(() => {
  'use strict';
  if (!navigator.mediaDevices || globalThis.__unsqueezeInstalled) return;
  globalThis.__unsqueezeInstalled = true;
  const { normalize, defaults, matches, optimizeCapture, createPipeline } = globalThis.Unsqueeze;
  let settings = { ...defaults };
  let readyResolve;
  const ready = new Promise(resolve => { readyResolve = resolve; });
  const pipelines = new Set();
  function report(kind, message) { window.postMessage({ type: 'UNSQUEEZE_STATUS', kind, message }, location.origin); }
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.type !== 'UNSQUEEZE_SETTINGS') return;
    settings = normalize(event.data.settings);
    readyResolve();
  });
  const original = navigator.mediaDevices.getUserMedia;
  navigator.mediaDevices.getUserMedia = async function (constraints) {
    if (!constraints?.video) return original.call(this, constraints);
    // Read saved settings before requesting access; the bridge always answers this handshake.
    window.postMessage({ type: 'UNSQUEEZE_READY' }, location.origin);
    await Promise.race([ready, new Promise(resolve => setTimeout(resolve, 1500))]);
    const stream = await original.call(this, constraints);
    const source = stream.getVideoTracks()[0];
    if (!source || !settings.enabled || !matches(source.label, settings.camera)) {
      report('bypass', `Unchanged camera: ${source?.label || 'none'}. Check the camera filter in Unsqueeze if needed.`);
      return stream;
    }
    try {
      await optimizeCapture(source, settings);
      const pipeline = createPipeline(source, () => ({ ...settings, enabled: settings.enabled && matches(source.label, settings.camera) }),
        error => report('error', `Video processing stopped: ${error.message}. Toggle your camera off and on.`));
      pipelines.add(pipeline);
      const close = pipeline.close;
      pipeline.close = () => { close(); pipelines.delete(pipeline); };
      pipeline.track.addEventListener('ended', () => pipelines.delete(pipeline), { once: true });
      stream.removeTrack(source);
      stream.addTrack(pipeline.track);
      report('active', `Correcting ${source.label}. Your call receives the processed video.`);
      return stream;
    } catch (error) {
      // Never silently send squeezed video when correction was requested.
      stream.getTracks().forEach(track => track.stop());
      report('error', error.message);
      throw error;
    }
  };
  window.addEventListener('pagehide', () => { for (const p of pipelines) p.close(); pipelines.clear(); });
})();
