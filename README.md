# Just This Tab

Clear the browser HTTP cache for the current tab’s site, and leave everything else alone.

Click the toolbar button. The extension reads that tab’s origin (scheme, host, and port) and removes the HTTP cache for that origin only. The tab stays where it is. A short badge confirms the result: **OK**, or **!** if the page can’t be cleared. Hover the icon while the badge is showing for the detail. Refresh the page when you want already-loaded files to download again.

## What it does not clear

- Other sites, including other subdomains (`https://www.example.com` and `https://example.com` are different origins)
- Cookies, site storage, history, downloads, or passwords
- The Cache Storage API (`caches` in a service worker) and service worker registrations
- Resources from other origins embedded in the page (a CDN script, for example)
- `chrome://`, `chrome-extension://`, `about:`, `file://`, `view-source:`, and other restricted pages

The HTTP cache is shared by origin, not by tab. Clearing `https://example.com` also drops cached responses for that same origin in other tabs. It does not touch any other origin. Copies the open page has already decoded stay in memory until you refresh.

Chrome’s cache deletion can take a moment on a large profile. The badge stays on **...** until the call finishes.

## Why Manifest V3

This repository did not name an extension framework. The extension is a minimal [Chrome Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/) package: a manifest, a service worker, and icons. There is no bundler and no install step. Load the folder unpacked.

It uses [`chrome.browsingData.remove`](https://developer.chrome.com/docs/extensions/reference/api/browsingData) with `origins` set to the active tab and `cache: true`. Permissions are `activeTab` (so the click can see that tab’s URL) and `browsingData`. No host permission is declared; the API does not need one to delete by origin, and `activeTab` avoids a permanent “all sites” grant.

Incognito is `split`. In a normal window, only the normal profile’s cache for that origin is cleared. To use the button in an Incognito window, enable **Allow in Incognito** on `chrome://extensions`. That copy clears the Incognito profile only.

Requires Chrome 96 or newer.

## Load unpacked in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Choose this folder (the one that contains `manifest.json`).
5. Pin **Just This Tab** from the puzzle-piece menu.
6. Open an `http` or `https` page and click the icon.

Restricted pages show **!** and do not change cache. Click **Reload** on `chrome://extensions` after you change the code.

## Develop

Checks use Node 18+ and do not install packages.

```bash
npm test
npm run check
```

`npm test` covers origin selection and that the browsingData call is cache-only. `npm run check` checks the manifest, icon files, and script syntax, and rejects a build that would clear cookies, history, or every site.

| File | Role |
| --- | --- |
| `manifest.json` | MV3 manifest and permissions |
| `background.js` | Toolbar click, badge, and tooltip |
| `src/clear-tab-cache.js` | Origin check and the cache-only API call |
| `test/clear-tab-cache.test.js` | Node tests for that behavior |
| `icons/` | Toolbar icons |

`scripts/generate-icons.py` redraws the icons. It is optional and needs [Pillow](https://pypi.org/project/pillow/); the PNGs are already in the repo.
