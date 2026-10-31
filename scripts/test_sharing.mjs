// Browser regression checks, without npm dependencies (Node >= 22 and Chrome).
// Run: node scripts/test_sharing.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSync, closeSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profile = await mkdtemp(path.join(tmpdir(), 'roccia-share-test-'));
const chromePath = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 18765;
const debugPort = 19226;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = openSync('/tmp/rocciamusic-browser-test.log', 'w');
// Byte ranges are needed to exercise seeking like GitHub Pages (Python's simple server omits them).
const server = createServer(async (request, response) => {
  try {
    let filename = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (!filename.startsWith(root + path.sep) && filename !== root) { response.writeHead(403).end(); return; }
    let info = await stat(filename);
    if (info.isDirectory()) { filename = path.join(filename, 'index.html'); info = await stat(filename); }
    const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };
    let start = 0, end = info.size - 1, code = 200;
    const headers = { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Accept-Ranges': 'bytes' };
    if (request.headers.range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range);
      if (!match || Number(match[1]) >= info.size) { response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end(); return; }
      start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end; code = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    }
    headers['Content-Length'] = end - start + 1;
    response.writeHead(code, headers);
    const stream = createReadStream(filename, { start, end });
    stream.on('error', () => response.destroy());
    response.on('close', () => stream.destroy());
    stream.pipe(response);
  } catch (_) { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
const chrome = spawn(chromePath, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', log, log] });
let socket;
try {
  let targets;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`, {signal: AbortSignal.timeout(1000)})).json();
      await fetch(`http://127.0.0.1:${port}/`, {signal: AbortSignal.timeout(1000)});
      ready = true;
      break;
    } catch (_) { await sleep(100); }
  }
  assert.ok(ready, 'Chrome and local server must start; see /tmp/rocciamusic-browser-test.log');
  console.log('Chrome and local server ready');
  socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextID = 0;
  const pending = new Map();
  const exceptions = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
    if (!message.id) return;
    const callbacks = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) callbacks.reject(new Error(JSON.stringify(message.error)));
    else callbacks.resolve(message.result);
  };
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextID;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timed out: ${method}`)); }, 15000);
    pending.set(id, { resolve: result => { clearTimeout(timer); resolve(result); }, reject: error => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression, userGesture = false) => {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const until = async (expression) => {
    for (let i = 0; i < 100; i++) {
      try { if (await evaluate(expression)) return; }
      catch (error) {
        if (!/navigated|context|Cannot find/i.test(error.message)) throw error;
      }
      await sleep(100);
    }
    throw new Error(`Timed out: ${expression}`);
  };
  const click = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`, true);
  const navigate = async (suffix = '') => {
    await command('Page.navigate', { url: `http://127.0.0.1:${port}/${suffix}` });
    const match = /^brani\/([^/]+)\/$/.exec(suffix);
    const expected = `http://127.0.0.1:${port}/${match ? '?track=' + match[1] : suffix}`;
    await until(`location.href === ${JSON.stringify(expected)} && document.readyState === 'complete' && document.querySelectorAll('.track-share-btn').length === 11`);
  };
  await command('Runtime.enable');
  await command('Page.enable');
  await command('Network.enable');
  await command('Network.setBlockedURLs', { urls: ['*cdnjs.cloudflare.com*'] });
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate();
  console.log('Mobile home and share controls loaded');
  assert.equal(await evaluate('Array.from(document.querySelectorAll(".track-audio")).filter(a => !a.paused).length'), 0, 'No audio on ordinary visit');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Mobile page fits');
  await click('[data-track-id="fake-rete-neurale"] .track-play-btn');
  await until('document.querySelector(".track-audio").currentTime > .1');
  const standby = await evaluate(`(() => {
    const video = document.querySelector('#hero-video');
    const before = video.paused;
    Object.defineProperty(document, 'hidden', {configurable:true, get:()=>window.__standby === true});
    window.__standby = true;
    document.dispatchEvent(new Event('visibilitychange'));
    const result = {audioPaused:document.querySelector('.track-audio').paused, wasPaused:before, videoPaused:video.paused};
    window.__standby = false;
    document.dispatchEvent(new Event('visibilitychange'));
    return result;
  })()`);
  assert.equal(standby.audioPaused, false, 'Decorative lifecycle never pauses music');
  if (!standby.wasPaused) assert.equal(standby.videoPaused, false, 'Preserve iOS video/audio session safeguard');
  const before = await evaluate('document.querySelector(".track-audio").currentTime');
  await evaluate(`window.__shares = []; Object.defineProperty(navigator, 'share', { configurable: true, value: data => { window.__shares.push(data); return Promise.resolve(); }});`);
  await click('[data-track-id="fake-rete-neurale"] .track-share-btn');
  assert.equal(await evaluate('window.__shares.length'), 1, 'A single tap opens native sharing directly');
  assert.deepEqual(await evaluate('window.__shares[0]'), {title: 'Fake - La Rete Neurale', url: `http://127.0.0.1:${port}/brani/fake-rete-neurale/`}, 'Share only the title and URL, never a file');
  assert.equal(await evaluate('document.querySelector("dialog")'), null, 'No intermediate menu');
  assert.equal(await evaluate('document.querySelector(".track-audio").paused'), false, 'Sharing does not pause audio');
  assert.ok(await evaluate('document.querySelector(".track-audio").currentTime') >= before, 'Sharing does not reset position');
  await evaluate(`Object.defineProperty(navigator, 'share', { configurable: true, value: data => { window.__shares.push(data); return new Promise(resolve => { window.__finishShare = resolve; }); }});`);
  await click('.track-share-btn');
  await click('[data-track-id="underground-impianti"] .track-share-btn');
  assert.equal(await evaluate('window.__shares.length'), 2, 'Repeated taps do not open duplicate share sheets');
  await evaluate('window.__finishShare()');
  await until('!document.querySelector(".track-share-btn").disabled');
  console.log('Direct native URL sharing and playback isolation verified');
  // Seek while playing, switch tracks, and advance on ended through the untouched player.
  await until('document.querySelector(".track-audio").readyState >= 3');
  await evaluate('document.querySelector(".track-audio").currentTime = 40');
  await until('document.querySelector(".track-audio").currentTime >= 40 && document.querySelector(".track-time-current").textContent !== "0:00"');
  await click('[data-track-id="underground-impianti"] .track-play-btn');
  await until('document.querySelector("[data-track-id=underground-impianti] .track-audio").currentTime > .1');
  assert.equal(await evaluate('document.querySelector(".track-audio").paused'), true, 'Previous audio stops');
  await click('[data-track-id="fake-rete-neurale"] .track-play-btn');
  await until('document.querySelector(".track-audio").currentTime >= 40.1 && !document.querySelector(".track-audio").paused');
  await click('[data-track-id="underground-impianti"] .track-play-btn');
  await until('!document.querySelector("[data-track-id=underground-impianti] .track-audio").paused');
  await evaluate('document.querySelector("[data-track-id=underground-impianti] .track-audio").dispatchEvent(new Event("ended"))');
  await until('document.querySelector("[data-track-id=doom-ego]").classList.contains("is-playing")');
  assert.equal(await evaluate('navigator.mediaSession.metadata.title'), "Doom - L'Ego", 'Lock-screen metadata follows next track');
  await sleep(650);
  await evaluate('document.querySelector("[data-track-id=doom-ego] .track-audio").pause()');
  // Link routing for all tracks: same selected track, one playing audio, no new player.
  const ids = await evaluate('Array.from(document.querySelectorAll(".giradischi-item"), item => item.dataset.trackId)');
  console.log('Player seek, next track and MediaSession verified');
  for (const id of ids) {
    await navigate(`brani/${id}/`);
    await until(`document.querySelector('[data-track-id="${id}"]').classList.contains('is-playing')`);
    assert.equal(await evaluate('document.querySelectorAll(".track-audio").length'), 11);
    assert.equal(await evaluate('Array.from(document.querySelectorAll(".track-audio")).filter(a => !a.paused).length'), 1);
  }
  console.log('All 11 incoming track links verified');
  // Simulated autoplay rejection, followed by an explicit tap; real audio still plays.
  const injection = await command('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__blockAudio = true;
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function() {
      if (this.tagName === 'AUDIO' && window.__blockAudio) return Promise.reject(new DOMException('Gesture required', 'NotAllowedError'));
      return originalPlay.call(this);
    };` });
  await navigate('?track=player-cuore');
  await until('document.querySelector(".shared-track-start") !== null');
  assert.equal(await evaluate('Array.from(document.querySelectorAll(".track-audio")).filter(a => !a.paused).length'), 0);
  await evaluate('window.__blockAudio = false');
  await click('.shared-track-start');
  await until('document.querySelector("[data-track-id=player-cuore]").classList.contains("is-playing")');
  assert.equal(await evaluate('document.querySelector(".shared-track-start")'), null);
  await command('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier });
  await navigate('?track=unknown');
  assert.equal(await evaluate('document.querySelector(".shared-track-start")'), null, 'Unknown link is ignored');
  assert.equal(await evaluate('Array.from(document.querySelectorAll(".track-audio")).filter(a => !a.paused).length'), 0);
  // A cancelled share does nothing; unsupported or failed native sharing copies the link.
  await evaluate(`window.__copied = []; Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText:url => {window.__copied.push(url); return Promise.resolve();}}}); Object.defineProperty(navigator, 'share', {configurable:true, value:()=>Promise.reject(new DOMException('Cancelled','AbortError'))});`);
  await click('.track-share-btn');
  await until('!document.querySelector(".track-share-btn").disabled');
  assert.equal(await evaluate('window.__copied.length'), 0, 'Cancellation does not copy anything');
  await evaluate(`Object.defineProperty(navigator, 'share', {configurable:true, value:()=>Promise.reject(new DOMException('Denied','NotAllowedError'))});`);
  await click('.track-share-btn');
  await until('window.__copied.length === 1');
  assert.equal(await evaluate('window.__copied[0]'), `http://127.0.0.1:${port}/brani/fake-rete-neurale/`);
  await evaluate(`Object.defineProperty(navigator, 'share', {configurable:true, value:undefined});`);
  await click('.track-share-btn');
  await until('window.__copied.length === 2');
  assert.ok((await evaluate('document.querySelector(".share-feedback").textContent')).includes('Link copiato'));
  await evaluate(`window.__prompts = []; window.prompt = (message,url) => { window.__prompts.push(url); return null; }; Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText:()=>Promise.reject(new Error('Denied'))}});`);
  await click('.track-share-btn');
  await until('window.__prompts.length === 1');
  assert.equal(await evaluate('window.__prompts[0]'), `http://127.0.0.1:${port}/brani/fake-rete-neurale/`);
  // Mobile visual QA and bounds, also at a narrow 320px viewport.
  await navigate();
  await evaluate('document.querySelector("[data-track-id=fake-rete-neurale]").scrollIntoView({block:"center"})');
  await sleep(500);
  let shot = await command('Page.captureScreenshot', { format: 'png' });
  await writeFile('/tmp/rocciamusic-mobile-sharing.png', Buffer.from(shot.data, 'base64'));
  await command('Emulation.setDeviceMetricsOverride', { width: 320, height: 568, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  assert.equal(exceptions.length, 0, JSON.stringify(exceptions));
  console.log('PASS: direct native URL sharing without files or extra menus, duplicate taps, cancellation, clipboard fallback, 11 deep links, mobile layout, playback isolation, seek, next track, MediaSession and autoplay fallback.');
  console.log('Screenshot: /tmp/rocciamusic-mobile-sharing.png');
} finally {
  if (socket) socket.close();
  chrome.kill();
  server.close();
  server.closeAllConnections();
  closeSync(log);
  await sleep(500);
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
