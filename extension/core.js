/* Shared by the call interceptor and the private preview. No network requests. */
(() => {
  'use strict';
  const defaults = Object.freeze({ schemaVersion: 2, enabled: true, factor: 1.5, framing: 'crop', camera: '*', performance: 'efficient' });
  const profiles = Object.freeze({ efficient: { width: 1280, height: 720, fps: 30 }, low: { width: 640, height: 360, fps: 24 }, source: { width: Infinity, height: Infinity, fps: Infinity } });
  function normalize(value = {}) {
    if (!value || typeof value !== 'object') value = {};
    const factor = Number(value.factor);
    let camera = typeof value.camera === 'string' ? value.camera.trim().slice(0, 200) : '*';
    // Migrate the original vendor preset; v2 filters are literal user-entered camera names.
    if (value.schemaVersion !== 2 && camera === 'sony') camera = '*';
    return {
      schemaVersion: 2,
      performance: ['efficient', 'low', 'source'].includes(value.performance) ? value.performance : 'efficient',
      enabled: value.enabled !== false,
      factor: Number.isFinite(factor) && factor >= 1 && factor <= 3 ? Math.round(factor * 100) / 100 : 1.5,
      framing: value.framing === 'fit' ? 'fit' : 'crop',
      camera: camera || '*'
    };
  }
  function matches(label, setting) {
    if (setting === '*') return true;
    return label.toLowerCase().includes(setting.toLowerCase());
  }
  function outputSize(width, height, mode) {
    const limit = profiles[mode] || profiles.efficient;
    const scale = Math.min(1, limit.width / width, limit.height / height);
    if (scale === 1) return { width, height };
    return { width: Math.max(2, Math.round(width * scale / 2) * 2), height: Math.max(2, Math.round(height * scale / 2) * 2) };
  }
  function captureHints(constraints, current, mode) {
    const result = { ...constraints };
    if (mode === 'source') return result;
    const limit = profiles[mode] || profiles.efficient;
    const size = outputSize(current.width || 1280, current.height || 720, mode);
    for (const [key, cap] of Object.entries({ ...size, frameRate: limit.fps })) {
      const original = constraints[key];
      const range = typeof original === 'object' && original !== null ? { ...original } : {};
      // Respect the call's mandatory requirements; output processing remains capped separately.
      if (range.exact !== undefined || (range.min !== undefined && range.min > cap)) continue;
      range.max = Math.min(range.max ?? Infinity, cap);
      range.ideal = Math.max(range.min || 0, Math.min(range.ideal ?? (typeof original === 'number' ? original : cap), range.max));
      result[key] = range;
    }
    return result;
  }
  async function optimizeCapture(source, settings) {
    if (settings.performance === 'source') return;
    const hints = captureHints(source.getConstraints(), source.getSettings(), settings.performance);
    // Some cameras expose fixed modes. Keep their working capture configuration on failure.
    try { await source.applyConstraints(hints); } catch (_) { /* Rendering is still bounded. */ }
  }
  function rectangle(sw, sh, ow, oh, factor, framing) {
    const scale = (framing === 'fit' ? Math.min : Math.max)(ow / (sw * factor), oh / sh);
    const width = sw * factor * scale, height = sh * scale;
    return { x: (ow - width) / 2, y: (oh - height) / 2, width, height };
  }
  function render(ctx, image, sw, sh, ow, oh, settings) {
    const r = rectangle(sw, sh, ow, oh, settings.enabled ? settings.factor : 1, settings.framing);
    if (settings.framing === 'fit') {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, ow, oh);
    }
    ctx.drawImage(image, r.x, r.y, r.width, r.height);
  }

  // Preserve camera semantics for transformed tracks, including clones made by WebRTC clients.
  const owned = new WeakMap();
  let native;
  function installTrackHooks() {
    if (native) return;
    const proto = MediaStreamTrack.prototype;
    native = Object.fromEntries(['stop', 'clone', 'getSettings', 'getConstraints', 'getCapabilities', 'applyConstraints'].map(k => [k, proto[k]]));
    native.enabled = Object.getOwnPropertyDescriptor(proto, 'enabled');
    proto.stop = function () {
      const pipeline = owned.get(this);
      native.stop.call(this);
      if (pipeline) pipeline.release(this);
    };
    proto.clone = function () {
      const clone = native.clone.call(this);
      const pipeline = owned.get(this);
      if (pipeline && clone.readyState === 'live') pipeline.register(clone);
      return clone;
    };
    for (const method of ['getConstraints', 'getCapabilities', 'applyConstraints']) {
      proto[method] = function (...args) {
        return native[method].apply(owned.get(this)?.source || this, args);
      };
    }
    proto.getSettings = function () {
      const pipeline = owned.get(this);
      if (!pipeline) return native.getSettings.call(this);
      const { width, height, frameRate } = pipeline.output;
      const sourceSettings = native.getSettings.call(pipeline.source);
      const rate = Math.min(sourceSettings.frameRate || Infinity, frameRate);
      return { ...sourceSettings, width, height, aspectRatio: width / height,
        ...(Number.isFinite(rate) ? { frameRate: rate } : {}) };
    };
    Object.defineProperty(proto, 'enabled', {
      ...native.enabled,
      set(value) {
        native.enabled.set.call(this, value);
        owned.get(this)?.syncEnabled();
      }
    });
    const cloneStream = MediaStream.prototype.clone;
    MediaStream.prototype.clone = function () {
      return this.getTracks().some(t => owned.has(t))
        ? new MediaStream(this.getTracks().map(t => t.clone())) : cloneStream.call(this);
    };
  }

  function createPipeline(source, readSettings, onError = console.error) {
    if (!globalThis.MediaStreamTrackProcessor || !globalThis.MediaStreamTrackGenerator) {
      throw new Error('This browser cannot process camera frames. Use a current version of Google Chrome or Microsoft Edge.');
    }
    installTrackHooks();
    const processor = new MediaStreamTrackProcessor({ track: source, maxBufferSize: 1 });
    const generator = new MediaStreamTrackGenerator({ kind: 'video' });
    const initial = source.getSettings();
    const initialSettings = readSettings();
    const size = outputSize(initial.width || 1280, initial.height || 720, initialSettings.performance);
    const canvas = new OffscreenCanvas(size.width, size.height);
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) throw new Error('Could not initialize video processing.');
    const reader = processor.readable.getReader();
    const writer = generator.writable.getWriter();
    const outputs = new Set();
    let closed = false;
    let previousTimestamp = -Infinity, nextTimestamp = -Infinity, previousKey = '';
    let active = true;
    const stats = { received: 0, rendered: 0, forwarded: 0, dropped: 0, renderedPixels: 0 };
    const pipeline = {
      source, canvas, track: native.clone.call(generator),
      stats,
      output: { ...size, frameRate: Math.min(initial.frameRate || Infinity, (profiles[initialSettings.performance] || profiles.efficient).fps) },
      register(track) {
        outputs.add(track);
        owned.set(track, pipeline);
        Object.defineProperty(track, 'label', { configurable: true, get: () => source.label });
      },
      syncEnabled() {
        active = [...outputs].some(t => t.readyState === 'live' && t.enabled);
        source.enabled = active;
      },
      release(track) {
        outputs.delete(track);
        if (!outputs.size) pipeline.close();
        else pipeline.syncEnabled();
      },
      close() {
        if (closed) return;
        closed = true;
        source.removeEventListener('ended', sourceEnded);
        native.stop.call(source);
        native.stop.call(generator);
        void reader.cancel().catch(() => {});
        void writer.abort().catch(() => {});
        for (const track of outputs) {
          if (track.readyState === 'live') {
            native.stop.call(track);
            track.dispatchEvent(new Event('ended'));
          }
        }
        outputs.clear();
      }
    };
    function sourceEnded() { pipeline.close(); }
    source.addEventListener('ended', sourceEnded);
    pipeline.register(pipeline.track);
    pipeline.track.enabled = source.enabled;
    void (async () => {
      try {
        while (!closed) {
          const { value: frame, done } = await reader.read();
          if (done) break;
          let output;
          try {
            if (closed) break;
            stats.received++;
            const settings = readSettings();
            const limit = profiles[settings.performance] || profiles.efficient;
            const correcting = active && settings.enabled && settings.factor !== 1;
            const fps = active ? limit.fps : 1;
            const key = `${fps}:${correcting}:${settings.factor}:${settings.framing}`;
            // Gate before any drawing or allocation. Reset on setting changes or timestamp discontinuities.
            if (key !== previousKey || frame.timestamp < previousTimestamp) nextTimestamp = -Infinity;
            previousKey = key;
            previousTimestamp = frame.timestamp;
            if (frame.timestamp + 500 < nextTimestamp) { stats.dropped++; continue; }
            const interval = 1e6 / fps;
            nextTimestamp = Number.isFinite(nextTimestamp) && frame.timestamp < nextTimestamp + interval
              ? nextTimestamp + interval : frame.timestamp + interval;
            const sw = frame.displayWidth, sh = frame.displayHeight;
            pipeline.output.frameRate = fps;
            if (!correcting) {
              // Preserve the original VideoFrame; no canvas copy, rescale or new VideoFrame.
              pipeline.output.width = sw; pipeline.output.height = sh;
              stats.forwarded++;
              await writer.write(frame);
            } else {
              const dimensions = outputSize(sw, sh, settings.performance);
              if (canvas.width !== dimensions.width || canvas.height !== dimensions.height) {
                canvas.width = dimensions.width; canvas.height = dimensions.height;
              }
              pipeline.output.width = dimensions.width; pipeline.output.height = dimensions.height;
              render(ctx, frame, sw, sh, canvas.width, canvas.height, settings);
              output = new VideoFrame(canvas, { timestamp: frame.timestamp });
              stats.rendered++; stats.renderedPixels += canvas.width * canvas.height;
              await writer.write(output);
            }
          } finally { frame.close(); output?.close(); }
        }
      } catch (error) { if (!closed) onError(error); }
      finally { pipeline.close(); }
    })();
    return pipeline;
  }
  globalThis.Unsqueeze = { defaults, profiles, normalize, matches, rectangle, render, outputSize, captureHints, optimizeCapture, createPipeline };
})();
