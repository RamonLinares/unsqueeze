# Chrome Web Store submission

Everything needed to submit Unsqueeze in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole), in the order the dashboard asks for it.

## Package

Run `python3 scripts/build.py`, then upload **`Unsqueeze-<version>-chrome-web-store.zip`** from the repository root. It contains only the runtime files, with `manifest.json` at the ZIP root. Do not upload `Unsqueeze.zip`: that is the GitHub download, which puts the files inside an `Unsqueeze/` folder for manual installation.

Each later upload needs a higher `version` in `extension/manifest.json`.

## Store listing tab

**Name and summary** come from the manifest: *Unsqueeze — Anamorphic Webcam* and its 121-character description.

**Description**

```
Unsqueeze corrects squeezed video from anamorphic camera lenses in Google Meet, so other participants see natural proportions.

An anamorphic lens compresses the image horizontally. Meet has no setting to undo that, so faces and rooms look too narrow. Unsqueeze restores the proportions in Chrome before Meet sends your video. You keep selecting your normal camera in Meet; no virtual camera or driver is installed.

FEATURES
• Presets for 1×, 1.25×, 1.33×, 1.5×, 1.6×, 1.8× and 2×, or any custom factor from 1× to 3×
• Fill the call (crops equal amounts from the sides) or Keep the whole image (black bars above and below)
• Efficient (up to 720p / 30 fps), Low power (up to 360p / 24 fps) or Source quality
• Optional camera-name filter, so correction applies only to your anamorphic setup
• Camera preview with a built-in test pattern that needs no camera

HOW TO USE
1. Install Unsqueeze and reload any open Google Meet tabs.
2. Click Unsqueeze in the toolbar and choose your lens’s squeeze factor.
3. In Meet → Settings → Video, select your usual camera.
After enabling correction or changing the camera filter, turn Meet’s camera off and on. Factor and framing changes apply live.

Works with any camera Chrome already recognizes: USB webcams, capture cards and camera utilities, regardless of camera or lens brand. Using a regular lens? Turn correction off or choose 1×.

PRIVACY
Video is processed on your device. Unsqueeze has no account, analytics, advertising, recording or upload service. Google Meet transmits your call as usual. Settings are stored locally in Chrome.

Designed for Google Meet in desktop Chrome. Free and open source under the MIT license: https://github.com/RamonLinares/unsqueeze
```

**Category:** Tools (alternatively *Communication*) · **Language:** English

**Graphic assets** (`store/images/`, regenerate with `node scripts/store_assets.mjs`)

| Field | File |
| --- | --- |
| Store icon (128×128) | `extension/icons/icon128.png` |
| Screenshots (1280×800), in this order | `screenshot-1-preview.png`, `screenshot-2-before-after.png`, `screenshot-3-popup.png`, `screenshot-4-framing.png` |
| Small promo tile (440×280) | `promo-small-440x280.png` |
| Marquee promo tile (1400×560), optional | `promo-marquee-1400x560.png` |

**Official URL:** none (needs a Search Console–verified domain; optional) · **Homepage URL:** `https://smallweblab.com/posts/unsqueeze/` · **Support URL:** `https://github.com/RamonLinares/unsqueeze/issues`

## Privacy practices tab

**Single purpose description**

```
Unsqueeze corrects the horizontal proportions of anamorphic (squeezed) camera video in Google Meet, so other call participants receive an image with natural proportions.
```

**Permission justification · storage**

```
Saves the user's preferences locally: whether correction is on, the squeeze factor, framing, quality mode and optional camera-name filter, plus the most recent camera-status message shown in the popup. Nothing is sent off the device.
```

**Host permission justification · https://meet.google.com/\***

```
The content script must run on Google Meet pages to correct the camera video before Meet sends it. It wraps the page's getUserMedia so that video tracks pass through a local frame-processing pipeline that restores the lens's proportions; audio tracks are returned unchanged. It runs only on meet.google.com, reads no page content and makes no network requests.
```

**Remote code:** No, I am not using remote code. (All JavaScript ships in the package; there is no eval, no remote script and no network request.)

**Data usage:** check **none** of the data-type boxes. Camera frames are processed in memory on the device and never collected or transmitted by the extension. Preferences stay in `chrome.storage.local`.

Then tick all three certifications:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** `https://github.com/RamonLinares/unsqueeze/blob/main/PRIVACY.md`

## Distribution tab

Visibility **Public**, all regions, free.

## Test instructions tab (for the reviewer)

```
No anamorphic camera or Google account is needed to verify the extension.

1. Click the Unsqueeze toolbar icon, then "Open camera preview".
2. Click "Test pattern". This plays a synthetic video squeezed by 1.5×; no camera is used.
3. With Lens squeeze at 1.5×, the circle is round and the grid cells are square. Choose "1× · Original" to see the uncorrected, narrow ellipse. "Keep the whole image" adds black bars; "Fill the call" crops the sides.

In Google Meet (meet.google.com), the same correction is applied to the outgoing camera video when the user joins a call or opens Meet's video settings with any webcam. Microphone audio passes through unchanged. The extension makes no network requests.
```
