// RocciaMusic Main JS - Hero video loop, intro animation & interactive audio players
(function(){
  const root = document.documentElement;
  const heroVideo = document.getElementById('hero-video');
  const heroCanvas = document.getElementById('hero-canvas');
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

  // --- TRACK AUDIO PLAYERS ---
  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const trackItems = Array.from(document.querySelectorAll('.giradischi-item'));
  let currentPlayingItem = null;

  // --- MEDIA SESSION API (lock screen controls on iOS/Android) ---
  const artworkMap = {
    'helldiver':       'giradischi/IMG_6861_transparent.webp',
    'deus-ex-machina': 'giradischi/IMG_6866_transparent.webp',
    'dimora-ade':      'giradischi/IMG_6863_transparent.webp',
    'niente':          'giradischi/IMG_6864_transparent.webp',
    'regno-del-rap':   'giradischi/IMG_6865_transparent.webp',
    'ironmonkey':      'giradischi/IMG_6871_transparent.webp',
  };

  const setMediaSession = (audio, trackId, title) => {
    if (!('mediaSession' in navigator)) return;
    const base = window.location.origin +
      window.location.pathname.replace(/\/[^\/]*$/, '/');
    const art = artworkMap[trackId];
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: 'RocciaMusic',
      album:  'Roccia',
      artwork: art ? [{ src: base + art, sizes: '512x512', type: 'image/webp' }] : []
    });
    navigator.mediaSession.playbackState = 'playing';

    // Lock-screen transport controls
    navigator.mediaSession.setActionHandler('play',  () => audio.play().catch(() => {}));
    navigator.mediaSession.setActionHandler('pause', () => audio.pause());
    navigator.mediaSession.setActionHandler('stop',  () => { audio.pause(); audio.currentTime = 0; });
    navigator.mediaSession.setActionHandler('seekbackward', (d) => {
      audio.currentTime = Math.max(0, audio.currentTime - (d.seekOffset || 10));
    });
    navigator.mediaSession.setActionHandler('seekforward', (d) => {
      audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + (d.seekOffset || 10));
    });
    navigator.mediaSession.setActionHandler('seekto', (d) => {
      if (d.seekTime != null) audio.currentTime = d.seekTime;
    });
  };

  const clearMediaSession = () => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = 'none';
    ['play','pause','stop','seekbackward','seekforward','seekto'].forEach(a => {
      try { navigator.mediaSession.setActionHandler(a, null); } catch(_) {}
    });
  };

  trackItems.forEach((item) => {
    const playBtn = item.querySelector('.track-play-btn');
    const audio = item.querySelector('.track-audio');
    const progressBar = item.querySelector('.track-progress-bar');
    const progressFill = item.querySelector('.track-progress-fill');
    const currentTimeEl = item.querySelector('.track-time-current');
    const durationEl = item.querySelector('.track-time-duration');
    const vinylWrap = item.querySelector('.giradischi-vinyl-wrap');

    const updatePlayState = (isPlaying) => {
      if (isPlaying) {
        item.classList.add('is-playing');
        if (playBtn) playBtn.setAttribute('title', 'Pausa');
      } else {
        item.classList.remove('is-playing');
        if (playBtn) playBtn.setAttribute('title', 'Play');
      }
    };

    const stopTrack = () => {
      if (audio) audio.pause();
      updatePlayState(false);
    };
    item._stopTrack = stopTrack;

    // Show duration as soon as metadata is available
    if (audio) {
      const trackId = item.dataset.trackId || '';
      const trackTitle = item.querySelector('.track-title')?.textContent.trim() || '';

      audio.addEventListener('loadedmetadata', () => {
        if (durationEl && !isNaN(audio.duration)) {
          durationEl.textContent = formatTime(audio.duration);
        }
        // Update position state for lock screen scrubber
        if ('mediaSession' in navigator && !audio.paused) {
          navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate,
            position: audio.currentTime
          });
        }
      });

      audio.addEventListener('timeupdate', () => {
        if (!audio.duration) return;
        const pct = (audio.currentTime / audio.duration) * 100;
        if (progressFill) progressFill.style.width = `${pct}%`;
        if (currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
        if (durationEl) durationEl.textContent = formatTime(audio.duration);
      });

      audio.addEventListener('ended', () => {
        updatePlayState(false);
        if (progressFill) progressFill.style.width = '0%';
        if (currentTimeEl) currentTimeEl.textContent = '0:00';
        currentPlayingItem = null;
        clearMediaSession();
      });

      audio.addEventListener('play', () => {
        updatePlayState(true);
        setMediaSession(audio, trackId, trackTitle);
        // Keep lock screen scrubber in sync
        if ('mediaSession' in navigator && audio.duration) {
          try {
            navigator.mediaSession.setPositionState({
              duration: audio.duration,
              playbackRate: audio.playbackRate,
              position: audio.currentTime
            });
          } catch(_) {}
        }
      });

      audio.addEventListener('pause', () => {
        updatePlayState(false);
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'paused';
        }
      });
    }

    const togglePlay = () => {
      const isCurrentlyPlaying = item.classList.contains('is-playing');

      // Stop any other playing track
      if (currentPlayingItem && currentPlayingItem !== item) {
        const otherStop = currentPlayingItem._stopTrack;
        if (otherStop) otherStop();
      }

      if (isCurrentlyPlaying) {
        stopTrack();
        currentPlayingItem = null;
      } else {
        currentPlayingItem = item;
        if (audio) {
          audio.play().catch(() => {});
        }
      }
    };

    playBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlay();
    });

    vinylWrap?.addEventListener('click', () => {
      togglePlay();
    });

    // Click on progress bar to seek
    progressBar?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!audio || !audio.duration) return;
      const rect = progressBar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audio.currentTime = ratio * audio.duration;
      if (progressFill) progressFill.style.width = `${ratio * 100}%`;
    });
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
