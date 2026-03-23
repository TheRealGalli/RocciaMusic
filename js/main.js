// Parallax leggero + fade-in + lazy load SoundCloud
(function(){
  const root = document.documentElement;
  const hero = document.querySelector('.hero');
  const frames = Array.from(document.querySelectorAll('iframe.sc-frame'));
  const intro = document.getElementById('intro');
  const slash = intro ? intro.querySelector('.slash') : null;
  const lightningCanvas = document.getElementById('fx-lightning');

  // Fade-in hero content (CSS handles animation)
  document.body.classList.add('parallax-active');

  // Parallax via scroll
  const onScroll = () => {
    // Store scrollY in a CSS var for animations.css
    root.style.setProperty('--scrollY', String(window.scrollY));
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

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

  // Lightning effect on hero canvas
  const Lightning = () => {
    if (!lightningCanvas) return null;
    const ctx = lightningCanvas.getContext('2d');
    let width = 0, height = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let running = false;
    const resize = () => {
      const rect = hero.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      lightningCanvas.width = Math.floor(width * dpr);
      lightningCanvas.height = Math.floor(height * dpr);
      lightningCanvas.style.width = width + 'px';
      lightningCanvas.style.height = height + 'px';
      ctx.setTransform(dpr,0,0,dpr,0,0);
    };
    resize();
    window.addEventListener('resize', resize);

    // Fractal midpoint-displacement bolt for più irregolarità
    const fractalBolt = (x0, y0, x1, y1, roughness = 40, iterations = 6) => {
      let pts = [ { x: x0, y: y0 }, { x: x1, y: y1 } ];
      for (let i = 0; i < iterations; i++) {
        const newPts = [ pts[0] ];
        for (let j = 0; j < pts.length - 1; j++) {
          const a = pts[j], b = pts[j+1];
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          const dx = b.x - a.x, dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len, ny = dx / len; // normale
          const offset = (Math.random() - 0.5) * roughness;
          newPts.push({ x: mx + nx * offset, y: my + ny * offset }, b);
        }
        pts = newPts;
        roughness *= 0.58; // attenuazione per dettagli fini
      }
      return pts;
    };

    const drawBolt = (pts, alpha, widthPx) => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle = `rgba(0,217,255,${alpha})`;
      ctx.lineWidth = widthPx;
      ctx.shadowBlur = 18;
      ctx.shadowColor = 'rgba(0,217,255,.8)';
      ctx.stroke();
    };

    let lastTime = 0;
    let nextMainAt = 0;
    let nextFlickerAt = 0;
    const loop = (t)=>{
      if (!running) return;
      const dt = t - lastTime; lastTime = t;
      // Fade canvas slightly for trailing effect
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(2,4,15,0.04)';
      ctx.fillRect(0,0,width,height);

      // Main bolt con frequenza controllata e maggiore ramificazione
      if (t >= nextMainAt) {
        const x0 = Math.random() * width;
        const x1 = x0 + (Math.random() - 0.5) * (width * 0.5);
        const main = fractalBolt(x0, 0, x1, height, 46, 6);
        drawBolt(main, 0.9, 2.2);
        // Ramificazioni
        const branchesCount = 1 + Math.floor(Math.random()*2); // 1-2 rami
        const step = Math.floor(main.length / (branchesCount + 2));
        for (let b = 1; b <= branchesCount; b++) {
          const idx = b * step + Math.floor(Math.random()*3);
          const p = main[Math.min(idx, main.length-2)];
          const len = height * (0.18 + Math.random()*0.15);
          const dir = (Math.random() < 0.5 ? -1 : 1);
          const bx = p.x + dir * (40 + Math.random()*90);
          const by = Math.min(height, p.y + len);
          const br = fractalBolt(p.x, p.y, bx, by, 22, 5);
          drawBolt(br, 0.45, 1.2);
        }
        // prossima scarica principale fra 300-800ms
        nextMainAt = t + 300 + Math.random()*500;
      }

      // Piccoli flicker laterali meno frequenti
      if (t >= nextFlickerAt) {
        const x = Math.random()*width;
        const fx = x + (Math.random()-0.5)*120;
        const f = fractalBolt(x, 0, fx, height*0.6, 28, 5);
        drawBolt(f, 0.6, 1.2);
        nextFlickerAt = t + 120 + Math.random()*180; // 120-300ms
      }

      requestAnimationFrame(loop);
    };

    const observer = new IntersectionObserver((entries)=>{
      for (const e of entries) {
        if (e.isIntersecting) {
          running = true; requestAnimationFrame(loop);
        } else {
          running = false;
        }
      }
    }, { threshold: 0.05 });
    observer.observe(hero);

    return { resize };
  };

  // Kick everything after load for better first paint
  window.addEventListener('load', () => {
    runIntro();
    Lightning();
    // Safety fallback: auto-hide intro after 2s in case CDN blocks or script fails
    // Safety fallback: auto-hide intro after 2.5s
    setTimeout(() => { if (intro && !intro.classList.contains('is-hidden')) intro.classList.add('is-hidden'); }, 2500);
  });
})();


