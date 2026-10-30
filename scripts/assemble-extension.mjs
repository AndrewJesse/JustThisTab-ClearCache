import { cp, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "out");
const dist = path.join(root, "dist");

const runtimeModules = [
  "auto-clear.js",
  "clear-tab-cache.js",
  "patterns.js",
  "result.js",
  "settings.js",
  "tab-status.js",
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(outDir, dist, { recursive: true });
await cp(path.join(root, "background.js"), path.join(dist, "background.js"));
await mkdir(path.join(dist, "src"), { recursive: true });
for (const name of runtimeModules) {
  await cp(path.join(root, "src", name), path.join(dist, "src", name));
}
await cp(path.join(root, "icons"), path.join(dist, "icons"), { recursive: true });

const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
manifest.action.default_popup = "index.html";
await writeFile(path.join(dist, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const htmlFiles = await findHtml(dist);
for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const slug = path.relative(dist, file).replace(/\.html$/, "").replace(/[^\w.-]+/g, "-");
  const rewritten = await externalizeInlineScripts(html, path.dirname(file), slug);
  await writeFile(file, rewritten);
  assertExtensionHtml(rewritten, path.relative(dist, file));
}

const popup = path.join(dist, "index.html");
if (!htmlFiles.includes(popup)) {
  throw new Error("Next export did not produce dist/index.html");
}

await makeChromeLoadable(dist);
console.log(`extension package ready at ${dist}`);

/**
 * Chrome extension pages cannot run inline scripts. Next's static export
 * bootstraps with inline payloads; move those into files under csp/.
 * JSON scripts are left inline because the page does not execute them.
 * @param {string} html
 * @param {string} directory
 * @param {string} slug
 * @returns {Promise<string>}
 */
async function externalizeInlineScripts(html, directory, slug) {
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  const matches = [...html.matchAll(pattern)];
  let index = 0;
  let rewritten = html;
  for (const match of matches) {
    const [full, attrs, body] = match;
    if (!isExecutableScript(attrs) || !body.trim()) {
      continue;
    }
    const filename = `${slug}-inline-${index}.js`;
    index += 1;
    const relative = `csp/${filename}`;
    await mkdir(path.join(directory, "csp"), { recursive: true });
    await writeFile(path.join(directory, relative), body);
    const typeAttr = scriptType(attrs) === "module" ? ' type="module"' : "";
    rewritten = rewritten.replace(full, `<script src="${relative}"${typeAttr}></script>`);
  }
  return rewritten;
}

/**
 * @param {string} attrs
 * @returns {boolean}
 */
function isExecutableScript(attrs) {
  if (/\bsrc\s*=/.test(attrs)) {
    return false;
  }
  const type = scriptType(attrs);
  return type === "" || type === "text/javascript" || type === "application/javascript" || type === "module";
}

/**
 * @param {string} attrs
 * @returns {string}
 */
function scriptType(attrs) {
  const match = /\btype\s*=\s*["']([^"']*)["']/i.exec(attrs);
  return match ? match[1].toLowerCase() : "";
}

/**
 * @param {string} html
 * @param {string} label
 */
function assertExtensionHtml(html, label) {
  const executable = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(executable)) {
    if (isExecutableScript(match[1]) && match[2].trim()) {
      throw new Error(`${label} still has an inline script`);
    }
  }
  if (/\son[a-z]+\s*=/i.test(html)) {
    throw new Error(`${label} has an inline event handler`);
  }
}

/**
 * Chrome refuses extension files and directories whose names start with "_".
 * Next writes `_next` and a few `_not-found` payloads, so the loadable
 * package renames the asset directory and drops those reserved names.
 * @param {string} directory
 */
async function makeChromeLoadable(directory) {
  const nextDir = path.join(directory, "_next");
  const assetsDir = path.join(directory, "assets");
  await rename(nextDir, assetsDir);
  await rewriteAssetPaths(directory);
  await removeReservedNames(directory);
  await assertNoReservedNames(directory);
}

/**
 * @param {string} directory
 */
async function rewriteAssetPaths(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await rewriteAssetPaths(full);
      continue;
    }
    if (!/\.(html|js|css|txt|json|map)$/.test(entry.name)) {
      continue;
    }
    const text = await readFile(full, "utf8");
    const rewritten = text.replaceAll("/_next/", "/assets/");
    if (rewritten !== text) {
      await writeFile(full, rewritten);
    }
  }
}

/**
 * @param {string} directory
 */
async function removeReservedNames(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.name.startsWith("_")) {
      await rm(full, { recursive: true, force: true });
      continue;
    }
    if (entry.isDirectory()) {
      await removeReservedNames(full);
    }
  }
}

/**
 * @param {string} directory
 */
async function assertNoReservedNames(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith("_")) {
      throw new Error(`Chrome cannot load a file named ${entry.name}`);
    }
    if (entry.isDirectory()) {
      await assertNoReservedNames(path.join(directory, entry.name));
    }
  }
}

/**
 * @param {string} directory
 * @returns {Promise<string[]>}
 */
async function findHtml(directory) {
  /** @type {string[]} */
  const found = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...await findHtml(full));
    } else if (entry.name.endsWith(".html")) {
      found.push(full);
    }
  }
  return found;
}
