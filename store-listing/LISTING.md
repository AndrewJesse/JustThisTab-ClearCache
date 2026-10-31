# Chrome Web Store listing copy

Paste these fields into the developer dashboard. The package name in `manifest.json` is the same as the listing name.

## Name

Just This Tab

## Short description

Clear cache for this tab's site. Choose cache types, and auto-clear origins you list when a matching tab finishes loading.

132 characters is the dashboard limit. This summary is 122.

## Detailed description

Just This Tab clears cache for the site open in the current tab. Other sites are left alone. It does not clear cookies, history, passwords, or downloads.

Click the toolbar icon, then Clear This Tab's Cache. That removes the cache types you selected for that tab's origin. Settings, in the same popup, turns those types on or off:

- HTTP cache, on by default
- Cache Storage
- File systems
- Service workers

You can list origins that clear themselves when a matching tab finishes loading or is refreshed. Only that tab's origin is cleared.

After a clear, the popup shows Cache cleared, the origin, and the categories that ran. Chrome does not report a file count or a size, so this extension does not show those numbers.

Chrome pages, about pages, and local files cannot be cleared. The button stays off and nothing is deleted.

Just This Tab is a Free-Utils extension.
https://free-utils.com

Permissions stay on your device. activeTab reads the current tab when you open the popup. browsingData deletes the selected cache types for one origin. storage saves your toggles and auto-clear list. tabs notices when a listed site finishes loading so that tab's origin can be cleared. Tab addresses are not sent to a server.

## Other listing fields

- Category: Productivity
- Language: English
- Homepage: https://free-utils.com

## Icons

The store icon is `store-icon-128.png`. It is the extension's grey trash can with an orange flame, the same artwork as the toolbar icon in the package.

`free-utils-capybara.png` is the company mark, the file `public/brand-logo.png` from the free-utils.com source repository (AndrewJesse/free-utils.com). free-utils.com uses that capybara as the Free-Utils mark, not as the icon for this extension, so it is not the store icon. The small promo tile and the marquee tile show the trash can as the product and the capybara as the company mark.
