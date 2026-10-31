# Upload Just This Tab to the Chrome Web Store

The file to upload is `store-listing/just-this-tab-0.2.0.zip`. It is the output of `npm run build`. `manifest.json` is at the root of the zip, not inside a `dist` folder.

## Note on the account limit

This developer account can publish 2 items and currently shows 0 of 2. This upload uses one of those slots.

## 1. New item

1. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Click **New item**.
3. Click **Select file** and choose `store-listing/just-this-tab-0.2.0.zip` from this repository.
4. Wait until the dashboard accepts the package. If it rejects the zip, confirm you selected this zip and not a zip of the repository root.

## 2. Store listing

Open the item's **Store listing** tab and paste the fields from `store-listing/LISTING.md`.

- Name: Just This Tab
- Summary: the short description in `LISTING.md`
- Description: the detailed description in `LISTING.md`, including the link to https://free-utils.com
- Category: Productivity
- Language: English
- Homepage / official URL: https://free-utils.com

### Graphic assets

Upload these files from `store-listing/`. Sizes match the [store image requirements](https://developer.chrome.com/docs/webstore/images).

| Dashboard field | File | Size |
| --- | --- | --- |
| Store icon | `store-icon-128.png` | 128×128 |
| Screenshot | `screenshots/01-toolbar-icon.png` | 1280×800 |
| Screenshot | `screenshots/02-popup.png` | 1280×800 |
| Screenshot | `screenshots/03-settings.png` | 1280×800 |
| Screenshot | `screenshots/04-result.png` | 1280×800 |
| Small promo tile | `small-promo-440x280.png` | 440×280 |
| Marquee promo tile | `marquee-promo-1400x560.png` | 1400×560 |

Upload the screenshots in that order: the toolbar icon, the popup with Clear This Tab's Cache and Settings, the Settings menu, then the green check after a clear. They were captured from the extension running in Chrome on https://example.com.

Use `store-icon-128.png` for the store icon. It is the grey trash can with an orange flame, the same icon Chrome shows on the toolbar. Do not upload `free-utils-capybara.png` as the store icon. That file is the Free-Utils company mark from https://free-utils.com/brand-logo.webp. The site uses the capybara as the company mark, not as this extension's icon. The promo tiles include it only as that company mark.

## 3. Privacy

Open the **Privacy** tab.

Single purpose:

> Clears cache for the site in the current tab, and for origins the user lists, without clearing other sites.

Permission justifications:

- `activeTab`: Reads the current tab's URL when the user opens the popup, so the clear applies to that origin.
- `browsingData`: Deletes the selected cache types for that one origin.
- `storage`: Saves the user's toggles, auto-clear list, and the last result on this browser.
- `tabs`: Reads a tab URL when that tab finishes loading, so an origin the user added can be cleared. The URL is not stored as browsing history and is not transmitted.

Data use:

- The extension does not collect or transmit user data. Settings and the last result stay in `chrome.storage` on the device.
- Do not say that data is sold or sent to a server.
- There is no remote code. The package is the static production build.

If the form asks about web history because of the `tabs` permission, say the tab URL is read locally to match an auto-clear pattern and is not collected.

## 4. Submit

1. Review the listing preview.
2. Click **Submit for review**.

The dashboard sends the item to review. It is not public until that review finishes.
