// Safari-engine regression tests. Requires Playwright and its WebKit browser.
// Run: node scripts/test_webkit.mjs (PLAYWRIGHT_MODULE can point to an installed package).
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
const { webkit, devices } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 18766;
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
const browser = await webkit.launch();
try {
  const context = await browser.newContext({...devices['iPhone 13'], reducedMotion:'no-preference'});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/cdnjs.cloudflare.com/**', route => route.abort());
  await page.addInitScript(() => {
    // Permission is scoped to the media element that received a real tap.
    const unlocked = new WeakSet();
    document.addEventListener('click', event => {
      if (!event.isTrusted) return;
      window.__audioGesture = true;
      setTimeout(() => { window.__audioGesture = false; }, 0);
    }, true);
    const nativePlay = HTMLMediaElement.prototype.play;
    window.__musicStarts = [];
    HTMLMediaElement.prototype.play = function() {
      if (this.tagName === 'AUDIO') {
        window.__musicStarts.push({videoPaused:document.querySelector('#hero-video').paused});
        if (window.__rejectNextPlay) {
          window.__rejectNextPlay = false;
          return Promise.reject(new DOMException('Playback unavailable', 'NotAllowedError'));
        }
        if (window.__audioGesture) unlocked.add(this);
        if (!unlocked.has(this)) return Promise.reject(new DOMException('Tap required', 'NotAllowedError'));
      }
      return nativePlay.call(this);
    };
    window.__mediaHandlers = {};
    const session = navigator.mediaSession;
    if (session) {
      const setHandler = session.setActionHandler.bind(session);
      session.setActionHandler = (action, handler) => {
        window.__mediaHandlers[action] = handler;
        return setHandler(action, handler);
      };
    }
  });
  const home = `http://127.0.0.1:${port}/`;
  await page.goto(home);
  await page.waitForFunction(() => document.querySelectorAll('.track-share-btn').length === 11);
  assert.equal(await page.locator('audio').count(), 1);
  assert.equal(await page.locator('#music-audio').getAttribute('src'), null);
  await page.locator('[data-track-id="fake-rete-neurale"] .track-play-btn').click();
  await page.waitForFunction(() => document.querySelector('#music-audio').currentTime > .1);
  console.log('WebKit real audio, mobile hero isolation and initial tap verified');
  assert.equal(await page.locator('#hero-video').evaluate(video => video.paused), true);
  assert.ok(await page.evaluate(() => window.__musicStarts.every(start => start.videoPaused)));
  assert.equal(await page.evaluate(() => navigator.mediaSession.metadata.title), 'Fake - La Rete Neurale');
  const cover = await page.evaluate(() => navigator.mediaSession.metadata.artwork[0]);
  assert.equal(cover.sizes, '512x512');
  assert.deepEqual(await page.evaluate(src => new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve([image.naturalWidth, image.naturalHeight]);
    image.onerror = reject; image.src = src;
  }), cover.src), [512,512]);

  await page.locator('[data-track-id="fake-rete-neurale"] .track-play-btn').click();
  assert.equal(await page.locator('#music-audio').evaluate(audio => audio.paused), true);
  await page.evaluate(() => window.__mediaHandlers.play());
  await page.waitForFunction(() => !document.querySelector('#music-audio').paused);
  await page.evaluate(() => {
    window.__mediaHandlers.pause();
    window.__mediaHandlers.seekto({seekTime:55});
    window.__mediaHandlers.play();
  });
  await page.waitForFunction(() => document.querySelector('#music-audio').currentTime >= 55.1);
  await page.locator('[data-track-id="underground-impianti"] .track-play-btn').click();
  await page.waitForFunction(() => document.querySelector('#music-audio').dataset.track === 'underground-impianti' && document.querySelector('#music-audio').currentTime > .1);
  await page.locator('[data-track-id="fake-rete-neurale"] .track-play-btn').click();
  await page.waitForFunction(() => document.querySelector('#music-audio').dataset.track === 'fake-rete-neurale' && document.querySelector('#music-audio').currentTime >= 55.1);

  // Simulate visibility lifecycle events; this does not simulate iOS suspending a process.
  const before = await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {configurable:true, get:() => window.__hidden === true});
    window.__hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pagehide'));
    return document.querySelector('#music-audio').currentTime;
  });
  await page.waitForFunction(time => document.querySelector('#music-audio').currentTime > time + .2, before);
  await page.evaluate(() => {
    const audio = document.querySelector('#music-audio');
    audio.currentTime = audio.duration - .2;
  });
  await page.waitForFunction(() => document.querySelector('#music-audio').dataset.track === 'underground-impianti' && document.querySelector('#music-audio').currentTime > .1);
  assert.equal(await page.evaluate(() => navigator.mediaSession.metadata.title), 'Underground - Gli Impianti');
  await page.evaluate(() => window.__mediaHandlers.previoustrack());
  await page.waitForFunction(() => document.querySelector('#music-audio').dataset.track === 'fake-rete-neurale' && document.querySelector('#music-audio').currentTime > .1);
  const ids = await page.locator('.giradischi-item').evaluateAll(items => items.map(item => item.dataset.trackId));
  for (const id of [...ids.slice(1), ids[0]]) {
    await page.evaluate(() => window.__mediaHandlers.nexttrack());
    await page.waitForFunction(id => document.querySelector('#music-audio').dataset.track === id && document.querySelector('#music-audio').currentTime > .1, id);
    assert.ok((await page.evaluate(() => navigator.mediaSession.metadata.artwork[0].src)).endsWith(`/${id}.jpg`));
  }
  await page.evaluate(() => {
    window.__hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pageshow'));
    window.__mediaHandlers.pause();
    window.__rejectNextPlay = true;
  });
  await page.locator('[data-track-id="fake-rete-neurale"] .track-play-btn').click();
  await page.waitForFunction(() => document.querySelector('.track-playback-error') !== null);
  assert.equal(await page.locator('.is-playing').count(), 0);
  await page.locator('[data-track-id="fake-rete-neurale"] .track-play-btn').click();
  await page.waitForFunction(() => !document.querySelector('#music-audio').paused);
  assert.equal(await page.locator('.track-playback-error').count(), 0);
  await page.screenshot({path:'/tmp/rocciamusic-webkit-player.png'});

  await page.goto(home + 'brani/player-cuore/');
  await page.waitForURL('**/?track=player-cuore');
  await page.locator('.shared-track-start').click();
  await page.waitForFunction(() => document.querySelector('#music-audio').currentTime > .1);
  assert.equal(await page.locator('#music-audio').getAttribute('data-track'), 'player-cuore');
  await page.waitForFunction(() => !document.querySelector('.shared-track-start'));
  assert.deepEqual(errors, []);
  await context.close();

  // Unsupported or rejected optional platform APIs must not prevent music.
  const fallback = await browser.newContext({...devices['iPhone 13'], reducedMotion:'reduce'});
  const quiet = await fallback.newPage();
  quiet.on('pageerror', error => errors.push(error.message));
  await quiet.route('**/cdnjs.cloudflare.com/**', route => route.abort());
  await quiet.addInitScript(() => {
    Object.defineProperty(navigator, 'audioSession', {get() { throw new Error('Unsupported'); }});
    Object.defineProperty(navigator, 'mediaSession', {get() { throw new Error('Unsupported'); }});
  });
  await quiet.goto(home);
  await quiet.locator('[data-track-id="fake-rete-neurale"] .track-play-btn').click();
  await quiet.waitForFunction(() => document.querySelector('#music-audio').currentTime > .1);
  assert.equal(await quiet.locator('#hero-video source').getAttribute('src'), null);
  assert.deepEqual(errors, []);
  await fallback.close();
  console.log('PASS WebKit with iPhone profile: real audio, one element permission, artwork, lock-screen handlers, paused seek, resume position, simulated background, real end-to-next, full playlist loop, retry, deep link and optional API fallback. Physical iPhone lock-screen verification remains necessary.');
} catch (error) {
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      console.error('WebKit player state:', await page.evaluate(() => {
        const audio = document.querySelector('#music-audio');
        return {url:location.href, paused:audio?.paused, time:audio?.currentTime, ready:audio?.readyState,
          error:audio?.error?.message, message:document.querySelector('.track-playback-error')?.textContent,
          selected:audio?.dataset.track, starts:window.__musicStarts, gesture:window.__audioGesture};
      }).catch(() => 'Page closed'));
    }
  }
  throw error;
} finally {
  await browser.close();
  server.close();
  server.closeAllConnections();
}
