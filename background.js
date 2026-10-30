import { clearCacheForTab } from "./src/clear-tab-cache.js";

const DEFAULT_TITLE = "Clear cache for this tab";
const BUSY_COLOR = "#5f6368";
const SUCCESS_COLOR = "#137333";
const FAILURE_COLOR = "#c5221f";
const BADGE_MS = 4000;

const badgeGenerations = new Map();

chrome.action.onClicked.addListener((tab) => {
  void onActionClicked(tab);
});

/**
 * Toolbar click: clear the HTTP cache for this tab's origin, then show a
 * short badge. The tooltip explains the result until the badge clears.
 * @param {chrome.tabs.Tab | undefined} tab
 */
async function onActionClicked(tab) {
  const tabId = badgeTabId(tab);
  try {
    await setBadge(tabId, {
      text: "...",
      color: BUSY_COLOR,
      title: "Clearing cache for this tab…",
    });

    const result = await clearCacheForTab(tab, chrome.browsingData);
    if (result.ok) {
      await setBadge(tabId, {
        text: "OK",
        color: SUCCESS_COLOR,
        title: `Cleared cache for ${result.origin}. Refresh the page to load fresh files.`,
      });
    } else {
      await setBadge(tabId, {
        text: "!",
        color: FAILURE_COLOR,
        title: result.reason,
      });
    }
  } catch (error) {
    const reason = error instanceof Error && error.message
      ? error.message
      : "Couldn't clear the cache for this tab.";
    try {
      await setBadge(tabId, {
        text: "!",
        color: FAILURE_COLOR,
        title: reason,
      });
    } catch {
      // The toolbar action is unavailable; avoid an unhandled rejection.
    }
  }

  scheduleBadgeClear(tabId);
}

/**
 * @param {chrome.tabs.Tab | undefined} tab
 * @returns {number | undefined}
 */
function badgeTabId(tab) {
  const id = tab && tab.id;
  return Number.isInteger(id) && id >= 0 ? id : undefined;
}

/**
 * @param {number | undefined} tabId
 * @param {{ text: string, color: string, title: string }} badge
 */
async function setBadge(tabId, badge) {
  const scope = tabId === undefined ? {} : { tabId };
  await chrome.action.setBadgeBackgroundColor({ ...scope, color: badge.color });
  if (typeof chrome.action.setBadgeTextColor === "function") {
    await chrome.action.setBadgeTextColor({ ...scope, color: "#ffffff" });
  }
  await chrome.action.setBadgeText({ ...scope, text: badge.text });
  await chrome.action.setTitle({ ...scope, title: badge.title });
}

/**
 * @param {number | undefined} tabId
 */
function scheduleBadgeClear(tabId) {
  const key = tabId === undefined ? "all" : String(tabId);
  const generation = (badgeGenerations.get(key) ?? 0) + 1;
  badgeGenerations.set(key, generation);

  setTimeout(() => {
    if (badgeGenerations.get(key) !== generation) {
      return;
    }
    const scope = tabId === undefined ? {} : { tabId };
    chrome.action.setBadgeText({ ...scope, text: "" }).catch(() => {});
    chrome.action.setTitle({ ...scope, title: DEFAULT_TITLE }).catch(() => {});
  }, BADGE_MS);
}
