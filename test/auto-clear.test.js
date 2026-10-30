import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planAutoClear } from "../src/auto-clear.js";
import { clearCacheForTab } from "../src/clear-tab-cache.js";
import { defaultSettings } from "../src/settings.js";

function settingsWith(autoClear, types = {}) {
  return {
    ...defaultSettings(),
    types: { ...defaultSettings().types, ...types },
    autoClear,
  };
}

describe("planAutoClear", () => {
  it("clears only the finished tab's origin when a pattern matches", () => {
    const plan = planAutoClear(
      { url: "https://www.example.com/docs?q=1" },
      settingsWith(["https://*.example.com"]),
    );

    assert.deepEqual(plan, {
      clear: true,
      origin: "https://www.example.com",
      types: { cache: true },
    });
  });

  it("does not clear a different origin", () => {
    const plan = planAutoClear(
      { url: "https://other.example/page" },
      settingsWith(["https://example.com", "https://*.example.com"]),
    );
    assert.deepEqual(plan, { clear: false, origin: "https://other.example" });
  });

  it("does not clear restricted pages", () => {
    for (const url of ["chrome://settings", "about:blank", "file:///tmp/a.html"]) {
      const plan = planAutoClear({ url }, settingsWith(["*://*"]));
      assert.equal(plan.clear, false, url);
    }
  });

  it("does not clear when every cache toggle is off", () => {
    const plan = planAutoClear(
      { url: "https://example.com/" },
      settingsWith(["https://example.com"], {
        cache: false,
        cacheStorage: false,
        fileSystems: false,
        serviceWorkers: false,
      }),
    );
    assert.equal(plan.clear, false);
    assert.equal(plan.reason, "Choose at least one cache type in Settings.");
  });

  it("uses the enabled toggles and still passes only that origin", async () => {
    const settings = settingsWith(["http://localhost:3000"], {
      cache: false,
      cacheStorage: true,
      serviceWorkers: true,
    });
    const tab = { url: "http://localhost:3000/app" };
    const plan = planAutoClear(tab, settings);
    assert.equal(plan.clear, true);
    if (!plan.clear) {
      return;
    }

    /** @type {{ options: { origins: string[] }, types: Record<string, boolean> }[]} */
    const calls = [];
    const result = await clearCacheForTab(tab, {
      async remove(options, types) {
        calls.push({ options: structuredClone(options), types: structuredClone(types) });
      },
    }, plan.types);

    assert.equal(result.ok, true);
    assert.deepEqual(calls[0].options, { origins: ["http://localhost:3000"] });
    assert.deepEqual(calls[0].types, { cacheStorage: true, serviceWorkers: true });
    assert.equal(calls[0].options.origins.length, 1);
  });
});
