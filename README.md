# YTBlocker

A Chrome extension that adds **Block Channel** and **Block Video** to YouTube's
three-dot menu, then hides the blocked content everywhere on the site.

No build step, no dependencies, no tracking. Just load it unpacked.

![YTBlocker options panel](docs/popup.png)

## Features

- **Block from the menu** — click the `⋮` ("Action menu" / "More actions") on any
  video card and pick *Block Channel* or *Block Video*. The rows flip to
  *Unblock Channel* / *Unblock Video* when something is already blocked.
- **Blocked content disappears** — hidden across home, search, subscriptions,
  the watch-page sidebar, playlists, shelves and shorts.
- **Block screen** — opening a blocked video or channel directly shows a block
  screen with a one-click **Unblock** button.
- **Matching by channel ID** — blocking a channel resolves its stable `UC…` ID
  where available, so renamed channels stay blocked. Falls back to `@handle`,
  then display name.
- **Popup manager** — search, review and remove blocks, toggle behaviour,
  import/export the list as JSON, or clear it.

## Install (unpacked)

1. Download or clone this repo.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Open YouTube and click the `⋮` on any video.

Works on `https://www.youtube.com/*` in Chrome and other Chromium browsers.
Chrome Web Store listing: not published.

## Usage

- **Block** — `⋮` on a video card → *Block Channel* / *Block Video*.
  A toast confirms and the card disappears.
- **Unblock** — same menu, now *Unblock …*; or open the extension popup and hit
  *Remove*; or use the *Unblock* button on the block screen.
- **Settings** (popup):
  - *Hide blocked items in feeds & search*
  - *Show a block screen on watch pages*
  - *Show a confirmation toast*
- **Backup** — *Export* writes `ytblocker-blocklist.json`; *Import* restores it.

## How it works

A Manifest V3 content script (`src/`) watches the DOM:

| File | Role |
| --- | --- |
| `src/state.js` | Blocklist stored in `chrome.storage.local`; match by channel ID → handle → name |
| `src/extract.js` | Finds the card behind a `⋮` click and extracts video ID / channel ID / handle / name |
| `src/menu.js` | Detects the open menu, injects the rows, handles the click |
| `src/filter.js` | Hides blocked cards and renders the watch-page block screen |
| `src/content.js` | Mutation observers, SPA navigation, bootstrap |

Both YouTube menu generations are handled: the legacy
`ytd-menu-service-item-renderer` list and the newer `yt-list-item-view-model`
layout. The same is true for cards, from `ytd-*` renderers through
`yt-lockup-view-model` and shorts.

## Known limitations

- Filtering happens on the DOM as it renders, so a blocked card can briefly
  flash before it is hidden. (BlockTube-style pre-render filtering of
  `ytInitialData` is not implemented.)
- YouTube changes its markup often. If the menu entries stop appearing, the
  selector lists at the top of `src/extract.js` and `src/menu.js` are the first
  places to update.

## Privacy

Everything stays on your machine. The extension has one permission, `storage`,
and makes no network requests.

## License

No license file is included yet.
