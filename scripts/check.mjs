import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const manifestPath = path.join(root, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

assert(manifest.manifest_version === 3, "manifest_version must be 3");
assert(manifest.background?.service_worker === "background.js", "service worker path");
assert(manifest.background?.type === "module", "service worker must be a module");
assert(manifest.action?.default_popup === undefined, "action click must not open a popup");
assert(!("host_permissions" in manifest), "host_permissions are not required");
assert(!("optional_host_permissions" in manifest), "optional host permissions are not required");

const permissions = [...manifest.permissions].sort();
assert(
  JSON.stringify(permissions) === JSON.stringify(["activeTab", "browsingData"]),
  `permissions must be activeTab and browsingData, got ${permissions.join(", ")}`,
);

for (const size of ["16", "32", "48", "128"]) {
  const relative = manifest.icons?.[size];
  assert(relative, `missing icons.${size}`);
  const file = path.join(root, relative);
  assert(existsSync(file), `missing icon file ${relative}`);
  const bytes = readFileSync(file);
  assert(bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a", `${relative} is not a PNG`);
  assert(bytes.length > 50, `${relative} looks empty`);
}

const sourceFiles = [
  path.join(root, "background.js"),
  path.join(root, "src", "clear-tab-cache.js"),
];
const forbidden = [
  /["']cookies["']\s*:/,
  /["']history["']\s*:/,
  /["']cacheStorage["']\s*:/,
  /["']localStorage["']\s*:/,
  /["']serviceWorkers["']\s*:/,
  /removeCache\s*\(/,
  /removeCookies\s*\(/,
  /host_permissions/,
  /<all_urls>/,
];

for (const file of sourceFiles) {
  const text = readFileSync(file, "utf8");
  for (const pattern of forbidden) {
    assert(!pattern.test(text), `${path.relative(root, file)} matches ${pattern}`);
  }
}

for (const file of [
  ...sourceFiles,
  path.join(root, "test", "clear-tab-cache.test.js"),
  path.join(root, "scripts", "check.mjs"),
]) {
  const checked = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (checked.status !== 0) {
    throw new Error(checked.stderr || `${file} failed node --check`);
  }
}

const clearSource = readFileSync(path.join(root, "src", "clear-tab-cache.js"), "utf8");
assert(clearSource.includes("cache: true"), "cache removal must request the cache data type");
assert(clearSource.includes("origins:"), "cache removal must pass origins");

console.log("manifest and scripts ok");

/**
 * @param {boolean} condition
 * @param {string} message
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
