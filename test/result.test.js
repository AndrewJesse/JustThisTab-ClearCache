import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clearCacheForTab } from "../src/clear-tab-cache.js";
import { loadLastResult, resultFromClear, resultLines, saveLastResult } from "../src/result.js";

describe("result lines", () => {
  it("does not invent file counts for a real clear", async () => {
    const cleared = await clearCacheForTab(
      { url: "https://example.com/docs" },
      { async remove() {} },
      { cache: true, cacheStorage: true },
    );
    const view = resultFromClear(cleared);
    const lines = resultLines(view);

    assert.equal(view.ok, true);
    assert.equal("measured" in view, false);
    assert.equal(lines.kind, "success");
    assert.equal(lines.title, "Cache cleared");
    assert.equal(lines.origin, "https://example.com");
    assert.equal(lines.categories, "HTTP cache, Cache Storage");
    assert.equal(lines.estimated, false);
    assert.equal(JSON.stringify(view).includes("files"), false);
  });

  it("shows measured numbers only when they were actually provided", () => {
    const honest = resultLines(resultFromClear({
      ok: true,
      origin: "https://example.com",
      categories: ["HTTP cache"],
      measured: { files: "lots", bytes: -1, fileTypes: 1.5 },
    }));
    assert.equal(honest.title, "Cache cleared");
    assert.equal(honest.estimated, false);

    const measured = resultLines(resultFromClear({
      ok: true,
      origin: "https://example.com",
      categories: ["Cache Storage"],
      measured: { files: 4, bytes: 2048, fileTypes: 2, estimated: false },
    }));
    assert.equal(measured.title, "4 files · 2.0 KB · 2 file types");
    assert.equal(measured.estimated, false);

    const estimate = resultLines(resultFromClear({
      ok: true,
      origin: "https://example.com",
      categories: ["HTTP cache"],
      measured: { files: 3, bytes: 512, fileTypes: 1, estimated: true },
    }));
    assert.equal(estimate.title, "Estimate: 3 files · 512 B · 1 file type");
    assert.equal(estimate.estimated, true);
  });

  it("keeps an empty state and a failure distinct from a success", () => {
    const empty = resultLines(null);
    assert.equal(empty.kind, "empty");
    assert.equal("text" in empty, false);
    const failure = resultLines(resultFromClear({ ok: false, reason: "Chrome pages can't be cleared." }));
    assert.deepEqual(failure, {
      kind: "error",
      title: "Not cleared",
      detail: "Chrome pages can't be cleared.",
    });
  });

  it("round-trips the last result through session storage", async () => {
    /** @type {Record<string, unknown>} */
    const store = {};
    const storage = {
      session: {
        async get(key) {
          return store[key] === undefined ? {} : { [key]: store[key] };
        },
        async set(values) {
          Object.assign(store, values);
        },
      },
    };

    const view = resultFromClear({
      ok: true,
      origin: "https://example.com",
      categories: ["HTTP cache"],
    });
    await saveLastResult(storage, view);
    const loaded = await loadLastResult(storage);
    assert.deepEqual(loaded, view);
  });
});
