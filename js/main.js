// Parallax leggero + fade-in + lazy load SoundCloud
(function(){
  const root = document.documentElement;
  const hero = document.querySelector('.hero');
  const frames = Array.from(document.querySelectorAll('iframe.sc-frame'));
  const intro = document.getElementById('intro');
  const slash = intro ? intro.querySelector('.slash') : null;
  const canvas = document.getElementById('hero-sword-canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  const scrollContainer = document.querySelector('.hero-scroll-container');
  const heroContent = document.querySelector('.hero-content');
  const loader = document.getElementById('hero-loader');
  const loaderProgress = document.getElementById('loader-progress');

  const isMobile = window.innerWidth <= 768;
  const frameStep = isMobile ? 2 : 1; // Load half the frames on mobile to save memory & render faster
  const totalFrames = 300;
  const images = [];       // raw HTMLImageElement
  const bitmaps = [];      // GPU-resident ImageBitmap (faster drawImage, especially on mobile)
  let loadedCount = 0;
  let currentFrameIndex = -1;

  // Lerping animation parameters
  let targetProgress = 0;
  let currentProgress = 0;

  // Fade-in hero content (CSS handles animation)
  document.body.classList.add('parallax-active');

  // --- COOKIE CONSENT LOGIC ---
  const cookieBanner = document.getElementById('cookie-banner');
  const btnAccept = document.getElementById('cookie-accept');
  const btnDecline = document.getElementById('cookie-decline');
  const btnReset = document.getElementById('reset-cookies');

  const getConsent = () => localStorage.getItem('cookie-consent');
  const setConsent = (val) => {
    localStorage.setItem('cookie-consent', val);
    if (val === 'accepted') loadAllIframes();
    cookieBanner.classList.remove('is-visible');
  };

  const loadAllIframes = () => {
    frames.forEach(f => {
      const src = f.getAttribute('data-src');
      if (src && !f.getAttribute('src')) {
        f.setAttribute('src', src);
      }
    });
  };

  // Intersection Observer per caricare gli iframe solo alla visibilità + CONSENSO
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries, obs) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const el = entry.target;
          if (getConsent() === 'accepted') {
            const src = el.getAttribute('data-src');
            if (src && !el.getAttribute('src')) {
              el.setAttribute('src', src);
            }
          }
          obs.unobserve(el);
        }
      }
    }, { rootMargin: '200px 0px' });
    frames.forEach(f => io.observe(f));
  } else if (getConsent() === 'accepted') {
    loadAllIframes();
  }

  // Mostra banner se manca il consenso
  if (!getConsent()) {
    setTimeout(() => cookieBanner.classList.add('is-visible'), 1000);
  }

  btnAccept?.addEventListener('click', () => setConsent('accepted'));
  btnDecline?.addEventListener('click', () => setConsent('declined'));
  btnReset?.addEventListener('click', () => {
    localStorage.removeItem('cookie-consent');
    window.location.reload();
  });

  // Respect reduced motion
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mq.matches) {
    document.body.classList.remove('parallax-active');
    window.removeEventListener('scroll', onScroll);
  }

  // Intro animation: katana slash reveals site
  const runIntro = () => {
    if (!intro || !slash || typeof window.anime === 'undefined' || mq.matches) {
      if (intro) intro.classList.add('is-hidden');
      return;
    }
    const tl = window.anime.timeline({ autoplay: true });
    // Prepare slash
    window.anime.set(slash, { rotate: 28, scaleY: 0, scaleX: 1, opacity: 1, translateX: '-55vw' });
    tl.add({
      targets: slash,
      scaleY: [0, 1.2, 0.9, 1],
      duration: 140,
      easing: 'easeOutQuad'
    })
    .add({
      targets: slash,
      translateX: ['-55vw', '55vw'],
      duration: 360,
      easing: 'easeInOutCubic',
      boxShadow: ['0 0 24px rgba(0,255,170,.8), 0 0 64px rgba(0,255,170,.5)','0 0 6px rgba(0,255,170,.4), 0 0 12px rgba(0,255,170,.25)']
    })
    .add({
      targets: '#intro',
      opacity: [1, 0],
      duration: 420,
      easing: 'easeOutQuad',
      complete: () => { intro.classList.add('is-hidden'); }
    }, '-=120');
  };

  // Draw a pre-scaled bitmap if available, otherwise fall back to raw image
  const drawFrame = (index) => {
    if (!canvas || !ctx) return;
    const src = bitmaps[index] || images[index];
    if (!src) return;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // If using a pre-scaled bitmap, it already matches canvas size — pure blit
    if (bitmaps[index]) {
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.drawImage(bitmaps[index], 0, 0);
      currentFrameIndex = index;
      return;
    }

    // Fallback: scale raw image with contain logic
    const img = src;
    const imgWidth = img.naturalWidth || img.width;
    const imgHeight = img.naturalHeight || img.height;
    if (!imgWidth || !imgHeight) return;

    const imgRatio = imgWidth / imgHeight;
    const canvasRatio = canvasWidth / canvasHeight;
    let drawWidth, drawHeight, x, y;
    if (canvasRatio > imgRatio) {
      drawWidth = canvasHeight * imgRatio; drawHeight = canvasHeight;
      x = (canvasWidth - drawWidth) / 2; y = 0;
    } else {
      drawWidth = canvasWidth; drawHeight = canvasWidth / imgRatio;
      x = 0; y = (canvasHeight - drawHeight) / 2;
    }
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(img, x, y, drawWidth, drawHeight);
    currentFrameIndex = index;
  };

  // Pre-scale all loaded images into GPU bitmaps at current canvas resolution
  const rebuildBitmaps = async () => {
    if (!canvas || !('createImageBitmap' in window)) return;
    const cw = canvas.width;
    const ch = canvas.height;
    // Run in small batches so the main thread isn't blocked
    const BATCH = 10;
    for (let i = 0; i < images.length; i += BATCH) {
      const batch = images.slice(i, i + BATCH);
      const promises = batch.map((img, j) => {
        if (!img || !img.naturalWidth) return Promise.resolve(null);
        // contain fit: calculate target draw rect
        const ir = img.naturalWidth / img.naturalHeight;
        const cr = cw / ch;
        let dw, dh, dx, dy;
        if (cr > ir) { dw = ch * ir; dh = ch; dx = (cw - dw) / 2; dy = 0; }
        else         { dw = cw; dh = cw / ir; dx = 0; dy = (ch - dh) / 2; }
        // Draw onto an offscreen canvas first so we can bitmapize the full frame
        const oc = new OffscreenCanvas(cw, ch);
        const octx = oc.getContext('2d');
        octx.clearRect(0, 0, cw, ch);
        octx.drawImage(img, dx, dy, dw, dh);
        return createImageBitmap(oc).then(bm => { bitmaps[i + j] = bm; }).catch(() => null);
      });
      await Promise.all(promises);
    }
  };

  const updateFrameOnScroll = () => {
    if (!scrollContainer) return;

    const rect = scrollContainer.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const totalScrollable = rect.height - viewportHeight;
    if (totalScrollable <= 0) return;

    const scrolled = -rect.top;
    targetProgress = Math.max(0, Math.min(1, scrolled / totalScrollable));
  };

  // Lerp-based RAF render loop: smoothly eases currentProgress toward targetProgress
  let rafRunning = false;
  const startRenderLoop = () => {
    if (rafRunning) return;
    rafRunning = true;
    const tick = () => {
      if (!rafRunning) return;

      const lerpFactor = isMobile ? 0.14 : 0.10;
      currentProgress += (targetProgress - currentProgress) * lerpFactor;

      // Snap to target when very close to avoid endless micro-ticks
      if (Math.abs(targetProgress - currentProgress) < 0.0005) {
        currentProgress = targetProgress;
      }

      const frameIndex = Math.min(images.length - 1, Math.floor(currentProgress * images.length));
      if (frameIndex !== currentFrameIndex) {
        drawFrame(frameIndex);
      }

      // Fade title overlay
      if (heroContent) {
        const opacity = Math.max(0.2, 1 - currentProgress * 1.5);
        heroContent.style.opacity = opacity;
        heroContent.style.transform = `translateY(${-currentProgress * 60}px)`;
        heroContent.style.visibility = 'visible';
      }

      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const resizeCanvas = () => {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    // Rebuild bitmaps at new resolution (async, non-blocking)
    rebuildBitmaps().then(() => {
      if (currentFrameIndex >= 0) drawFrame(currentFrameIndex);
      else updateFrameOnScroll();
    });
  };

  const preloadImages = () => {
    // On mobile, only load every other frame (half the frames) to reduce memory & improve perf
    const step = frameStep;
    const framesToLoad = [];
    for (let i = 1; i <= totalFrames; i += step) {
      framesToLoad.push(i);
    }
    const count = framesToLoad.length;
    let loaded = 0;

    framesToLoad.forEach((frameNum) => {
      const img = new Image();
      const numStr = String(frameNum).padStart(3, '0');
      img.src = `rendered_frames/frame_${numStr}.webp`;
      img.onload = () => {
        loaded++;
        if (loaderProgress) {
          loaderProgress.textContent = Math.round((loaded / count) * 100);
        }
        if (loaded === count) {
          if (loader) loader.classList.add('fade-out');
          resizeCanvas();
          // Build GPU bitmaps first, then start the render loop
          rebuildBitmaps().then(() => {
            updateFrameOnScroll();
            startRenderLoop();
          });
        }
      };
      img.onerror = () => {
        loaded++;
        if (loaded === count) {
          if (loader) loader.classList.add('fade-out');
          resizeCanvas();
          rebuildBitmaps().then(() => {
            updateFrameOnScroll();
            startRenderLoop();
          });
        }
      };
      images.push(img);
    });
  };

  window.addEventListener('resize', resizeCanvas);

  const onScroll = () => {
    root.style.setProperty('--scrollY', String(window.scrollY));
    updateFrameOnScroll();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Kick everything after load for better first paint
  window.addEventListener('load', () => {
    runIntro();
    preloadImages();
    // Safety fallback: auto-hide intro after 2.5s
    setTimeout(() => { if (intro && !intro.classList.contains('is-hidden')) intro.classList.add('is-hidden'); }, 2500);
  });
})();


