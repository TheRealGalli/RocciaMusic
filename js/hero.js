// Decorative video only. Audio transport and MediaSession live in main.js.
(function () {
  'use strict';
  const video = document.getElementById('hero-video');
  const canvas = document.getElementById('hero-canvas');
  const poster = document.getElementById('hero-poster');
  const section = document.querySelector('.hero');
  if (!video || !canvas || !poster || !section) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return; // The HTML poster remains visible without canvas support.

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(pointer: coarse), (max-width: 640px)').matches;
  const saveData = !!navigator.connection?.saveData;
  const useVideoFrames = typeof video.requestVideoFrameCallback === 'function';
  const frameInterval = 1000 / (mobile ? 24 : 30);
  const source = video.querySelector('source');
  let visible = !('IntersectionObserver' in window);
  let pageActive = true;
  let failed = false;
  let frameID = null;
  let frameGeneration = 0;
  let lastDraw = -Infinity;
  let playPending = false;
  let gesturePending = false;
  let musicSessionActive = false;
  const gestureEvent = 'PointerEvent' in window ? 'pointerup' : 'touchend';

  const audioIsPlaying = () => Array.from(document.querySelectorAll('.track-audio'))
    .some((audio) => !audio.paused && !audio.ended);
  const shouldAnimate = () => pageActive && visible && !document.hidden && !motion.matches && !saveData && !failed && !musicSessionActive;
  const stopDrawing = () => {
    ++frameGeneration;
    if (frameID !== null) {
      if (useVideoFrames) video.cancelVideoFrameCallback(frameID);
      else cancelAnimationFrame(frameID);
      frameID = null;
    }
  };
  const showPoster = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    poster.style.visibility = '';
  };
  const syncSize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    // Safari toolbar changes can emit resize without changing this square.
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    poster.style.visibility = '';
  };
  const draw = () => {
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
    const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
    const width = video.videoWidth * scale;
    const height = video.videoHeight * scale;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    poster.style.visibility = 'hidden';
  };
  const scheduleFrame = () => {
    if (frameID !== null || !shouldAnimate() || video.paused) return;
    const generation = frameGeneration;
    const callback = (time) => {
      if (generation !== frameGeneration) return;
      frameID = null;
      if (!shouldAnimate() || video.paused) return;
      // Optimized sources already have 24/30 fps. Draw each decoded frame;
      // only the RAF fallback needs an explicit cap to avoid 60/120 Hz redraws.
      if (useVideoFrames || time - lastDraw >= frameInterval - 1) {
        draw();
        lastDraw = time;
      }
      scheduleFrame();
    };
    frameID = useVideoFrames ? video.requestVideoFrameCallback(callback) : requestAnimationFrame(callback);
  };
  const retryGesture = () => {
    if (!gesturePending || !shouldAnimate()) return;
    gesturePending = false;
    document.removeEventListener(gestureEvent, retryGesture);
    reconcile();
  };
  const reconcile = () => {
    if (!shouldAnimate()) {
      stopDrawing();
      // Preserve the site's iOS audio-session safeguard: never pause the video
      // or reset media resources while a song is playing, including in standby.
      if (!audioIsPlaying() && !video.paused) video.pause();
      if (motion.matches || saveData || failed || musicSessionActive) showPoster();
      return;
    }
    if (source && !source.hasAttribute('src')) {
      source.src = mobile ? source.dataset.mobileSrc : source.dataset.src;
      video.preload = 'auto';
      video.load();
    }
    if (!video.paused) { scheduleFrame(); return; }
    if (playPending || gesturePending) return;
    playPending = true;
    video.play().then(() => {
      playPending = false;
      if (shouldAnimate()) scheduleFrame();
      else reconcile();
    }).catch((error) => {
      playPending = false;
      stopDrawing();
      showPoster();
      if (error.name === 'NotAllowedError' && !gesturePending) {
        gesturePending = true;
        document.addEventListener(gestureEvent, retryGesture, { passive: true });
      }
    });
  };

  video.muted = true;
  video.playsInline = true;
  // On phones, retire the decorative media BEFORE music starts. Pausing or
  // restarting a second media element during standby can disturb Safari audio.
  window.addEventListener('rocciamusic:beforeplay', () => {
    if (!mobile || musicSessionActive) return;
    musicSessionActive = true;
    stopDrawing();
    if (!video.paused) video.pause();
    showPoster();
  });
  video.addEventListener('playing', scheduleFrame);
  video.addEventListener('loadeddata', scheduleFrame);
  video.addEventListener('pause', stopDrawing);
  video.addEventListener('error', () => { failed = true; reconcile(); });
  document.addEventListener('visibilitychange', reconcile);
  window.addEventListener('pagehide', () => { pageActive = false; stopDrawing(); });
  window.addEventListener('pageshow', () => { pageActive = true; reconcile(); });
  motion.addEventListener('change', reconcile);
  if ('ResizeObserver' in window) new ResizeObserver(syncSize).observe(canvas);
  else window.addEventListener('resize', syncSize, { passive: true });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      reconcile();
    }, { threshold: 0 }).observe(section);
  }
  syncSize();
  reconcile();
})();
