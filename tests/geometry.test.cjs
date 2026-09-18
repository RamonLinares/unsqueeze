const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../extension/core.js');
const { rectangle, normalize, matches, outputSize, captureHints } = globalThis.Unsqueeze;
test('1.5× crop stretches horizontally and removes equal left/right edges', () => {
  assert.deepEqual(rectangle(1920, 1080, 1920, 1080, 1.5, 'crop'), { x: -480, y: 0, width: 2880, height: 1080 });
});
test('1.5× letterbox retains all pixels with 180px top/bottom bars', () => {
  assert.deepEqual(rectangle(1920, 1080, 1920, 1080, 1.5, 'fit'), { x: 0, y: 180, width: 1920, height: 720 });
});
test('unsqueezed 1× and 4:3 input geometry', () => {
  assert.deepEqual(rectangle(1280, 720, 1280, 720, 1, 'crop'), { x: 0, y: 0, width: 1280, height: 720 });
  assert.deepEqual(rectangle(640, 480, 640, 480, 1.5, 'fit'), { x: 0, y: 80, width: 640, height: 320 });
});
test('camera filters match literal names without brand-specific behavior', () => {
  assert.ok(matches('Studio USB Capture', 'usb capture'));
  assert.equal(matches('Integrated Webcam', 'USB Capture'), false);
  assert.equal(matches('USB Capture', 'USB.*'), false);
  assert.ok(matches('USB Video', '*'));
});
test('custom lens ratios and defaults', () => {
  for (const factor of [1, 1.25, 1.33, 1.42, 1.5, 1.8, 2, 3]) assert.equal(normalize({ factor }).factor, factor);
  assert.equal(normalize({ factor: '1.42' }).factor, 1.42);
  assert.equal(normalize({ factor: 3.1 }).factor, 1.5);
  assert.equal(normalize().camera, '*');
});
test('legacy preferences migrate while preserving ratio, framing and on/off', () => {
  assert.deepEqual(normalize({ camera: 'sony', factor: 1.33, framing: 'fit', enabled: false }),
    { schemaVersion: 2, camera: '*', factor: 1.33, framing: 'fit', enabled: false, performance: 'efficient' });
  assert.equal(normalize({ camera: '*', factor: 2 }).factor, 2);
  assert.equal(normalize({ schemaVersion: 2, camera: 'sony' }).camera, 'sony');
  assert.equal(normalize({ schemaVersion: 2, camera: ' USB Capture ' }).camera, 'USB Capture');
});
test('quality caps keep source proportions and never upscale', () => {
  assert.deepEqual(outputSize(3840, 2160, 'efficient'), { width: 1280, height: 720 });
  assert.deepEqual(outputSize(1920, 1080, 'low'), { width: 640, height: 360 });
  assert.deepEqual(outputSize(640, 480, 'efficient'), { width: 640, height: 480 });
  assert.deepEqual(outputSize(1080, 1920, 'efficient'), { width: 406, height: 720 });
  assert.deepEqual(outputSize(3840, 2160, 'source'), { width: 3840, height: 2160 });
  assert.equal(normalize({ performance: 'bad' }).performance, 'efficient');
});
test('camera hints lower optional capture demands and preserve hard constraints', () => {
  const original = { deviceId: { exact: 'camera-id' }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } };
  const hints = captureHints(original, { width: 1920, height: 1080 }, 'efficient');
  assert.deepEqual(hints.width, { ideal: 1280, max: 1280 });
  assert.deepEqual(hints.height, { ideal: 720, max: 720 });
  assert.deepEqual(hints.frameRate, { ideal: 30, max: 30 });
  assert.deepEqual(hints.deviceId, original.deviceId);
  assert.equal(original.width.ideal, 1920);
  const mandatory = { width: { exact: 1920 }, height: { min: 1080 }, frameRate: { max: 15 } };
  const limited = captureHints(mandatory, { width: 1920, height: 1080 }, 'efficient');
  assert.deepEqual(limited.width, mandatory.width);
  assert.deepEqual(limited.height, mandatory.height);
  assert.equal(limited.frameRate.max, 15);
  assert.deepEqual(captureHints(original, {}, 'source'), original);
});
test('untrusted settings cannot cause invalid geometry', () => {
  assert.equal(normalize({ factor: 0 }).factor, 1.5);
  assert.equal(normalize({ factor: Infinity }).factor, 1.5);
  assert.equal(normalize({ framing: 'bad' }).framing, 'crop');
  assert.equal(normalize({ enabled: false }).enabled, false);
  assert.equal(normalize(null).factor, 1.5);
  assert.equal(normalize({ camera: '' }).camera, '*');
});
