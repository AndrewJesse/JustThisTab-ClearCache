import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clearCacheForTab, resolveTabTarget } from "../src/clear-tab-cache.js";

/**
 * @param {{ remove?: (options: { origins: string[] }, types: Record<string, boolean>) => Promise<void> }} [impl]
 */
function fakeBrowsingData(impl) {
  /** @type {{ options: { origins: string[] }, types: Record<string, boolean> }[]} */
  const calls = [];
  return {
    calls,
    browsingData: {
      async remove(options, types) {
        calls.push({
          options: structuredClone(options),
          types: structuredClone(types),
        });
        if (impl && impl.remove) {
          await impl.remove(options, types);
        }
      },
    },
  };
}

describe("resolveTabTarget", () => {
  it("uses the committed page origin and drops the path, query, and hash", () => {
    const result = resolveTabTarget({
      url: "https://example.com:8443/docs/index.html?q=1#top",
    });
    assert.deepEqual(result, { ok: true, origin: "https://example.com:8443" });
  });

  it("keeps http ports that are not the default", () => {
    const result = resolveTabTarget({ url: "http://localhost:3000/app" });
    assert.deepEqual(result, { ok: true, origin: "http://localhost:3000" });
  });

  it("drops default ports and credentials", () => {
    assert.deepEqual(resolveTabTarget({ url: "https://user:secret@example.com/" }), {
      ok: true,
      origin: "https://example.com",
    });
    assert.deepEqual(resolveTabTarget({ url: "http://127.0.0.1/" }), {
      ok: true,
      origin: "http://127.0.0.1",
    });
  });

  it("prefers the committed URL over a pending navigation", () => {
    const result = resolveTabTarget({
      url: "https://current.example/page",
      pendingUrl: "https://next.example/other",
    });
    assert.deepEqual(result, { ok: true, origin: "https://current.example" });
  });

  it("uses pendingUrl when the tab has no committed URL yet", () => {
    const result = resolveTabTarget({ pendingUrl: "https://loading.example/path" });
    assert.deepEqual(result, { ok: true, origin: "https://loading.example" });
  });

  it("fails closed for restricted and non-web URLs", () => {
    const urls = [
      "chrome://settings",
      "chrome://newtab",
      "chrome-extension://abcdefghijklmnop/page.html",
      "chrome-untrusted://new-tab-page/newtab.html",
      "about:blank",
      "edge://settings",
      "devtools://devtools/bundled/inspector.html",
      "view-source:https://example.com/",
      "file:///tmp/page.html",
      "data:text/html,hi",
      "blob:https://example.com/8b0c1c3e-1c3e-4c3e-8c3e-1c3e1c3e1c3e",
      "javascript:void(0)",
    ];

    for (const url of urls) {
      const result = resolveTabTarget({ url });
      assert.equal(result.ok, false, url);
      assert.equal("origin" in result, false, url);
    }
  });

  it("fails when there is no tab or no readable address", () => {
    assert.deepEqual(resolveTabTarget(null), { ok: false, reason: "No active tab." });
    assert.deepEqual(resolveTabTarget(undefined), { ok: false, reason: "No active tab." });
    assert.equal(resolveTabTarget({}).ok, false);
    assert.equal(resolveTabTarget({ url: "" }).ok, false);
    assert.equal(resolveTabTarget({ url: "not a url" }).ok, false);
  });
});

describe("clearCacheForTab", () => {
  it("removes only the HTTP cache for that origin when settings are omitted", async () => {
    const { browsingData, calls } = fakeBrowsingData();
    const result = await clearCacheForTab(
      { url: "https://example.com/a?b=1#c" },
      browsingData,
    );

    assert.deepEqual(result, {
      ok: true,
      origin: "https://example.com",
      categories: ["HTTP cache"],
      types: { cache: true },
    });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].options, { origins: ["https://example.com"] });
    assert.deepEqual(Object.keys(calls[0].options), ["origins"]);
    assert.deepEqual(calls[0].types, { cache: true });
    assert.equal("measured" in result, false);
    assert.equal("files" in result, false);
  });

  it("sends only the enabled cache types and drops anything else", async () => {
    const { browsingData, calls } = fakeBrowsingData();
    const result = await clearCacheForTab(
      { url: "https://example.com/path" },
      browsingData,
      {
        cache: false,
        cacheStorage: true,
        fileSystems: true,
        serviceWorkers: false,
        cookies: true,
        history: true,
        passwords: true,
        localStorage: true,
        indexedDB: true,
      },
    );

    assert.equal(result.ok, true);
    assert.deepEqual(calls[0].options, { origins: ["https://example.com"] });
    assert.deepEqual(calls[0].types, { cacheStorage: true, fileSystems: true });
    assert.deepEqual(result.categories, ["Cache Storage", "File systems"]);
  });

  it("can clear every allowlisted cache type for one origin", async () => {
    const { browsingData, calls } = fakeBrowsingData();
    const result = await clearCacheForTab(
      { url: "https://example.com/" },
      browsingData,
      { cache: true, cacheStorage: true, fileSystems: true, serviceWorkers: true },
    );

    assert.deepEqual(result.types, {
      cache: true,
      cacheStorage: true,
      fileSystems: true,
      serviceWorkers: true,
    });
    assert.deepEqual(calls[0].types, result.types);
    assert.deepEqual(Object.keys(calls[0].options), ["origins"]);
  });

  it("does not call the API when every toggle is off", async () => {
    const { browsingData, calls } = fakeBrowsingData();
    const result = await clearCacheForTab(
      { url: "https://example.com/" },
      browsingData,
      { cache: false, cacheStorage: false, fileSystems: false, serviceWorkers: false },
    );

    assert.deepEqual(result, {
      ok: false,
      reason: "Choose at least one cache type in Settings.",
    });
    assert.equal(calls.length, 0);
  });

  it("does not reuse a data-type object a caller could mutate", async () => {
    const { browsingData, calls } = fakeBrowsingData({
      async remove(_options, types) {
        Object.assign(types, { cache: false, cookies: true });
      },
    });

    await clearCacheForTab({ url: "https://one.example/" }, browsingData);
    await clearCacheForTab({ url: "https://two.example/" }, browsingData);

    assert.deepEqual(calls[1].types, { cache: true });
    assert.deepEqual(calls[1].options.origins, ["https://two.example"]);
    assert.equal("cookies" in calls[1].types, false);
  });

  it("does not call browsingData for restricted pages, missing tabs, or empty URLs", async () => {
    const { browsingData, calls } = fakeBrowsingData();
    const cases = [
      undefined,
      null,
      {},
      { url: "" },
      { url: "chrome://newtab" },
      { url: "about:blank" },
      { url: "file:///tmp/a.html" },
      { url: "chrome-extension://abc/popup.html" },
    ];

    for (const tab of cases) {
      const result = await clearCacheForTab(tab, browsingData);
      assert.equal(result.ok, false);
    }
    assert.equal(calls.length, 0);
  });

  it("reports an API failure and still does not widen the clear", async () => {
    const { browsingData, calls } = fakeBrowsingData({
      async remove() {
        throw new Error("Invalid origin: nope");
      },
    });

    const result = await clearCacheForTab({ url: "https://example.com/" }, browsingData);
    assert.deepEqual(result, { ok: false, reason: "Invalid origin: nope" });
    assert.deepEqual(calls[0].types, { cache: true });
    assert.deepEqual(calls[0].options.origins, ["https://example.com"]);
  });

  it("replaces a huge API error with a short failure", async () => {
    const { browsingData } = fakeBrowsingData({
      async remove() {
        throw new Error("x".repeat(200));
      },
    });
    const result = await clearCacheForTab({ url: "https://example.com/" }, browsingData);
    assert.deepEqual(result, {
      ok: false,
      reason: "Couldn't clear the cache for this tab.",
    });
  });

  it("fails when the browsingData API is missing", async () => {
    const result = await clearCacheForTab({ url: "https://example.com/" }, undefined);
    assert.deepEqual(result, { ok: false, reason: "Cache clearing isn't available." });
  });
});
