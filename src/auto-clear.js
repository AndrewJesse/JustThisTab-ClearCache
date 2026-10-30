/**
 * Decide whether a finished navigation should clear that tab's origin.
 * The pattern only decides yes or no. The removal always uses the tab origin.
 */

import { resolveTabTarget } from "./clear-tab-cache.js";
import { originMatches } from "./patterns.js";
import { normalizeSettings, toRemovalTypes } from "./settings.js";

/**
 * @typedef {{ clear: true, origin: string, types: Record<string, true> } | { clear: false, origin?: string, reason?: string }} AutoClearPlan
 */

/**
 * @param {import("./clear-tab-cache.js").TabLike | null | undefined} tab
 * @param {unknown} settings
 * @returns {AutoClearPlan}
 */
export function planAutoClear(tab, settings) {
  const target = resolveTabTarget(tab);
  if (!target.ok) {
    return { clear: false, reason: target.reason };
  }

  const normalized = normalizeSettings(settings);
  const matched = normalized.autoClear.some((pattern) => originMatches(target.origin, pattern));
  if (!matched) {
    return { clear: false, origin: target.origin };
  }

  const types = toRemovalTypes(normalized.types);
  if (Object.keys(types).length === 0) {
    return {
      clear: false,
      origin: target.origin,
      reason: "Choose at least one cache type in Settings.",
    };
  }

  return { clear: true, origin: target.origin, types };
}
