/**
 * Popup copy for the current tab. Restricted pages get a specific reason
 * and are not clearable.
 */

import { resolveTabTarget } from "./clear-tab-cache.js";

/**
 * @typedef {{ clearable: true, origin: string, summary: string } | { clearable: false, summary: string, reason: string }} TabStatus
 */

/**
 * @param {import("./clear-tab-cache.js").TabLike | null | undefined} tab
 * @returns {TabStatus}
 */
export function describeTab(tab) {
  const target = resolveTabTarget(tab);
  if (target.ok) {
    return {
      clearable: true,
      origin: target.origin,
      summary: target.origin,
    };
  }

  return {
    clearable: false,
    summary: restrictionSummary(tab),
    reason: target.reason,
  };
}

/**
 * @param {import("./clear-tab-cache.js").TabLike | null | undefined} tab
 * @returns {string}
 */
function restrictionSummary(tab) {
  if (!tab || typeof tab !== "object") {
    return "No active tab.";
  }

  const urlString = firstUrl(tab.url, tab.pendingUrl);
  if (!urlString) {
    return "This page can't be cleared.";
  }
  if (urlString.toLowerCase().startsWith("view-source:")) {
    return "This page can't be cleared.";
  }

  let protocol = "";
  try {
    protocol = new URL(urlString).protocol;
  } catch {
    return "This address can't be cleared.";
  }

  if (protocol === "about:") {
    return "about: pages can't be cleared.";
  }
  if (protocol === "file:") {
    return "Local files can't be cleared.";
  }
  if (protocol === "chrome:" || protocol === "chrome-extension:" || protocol === "chrome-untrusted:") {
    return "Chrome pages can't be cleared.";
  }
  return "This page can't be cleared.";
}

/**
 * @param {...unknown} values
 * @returns {string}
 */
function firstUrl(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return "";
}
