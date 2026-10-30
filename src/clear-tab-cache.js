/**
 * Decide whether a tab has an http(s) origin, then clear only that origin.
 * Never call browsingData without an origin: omitting `origins` clears the
 * whole profile. Only cache-like types from the allowlist are sent.
 */

import { categoriesForTypes, toRemovalTypes } from "./settings.js";

const WEB_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * @typedef {object} TabLike
 * @property {string} [url]
 * @property {string} [pendingUrl]
 */

/**
 * @typedef {{ ok: true, origin: string } | { ok: false, reason: string }} TargetResult
 */

/**
 * @typedef {{
 *   ok: true,
 *   origin: string,
 *   categories: string[],
 *   types: Record<string, true>
 * } | { ok: false, reason: string }} ClearResult
 */

/**
 * @typedef {{ remove: (options: { origins: string[] }, types: Record<string, true>) => Promise<void> }} BrowsingDataClient
 */

/**
 * @param {TabLike | null | undefined} tab
 * @returns {TargetResult}
 */
export function resolveTabTarget(tab) {
  if (!tab || typeof tab !== "object") {
    return { ok: false, reason: "No active tab." };
  }

  const urlString = firstUrl(tab.url, tab.pendingUrl);
  if (!urlString) {
    return { ok: false, reason: "Can't clear cache for this page." };
  }

  let url;
  try {
    url = new URL(urlString);
  } catch {
    return { ok: false, reason: "Can't clear cache for this address." };
  }

  if (!WEB_PROTOCOLS.has(url.protocol) || url.origin === "null" || !url.hostname) {
    return { ok: false, reason: "Can't clear cache on this page." };
  }

  if (!isClearableOrigin(url.origin)) {
    return { ok: false, reason: "Can't clear cache for this address." };
  }

  return { ok: true, origin: url.origin };
}

/**
 * Clear the selected cache types for this tab's origin only.
 * When `selection` is omitted, only the HTTP cache is cleared.
 * @param {TabLike | null | undefined} tab
 * @param {BrowsingDataClient | null | undefined} browsingData
 * @param {unknown} [selection]
 * @returns {Promise<ClearResult>}
 */
export async function clearCacheForTab(tab, browsingData, selection) {
  const target = resolveTabTarget(tab);
  if (!target.ok) {
    return target;
  }

  if (!browsingData || typeof browsingData.remove !== "function") {
    return { ok: false, reason: "Cache clearing isn't available." };
  }

  const types = selection === undefined || selection === null
    ? { cache: true }
    : toRemovalTypes(selection);

  if (Object.keys(types).length === 0) {
    return { ok: false, reason: "Choose at least one cache type in Settings." };
  }

  const removalTypes = { ...types };
  try {
    await browsingData.remove({ origins: [target.origin] }, removalTypes);
  } catch (error) {
    return { ok: false, reason: formatClearError(error) };
  }

  return {
    ok: true,
    origin: target.origin,
    categories: categoriesForTypes(removalTypes),
    types: removalTypes,
  };
}

/**
 * @param {string} origin
 * @returns {boolean}
 */
function isClearableOrigin(origin) {
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  return WEB_PROTOCOLS.has(url.protocol) && url.origin === origin && url.hostname !== "";
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

/**
 * @param {unknown} error
 * @returns {string}
 */
function formatClearError(error) {
  let message = "";
  if (typeof error === "string") {
    message = error.trim();
  } else if (error instanceof Error) {
    message = error.message.trim();
  } else if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    message = error.message.trim();
  }

  if (!message || message.length > 140) {
    return "Couldn't clear the cache for this tab.";
  }
  return message;
}
