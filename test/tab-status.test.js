import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeTab } from "../src/tab-status.js";

describe("describeTab", () => {
  it("names a clearable origin", () => {
    assert.deepEqual(describeTab({ url: "https://example.com/path?q=1" }), {
      clearable: true,
      origin: "https://example.com",
      summary: "https://example.com",
    });
  });

  it("explains restricted pages without offering a clear", () => {
    assert.equal(describeTab({ url: "chrome://settings" }).summary, "Chrome pages can't be cleared.");
    assert.equal(describeTab({ url: "chrome://newtab" }).summary, "Chrome pages can't be cleared.");
    assert.equal(describeTab({ url: "chrome-extension://abc/popup.html" }).summary, "Chrome pages can't be cleared.");
    assert.equal(describeTab({ url: "about:blank" }).summary, "about: pages can't be cleared.");
    assert.equal(describeTab({ url: "file:///tmp/page.html" }).summary, "Local files can't be cleared.");
    assert.equal(describeTab({ url: "data:text/html,hi" }).summary, "This page can't be cleared.");
    assert.equal(describeTab({ url: "edge://settings" }).summary, "This page can't be cleared.");
    assert.equal(describeTab(null).summary, "No active tab.");
    assert.equal(describeTab({}).summary, "This page can't be cleared.");

    for (const tab of [
      { url: "chrome://settings" },
      { url: "about:blank" },
      { url: "file:///tmp/page.html" },
      { url: "view-source:https://example.com/" },
    ]) {
      assert.equal(describeTab(tab).clearable, false);
    }
  });
});
