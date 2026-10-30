/**
 * Decide whether a tab has an http(s) origin, then clear only that origin's
 * HTTP cache. Never call browsingData without an origin: omitting `origins`
 * clears the whole profile.
 */

const WEB_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * @typedef {object} TabLike
 * @property {string} [url]
 * @property {string} [pendingUrl]
 */

/**
 * @typedef {{ ok: true, origin: string } | { ok: false, reason: string }} ClearResult
 */

/**
 * @typedef {{ remove: (options: { origins: [string] }, types: { cache: true }) => Promise<void> }} BrowsingDataClient
 */

/**
 * @param {TabLike | null | undefined} tab
 * @returns {ClearResult}
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
 * @param {TabLike | null | undefined} tab
 * @param {BrowsingDataClient | null | undefined} browsingData
 * @returns {Promise<ClearResult>}
 */
export async function clearCacheForTab(tab, browsingData) {
  const target = resolveTabTarget(tab);
  if (!target.ok) {
    return target;
  }

  if (!browsingData || typeof browsingData.remove !== "function") {
    return { ok: false, reason: "Cache clearing isn't available." };
  }

  try {
    await browsingData.remove({ origins: [target.origin] }, { cache: true });
  } catch (error) {
    return { ok: false, reason: formatClearError(error) };
  }

  return { ok: true, origin: target.origin };
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
