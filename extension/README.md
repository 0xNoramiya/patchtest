# PatchTest browser extension

Checks the skincare in a cart on **someone else's shop** against what you told
PatchTest about your skin, before you pay for it.

The web app answers "is this cart right for me" inside PatchTest. The extension
answers it where people actually shop.

## Install it

Chrome, Edge or any Chromium browser. It is not on the Web Store, so it loads
unpacked. Takes about thirty seconds.

1. **[Download the zip](https://github.com/0xNoramiya/patchtest/releases/latest/download/patchtest-extension-v1.0.0.zip)** from
   [Releases](https://github.com/0xNoramiya/patchtest/releases/latest), and unzip it. Or clone this repo and use the
   `extension/` folder directly.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**, top right.
4. Press **Load unpacked** and pick the unzipped folder.

Nothing else to configure. It points at `https://patchtest.fly.dev` out of the box.

## Use it

1. Go to **https://patchtest.fly.dev**, run any preset or a scan of your own.
   The results page leaves your profile in that browser for the extension.
2. Open **https://patchtest.fly.dev/store**, a fictional shop built for this demo.
3. The extension annotates the cart. Press the toolbar icon and **Check this
   page** to run it again on any other cart.

## How it reads a cart

The rules engine keys on **active classes and strengths**, and skincare product
titles almost always carry both: "Retinol 0.5% Night Serum", "AHA 30% + BHA 2%
Peeling Solution". So a title is usually enough.

Extraction is layered, most reliable first:

| Order | Source | Notes |
|---|---|---|
| 1 | `data-patchtest-item` attributes | An exact opt-in any shop can add |
| 2 | schema.org **JSON-LD** `Product` | What most shops already publish |
| 3 | schema.org **microdata** | The older structured format. The demo shop uses this |
| 4 | Cart-row heuristic | Filtered to rows that mention a skincare ingredient, so shipping lines are not annotated |

`lib/match.ts` in the main repo then parses the title into actives, percentages,
tags, rinse-off versus leave-on, and body area. It has 24 tests of its own.

**A title it cannot read gets no verdict.** The badge says "Could not read this"
and states plainly that this is not a safety clearance. The parser never guesses.

## What it sends

On pressing check, it sends the product titles it found and your saved profile to
`POST /api/check-cart`. Your profile is your declared intake plus the label of
your recorded scan. **No photo is ever sent by the extension**, and your profile
stays in `chrome.storage.local` on your machine until you check a cart.

## Files

| File | What it does |
|---|---|
| `manifest.json` | Manifest V3 |
| `content.js` | Finds the cart, injects verdicts, syncs your profile from PatchTest |
| `background.js` | Service worker. Makes the API call, so it carries the extension's host permissions rather than fighting the shop's CORS |
| `popup.js` | Toolbar popup: profile status and a manual re-check |
| `content.css` | Styles, scoped so they do not leak onto the shop's page |

## Limits

- The ingredient parser reads titles, not ingredient lists. A product whose title
  hides its actives behind a brand name gets no verdict.
- The heuristic extractor is best effort. Shops with structured data work
  properly; shops without may be missed entirely.
- Everything the main app says about itself applies here: 24 rules is finite
  coverage, the thresholds are heuristics, and it is not a medical device.
