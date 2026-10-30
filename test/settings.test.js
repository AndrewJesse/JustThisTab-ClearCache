import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CACHE_CATEGORIES,
  addAutoClearEntry,
  defaultSettings,
  loadSettings,
  normalizeSettings,
  removeAutoClearEntry,
  saveSettings,
  toRemovalTypes,
} from "../src/settings.js";

function memoryArea() {
  /** @type {Record<string, unknown>} */
  const store = {};
  return {
    store,
    async get(key) {
      if (!Object.prototype.hasOwnProperty.call(store, key)) {
        return {};
      }
      return { [key]: store[key] };
    },
    async set(values) {
      Object.assign(store, values);
    },
  };
}

describe("settings", () => {
  it("defaults to HTTP cache on and the other cache types off", () => {
    const settings = defaultSettings();
    assert.deepEqual(settings.types, {
      cache: true,
      cacheStorage: false,
      fileSystems: false,
      serviceWorkers: false,
    });
    assert.deepEqual(settings.autoClear, []);
    assert.deepEqual(CACHE_CATEGORIES.map((category) => category.id), [
      "cache",
      "cacheStorage",
      "fileSystems",
      "serviceWorkers",
    ]);
  });

  it("drops non-cache types and invalid patterns from saved settings", () => {
    const settings = normalizeSettings({
      types: {
        cache: false,
        cacheStorage: true,
        cookies: true,
        history: true,
        passwords: true,
        localStorage: true,
        indexedDB: true,
      },
      autoClear: [
        "https://example.com/path",
        "https://example.com/other",
        "ftp://files.example",
        "<all_urls>",
        "https://ok.example:8443",
      ],
    });

    assert.deepEqual(settings.types, {
      cache: false,
      cacheStorage: true,
      fileSystems: false,
      serviceWorkers: false,
    });
    assert.deepEqual(settings.autoClear, [
      "https://example.com",
      "https://ok.example:8443",
    ]);
    assert.deepEqual(toRemovalTypes(settings.types), { cacheStorage: true });
    assert.equal("cookies" in toRemovalTypes(settings.types), false);
  });

  it("adds and removes canonical origins", () => {
    const added = addAutoClearEntry(defaultSettings(), "HTTPS://Example.com/docs");
    assert.equal(added.ok, true);
    if (!added.ok) {
      return;
    }
    assert.deepEqual(added.settings.autoClear, ["https://example.com"]);
    const duplicate = addAutoClearEntry(added.settings, "https://example.com/");
    assert.deepEqual(duplicate, { ok: false, reason: "That origin is already on the list." });
    const removed = removeAutoClearEntry(added.settings, "https://example.com");
    assert.deepEqual(removed.autoClear, []);
  });

  it("prefers the newer copy when sync and local disagree", async () => {
    const sync = memoryArea();
    const local = memoryArea();
    const storage = { sync, local };

    await saveSettings(storage, defaultSettings());
    local.store.settings = {
      .../** @type {Record<string, unknown>} */ (local.store.settings),
      updatedAt: Date.now() + 10_000,
      types: {
        cache: true,
        cacheStorage: true,
        fileSystems: false,
        serviceWorkers: false,
      },
    };

    const loaded = await loadSettings(storage);
    assert.equal(loaded.types.cacheStorage, true);

    sync.store.settings = {
      .../** @type {Record<string, unknown>} */ (sync.store.settings),
      updatedAt: Date.now() + 20_000,
      autoClear: ["https://from-sync.example"],
    };
    const fromSync = await loadSettings(storage);
    assert.deepEqual(fromSync.autoClear, ["https://from-sync.example"]);
  });

  it("falls back to local when sync throws", async () => {
    const local = memoryArea();
    const storage = {
      sync: {
        async get() {
          throw new Error("sync unavailable");
        },
        async set() {
          throw new Error("sync unavailable");
        },
      },
      local,
    };

    const saved = await saveSettings(storage, {
      ...defaultSettings(),
      autoClear: ["http://localhost:3000"],
    });
    assert.deepEqual(saved.autoClear, ["http://localhost:3000"]);
    const loaded = await loadSettings(storage);
    assert.deepEqual(loaded.autoClear, ["http://localhost:3000"]);
    assert.equal(loaded.types.cache, true);
  });
});
