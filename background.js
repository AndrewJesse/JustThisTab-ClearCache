import { planAutoClear } from "./src/auto-clear.js";
import { clearCacheForTab } from "./src/clear-tab-cache.js";
import { resultFromClear, saveLastResult } from "./src/result.js";
import { loadSettings } from "./src/settings.js";

const recentClears = new Map();

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") {
    return;
  }
  void autoClearFinishedTab(tab);
});

/**
 * A full load or refresh of a matching tab clears that tab's origin only.
 * @param {chrome.tabs.Tab} tab
 */
async function autoClearFinishedTab(tab) {
  try {
    const settings = await loadSettings(chrome.storage);
    const plan = planAutoClear(tab, settings);
    if (!plan.clear) {
      return;
    }
    if (clearedMomentsAgo(tab.id, plan.origin)) {
      return;
    }
    const cleared = await clearCacheForTab(tab, chrome.browsingData, plan.types);
    await saveLastResult(chrome.storage, resultFromClear(cleared));
  } catch {
    // The browser may be shutting the worker down mid-call.
  }
}

/**
 * Collapse duplicate "complete" events from one navigation.
 * A real refresh a moment later still clears.
 * @param {number | undefined} tabId
 * @param {string} origin
 * @returns {boolean}
 */
function clearedMomentsAgo(tabId, origin) {
  const key = `${tabId ?? "unknown"}\n${origin}`;
  const now = Date.now();
  const previous = recentClears.get(key) ?? 0;
  recentClears.set(key, now);
  if (recentClears.size > 200) {
    for (const [entry, time] of recentClears) {
      if (now - time > 10_000) {
        recentClears.delete(entry);
      }
    }
  }
  return now - previous < 250;
}
