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

  const totalFrames = 300;
  const images = [];
  let loadedCount = 0;
  let currentFrameIndex = -1;

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

  // --- FRAME-BY-FRAME CANVAS SWORD ANIMATION ---
  const drawFrame = (index) => {
    if (!canvas || !ctx || !images[index]) return;
    
    const img = images[index];
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    const imgWidth = img.naturalWidth || img.width;
    const imgHeight = img.naturalHeight || img.height;
    
    if (!imgWidth || !imgHeight) return;

    const imgRatio = imgWidth / imgHeight;
    const canvasRatio = canvasWidth / canvasHeight;
    
    let drawWidth, drawHeight, x, y;
    
    // We use "contain" scaling to ensure the entire sword scene is fully visible on any screen size/ratio
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
    if (!scrollContainer || images.length < totalFrames) return;
    
    const rect = scrollContainer.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    // Calculate progress (0 to 1) based on scroll position of the track
    const totalScrollable = rect.height - viewportHeight;
    if (totalScrollable <= 0) return;
    
    const scrolled = -rect.top;
    let progress = scrolled / totalScrollable;
    progress = Math.max(0, Math.min(1, progress));
    
    const frameIndex = Math.min(totalFrames - 1, Math.floor(progress * totalFrames));
    
    if (frameIndex !== currentFrameIndex) {
      requestAnimationFrame(() => drawFrame(frameIndex));
    }
    
    // Handle fading of the text overlay based on progress (minimum 0.2 opacity so it doesn't disappear)
    if (heroContent) {
      const opacity = Math.max(0.2, 1 - progress * 1.5);
      const translateY = -progress * 60;
      heroContent.style.opacity = opacity;
      heroContent.style.transform = `translateY(${translateY}px)`;
      heroContent.style.visibility = 'visible';
    }
  };

  const resizeCanvas = () => {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    if (currentFrameIndex >= 0) {
      drawFrame(currentFrameIndex);
    } else {
      updateFrameOnScroll();
    }
  };

  const preloadImages = () => {
    let loaded = 0;
    for (let i = 1; i <= totalFrames; i++) {
      const img = new Image();
      const numStr = String(i).padStart(3, '0');
      img.src = `rendered_frames/frame_${numStr}.webp`;
      img.onload = () => {
        loaded++;
        if (loaderProgress) {
          loaderProgress.textContent = Math.round((loaded / totalFrames) * 100);
        }
        if (loaded === totalFrames) {
          if (loader) {
            loader.classList.add('fade-out');
          }
          resizeCanvas();
          updateFrameOnScroll();
        }
      };
      img.onerror = () => {
        loaded++;
        if (loaded === totalFrames) {
          if (loader) loader.classList.add('fade-out');
          resizeCanvas();
          updateFrameOnScroll();
        }
      };
      images.push(img);
    }
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


