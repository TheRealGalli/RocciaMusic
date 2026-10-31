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

  await command('Page.addScriptToEvaluateOnNewDocument', {source: `
    window.__perf = {draws:0, resizes:0, rafCalls:0, videoCalls:0, maxPending:0,maxPendingVideo:0};
    const active = new Set();
    const raf = window.requestAnimationFrame.bind(window);
    const cancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => {
      let id = raf(time => {active.delete(id); window.__perf.rafCalls++; callback(time);});
      active.add(id); window.__perf.maxPending = Math.max(window.__perf.maxPending, active.size); return id;
    };
    window.cancelAnimationFrame = id => {active.delete(id); cancel(id);};
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function(...args) {
      if(this.canvas.id === 'hero-canvas') window.__perf.draws++;
      return draw.apply(this,args);
    };
    for(const name of ['width','height']) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,name);
      Object.defineProperty(HTMLCanvasElement.prototype,name,{...descriptor,set(value){
        if(this.id === 'hero-canvas') window.__perf.resizes++;
        descriptor.set.call(this,value);
      }});
    }
    if(HTMLVideoElement.prototype.requestVideoFrameCallback) {
      const requestFrame = HTMLVideoElement.prototype.requestVideoFrameCallback;
      const cancelFrame = HTMLVideoElement.prototype.cancelVideoFrameCallback;
      const videoFrames = new Set();
      HTMLVideoElement.prototype.requestVideoFrameCallback = function(callback) {
        let id = requestFrame.call(this,(...args)=>{videoFrames.delete(id);window.__perf.videoCalls++;callback(...args);});
        videoFrames.add(id);window.__perf.maxPendingVideo=Math.max(window.__perf.maxPendingVideo,videoFrames.size);return id;
      };
      HTMLVideoElement.prototype.cancelVideoFrameCallback = function(id) {videoFrames.delete(id);return cancelFrame.call(this,id);};
    }
  `});
  if(process.argv.includes('--raf-fallback')) await command('Page.addScriptToEvaluateOnNewDocument',{source: 'Object.defineProperty(HTMLVideoElement.prototype,"requestVideoFrameCallback",{configurable:true,value:undefined});'});
  const transferred = { audio:0, video:0, images:0, other:0 };
  const requestTypes = new Map();
  const receive = socket.onmessage;
  socket.onmessage = event => {
    receive(event);
    const message = JSON.parse(event.data), p = message.params;
    if(message.method === 'Network.responseReceived') {
      const type = /\.mp3(?:\?|$)/.test(p.response.url) ? 'audio' : /\.webm(?:\?|$)/.test(p.response.url) ? 'video' : p.type === 'Image' ? 'images' : 'other';
      requestTypes.set(p.requestId,type);
    }
    if(message.method === 'Network.dataReceived') transferred[requestTypes.get(p.requestId)||'other'] += p.encodedDataLength;
  };
  await command('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:3,mobile:true});
  await command('Performance.enable');
  await navigate();
  await sleep(2500);
  const start = await evaluate('({...window.__perf})');
  await sleep(2000);
  const visible = await evaluate('({...window.__perf})');
  await evaluate('window.scrollTo(0,document.body.scrollHeight)');
  await sleep(300);
  const offStart = await evaluate('({...window.__perf})');
  await sleep(2000);
  const offEnd = await evaluate('({...window.__perf})');
  await evaluate('window.scrollTo(0,0)');
  await sleep(300);
  const resizeStart = await evaluate('window.__perf.resizes');
  await evaluate('for(let i=0;i<100;i++)window.dispatchEvent(new Event("resize"))');
  await sleep(100);
  const resizeEnd = await evaluate('window.__perf.resizes');
  await evaluate('for(let i=0;i<10;i++){window.dispatchEvent(new Event("pagehide"));window.dispatchEvent(new Event("pageshow"));}');
  await evaluate(`new Promise(resolve=>{let i=0;const tick=()=>{scrollTo(0,i%2?0:document.body.scrollHeight); if(++i<30)setTimeout(tick,32);else resolve();};tick();})`);
  const peak = await evaluate('({...window.__perf})');
  const metrics = await command('Performance.getMetrics');
  const result = {
    visibleDrawsIn2s:visible.draws-start.draws,
    visibleRAFCallbacksIn2s:visible.rafCalls-start.rafCalls,
    maxPendingRAF:peak.maxPending,
    maxPendingVideo:peak.maxPendingVideo,
    offscreenDrawsIn2s:offEnd.draws-offStart.draws,
    offscreenCallbacksIn2s:offEnd.rafCalls-offStart.rafCalls+offEnd.videoCalls-offStart.videoCalls,
    canvasResetsFor100IdenticalResizeEvents:resizeEnd-resizeStart,
    transferredBytes:transferred,
    imageSources:await evaluate('Array.from(document.querySelectorAll(".giradischi-img"),i=>({source:i.currentSrc,width:i.naturalWidth,height:i.naturalHeight}))'),
    canvas:await evaluate('({width:document.querySelector("#hero-canvas").width,height:document.querySelector("#hero-canvas").height})'),
    metrics:Object.fromEntries(metrics.metrics.filter(m=>['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','JSHeapUsedSize'].includes(m.name)).map(m=>[m.name,m.value])),
    exceptions
  };
  const label=process.argv[2]||'current';
  if(label !== 'before') {
    assert.equal(result.offscreenCallbacksIn2s, 0, 'No decorative callbacks offscreen');
    assert.equal(result.canvasResetsFor100IdenticalResizeEvents, 0, 'No duplicate allocations on toolbar resize');
    assert.ok(result.maxPendingRAF <= 1 && result.maxPendingVideo <= 1, 'At most one rendering chain');
    assert.equal(exceptions.length, 0, 'No browser exceptions');
  }
  await writeFile(`/tmp/rocciamusic-perf-${label}.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
} finally {
  if (socket) socket.close();
  chrome.kill();
  server.close();
  server.closeAllConnections();
  closeSync(log);
  await sleep(500);
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
