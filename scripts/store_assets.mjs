// Render Chrome Web Store screenshots and promo tiles at their required sizes.
// Usage: node scripts/store_assets.mjs [path-to-chrome]. Needs Node 22+ and desktop Chrome; no npm packages.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'store', 'images');
const CHROME = process.argv[2] || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOTS = [
  { file: 'screenshot-1-preview.png', path: '/extension/preview.html', width: 1280, height: 800, demo: true },
  { file: 'screenshot-2-before-after.png', path: '/store/src/shots.html?shot=compare', width: 1280, height: 800 },
  { file: 'screenshot-3-popup.png', path: '/store/src/shots.html?shot=popup', width: 1280, height: 800 },
  { file: 'screenshot-4-framing.png', path: '/store/src/shots.html?shot=framing', width: 1280, height: 800 },
  { file: 'promo-small-440x280.png', path: '/store/src/shots.html?shot=promo', width: 440, height: 280 },
  { file: 'promo-marquee-1400x560.png', path: '/store/src/shots.html?shot=marquee', width: 1400, height: 560 },
];
// Extension pages read chrome.storage; on a plain http page, stand in with empty storage so defaults load.
const STORAGE_STUB = `window.chrome = Object.assign(window.chrome || {}, { storage: {
  local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener() {} } } });`;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

const server = createServer(async (req, res) => {
  const file = resolve(ROOT, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(ROOT + sep)) return res.writeHead(403).end();
  let body;
  try { body = await readFile(file); } catch { return res.writeHead(404).end(); }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const profile = await mkdtemp(join(tmpdir(), 'unsqueeze-store-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--hide-scrollbars', '--lang=en-US', '--accept-lang=en-US', '--force-device-scale-factor=1', '--no-first-run', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' } });
const wsUrl = await new Promise((ok, fail) => {
  let log = '';
  chrome.stderr.on('data', d => { log += d; const m = log.match(/DevTools listening on (ws:\S+)/); if (m) ok(m[1]); });
  chrome.once('exit', code => fail(new Error(`Chrome exited (${code}): ${log}`)));
});

const socket = new WebSocket(wsUrl);
await new Promise(r => socket.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(), listeners = [];
socket.addEventListener('message', ({ data }) => {
  const msg = JSON.parse(data);
  if (msg.id && pending.has(msg.id)) { const { ok, fail } = pending.get(msg.id); pending.delete(msg.id); msg.error ? fail(new Error(msg.error.message)) : ok(msg.result); }
  else listeners.forEach(l => l(msg));
});
const send = (method, params = {}, sessionId) => new Promise((ok, fail) => {
  pending.set(++id, { ok, fail }); socket.send(JSON.stringify({ id, method, params, sessionId }));
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

try {
  await mkdir(OUT, { recursive: true });
  for (const shot of SHOTS) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Page.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', { width: shot.width, height: shot.height, deviceScaleFactor: 1, mobile: false }, sessionId);
    await send('Emulation.setLocaleOverride', { locale: 'en-US' }, sessionId);
    await send('Page.addScriptToEvaluateOnNewDocument', { source: STORAGE_STUB }, sessionId);
    const loaded = new Promise(r => listeners.push(m => m.sessionId === sessionId && m.method === 'Page.loadEventFired' && r()));
    await send('Page.navigate', { url: origin + shot.path }, sessionId);
    await loaded;
    if (shot.demo) await send('Runtime.evaluate', { expression: "document.getElementById('demo').click()" }, sessionId);
    await sleep(1500);
    // macOS Chrome formats number inputs with the system locale (e.g. 1,5); show the English-locale value.
    await send('Runtime.evaluate', { expression: `[document, ...[...document.querySelectorAll('iframe')].map(f => f.contentDocument)]
      .flatMap(d => [...d.querySelectorAll('input[type=number]')]).forEach(i => { const v = i.value; i.type = 'text'; i.value = v; })` }, sessionId);
    const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: shot.width, height: shot.height, scale: 1 } }, sessionId);
    await writeFile(join(OUT, shot.file), Buffer.from(data, 'base64'));
    await send('Target.closeTarget', { targetId });
    console.log(`${shot.file} · ${shot.width}×${shot.height}`);
  }
} finally {
  socket.close(); chrome.kill(); server.close();
  await sleep(300); await rm(profile, { recursive: true, force: true });
}
