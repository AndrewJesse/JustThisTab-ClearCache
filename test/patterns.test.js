import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { originMatches, parseAutoClearInput } from "../src/patterns.js";

describe("parseAutoClearInput", () => {
  it("canonicalizes exact origins and strips path, query, hash, and userinfo", () => {
    assert.equal(parseAutoClearInput("https://example.com").pattern, "https://example.com");
    assert.equal(parseAutoClearInput("https://example.com/").pattern, "https://example.com");
    assert.equal(parseAutoClearInput("https://example.com/docs?q=1#top").pattern, "https://example.com");
    assert.equal(parseAutoClearInput("https://User:Secret@Example.COM/a").pattern, "https://example.com");
    assert.equal(parseAutoClearInput("https://example.com:443").pattern, "https://example.com");
    assert.equal(parseAutoClearInput("http://example.com:80").pattern, "http://example.com");
    assert.equal(parseAutoClearInput("http://localhost:3000").pattern, "http://localhost:3000");
    assert.equal(parseAutoClearInput("  https://example.com  ").pattern, "https://example.com");
  });

  it("treats a bare host as both schemes on the default port", () => {
    assert.equal(parseAutoClearInput("example.com").pattern, "*://example.com");
    assert.equal(parseAutoClearInput("*.example.com").pattern, "*://*.example.com");
    assert.equal(parseAutoClearInput("https://*.example.com").pattern, "https://*.example.com");
    assert.equal(parseAutoClearInput("https://*.example.com/path").pattern, "https://*.example.com");
  });

  it("keeps non-default ports and IPv6 hosts", () => {
    assert.equal(parseAutoClearInput("https://example.com:8443").pattern, "https://example.com:8443");
    assert.equal(parseAutoClearInput("http://127.0.0.1:8080").pattern, "http://127.0.0.1:8080");
    assert.equal(parseAutoClearInput("https://[::1]:8080").pattern, "https://[::1]:8080");
  });

  it("rejects every-site patterns and non-web URLs", () => {
    for (const input of ["", "   ", "*", "<all_urls>", "*://*", "*://*/*", "https://*", "*.com", "*.co.uk", "chrome://settings", "file:///tmp/a.html", "about:blank", "javascript:alert(1)", "ftp://example.com", "https://", "not a host", "https://example.com:99999"]) {
      const result = parseAutoClearInput(input);
      assert.equal(result.ok, false, input);
    }
  });
});

describe("originMatches", () => {
  it("matches an exact origin and not its neighbors", () => {
    const pattern = "https://example.com";
    assert.equal(originMatches("https://example.com", pattern), true);
    assert.equal(originMatches("https://example.com:443", pattern), true);
    assert.equal(originMatches("http://example.com", pattern), false);
    assert.equal(originMatches("https://www.example.com", pattern), false);
    assert.equal(originMatches("https://example.com:8443", pattern), false);
    assert.equal(originMatches("https://example.org", pattern), false);
    assert.equal(originMatches("https://notexample.com", pattern), false);
  });

  it("lets a bare host match both default-port schemes", () => {
    assert.equal(originMatches("https://example.com", "*://example.com"), true);
    assert.equal(originMatches("http://example.com", "*://example.com"), true);
    assert.equal(originMatches("https://example.com:8443", "*://example.com"), false);
    assert.equal(originMatches("http://localhost:3000", "http://localhost:3000"), true);
    assert.equal(originMatches("http://localhost", "http://localhost:3000"), false);
  });

  it("matches a site and its subdomains without matching lookalikes", () => {
    const pattern = "https://*.example.com";
    assert.equal(originMatches("https://example.com", pattern), true);
    assert.equal(originMatches("https://www.example.com", pattern), true);
    assert.equal(originMatches("https://a.b.example.com", pattern), true);
    assert.equal(originMatches("http://www.example.com", pattern), false);
    assert.equal(originMatches("https://example.com.evil.com", pattern), false);
    assert.equal(originMatches("https://notexample.com", pattern), false);
    assert.equal(originMatches("https://example.org", pattern), false);
  });
});
