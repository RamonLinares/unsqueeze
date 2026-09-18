globalThis.runUnsqueezeChecks = async () => {
  const results = [];
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  async function check(name, body) {
    try { await body(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, error: error.stack }); }
  }
  function pattern(width = 640, height = 360) {
    const canvas = new OffscreenCanvas(width, height), ctx = canvas.getContext('2d');
    ctx.fillStyle = '#222'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(width / 2, height / 2, height / 6, height / 4, 0, 0, Math.PI * 2); ctx.fill();
    const generator = new MediaStreamTrackGenerator({ kind: 'video' });
    const writer = generator.writable.getWriter();
    let timestamp = 0;
    return { track: generator, async write(at) {
      const frame = new VideoFrame(canvas, { timestamp: at ?? (timestamp += 33333) });
      try { await writer.write(frame); } finally { frame.close(); }
    }, close() { generator.stop(); void writer.abort().catch(() => {}); } };
  }
  async function pixels(track, write) {
    const clone = track.clone();
    const reader = new MediaStreamTrackProcessor({ track: clone }).readable.getReader();
    const read = reader.read(); await write();
    let timeout;
    const { value: frame } = await Promise.race([read, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('No video frame in 5 seconds')), 5000); })]);
    clearTimeout(timeout);
    const canvas = new OffscreenCanvas(frame.displayWidth, frame.displayHeight), ctx = canvas.getContext('2d');
    ctx.drawImage(frame, 0, 0); frame.close();
    await reader.cancel();
    clone.stop();
    return { data: ctx.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height };
  }
  function bounds(image) {
    let left = image.width, right = -1, top = image.height, bottom = -1;
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
      if (image.data[(y * image.width + x) * 4] > 220) {
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    return { width: right - left + 1, height: bottom - top + 1 };
  }
  await check('Corrected outgoing pixels form a circle; live bypass and letterbox', async () => {
    const input = pattern(); let settings = { ...Unsqueeze.defaults };
    const p = Unsqueeze.createPipeline(input.track, () => settings);
    try {
      let b = bounds(await pixels(p.track, input.write));
      assert(Math.abs(b.width - b.height) < 3, JSON.stringify(b));
      settings = { ...settings, enabled: false };
      const rendersBefore = p.stats.rendered;
      b = bounds(await pixels(p.track, input.write));
      assert(Math.abs(b.width / b.height - 2 / 3) < .02, 'Bypass must retain the squeezed ellipse');
      assert(p.stats.rendered === rendersBefore && p.stats.forwarded === 1, 'Bypass must not redraw the camera frame');
      settings = { ...settings, enabled: true, framing: 'fit' };
      const image = await pixels(p.track, input.write); b = bounds(image);
      assert(Math.abs(b.width - b.height) < 3, 'Letterbox circle is distorted');
      assert(image.data[0] === 0, 'Letterbox bars must be black');
    } finally { p.close(); input.close(); }
  });
  await check('4K input scales to 720p / 360p without distortion; source mode and bypass retain dimensions', async () => {
    const input = pattern(3840, 2160); let settings = { ...Unsqueeze.defaults };
    const p = Unsqueeze.createPipeline(input.track, () => settings);
    try {
      let image = await pixels(p.track, input.write), b = bounds(image);
      assert(image.width === 1280 && image.height === 720, 'Efficient cap failed');
      assert(Math.abs(b.width - b.height) < 3, 'Efficient circle distorted');
      assert(p.track.getSettings().width === 1280, 'Track dimensions differ from output');
      settings = { ...settings, performance: 'low' };
      image = await pixels(p.track, input.write); b = bounds(image);
      assert(image.width === 640 && image.height === 360, 'Low-power cap failed');
      assert(Math.abs(b.width - b.height) < 3, 'Low-power circle distorted');
      settings = { ...settings, performance: 'source' };
      image = await pixels(p.track, input.write);
      assert(image.width === 3840 && image.height === 2160, 'Source quality capped');
      settings = { ...settings, performance: 'efficient', enabled: false };
      const renders = p.stats.rendered;
      image = await pixels(p.track, input.write);
      assert(image.width === 3840 && p.track.getSettings().width === 3840, 'Bypass dimensions incorrect');
      assert(p.stats.rendered === renders, 'Bypass rendered unnecessarily');
      settings = { ...settings, enabled: true, factor: 1 };
      await pixels(p.track, input.write);
      assert(p.stats.rendered === renders, '1× rendered unnecessarily');
    } finally { p.close(); input.close(); }
  });
  await check('60 fps input is throttled before rendering; muting skips rendering and resumes immediately', async () => {
    const input = pattern(), p = Unsqueeze.createPipeline(input.track, () => Unsqueeze.defaults);
    const reader = new MediaStreamTrackProcessor({ track: p.track }).readable.getReader();
    const drain = (async () => { while (true) { const {value,done} = await reader.read(); if (done) return; value.close(); } })();
    const waitFor = async count => {
      const deadline = performance.now() + 3000;
      while (p.stats.received < count) {
        if (performance.now() > deadline) throw new Error('Pipeline stalled');
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    };
    try {
      for (let i = 0; i < 120; i++) { await input.write(Math.round(i * 1e6 / 60)); await waitFor(i + 1); }
      assert(p.stats.rendered === 60 && p.stats.dropped === 60, JSON.stringify(p.stats));
      const renders = p.stats.rendered;
      p.track.enabled = false;
      await input.write(2000000); await waitFor(121);
      assert(p.stats.rendered === renders, 'Muted track rendered');
      p.track.enabled = true;
      await input.write(2016667); await waitFor(122);
      assert(p.stats.rendered === renders + 1, 'Resume waited for the muted heartbeat');
    } finally { p.close(); input.close(); await reader.cancel(); await drain; }
  });
  await check('Capture optimization preserves a working camera if lower constraints are unavailable', async () => {
    const stream = await navigator.mediaDevices.getUserMedia({video:{width:1920,height:1080,frameRate:60}});
    const source = stream.getVideoTracks()[0];
    try {
      await Unsqueeze.optimizeCapture(source, Unsqueeze.defaults);
      assert(source.getSettings().width <= 1280 && source.getSettings().height <= 720, 'Capture did not reduce');
      assert(source.getSettings().frameRate <= 30, 'Capture FPS did not reduce');
    } finally { source.stop(); }
    let tried = false;
    await Unsqueeze.optimizeCapture({ getSettings: () => ({width:1920,height:1080}), getConstraints: () => ({}), applyConstraints: async () => { tried = true; throw new DOMException('Unsupported', 'OverconstrainedError'); } }, Unsqueeze.defaults);
    assert(tried, 'Fixed-mode camera fallback not exercised');
  });
  await check('Track clones and stream clones retain ownership; final stop releases input', async () => {
    const input = pattern(), p = Unsqueeze.createPipeline(input.track, () => Unsqueeze.defaults);
    const clone = p.track.clone();
    const streamClone = new MediaStream([clone]).clone().getVideoTracks()[0];
    p.track.stop(); clone.stop();
    assert(input.track.readyState === 'live', 'Remaining clone must keep source live');
    const b = bounds(await pixels(streamClone, input.write));
    assert(Math.abs(b.width - b.height) < 3, 'Cloned video stopped working');
    streamClone.stop();
    assert(input.track.readyState === 'ended', 'Camera did not release'); input.close();
  });
  await check('Disabling all output tracks disables camera capture; re-enable restores it', async () => {
    const input = pattern(), p = Unsqueeze.createPipeline(input.track, () => Unsqueeze.defaults);
    try {
      const clone = p.track.clone(); p.track.enabled = false;
      assert(input.track.enabled, 'Enabled clone must keep input enabled');
      clone.enabled = false; assert(!input.track.enabled, 'Source remains enabled');
      clone.enabled = true; assert(input.track.enabled, 'Source did not re-enable');
      clone.stop(); p.track.stop(); assert(input.track.readyState === 'ended', 'Final stop did not release camera');
    } finally { p.close(); input.close(); }
  });
  await check('Camera constraints and device identity survive processing; audio stays separate', async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: true });
    const source = stream.getVideoTracks()[0], original = source.getSettings();
    const p = Unsqueeze.createPipeline(source, () => Unsqueeze.defaults);
    try {
      assert(p.track.getSettings().deviceId === original.deviceId, 'Device identity lost');
      assert(p.track.label === source.label, 'Camera label lost');
      await p.track.applyConstraints({ width: { exact: 320 }, height: { exact: 240 } });
      assert(source.getSettings().width === 320, 'Camera constraints not forwarded');
      p.track.stop(); assert(source.readyState === 'ended', 'Stop did not release camera');
      assert(stream.getAudioTracks()[0].readyState === 'live', 'Video stop must not stop microphone');
    } finally { p.close(); stream.getTracks().forEach(t => t.stop()); }
  });
  await check('Processed track travels through a real WebRTC loopback', async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 }, audio: false });
    const p = Unsqueeze.createPipeline(stream.getVideoTracks()[0], () => Unsqueeze.defaults);
    const a = new RTCPeerConnection(), b = new RTCPeerConnection();
    const pendingA = [], pendingB = [];
    a.onicecandidate = e => { if (e.candidate) { if (b.remoteDescription) void b.addIceCandidate(e.candidate); else pendingB.push(e.candidate); } };
    b.onicecandidate = e => { if (e.candidate) { if (a.remoteDescription) void a.addIceCandidate(e.candidate); else pendingA.push(e.candidate); } };
    let remote;
    b.ontrack = e => { remote = e.track; };
    try {
      a.addTrack(p.track, new MediaStream([p.track]));
      await a.setLocalDescription(await a.createOffer()); await b.setRemoteDescription(a.localDescription);
      for (const c of pendingB) await b.addIceCandidate(c);
      await b.setLocalDescription(await b.createAnswer()); await a.setRemoteDescription(b.localDescription);
      for (const c of pendingA) await a.addIceCandidate(c);
      const frame = await pixels(remote, async () => {});
      assert(frame.width > 0 && frame.height > 0, 'Remote video has no dimensions');
      results.push({ name: 'WebRTC received dimensions', detail: `${frame.width}×${frame.height}`, passed: true });
    } finally { a.close(); b.close(); p.close(); stream.getTracks().forEach(t => t.stop()); }
  });
  return results;
};
if (document.getElementById('results')) runUnsqueezeChecks().then(results => {
  globalThis.unsqueezeTestResults = results;
  document.getElementById('results').textContent = JSON.stringify(results, null, 2);
});
