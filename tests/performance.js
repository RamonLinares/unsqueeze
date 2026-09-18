(async () => {
  const params = new URLSearchParams(location.search);
  const baseline = params.get('version') === 'baseline';
  const mode = params.get('mode') || 'efficient';
  const disabled = params.get('disabled') === '1';
  const script = document.createElement('script');
  script.src = baseline ? '../output/performance/baseline-core.js' : '../extension/core.js';
  await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = reject; document.head.append(script); });
  const inputCanvas = new OffscreenCanvas(1920, 1080);
  const ctx = inputCanvas.getContext('2d'); ctx.fillStyle = '#abcdef'; ctx.fillRect(0, 0, 1920, 1080);
  const producer = new MediaStreamTrackGenerator({ kind: 'video' });
  const inputWriter = producer.writable.getWriter();
  const draw = OffscreenCanvasRenderingContext2D.prototype.drawImage;
  const OriginalFrame = VideoFrame;
  let draws = 0, pixels = 0, snapshots = 0, synchronousRenderMs = 0;
  OffscreenCanvasRenderingContext2D.prototype.drawImage = function (...args) {
    const started = performance.now();
    try { return draw.apply(this, args); }
    finally { draws++; pixels += this.canvas.width * this.canvas.height; synchronousRenderMs += performance.now() - started; }
  };
  globalThis.VideoFrame = new Proxy(OriginalFrame, { construct(target, args) {
    const isOutput = args[0] instanceof OffscreenCanvas && args[0] !== inputCanvas;
    const started = performance.now();
    const result = Reflect.construct(target, args);
    if (isOutput) { snapshots++; synchronousRenderMs += performance.now() - started; }
    return result;
  }});
  const p = Unsqueeze.createPipeline(producer, () => ({ ...Unsqueeze.defaults, performance: mode, enabled: !disabled }));
  const reader = new MediaStreamTrackProcessor({ track: p.track }).readable.getReader();
  let outputs = 0, width, height;
  const drain = (async () => {
    for (;;) {
      const { value, done } = await reader.read(); if (done) return;
      outputs++; width = value.displayWidth; height = value.displayHeight; value.close();
    }
  })();
  try {
    for (let i = 0; i < 120; i++) {
      const frame = new OriginalFrame(inputCanvas, { timestamp: Math.round(i * 1e6 / 60) });
      try { await inputWriter.write(frame); } finally { frame.close(); }
      const deadline = performance.now() + 5000;
      while ((p.stats?.received ?? draws) < i + 1) {
        if (performance.now() > deadline) throw new Error('Benchmark pipeline stalled');
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    globalThis.benchmarkResult = { version: baseline ? '1.1 baseline' : '1.2', mode, disabled,
      input: '1920×1080 / 60 fps', inputFrames:120, outputs, outputSize:`${width}×${height}`,
      canvasDraws:draws, outputVideoFrameAllocations:snapshots, renderedPixels:pixels,
      synchronousRenderMs:Math.round(synchronousRenderMs*100)/100, pipelineStats:p.stats };
    document.getElementById('results').textContent = JSON.stringify(benchmarkResult, null, 2);
  } catch (error) {
    globalThis.benchmarkResult = { error: error.stack };
    document.getElementById('results').textContent = error.stack;
  } finally {
    p.close(); producer.stop(); await reader.cancel(); await drain;
    void inputWriter.abort().catch(() => {});
    OffscreenCanvasRenderingContext2D.prototype.drawImage = draw;
    globalThis.VideoFrame = OriginalFrame;
  }
})();
