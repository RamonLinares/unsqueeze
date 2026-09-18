# Unsqueeze 1.2 efficiency changes

## What changed

- The default corrected output is capped at 1280×720 / 30 fps. Low power uses 640×360 / 24 fps. Source quality remains available.
- Excess frames are dropped before drawing or allocating a new output VideoFrame.
- Correction off, a 1× ratio, and disabled output tracks bypass canvas processing.
- Crop mode no longer clears the whole canvas before covering it with the image.
- On camera acquisition, compatible cameras are asked for lighter capture modes. Mandatory app constraints and camera-device selection are preserved. Unsupported lower modes keep their existing capture configuration.
- Hidden preview tabs release their streams and stop the test-pattern timer. Actual call tabs continue working in the background.

## Controlled rendering comparison

Synthetic 1920×1080 frames with timestamps representing 60 fps; 120 frames per scenario. Measured in the same isolated Chromium installation on September 18, 2026. Source capture and call encoding are excluded from this comparison.

| Processing path | Output frames | Output size | Canvas draws | New output VideoFrames | Canvas output pixels |
| --- | ---: | --- | ---: | ---: | ---: |
| 1.1 baseline | 120 | 1920×1080 | 120 | 120 | 248,832,000 |
| 1.2 Efficient | 60 | 1280×720 | 60 | 60 | 55,296,000 |
| 1.2 Low power | 48 | 640×360 | 48 | 48 | 11,059,200 |
| 1.2 correction off | 60 | 1920×1080 | 0 | 0 | 0 |

Efficient rendered 77.8% fewer output pixels; Low power rendered 95.6% fewer. These are workload counts, **not CPU or temperature measurements**. The bypass keeps the incoming frame dimensions because it does not rescale frames.

Instrumented synchronous drawing/frame-construction time was 16.5 ms, 15.8 ms, 14.4 ms, and 0 ms respectively across these scenarios. These short timings do not capture deferred GPU work, camera decoding, browser encoding, or operating-system thermal behavior and should not be interpreted as an end-to-end speedup.

## Reproduction

`tests/performance.html` uses generated frames only. Serve the project locally, then visit it in an isolated Chromium profile. Query options: `?mode=efficient`, `?mode=low`, or `?mode=efficient&disabled=1`. For comparison with the saved local 1.1 source, use `?version=baseline`; that source is in the ignored `output/performance/baseline-core.js` directory and is not included in the release ZIP.

`node --test tests/geometry.test.cjs` covers dimensions, capture-constraint preservation, settings and migration. `tests/browser.html` exercises actual frame pixels, throttling, bypass, track ownership, muting, capture fallback, and a local WebRTC connection.

The installed extension was also checked on a locally simulated Meet page using its actual settings bridge. Preview visibility cleanup passed with a simulated hidden event; real tab switching could not be verified because the automation browser kept all tabs marked visible.
