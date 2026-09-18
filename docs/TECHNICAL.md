# Technical details

For installation and everyday use, start with the [installation guide](INSTALL.md).

## Runtime

The `extension/` directory is the complete Manifest V3 extension. It has no npm dependencies, remote code, server, or build requirement. Load that directory directly in desktop Chrome for development. The manifest restricts injection to Google Meet and the legacy Hangouts hostname.

- `core.js`: settings normalization, correction geometry, capture constraints, frame processing, and track ownership.
- `intercept.js`: wraps page-world `getUserMedia` so the call receives processed video. Microphone tracks pass through unchanged.
- `bridge.js`: connects Chrome's local settings storage with the page-world interceptor.
- `factor-control.js`: keeps presets and custom factors synchronized in both interfaces.
- `popup.*`: call settings and the most recent camera activity.
- `preview.*`: camera preview and a synthetic 1.5× squeezed calibration pattern.

Video uses `MediaStreamTrackProcessor`, `MediaStreamTrackGenerator`, `VideoFrame`, and `OffscreenCanvas`. The camera must already work with Chrome; this extension does not create a system-wide virtual camera.

## Processing and settings

The default Efficient mode caps corrected output at 1280×720 and 30 fps. Low power uses 640×360 and 24 fps. Source quality keeps source resolution and frame rate. Smaller inputs are not upscaled. Excess frames are dropped before rendering. Disabled correction or a 1× factor forwards frames without a canvas redraw. Muted output tracks skip rendering and use a low-rate heartbeat.

Capture requests respect the calling app's mandatory constraints and device selection. Unsupported lower capture modes fall back to the original request; output caps still apply. Changing capture quality requires restarting the camera to obtain a new capture mode. Ratio and framing update live on a processed stream.

The camera-name filter uses a case-insensitive substring match. The preview's selected camera is independent of call filtering. Preferences and the latest camera status are stored locally. Status is a record of the latest camera request, not a live connection monitor. See [privacy](../PRIVACY.md).

The preview releases its stream when the document reports itself hidden. This behavior does not suspend Meet calls. Stop the standalone preview before using the same camera in a call.

## Build and automated checks

From the repository root:

```sh
node --test tests/geometry.test.cjs
python3 scripts/build.py
python3 scripts/check_package.py
```

Node.js 18+ runs the dependency-free tests. Python 3.9+ generates the icons and packages the release without third-party modules. The two generated archives, `Unsqueeze.zip` and `Unsqueeze-<version>.zip`, are identical and contain a single `Unsqueeze/` folder. The stable filename makes the latest-release download link work across versions. `SHA256SUMS.txt` records its SHA-256 checksum.

The archive contains the runtime, offline installation guide, privacy information, and MIT license. It excludes tests, browser profiles, logs, and developer tooling. `check_package.py` verifies archive integrity, source parity, required files, manifest references, and local HTML references. Generated files are ignored by Git.

## Browser and video checks

Serve the repository on localhost:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/tests/browser.html` in an isolated desktop Chromium profile. For its camera/audio checks, launch that profile with `--use-fake-device-for-media-stream` and `--use-fake-ui-for-media-stream`. Do not use those flags with a normal calling profile. Stop the server and test browser when finished.

The page checks actual frame pixels, letterboxing, 4K downscaling, frame-rate limiting, bypass, mute/resume, track clones, camera release, constraint forwarding, capture fallback, audio lifetime, and a local WebRTC loopback. Check the page's results for failures. `tests/performance.html` measures synthetic rendering work; see [methodology and limitations](../PERFORMANCE.md).

For interface changes, load the extension in an isolated profile and check:

1. All seven presets save and persist after reopening the popup.
2. A custom factor such as 1.42 persists; entering 1.6 selects the matching preset.
3. Values outside 1–3 do not save.
4. Settings synchronize between popup and preview.
5. At 1.5×, the synthetic test-pattern circle is round; at 1×, it is narrow.
6. Stopping the preview releases its stream; hiding the preview stops it.
7. Actual Meet calls continue when switching tabs, and the remote image has corrected proportions.

## Verification history and limits

Version 1.2 passed nine geometry/settings tests and the browser/video checks above. Version 1.2.1 also passed preset/custom-value persistence and synchronization checks. The installed extension's settings bridge was checked on a locally simulated Meet page. Its user confirmed the original processing pipeline worked in an actual Google Meet call with an anamorphic camera setup.

Preview shutdown released the stream under a simulated visibility event. The automation browser kept actual tabs marked visible, so physical tab-hide behavior still needs a manual check. These checks do not establish compatibility with every camera, browser, operating system, or future Meet change.
