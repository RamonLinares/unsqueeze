(() => {
  const $ = id => document.getElementById(id);
  let settings = { ...Unsqueeze.defaults }, stream, pipeline, demoTimer, busy = false, generation = 0;
  const storage = globalThis.chrome?.storage?.local;
  const factorControl = Unsqueeze.bindFactorControl();
  function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
  function stop() {
    generation++;
    clearInterval(demoTimer);
    pipeline?.close(); pipeline = null;
    stream?.getTracks().forEach(t => t.stop()); stream = null;
    $('video').srcObject = null;
    $('stage').classList.remove('running'); $('stop').disabled = true;
    status('Camera off. The camera is available for your call.');
  }
  async function refreshDevices() {
    const selected = $('device').value;
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
    $('device').replaceChildren(new Option('Default camera', ''));
    devices.forEach((d, i) => $('device').add(new Option(d.label || `Camera ${i + 1}`, d.deviceId)));
    $('device').value = devices.some(d => d.deviceId === selected) ? selected : '';
  }
  function synthetic() {
    const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
    const ctx = canvas.getContext('2d');
    function draw() {
      ctx.fillStyle = '#21332b'; ctx.fillRect(0, 0, 1280, 720);
      ctx.save(); ctx.translate(640, 360); ctx.scale(1 / 1.5, 1);
      ctx.strokeStyle = '#435c4a'; ctx.lineWidth = 2;
      for (let x = -960; x <= 960; x += 90) { ctx.beginPath(); ctx.moveTo(x, -360); ctx.lineTo(x, 360); ctx.stroke(); }
      for (let y = -360; y <= 360; y += 90) { ctx.beginPath(); ctx.moveTo(-960, y); ctx.lineTo(960, y); ctx.stroke(); }
      ctx.fillStyle = '#d5ef9f'; ctx.beginPath(); ctx.arc(0, 0, 155, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = '#17281d'; ctx.textAlign = 'center'; ctx.font = '24px sans-serif'; ctx.fillText('A circle, again.', 0, 8);
      ctx.fillStyle = '#d5ef9f'; ctx.font = '18px sans-serif'; ctx.fillText('UNSQUEEZE  ·  1.5× TEST INPUT', 0, 265);
      ctx.beginPath(); ctx.arc(Math.sin(Date.now() / 1000) * 450, -260, 9, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    draw(); demoTimer = setInterval(draw, 1000 / 30);
    return canvas.captureStream(30);
  }
  async function start(demo) {
    if (busy) return;
    busy = true; stop(); const token = generation;
    $('start').disabled = $('demo').disabled = true;
    try {
      status(demo ? 'Preparing test pattern…' : 'Requesting camera access…');
      const acquired = demo ? synthetic() : await navigator.mediaDevices.getUserMedia({ audio: false, video: {
        ...($('device').value ? { deviceId: { exact: $('device').value } } : {}),
        width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 }
      } });
      if (token !== generation) { acquired.getTracks().forEach(t => t.stop()); return; }
      stream = acquired;
      if (!demo) await Unsqueeze.optimizeCapture(stream.getVideoTracks()[0], settings);
      if (token !== generation) { acquired.getTracks().forEach(t => t.stop()); return; }
      pipeline = Unsqueeze.createPipeline(stream.getVideoTracks()[0], () => settings, error => { stop(); status(error.message, true); });
      $('video').srcObject = new MediaStream([pipeline.track]);
      await $('video').play();
      $('stage').classList.add('running'); $('stop').disabled = false;
      status(demo ? 'Test pattern · simulated 1.5× squeezed input · no camera in use.' : `${stream.getVideoTracks()[0].label} · corrected preview · stop before opening your call.`);
      if (!demo) await refreshDevices();
    } catch (error) { stop(); status(`${error.name}: ${error.message} Close other camera apps, check Chrome’s camera permission, then retry.`, true); }
    finally { busy = false; $('start').disabled = $('demo').disabled = false; }
  }
  async function init() {
    if (storage) settings = Unsqueeze.normalize((await storage.get('settings')).settings);
    $('factor').value = settings.factor; $('framing').value = settings.framing; $('enabled').checked = settings.enabled; $('performance').value = settings.performance;
    factorControl.sync();
    for (const id of ['factor', 'framing', 'enabled', 'performance']) $(id).addEventListener('change', async () => {
      if (!$('factor').reportValidity()) return;
      settings = Unsqueeze.normalize({ ...settings, factor: $('factor').value, framing: $('framing').value, enabled: $('enabled').checked, performance: $('performance').value });
      if (storage) {
        const latest = Unsqueeze.normalize((await storage.get('settings')).settings);
        await storage.set({ settings: { ...settings, camera: latest.camera } });
      }
    });
    $('start').addEventListener('click', () => start(false));
    if (storage) chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.settings) return;
      settings = Unsqueeze.normalize(changes.settings.newValue);
      $('factor').value = settings.factor; $('framing').value = settings.framing; $('enabled').checked = settings.enabled; $('performance').value = settings.performance;
      factorControl.sync();
    });
    $('demo').addEventListener('click', () => start(true));
    $('stop').addEventListener('click', stop);
    navigator.mediaDevices?.addEventListener('devicechange', () => void refreshDevices().catch(() => {}));
    void refreshDevices().catch(() => {});
  }
  window.addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (stream || busy)) {
      stop();
      status('Preview stopped to save power while this tab is hidden. Click Start camera or Test pattern to resume.');
    }
  });
  void init();
})();
