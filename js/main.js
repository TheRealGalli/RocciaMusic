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
  const frameStep = isMobile ? 3 : 1; // Load 100 frames on mobile, 300 on desktop
  const totalFrames = 300;
  
  const images = []; // Array of preloaded Image objects
  const loadedIndices = new Set(); // Set of loaded image indices
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

  // Helper to find the closest loaded frame to avoid blank canvas
  const getClosestLoadedFrameIndex = (targetIndex) => {
    if (loadedIndices.has(targetIndex)) return targetIndex;
    let minDiff = Infinity;
    let closest = -1;
    for (const idx of loadedIndices) {
      const diff = Math.abs(idx - targetIndex);
      if (diff < minDiff) {
        minDiff = diff;
        closest = idx;
      }
    }
    return closest;
  };

  // Auto-resizing draw function
  const drawFrame = (index) => {
    if (!canvas || !ctx) return;

    // Find the closest loaded index
    const activeIndex = getClosestLoadedFrameIndex(index);
    if (activeIndex === -1) return;

    const img = images[activeIndex];
    if (!img) return;

    // Dynamically check/update canvas size to prevent 0px rendering bugs
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetWidth = Math.floor(rect.width * dpr);
    const targetHeight = Math.floor(rect.height * dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    if (canvasWidth === 0 || canvasHeight === 0) return;

    const imgWidth = img.naturalWidth || img.width;
    const imgHeight = img.naturalHeight || img.height;
    if (!imgWidth || !imgHeight) return;

    const imgRatio = imgWidth / imgHeight;
    const canvasRatio = canvasWidth / canvasHeight;

    let drawWidth, drawHeight, x, y;
    if (canvasRatio > imgRatio) {
      drawWidth = canvasHeight * imgRatio;
      drawHeight = canvasHeight;
      x = (canvasWidth - drawWidth) / 2;
      y = 0;
    } else {
      drawWidth = canvasWidth;
      drawHeight = canvasWidth / imgRatio;
      x = 0;
      y = (canvasHeight - drawHeight) / 2;
    }

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(img, x, y, drawWidth, drawHeight);
    currentFrameIndex = index;
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

  // Lerp-based RAF render loop
  let rafRunning = false;
  const startRenderLoop = () => {
    if (rafRunning) return;
    rafRunning = true;
    const tick = () => {
      if (!rafRunning) return;

      const lerpFactor = isMobile ? 0.15 : 0.10;
      currentProgress += (targetProgress - currentProgress) * lerpFactor;

      if (Math.abs(targetProgress - currentProgress) < 0.0005) {
        currentProgress = targetProgress;
      }

      const frameIndex = Math.min(totalFrames, Math.max(1, Math.floor(currentProgress * totalFrames)));
      if (frameIndex !== currentFrameIndex) {
        drawFrame(frameIndex);
      }

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
    if (currentFrameIndex >= 0) {
      drawFrame(currentFrameIndex);
    } else {
      updateFrameOnScroll();
    }
  };

  // Progressively preload all frames
  const preloadImages = () => {
    // 1. Load frame 1 immediately to show the hero right away
    const firstImg = new Image();
    firstImg.onload = () => {
      images[1] = firstImg;
      loadedIndices.add(1);

      // Hide loader instantly
      if (loader) loader.classList.add('fade-out');
      
      // Initial draw
      drawFrame(1);
      startRenderLoop();

      // 2. Load the remaining frames in the background
      const framesToLoad = [];
      for (let i = 1 + frameStep; i <= totalFrames; i += frameStep) {
        framesToLoad.push(i);
      }

      let loadedCount = 1;
      const totalToLoad = framesToLoad.length + 1;

      framesToLoad.forEach((frameNum) => {
        const img = new Image();
        img.onload = () => {
          images[frameNum] = img;
          loadedIndices.add(frameNum);
          loadedCount++;
          if (loaderProgress) {
            loaderProgress.textContent = Math.round((loadedCount / totalToLoad) * 100);
          }
        };
        img.onerror = () => {
          loadedCount++;
        };
        img.src = `rendered_frames/frame_${String(frameNum).padStart(3, '0')}.webp`;
      });
    };

    firstImg.onerror = () => {
      if (loader) loader.classList.add('fade-out');
    };

    firstImg.src = `rendered_frames/frame_001.webp`;
  };

  window.addEventListener('resize', resizeCanvas);

  const onScroll = () => {
    root.style.setProperty('--scrollY', String(window.scrollY));
    updateFrameOnScroll();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Run immediately
  runIntro();
  preloadImages();
  setTimeout(() => { if (intro && !intro.classList.contains('is-hidden')) intro.classList.add('is-hidden'); }, 2500);
})();
