# Just This Tab

Clear cache for the site in the current tab, and leave every other origin alone.

The toolbar button opens a popup. It does not clear anything until you choose **Clear This Tab's Cache** or a site you listed finishes loading.

## Load unpacked

The popup is a [Next.js](https://nextjs.org/) static export. Chrome loads the built `dist` folder. There is no server.

Requires Node 18+ and Chrome 96+.

```bash
npm install
npm test
npm run check
npm run build
```

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Choose the `dist` folder (the one that contains the built `manifest.json`), not the repository root.
5. Pin **Just This Tab**.
6. Open an `http` or `https` page and click the icon.

After code changes, run `npm run build` again and click **Reload** on `chrome://extensions`.

Incognito is `split`. Enable **Allow in Incognito** to use the extension there. That copy has its own settings and clears only the Incognito profile.

## The controls

**Clear This Tab's Cache** (broom) clears the current tab's origin using the toggles in Settings. The path, query, and hash are ignored. `https://example.com/docs` and `https://example.com` are the same origin. `https://www.example.com` is not. The tab is not reloaded.

**Settings** (gear) opens a nested menu in the popup.

- **What gets cleared** is four independent toggles. They are saved in `chrome.storage.sync` and mirrored to `chrome.storage.local` (local is used if sync is unavailable). The newer copy wins.
- **Auto-clear origins** adds and removes origins or origin patterns. When a matching tab finishes a full load or a refresh, the extension clears that tab's origin with the same toggles. Other origins are not cleared.

`chrome://`, `about:`, `file://`, and other restricted pages show an error under the title. **Clear This Tab's Cache** stays disabled and the extension does not call the API.

## Cache types

These are real [`chrome.browsingData`](https://developer.chrome.com/docs/extensions/reference/api/browsingData) removal types that still delete data for one origin. The call is always `browsingData.remove({ origins: [thatOrigin] }, types)`.

| Toggle | API type | Default | What it removes |
| --- | --- | --- | --- |
| HTTP cache | `cache` | On | The browser HTTP cache for that origin |
| Cache Storage | `cacheStorage` | Off | Cache Storage API entries for that origin |
| File systems | `fileSystems` | Off | That origin's sandbox file system (File System API) |
| Service workers | `serviceWorkers` | Off | Service worker registrations for that origin |

`appcache` and `webSQL` are still accepted by the API and then ignored (Chrome removed them in version 152), so they are not toggles. Cookies, history, passwords, downloads, form data, `localStorage`, and IndexedDB are never sent.

Turning every toggle off disables both the button and auto-clear until one is on again. If the call fails, nothing is reported as cleared.

The HTTP cache is shared by origin, so other tabs on that same origin lose those cached responses too. Resources the open page has already decoded stay until you refresh. A service worker removed here can register again the next time the page loads it.

## Auto-clear matching

A pattern answers yes or no for the tab that just finished loading. The deletion always uses that tab's origin, never a list of other hosts.

| You enter | Stored as | Matches |
| --- | --- | --- |
| `https://example.com` or `https://example.com/docs` | `https://example.com` | That origin, default port only |
| `http://localhost:3000` | `http://localhost:3000` | That origin and port |
| `example.com` | `*://example.com` | `http://example.com` and `https://example.com` |
| `https://*.example.com` | `https://*.example.com` | `https://example.com` and its subdomains |
| `*.example.com` | `*://*.example.com` | Both schemes, that site and its subdomains |

`https://example.com:8443` does not match `https://example.com`. `https://www.example.com` does not match `https://example.com`. `https://example.com.evil.com` does not match `*.example.com`. Patterns that would match every site (`*`, `<all_urls>`, `*.com`, `*.co.uk`) are rejected.

Auto-clear runs from `chrome.tabs.onUpdated` when the tab status is `complete` (a full load or refresh). It does not run for in-page route changes that never finish a navigation. Restricted URLs never match.

## What the result line measures

After a clear, the bottom of the popup shows a green check, **Cache cleared**, the origin, and the categories that ran. For example: `HTTP cache, Service workers`.

`chrome.browsingData.remove` resolves with no file list, byte count, or content types. The popup does not invent those numbers and does not label anything as an estimate. Chrome does not tell the extension which files were in the HTTP cache.

Reopening the popup shows the last result from `chrome.storage.session` until the browser session ends.

## Permissions

| Permission | Why |
| --- | --- |
| `activeTab` | Read the current tab's URL when you open the popup |
| `browsingData` | Delete the selected cache types for one origin |
| `storage` | Save the toggles, the auto-clear list, and the last result |
| `tabs` | See when a tab finishes loading and read its URL for auto-clear, without a click |

`tabs` is the narrow permission that makes auto-clear possible. Chrome describes it as reading browsing history because tab URLs are visible to the extension. The extension does not store browsing history. It stores only the patterns you add and the last clear result.

No host permission and no `<all_urls>` grant. Deleting by origin does not need one, and host access would let the extension read and change page contents, which this extension does not do.

## Icons

`icons/icon16.png`, `icons/icon32.png`, `icons/icon48.png`, and `icons/icon128.png` are a grey trash can with a small orange flame on a transparent background. `scripts/generate-icons.py` redraws them and needs [Pillow](https://pypi.org/project/pillow/). The PNGs in the repo are what Chrome uses.

## How it is built

The popup UI is a Next.js App Router page (`app/`) exported with `output: "export"`. `npm run build` writes that site, then `scripts/assemble-extension.mjs` copies the plain JavaScript service worker, shared modules, icons, and manifest into `dist`. Next's `_next` directory is renamed to `assets` because Chrome rejects extension paths that start with `_`. Inline bootstrap scripts are moved into `dist/csp/` so the extension content-security policy (`script-src 'self'`) can load them.

The service worker stays plain JavaScript (`background.js` and `src/`). Next.js is not the service worker.

| Path | Role |
| --- | --- |
| `manifest.json` | Manifest V3, permissions, popup entry |
| `background.js` | Auto-clear when a matching tab finishes loading |
| `src/clear-tab-cache.js` | Origin check and the origin-scoped API call |
| `src/settings.js` | Toggles, storage, and the cache-type allowlist |
| `src/patterns.js` | Origin and pattern parsing |
| `src/auto-clear.js` | Decide whether one finished tab should be cleared |
| `src/result.js` | The honest result line |
| `app/` | Next.js popup |
| `test/` | Node tests |
| `dist/` | Built extension, created by `npm run build` |
