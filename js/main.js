// RocciaMusic Main JS - Hero video loop, intro animation & SoundCloud lazy load
(function(){
  const root = document.documentElement;
  const heroVideo = document.getElementById('hero-video');
  const frames = Array.from(document.querySelectorAll('iframe.sc-frame'));
  const intro = document.getElementById('intro');
  const slash = intro ? intro.querySelector('.slash') : null;

  // Active parallax state
  document.body.classList.add('parallax-active');

  // --- HERO VIDEO LOOP AUTOMATION ---
  if (heroVideo) {
    // Force muted & playsinline for autoplay compliance across browsers/iOS
    heroVideo.muted = true;
    heroVideo.playsInline = true;

    const playVideo = () => {
      const promise = heroVideo.play();
      if (promise !== undefined) {
        promise.catch(err => {
          console.warn('Hero video autoplay prevented or delayed:', err);
          // Try playing again on user interaction if blocked
          const resumeOnInteraction = () => {
            heroVideo.play();
            window.removeEventListener('click', resumeOnInteraction);
            window.removeEventListener('touchstart', resumeOnInteraction);
          };
          window.addEventListener('click', resumeOnInteraction);
          window.addEventListener('touchstart', resumeOnInteraction);
        });
      }
    };

    // Trigger video playback immediately and on metadata load
    playVideo();
    heroVideo.addEventListener('loadeddata', playVideo);

    // Precise loop trigger to prevent end-pause hiccup
    const checkSeamlessLoop = () => {
      if (heroVideo && !heroVideo.paused && heroVideo.duration) {
        // Trim off end freeze (0.4s cutoff) for seamless continuous motion
        if (heroVideo.currentTime >= heroVideo.duration - 0.4) {
          heroVideo.currentTime = 0.01;
        }
      }
      requestAnimationFrame(checkSeamlessLoop);
    };
    requestAnimationFrame(checkSeamlessLoop);

    // Backup ended event listener
    heroVideo.addEventListener('ended', () => {
      heroVideo.currentTime = 0.01;
      playVideo();
    });
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
