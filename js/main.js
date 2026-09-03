// RocciaMusic Main JS - Hero video loop, intro animation & SoundCloud lazy load
(function(){
  const root = document.documentElement;
  const heroVideo = document.getElementById('hero-video');
  const heroCanvas = document.getElementById('hero-canvas');
  const frames = Array.from(document.querySelectorAll('iframe.sc-frame'));
  const intro = document.getElementById('intro');
  const slash = intro ? intro.querySelector('.slash') : null;

  // Active parallax state
  document.body.classList.add('parallax-active');

  // --- HERO VIDEO → CANVAS RENDERING ---
  if (heroVideo && heroCanvas) {
    const ctx = heroCanvas.getContext('2d');
    heroVideo.muted = true;
    heroVideo.playsInline = true;
    let isHeroVisible = true;

    // Load lightweight 19KB poster image for instant 0ms display on mobile
    const posterImg = new Image();
    let posterLoaded = false;
    posterImg.onload = () => {
      posterLoaded = true;
      syncCanvasSize();
      drawPoster();
    };
    posterImg.src = 'hero_poster.webp';

    const drawPoster = () => {
      if (!posterLoaded || (heroVideo && !heroVideo.paused && heroVideo.readyState >= 2)) return;
      const cw = heroCanvas.width;
      const ch = heroCanvas.height;
      if (!cw || !ch) return;
      const iw = posterImg.naturalWidth || 892;
      const ih = posterImg.naturalHeight || 690;
      const scale = Math.min(cw / iw, ch / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (cw - dw) / 2;
      const dy = (ch - dh) / 2;
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(posterImg, dx, dy, dw, dh);
    };

    // Pause canvas drawing loop when hero is out of viewport to save mobile CPU/GPU
    if ('IntersectionObserver' in window) {
      const heroObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          isHeroVisible = entry.isIntersecting;
          if (isHeroVisible && heroVideo.paused) {
            heroVideo.play().catch(() => {});
          }
        }
      }, { threshold: 0.01 });
      const heroSection = document.querySelector('.hero');
      if (heroSection) heroObserver.observe(heroSection);
    }

    const syncCanvasSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = heroCanvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        heroCanvas.width = Math.round(rect.width * dpr);
        heroCanvas.height = Math.round(rect.height * dpr);
      }
    };
    window.addEventListener('resize', () => {
      syncCanvasSize();
      if (heroVideo.paused) drawPoster();
    });

    const drawVideoFrame = () => {
      if (isHeroVisible) {
        if (!heroVideo.paused && !heroVideo.ended && heroVideo.readyState >= 2) {
          const vw = heroVideo.videoWidth;
          const vh = heroVideo.videoHeight;
          if (vw && vh) {
            const cw = heroCanvas.width;
            const ch = heroCanvas.height;
            const scale = Math.min(cw / vw, ch / vh);
            const dw = vw * scale;
            const dh = vh * scale;
            const dx = (cw - dw) / 2;
            const dy = (ch - dh) / 2;

            ctx.clearRect(0, 0, cw, ch);
            ctx.drawImage(heroVideo, dx, dy, dw, dh);

            // Seamless loop: reset 0.4s before end
            if (heroVideo.duration && heroVideo.currentTime >= heroVideo.duration - 0.4) {
              heroVideo.currentTime = 0.01;
            }
          }
        } else if (posterLoaded && heroVideo.paused) {
          drawPoster();
        }
      }
      requestAnimationFrame(drawVideoFrame);
    };

    const startPlayback = () => {
      syncCanvasSize();
      drawPoster();
      const promise = heroVideo.play();
      if (promise !== undefined) {
        promise.catch(() => {
          const resume = () => {
            heroVideo.play().catch(() => {});
            window.removeEventListener('click', resume);
            window.removeEventListener('touchstart', resume);
            window.removeEventListener('pointerdown', resume);
          };
          window.addEventListener('click', resume);
          window.addEventListener('touchstart', resume);
          window.addEventListener('pointerdown', resume);
        });
      }
      drawVideoFrame();
    };

    heroVideo.addEventListener('loadeddata', startPlayback);
    heroVideo.addEventListener('ended', () => { heroVideo.currentTime = 0.01; heroVideo.play().catch(() => {}); });
    
    // Force immediate start on load & DOMReady
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startPlayback);
    } else {
      startPlayback();
    }
  }

  // --- COOKIE CONSENT LOGIC ---
  const cookieBanner = document.getElementById('cookie-banner');
  const btnAccept = document.getElementById('cookie-accept');
  const btnDecline = document.getElementById('cookie-decline');
  const btnReset = document.getElementById('reset-cookies');

  const getConsent = () => localStorage.getItem('cookie-consent');
  const setConsent = (val) => {
    localStorage.setItem('cookie-consent', val);
    if (val === 'accepted') loadAllIframes();
    cookieBanner?.classList.remove('is-visible');
  };

  const loadAllIframes = () => {
    frames.forEach(f => {
      const src = f.getAttribute('data-src');
      if (src && !f.getAttribute('src')) {
        f.setAttribute('src', src);
      }
    });
  };

  // Intersection Observer to lazy load SoundCloud embeds on scroll after consent
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

  // Show consent banner if consent is missing
  if (!getConsent() && cookieBanner) {
    setTimeout(() => cookieBanner.classList.add('is-visible'), 1000);
  }

  btnAccept?.addEventListener('click', () => setConsent('accepted'));
  btnDecline?.addEventListener('click', () => setConsent('declined'));
  btnReset?.addEventListener('click', () => {
    localStorage.removeItem('cookie-consent');
    window.location.reload();
  });

  // Respect reduced motion settings
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mq.matches) {
    document.body.classList.remove('parallax-active');
  }

  // Intro animation: katana slash reveals website
  const runIntro = () => {
    if (!intro || !slash || typeof window.anime === 'undefined' || mq.matches) {
      if (intro) intro.classList.add('is-hidden');
      return;
    }
    const tl = window.anime.timeline({ autoplay: true });
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

  // Scroll handler for subtle header & parallax variables
  const onScroll = () => {
    root.style.setProperty('--scrollY', String(window.scrollY));
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Run intro immediately
  runIntro();
  setTimeout(() => { if (intro && !intro.classList.contains('is-hidden')) intro.classList.add('is-hidden'); }, 2500);
})();
