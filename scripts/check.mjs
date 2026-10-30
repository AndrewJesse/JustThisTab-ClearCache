import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(path.join(root, "manifest.json"), "utf8"));

assert(manifest.manifest_version === 3, "manifest_version must be 3");
assert(manifest.background?.service_worker === "background.js", "service worker path");
assert(manifest.background?.type === "module", "service worker must be a module");
assert(manifest.action?.default_popup === "index.html", "action must open the popup");
assert(!("host_permissions" in manifest), "host_permissions are not required");
assert(!("optional_host_permissions" in manifest), "optional host permissions are not required");
assert(
  manifest.content_security_policy?.extension_pages === "script-src 'self'; object-src 'self'",
  "extension pages must keep the default script CSP",
);

const permissions = [...manifest.permissions].sort();
assert(
  JSON.stringify(permissions) === JSON.stringify(["activeTab", "browsingData", "storage", "tabs"]),
  `permissions must be activeTab, browsingData, storage, and tabs, got ${permissions.join(", ")}`,
);

for (const size of ["16", "32", "48", "128"]) {
  const relative = manifest.icons?.[size];
  assert(relative === `icons/icon${size}.png`, `icons.${size} path`);
  const file = path.join(root, relative);
  assert(existsSync(file), `missing icon file ${relative}`);
  const image = decodePng(readFileSync(file));
  assert(image.width === Number(size) && image.height === Number(size), `${relative} dimensions`);
  assertIcon(image, relative);
}

const nextConfig = readFileSync(path.join(root, "next.config.mjs"), "utf8");
assert(nextConfig.includes('output: "export"') || nextConfig.includes("output: 'export'"), "Next must static-export");

const sourceFiles = [
  path.join(root, "background.js"),
  ...readdirSync(path.join(root, "src")).filter((name) => name.endsWith(".js")).map((name) => path.join(root, "src", name)),
  ...walk(path.join(root, "app")).filter((file) => file.endsWith(".js") || file.endsWith(".jsx")),
];

const forbidden = [
  /["']cookies["']\s*:/,
  /["']history["']\s*:/,
  /["']passwords["']\s*:/,
  /["']downloads["']\s*:/,
  /["']formData["']\s*:/,
  /["']indexedDB["']\s*:/,
  /["']localStorage["']\s*:/,
  /["']pluginData["']\s*:/,
  /removeCache\s*\(/,
  /removeCookies\s*\(/,
  /removeHistory\s*\(/,
  /host_permissions/,
];
const manifestText = readFileSync(path.join(root, "manifest.json"), "utf8");
assert(!manifestText.includes("<all_urls>"), "manifest must not grant every site");
assert(!manifestText.includes("*://*/*"), "manifest must not grant every site");

for (const file of sourceFiles) {
  const text = readFileSync(file, "utf8");
  for (const pattern of forbidden) {
    assert(!pattern.test(text), `${path.relative(root, file)} matches ${pattern}`);
  }
}

for (const file of [
  path.join(root, "background.js"),
  ...readdirSync(path.join(root, "src")).filter((name) => name.endsWith(".js")).map((name) => path.join(root, "src", name)),
  ...walk(path.join(root, "test")).filter((entry) => entry.endsWith(".js")),
  path.join(root, "scripts", "check.mjs"),
  path.join(root, "scripts", "assemble-extension.mjs"),
]) {
  const checked = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (checked.status !== 0) {
    throw new Error(checked.stderr || `${file} failed node --check`);
  }
}

const clearSource = readFileSync(path.join(root, "src", "clear-tab-cache.js"), "utf8");
assert(clearSource.includes("origins:"), "cache removal must pass origins");
const settingsSource = readFileSync(path.join(root, "src", "settings.js"), "utf8");
for (const id of ["cache", "cacheStorage", "fileSystems", "serviceWorkers"]) {
  assert(settingsSource.includes(`id: "${id}"`), `settings must offer ${id}`);
}

const popup = readFileSync(path.join(root, "app", "popup-app.jsx"), "utf8");
assert(popup.includes("Clear This Tab's Cache"), "popup must name the clear action");
assert(popup.includes(">Settings<"), "popup must name Settings");

const distPopup = path.join(root, "dist", "index.html");
if (existsSync(distPopup)) {
  const html = readFileSync(distPopup, "utf8");
  assert(!hasExecutableInlineScript(html), "dist/index.html still has an inline script");
  assert(html.includes("/assets/"), "popup scripts must load from /assets after the Chrome rename");
  assert(!html.includes("/_next/"), "popup must not reference /_next");
  assert(existsSync(path.join(root, "dist", "background.js")), "dist is missing the service worker");
  assert(existsSync(path.join(root, "dist", "manifest.json")), "dist is missing the manifest");
  assertNoReservedNames(path.join(root, "dist"));
}

console.log("manifest, icons, and scripts ok");

/**
 * @param {boolean} condition
 * @param {string} message
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * @param {string} directory
 */
function assertNoReservedNames(directory) {
  for (const entry of readdirSync(directory)) {
    assert(!entry.startsWith("_"), `Chrome cannot load ${entry}`);
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) {
      assertNoReservedNames(full);
    }
  }
}

/**
 * @param {string} directory
 * @returns {string[]}
 */
function walk(directory) {
  if (!existsSync(directory)) {
    return [];
  }
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

/**
 * @param {string} html
 * @returns {boolean}
 */
function hasExecutableInlineScript(html) {
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(match[1]) || !match[2].trim()) {
      continue;
    }
    const type = /\btype\s*=\s*["']([^"']*)["']/i.exec(match[1]);
    const value = type ? type[1].toLowerCase() : "";
    if (value === "" || value === "text/javascript" || value === "application/javascript" || value === "module") {
      return true;
    }
  }
  return false;
}

/**
 * @param {Buffer} buffer
 */
function decodePng(buffer) {
  assert(buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a", "PNG signature");
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  /** @type {Buffer[]} */
  const idat = [];
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  assert(bitDepth === 8 && interlace === 0, "PNG must be 8-bit and non-interlaced");
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : null;
  assert(channels, `unsupported PNG color type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = new Uint8Array(width * height * 4);
  let src = 0;
  let previous = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[src];
    src += 1;
    const row = raw.subarray(src, src + stride);
    src += stride;
    const recon = new Uint8Array(stride);
    for (let i = 0; i < stride; i += 1) {
      const left = i >= channels ? recon[i - channels] : 0;
      const up = previous[i];
      const upLeft = i >= channels ? previous[i - channels] : 0;
      recon[i] = unfilter(filter, row[i], left, up, upLeft);
    }
    for (let x = 0; x < width; x += 1) {
      const index = x * channels;
      const dest = (y * width + x) * 4;
      if (channels === 4) {
        pixels.set(recon.subarray(index, index + 4), dest);
      } else {
        pixels[dest] = recon[index];
        pixels[dest + 1] = recon[index + 1];
        pixels[dest + 2] = recon[index + 2];
        pixels[dest + 3] = 255;
      }
    }
    previous = recon;
  }
  return { width, height, pixels };
}

/**
 * @param {number} filter
 * @param {number} value
 * @param {number} left
 * @param {number} up
 * @param {number} upLeft
 */
function unfilter(filter, value, left, up, upLeft) {
  if (filter === 0) return value;
  if (filter === 1) return (value + left) & 255;
  if (filter === 2) return (value + up) & 255;
  if (filter === 3) return (value + Math.floor((left + up) / 2)) & 255;
  if (filter === 4) return (value + paeth(left, up, upLeft)) & 255;
  throw new Error(`bad PNG filter ${filter}`);
}

/**
 * @param {number} left
 * @param {number} up
 * @param {number} upLeft
 */
function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

/**
 * @param {{ width: number, height: number, pixels: Uint8Array }} image
 * @param {string} label
 */
function assertIcon(image, label) {
  const { width, pixels } = image;
  const corner = pixelAt(pixels, width, 0, 0);
  assert(corner[3] === 0, `${label} should have a transparent background`);
  let orange = 0;
  let grey = 0;
  let blue = 0;
  const count = image.width * image.height;
  for (let i = 0; i < count; i += 1) {
    const [r, g, b, a] = pixelAt(pixels, width, i % width, Math.floor(i / width));
    if (a < 200) continue;
    if (r > 200 && g > 70 && g < 200 && b < 100) orange += 1;
    if (Math.abs(r - g) < 18 && Math.abs(g - b) < 18 && r > 70 && r < 190) grey += 1;
    if (b > 150 && b > r + 40 && b > g + 40) blue += 1;
  }
  assert(orange > 0, `${label} needs an orange flame`);
  assert(grey > 0, `${label} needs a grey trash can`);
  assert(blue === 0, `${label} should not be a blue tile`);
}

/**
 * @param {Uint8Array} pixels
 * @param {number} width
 * @param {number} x
 * @param {number} y
 */
function pixelAt(pixels, width, x, y) {
  const index = (y * width + x) * 4;
  return [pixels[index], pixels[index + 1], pixels[index + 2], pixels[index + 3]];
}
