/**
 * Cache categories the user can clear, and the saved auto-clear list.
 *
 * These are the chrome.browsingData types that both mean "cache-like" and
 * still delete data for one origin on current Chrome:
 * cache, cacheStorage, fileSystems, serviceWorkers.
 *
 * appcache and webSQL are still accepted by the API and then ignored
 * (removed in Chrome 152), so they are not toggles. Cookies, history,
 * passwords, localStorage, and IndexedDB are not cache and are never sent.
 */

import { parseAutoClearInput } from "./patterns.js";

export const STORAGE_KEY = "settings";
export const MAX_AUTO_CLEAR = 40;

export const CACHE_CATEGORIES = [
  {
    id: "cache",
    label: "HTTP cache",
    description: "The browser HTTP cache for this site.",
    defaultEnabled: true,
  },
  {
    id: "cacheStorage",
    label: "Cache Storage",
    description: "Cache Storage API entries for this site.",
    defaultEnabled: false,
  },
  {
    id: "fileSystems",
    label: "File systems",
    description: "This site's sandbox file system (File System API).",
    defaultEnabled: false,
  },
  {
    id: "serviceWorkers",
    label: "Service workers",
    description: "Service worker registrations for this site.",
    defaultEnabled: false,
  },
];

/**
 * @typedef {{ version: 1, updatedAt: number, types: Record<string, boolean>, autoClear: string[] }} Settings
 */

/**
 * @returns {Settings}
 */
export function defaultSettings() {
  return {
    version: 1,
    updatedAt: 0,
    types: Object.fromEntries(CACHE_CATEGORIES.map((category) => [category.id, category.defaultEnabled])),
    autoClear: [],
  };
}

/**
 * @param {unknown} input
 * @returns {Settings}
 */
export function normalizeSettings(input) {
  const defaults = defaultSettings();
  const source = input && typeof input === "object" ? /** @type {Record<string, unknown>} */ (input) : {};
  const types = { ...defaults.types };
  const rawTypes = source.types && typeof source.types === "object"
    ? /** @type {Record<string, unknown>} */ (source.types)
    : {};

  for (const category of CACHE_CATEGORIES) {
    if (typeof rawTypes[category.id] === "boolean") {
      types[category.id] = rawTypes[category.id];
    }
  }

  /** @type {string[]} */
  const autoClear = [];
  const seen = new Set();
  const list = Array.isArray(source.autoClear) ? source.autoClear : [];
  for (const entry of list) {
    if (autoClear.length >= MAX_AUTO_CLEAR) {
      break;
    }
    if (typeof entry !== "string") {
      continue;
    }
    const parsed = parseAutoClearInput(entry);
    if (!parsed.ok || seen.has(parsed.pattern)) {
      continue;
    }
    seen.add(parsed.pattern);
    autoClear.push(parsed.pattern);
  }

  const updatedAt = typeof source.updatedAt === "number" && Number.isFinite(source.updatedAt)
    ? source.updatedAt
    : 0;

  return {
    version: 1,
    updatedAt,
    types,
    autoClear,
  };
}

/**
 * Only the enabled allowlisted types. False and unknown keys are omitted so
 * the browsingData call cannot be widened by saved or injected fields.
 * @param {unknown} selection
 * @returns {Record<string, true>}
 */
export function toRemovalTypes(selection) {
  const source = selection && typeof selection === "object"
    ? /** @type {Record<string, unknown>} */ (selection)
    : {};
  /** @type {Record<string, true>} */
  const types = {};
  for (const category of CACHE_CATEGORIES) {
    if (source[category.id] === true) {
      types[category.id] = true;
    }
  }
  return types;
}

/**
 * @param {Record<string, boolean>} types
 * @returns {string[]}
 */
export function categoriesForTypes(types) {
  return CACHE_CATEGORIES.filter((category) => types[category.id] === true).map((category) => category.label);
}

/**
 * @param {Settings} settings
 * @param {unknown} raw
 * @returns {{ ok: true, settings: Settings, pattern: string } | { ok: false, reason: string }}
 */
export function addAutoClearEntry(settings, raw) {
  const parsed = parseAutoClearInput(raw);
  if (!parsed.ok) {
    return parsed;
  }
  const current = normalizeSettings(settings);
  if (current.autoClear.includes(parsed.pattern)) {
    return { ok: false, reason: "That origin is already on the list." };
  }
  if (current.autoClear.length >= MAX_AUTO_CLEAR) {
    return { ok: false, reason: `The auto-clear list is full (${MAX_AUTO_CLEAR}).` };
  }
  return {
    ok: true,
    pattern: parsed.pattern,
    settings: {
      ...current,
      autoClear: [...current.autoClear, parsed.pattern],
    },
  };
}

/**
 * @param {Settings} settings
 * @param {string} pattern
 * @returns {Settings}
 */
export function removeAutoClearEntry(settings, pattern) {
  const current = normalizeSettings(settings);
  return {
    ...current,
    autoClear: current.autoClear.filter((entry) => entry !== pattern),
  };
}

/**
 * @param {unknown} storage
 * @returns {Promise<Settings>}
 */
export async function loadSettings(storage) {
  const areas = storage && typeof storage === "object"
    ? /** @type {{ sync?: { get?: Function }, local?: { get?: Function } }} */ (storage)
    : {};
  const syncSettings = await readArea(areas.sync);
  const localSettings = await readArea(areas.local);
  if (!syncSettings && !localSettings) {
    return defaultSettings();
  }
  if (!syncSettings) {
    return localSettings;
  }
  if (!localSettings) {
    return syncSettings;
  }
  return localSettings.updatedAt > syncSettings.updatedAt ? localSettings : syncSettings;
}

/**
 * Writes sync and local. Local is the fallback when sync is unavailable.
 * @param {unknown} storage
 * @param {unknown} settings
 * @returns {Promise<Settings>}
 */
export async function saveSettings(storage, settings) {
  const normalized = normalizeSettings(settings);
  normalized.updatedAt = Date.now();
  const payload = { [STORAGE_KEY]: normalized };
  const areas = storage && typeof storage === "object"
    ? /** @type {{ sync?: { set?: Function }, local?: { set?: Function } }} */ (storage)
    : {};

  let syncError = null;
  if (areas.sync && typeof areas.sync.set === "function") {
    try {
      await areas.sync.set(payload);
    } catch (error) {
      syncError = error;
    }
  }

  if (areas.local && typeof areas.local.set === "function") {
    await areas.local.set(payload);
  } else if (syncError) {
    throw syncError;
  }

  return normalized;
}

/**
 * @param {{ get?: Function } | undefined} area
 * @returns {Promise<Settings | null>}
 */
async function readArea(area) {
  if (!area || typeof area.get !== "function") {
    return null;
  }
  try {
    const data = await area.get(STORAGE_KEY);
    if (!data || typeof data !== "object" || !Object.prototype.hasOwnProperty.call(data, STORAGE_KEY)) {
      return null;
    }
    return normalizeSettings(/** @type {Record<string, unknown>} */ (data)[STORAGE_KEY]);
  } catch {
    return null;
  }
}
