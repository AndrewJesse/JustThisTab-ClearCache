"use client";

import { useEffect, useState } from "react";
import { clearCacheForTab } from "../src/clear-tab-cache.js";
import { loadLastResult, resultFromClear, resultLines, saveLastResult } from "../src/result.js";
import {
  CACHE_CATEGORIES,
  addAutoClearEntry,
  defaultSettings,
  loadSettings,
  normalizeSettings,
  removeAutoClearEntry,
  saveSettings,
} from "../src/settings.js";
import { describeTab } from "../src/tab-status.js";
import { BroomIcon, CheckIcon, ChevronIcon, GearIcon } from "./icons.jsx";

export default function PopupApp() {
  const [tabState, setTabState] = useState({
    pending: true,
    clearable: false,
    summary: "Checking this tab…",
  });
  const [settings, setSettings] = useState(defaultSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [formError, setFormError] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const browser = getBrowser();
    if (!browser) {
      setTabState({
        pending: false,
        clearable: false,
        summary: "Open this from the Just This Tab toolbar icon.",
      });
      return undefined;
    }

    let cancelled = false;

    async function refresh() {
      try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        const [storedSettings, lastResult] = await Promise.all([
          loadSettings(browser.storage),
          loadLastResult(browser.storage),
        ]);
        if (cancelled) {
          return;
        }
        setTabState({ ...describeTab(tab), pending: false });
        setSettings(storedSettings);
        setResult(lastResult);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setTabState({
          pending: false,
          clearable: false,
          summary: error instanceof Error && error.message
            ? error.message
            : "Couldn't read this tab.",
        });
      }
    }

    void refresh();

    const onUpdated = (_tabId, changeInfo, tab) => {
      if (!tab.active || changeInfo.status !== "complete") {
        return;
      }
      setTabState({ ...describeTab(tab), pending: false });
    };

    const onChanged = (changes, area) => {
      if ((area === "sync" || area === "local") && changes.settings && changes.settings.newValue) {
        setSettings(normalizeSettings(changes.settings.newValue));
      }
      if (area === "session" && changes.lastResult) {
        setResult(changes.lastResult.newValue ? resultFromClear(changes.lastResult.newValue) : null);
      }
    };

    browser.tabs.onUpdated.addListener(onUpdated);
    if (browser.storage.onChanged) {
      browser.storage.onChanged.addListener(onChanged);
    }

    return () => {
      cancelled = true;
      browser.tabs.onUpdated.removeListener(onUpdated);
      if (browser.storage.onChanged) {
        browser.storage.onChanged.removeListener(onChanged);
      }
    };
  }, []);

  async function onClear() {
    const browser = getBrowser();
    if (!browser || busy) {
      return;
    }
    setBusy(true);
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      const described = describeTab(tab);
      setTabState({ ...described, pending: false });
      const cleared = described.clearable
        ? await clearCacheForTab(tab, browser.browsingData, settings.types)
        : { ok: false, reason: described.summary };
      const view = resultFromClear(cleared);
      setResult(view);
      await saveLastResult(browser.storage, view);
    } catch (error) {
      const view = resultFromClear({
        ok: false,
        reason: error instanceof Error && error.message
          ? error.message
          : "Couldn't clear the cache for this tab.",
      });
      setResult(view);
    } finally {
      setBusy(false);
    }
  }

  async function onToggle(id, enabled) {
    const next = normalizeSettings({
      ...settings,
      types: { ...settings.types, [id]: enabled },
    });
    setSettings(next);
    await persist(next);
  }

  async function onAdd(event) {
    event.preventDefault();
    const added = addAutoClearEntry(settings, draft);
    if (!added.ok) {
      setFormError(added.reason);
      return;
    }
    setFormError("");
    setDraft("");
    setSettings(added.settings);
    await persist(added.settings);
  }

  async function onRemove(pattern) {
    const next = removeAutoClearEntry(settings, pattern);
    setSettings(next);
    await persist(next);
  }

  async function persist(next) {
    const browser = getBrowser();
    if (!browser) {
      setSettingsError("Couldn't save settings.");
      return;
    }
    try {
      const saved = await saveSettings(browser.storage, next);
      setSettings(saved);
      setSettingsError("");
    } catch {
      setSettingsError("Couldn't save settings.");
    }
  }

  const lines = resultLines(result);
  const summaryClass = tabState.pending || tabState.clearable ? "" : "is-blocked";
  const clearDisabled = busy || tabState.pending || !tabState.clearable;

  return (
    <div className="popup">
      <header className="header">
        <img className="logo" src="icons/icon32.png" width={32} height={32} alt="" />
        <div className="titles">
          <h1>Just This Tab</h1>
          <p id="tab-summary" className={summaryClass}>{tabState.summary}</p>
        </div>
      </header>

      <button
        type="button"
        className="menu-button"
        onClick={onClear}
        disabled={clearDisabled}
        aria-describedby="tab-summary"
        aria-busy={busy}
      >
        <BroomIcon />
        <span className="menu-label">{busy ? "Clearing…" : "Clear This Tab's Cache"}</span>
      </button>

      <button
        type="button"
        className="menu-button"
        aria-expanded={settingsOpen}
        aria-controls="settings-panel"
        onClick={() => setSettingsOpen((open) => !open)}
      >
        <GearIcon />
        <span className="menu-label">Settings</span>
        <ChevronIcon />
      </button>

      <div id="settings-panel" className="settings" hidden={!settingsOpen}>
        <p className="group-label" id="clear-types-label">What gets cleared</p>
        <div role="group" aria-labelledby="clear-types-label">
          {CACHE_CATEGORIES.map((category) => {
            const inputId = `clear-${category.id}`;
            const helpId = `${inputId}-help`;
            return (
              <label className="toggle" key={category.id} htmlFor={inputId}>
                <input
                  id={inputId}
                  type="checkbox"
                  checked={settings.types[category.id] === true}
                  aria-describedby={helpId}
                  onChange={(event) => {
                    void onToggle(category.id, event.target.checked);
                  }}
                />
                <span>
                  <span className="toggle-name">{category.label}</span>
                  <span className="toggle-help" id={helpId}>{category.description}</span>
                </span>
              </label>
            );
          })}
        </div>

        <form className="auto-clear" onSubmit={onAdd}>
          <label className="group-label" htmlFor="auto-clear-origin">Auto-clear origins</label>
          <p className="field-help" id="auto-clear-help">
            When a matching tab finishes loading or is refreshed, only that tab’s origin is cleared.
          </p>
          <div className="add-row">
            <input
              id="auto-clear-origin"
              type="text"
              value={draft}
              placeholder="https://example.com"
              aria-describedby={formError ? "auto-clear-help auto-clear-error" : "auto-clear-help"}
              aria-invalid={formError ? "true" : "false"}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={200}
              onChange={(event) => {
                setDraft(event.target.value);
                if (formError) {
                  setFormError("");
                }
              }}
            />
            <button type="submit">Add</button>
          </div>
          {formError ? <p className="form-error" id="auto-clear-error" role="alert">{formError}</p> : null}
          {settings.autoClear.length === 0 ? (
            <p className="empty-origins">No origins yet. Add example.com or *.example.com.</p>
          ) : (
            <ul className="origin-list">
              {settings.autoClear.map((pattern) => (
                <li className="origin-row" key={pattern}>
                  <span>{pattern}</span>
                  <button type="button" aria-label={`Remove ${pattern}`} onClick={() => { void onRemove(pattern); }}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          {settingsError ? <p className="settings-error" role="alert">{settingsError}</p> : null}
        </form>
      </div>

      <footer className="result" role="status" aria-live="polite">
        {lines.kind === "empty" ? <p className="result-empty">{lines.text}</p> : null}
        {lines.kind === "error" ? (
          <div className="result-row">
            <span className="mark mark-error" aria-hidden="true">!</span>
            <div>
              <p className="result-title is-error">{lines.title}</p>
              <p className="result-detail">{lines.detail}</p>
            </div>
          </div>
        ) : null}
        {lines.kind === "success" ? (
          <div className="result-row">
            <CheckIcon />
            <div>
              <p className="result-title">{lines.title}</p>
              {lines.origin ? <p className="result-origin">{lines.origin}</p> : null}
              {lines.categories ? <p className="result-cats">{lines.categories}</p> : null}
            </div>
          </div>
        ) : null}
      </footer>
    </div>
  );
}

function getBrowser() {
  const browser = globalThis.chrome;
  if (!browser || !browser.tabs || !browser.storage || !browser.browsingData) {
    return null;
  }
  return browser;
}
