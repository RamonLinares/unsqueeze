# Install Unsqueeze in Chrome

You do not need to know how to code. Installation uses Chrome’s built-in **Load unpacked** feature.

## Before you begin

Use desktop Google Chrome. Your camera should already appear as a working camera in Google Meet. Unsqueeze corrects its proportions; it does not install camera drivers.

## 1. Download and unzip

Get **[Unsqueeze.zip from the latest release](https://github.com/RamonLinares/unsqueeze/releases/latest/download/Unsqueeze.zip)**.

- **Mac:** double-click the ZIP in Finder.
- **Windows:** right-click the ZIP and choose **Extract All**.
- **Other desktop systems:** extract the ZIP using your archive manager. These systems have not been verified with Unsqueeze.

You should see a folder called **Unsqueeze**. Move it somewhere permanent, such as your Documents folder. Open it once to check that it contains `manifest.json` and `START-HERE.html`.

Do not delete or move this folder after installation. Chrome reads the extension from it.

## 2. Open Chrome’s extensions page

Type this into Chrome’s **address bar**, then press Enter:

```text
chrome://extensions
```

This is a Chrome settings address, not a search term. Turn on **Developer mode** in the upper-right corner. This reveals the **Load unpacked** button.

## 3. Select the extension folder

Click **Load unpacked** and select the **Unsqueeze** folder you extracted. The folder you select must directly contain `manifest.json`.

```text
Documents/
└── Unsqueeze/          ← select this folder
    ├── manifest.json
    ├── START-HERE.html
    ├── popup.html
    ├── preview.html
    └── …
```

An **Unsqueeze — Anamorphic Webcam** card should appear on the extensions page. It should be enabled.

If you chose GitHub’s automatically generated **Source code (zip)** instead of the release asset, select the source archive’s **extension** subfolder instead.

## 4. Pin it and choose your lens

Click the puzzle-piece Extensions icon in Chrome’s toolbar, then the pin beside **Unsqueeze**.

Click Unsqueeze. Turn on **Desqueeze video**. Select your lens’s squeeze factor from **Lens squeeze**, or enter it in **Factor (×)**. Use the ratio specified for your lens, not its focal length or aperture.

For example, a 1.5× anamorphic lens needs a 1.5× factor. A regular lens needs 1× or correction switched off.

Leave **Video quality → Efficient** selected for normal use. Choose **Low power** if reducing processing load matters more than sharpness.

## 5. Use Google Meet

Reload any Meet tabs that were already open. In **Meet → Settings → Video**, choose your usual camera.

There is no new camera named Unsqueeze: it corrects the selected camera’s outgoing video inside Meet. Other people in the call receive that corrected image.

If you change the camera filter or enable correction after starting the camera, turn Meet’s camera off and back on. After changing video quality, do the same to update the capture request.

## Optional: check before a call

Open **Unsqueeze → Open camera preview**.

- **Test pattern** works without a camera. At 1.5×, the circle is round and the grid squares are square.
- **Start camera** shows your selected real camera after you grant camera permission.
- Click **Stop** before using the camera in Meet.

## Update later

1. Stop your call and preview.
2. Download and extract the latest release.
3. Replace the files inside your existing Unsqueeze folder with the new files. Keep the original folder path.
4. Open `chrome://extensions` and click Reload on Unsqueeze’s card.
5. Reload Meet.

Do not click Load unpacked again for a second copy. Settings are retained when the original installation path is kept. Updates are manual for this GitHub installation.

## If something goes wrong

- **No Load unpacked button:** check Developer mode. A work/school administrator may restrict manual extensions.
- **Missing manifest:** you selected the ZIP, its parent, or the wrong nested folder. Select the folder containing `manifest.json`.
- **The extension disappeared after cleaning Downloads:** put its files back at the original path, or reload it from a permanent folder.
- **No image:** confirm the camera works in Meet without Unsqueeze, check camera permissions, and close other camera apps.
- **Still squeezed:** check the camera filter, factor, and that you reloaded Meet after installation.

For help, [open a GitHub issue](https://github.com/RamonLinares/unsqueeze/issues) with your operating system, Chrome version, camera/capture setup, and the steps that reproduce the problem.
