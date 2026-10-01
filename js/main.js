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
          if (isHeroVisible && heroVideo.paused && !document.hidden) {
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

  // --- SCREEN WAKE LOCK (keep screen on during audio playback when page is visible) ---
  let wakeLock = null;
  const acquireWakeLock = async () => {
    if ('wakeLock' in navigator && wakeLock === null) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } catch (_) {}
    }
  };
  const releaseWakeLock = () => {
    if (wakeLock !== null) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
    }
  };

  const trackItems = Array.from(document.querySelectorAll('.giradischi-item'));
  let currentPlayingItem = null;

  // Sync position state with iOS Control Center / Android Media Notification
  const syncPositionState = (audio) => {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    if (!audio || !audio.duration || isNaN(audio.duration) || audio.duration <= 0) return;
    try {
      const pos = Math.min(Math.max(0, audio.currentTime || 0), audio.duration);
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        playbackRate: audio.playbackRate || 1,
        position: pos
      });
    } catch (_) {}
  };

  // --- MEDIA SESSION API (lock screen / notification controls on iOS & Android) ---
  const setMediaSession = (audio, trackId, title) => {
    if (!('mediaSession' in navigator)) return;
    try {
      const base = window.location.origin +
        window.location.pathname.replace(/\/[^\/]*$/, '/');
      
      const sizes = ['96x96', '128x128', '192x192', '256x256', '384x384', '512x512'];
      const artwork = [];
      sizes.forEach((s) => {
        artwork.push({ src: `${base}giradischi/artwork/${trackId}.jpg`, sizes: s, type: 'image/jpeg' });
        artwork.push({ src: `${base}giradischi/artwork/${trackId}.png`, sizes: s, type: 'image/png' });
      });

      navigator.mediaSession.metadata = new MediaMetadata({
        title: title || 'RocciaMusic',
        artist: 'RocciaMusic',
        album: 'Roccia',
        artwork: artwork
      });
      navigator.mediaSession.playbackState = 'playing';

      // Lock-screen transport controls (iOS Control Center & Android Notification Bar)
      const actionHandlers = [
        ['play', () => {
          if (currentPlayingItem) {
            const a = currentPlayingItem.querySelector('.track-audio');
            if (a) a.play().catch(() => {});
          }
        }],
        ['pause', () => {
          if (currentPlayingItem) {
            const a = currentPlayingItem.querySelector('.track-audio');
            if (a) a.pause();
          }
        }],
        ['stop', () => {
          if (currentPlayingItem) {
            const a = currentPlayingItem.querySelector('.track-audio');
            if (a) {
              a.pause();
              a.currentTime = 0;
            }
            if (currentPlayingItem._stopTrack) currentPlayingItem._stopTrack();
          }
        }],
        ['seekbackward', (d) => {
          if (currentPlayingItem) {
            const a = currentPlayingItem.querySelector('.track-audio');
            if (a) {
              a.currentTime = Math.max(0, a.currentTime - (d.seekOffset || 10));
              syncPositionState(a);
            }
          }
        }],
        ['seekforward', (d) => {
          if (currentPlayingItem) {
            const a = currentPlayingItem.querySelector('.track-audio');
            if (a) {
              a.currentTime = Math.min(a.duration || 0, a.currentTime + (d.seekOffset || 10));
              syncPositionState(a);
            }
          }
        }],
        ['seekto', (d) => {
          if (currentPlayingItem && d.seekTime != null) {
            const a = currentPlayingItem.querySelector('.track-audio');
            if (a) {
              a.currentTime = d.seekTime;
              syncPositionState(a);
            }
          }
        }],
        ['nexttrack', () => playNext()],
        ['previoustrack', () => playPrev()]
      ];

      actionHandlers.forEach(([action, handler]) => {
        try {
          navigator.mediaSession.setActionHandler(action, handler);
        } catch (_) {}
      });
    } catch (err) {
      console.warn('MediaSession initialization error:', err);
    }
  };

  const clearMediaSession = () => {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = 'none';
      ['play','pause','stop','seekbackward','seekforward','seekto','nexttrack','previoustrack'].forEach(a => {
        try { navigator.mediaSession.setActionHandler(a, null); } catch(_) {}
      });
    } catch (_) {}
  };

  // --- CYCLE PLAYBACK ---
  const playTrackItem = (item) => {
    if (!item) return;
    // Stop previous track if different
    if (currentPlayingItem && currentPlayingItem !== item) {
      const prevItem = currentPlayingItem;
      const prevAudio = prevItem.querySelector('.track-audio');
      if (prevAudio) {
        prevAudio.pause();
        prevAudio.currentTime = 0;
      }
      prevItem.classList.remove('is-playing');
      const prevBtn = prevItem.querySelector('.track-play-btn');
      if (prevBtn) prevBtn.setAttribute('title', 'Play');
      const prevFill = prevItem.querySelector('.track-progress-fill');
      if (prevFill) prevFill.style.width = '0%';
      const prevCurrentTime = prevItem.querySelector('.track-time-current');
      if (prevCurrentTime) prevCurrentTime.textContent = '0:00';
    }
    currentPlayingItem = item;
    const audio = item.querySelector('.track-audio');
    if (audio) {
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Playback error:', err);
        });
      }
    }
  };

  const playNext = () => {
    const idx = trackItems.indexOf(currentPlayingItem);
    const nextItem = trackItems[(idx + 1) % trackItems.length];
    playTrackItem(nextItem);
  };

  const playPrev = () => {
    const idx = trackItems.indexOf(currentPlayingItem);
    const prevItem = trackItems[(idx - 1 + trackItems.length) % trackItems.length];
    playTrackItem(prevItem);
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

    if (audio) {
      const trackId = item.dataset.trackId || '';
      const trackTitle = item.querySelector('.track-title')?.textContent.trim() || '';
      let lastSyncSec = -1;

      audio.addEventListener('loadedmetadata', () => {
        if (durationEl && !isNaN(audio.duration)) {
          durationEl.textContent = formatTime(audio.duration);
        }
        if (currentPlayingItem === item) {
          syncPositionState(audio);
        }
      });

      audio.addEventListener('timeupdate', () => {
        if (!audio.duration) return;
        const pct = (audio.currentTime / audio.duration) * 100;
        if (progressFill) progressFill.style.width = `${pct}%`;
        if (currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
        if (durationEl) durationEl.textContent = formatTime(audio.duration);

        // Keep lockscreen scrubber perfectly synchronized every second
        const sec = Math.floor(audio.currentTime);
        if (sec !== lastSyncSec) {
          lastSyncSec = sec;
          if (currentPlayingItem === item) {
            syncPositionState(audio);
          }
        }
      });

      audio.addEventListener('ended', () => {
        updatePlayState(false);
        if (progressFill) progressFill.style.width = '0%';
        if (currentTimeEl) currentTimeEl.textContent = '0:00';
        // Auto-play next track (cycle) seamlessly
        playNext();
      });

      audio.addEventListener('play', () => {
        updatePlayState(true);
        acquireWakeLock();
        setMediaSession(audio, trackId, trackTitle);
        syncPositionState(audio);
      });

      audio.addEventListener('pause', () => {
        updatePlayState(false);
        // Only update lockscreen state if this track is still the active one and wasn't transitioning/ended
        if (currentPlayingItem === item && !audio.ended) {
          releaseWakeLock();
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'paused';
          }
          syncPositionState(audio);
        }
      });

      audio.addEventListener('seeked', () => {
        if (currentPlayingItem === item) {
          syncPositionState(audio);
        }
      });
    }

    const togglePlay = () => {
      const isCurrentlyPlaying = item.classList.contains('is-playing');

      if (isCurrentlyPlaying) {
        stopTrack();
        currentPlayingItem = null;
      } else {
        if (currentPlayingItem && currentPlayingItem !== item) {
          const otherStop = currentPlayingItem._stopTrack;
          if (otherStop) otherStop();
        }
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
      if (currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
      syncPositionState(audio);
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

  // Page visibility & standby management:
  // When leaving page or entering lockscreen/standby, sync audio position to MediaSession and pause hero video to save GPU/RAM.
  // When returning, resume hero video if visible and refresh sync.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (currentPlayingItem) {
        const a = currentPlayingItem.querySelector('.track-audio');
        if (a) syncPositionState(a);
      }
      if (heroVideo && !heroVideo.paused) {
        heroVideo.pause();
      }
    } else {
      if (heroVideo && heroVideo.paused && isHeroVisible) {
        heroVideo.play().catch(() => {});
      }
      if (currentPlayingItem) {
        acquireWakeLock();
        const a = currentPlayingItem.querySelector('.track-audio');
        if (a) syncPositionState(a);
      }
    }
  });

  // Run intro immediately
  runIntro();
  setTimeout(() => { if (intro && !intro.classList.contains('is-hidden')) intro.classList.add('is-hidden'); }, 2500);
})();
