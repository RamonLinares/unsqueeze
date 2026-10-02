# Unsqueeze privacy information

Unsqueeze processes anamorphic webcam video locally so Google Meet can use the corrected image.

## Camera and microphone

Camera frames are processed in memory on your device. Unsqueeze does not record or upload them to a separate service. Google Meet still sends your video and audio as part of the call under its own policies. Unsqueeze leaves microphone tracks unchanged, and the standalone preview requests video only.

Camera access is controlled by Chrome and your operating system. Unsqueeze cannot bypass their permission prompts.

## Local preferences

Chrome’s local extension storage holds your correction setting, squeeze factor, framing, quality mode, camera-name filter, and the latest camera-status message. That message may contain a camera device label and timestamp. This information is not sent to the developer or synchronized by Unsqueeze to an external server.

## Services and permissions

Unsqueeze has no account system, analytics, telemetry, recording, advertising, payment service, remote code, or upload backend. Its content scripts run only on `meet.google.com`. Its `storage` permission is used for the local preferences and status above.

## Removing data

Remove Unsqueeze through `chrome://extensions` to remove the installation and its extension storage. Deleting the downloaded folder alone does not uninstall the extension.

## Support

GitHub handles downloads and issue reports under its own policies. Anything you post in this public repository’s issues is public. Do not include private call recordings, credentials, or personal information in reports.

For questions, use [the repository’s issue tracker](https://github.com/RamonLinares/unsqueeze/issues).
