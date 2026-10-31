// RocciaMusic Main JS - Intro animation & interactive audio players
(function(){
  const intro = document.getElementById('intro');
  const slash = intro ? intro.querySelector('.slash') : null;

  // --- TRACK AUDIO PLAYERS ---
  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
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

  // Reliable seek for iOS/Android WebKit & Chrome:
  // on mobile, setting currentTime while the element is paused or not yet buffered
  // updates the displayed time but the decoder still starts from 0:00.
  // We remember the target and re-apply it once the media is actually ready/playing.
  const seekAudio = (audio, time) => {
    if (!audio || time == null || isNaN(time)) return;
    const dur = audio.duration;
    if (!dur || isNaN(dur) || audio.readyState < 1) {
      // Metadata not loaded yet: apply as soon as it is
      audio._pendingSeek = Math.max(0, time);
      if (audio.readyState === 0) {
        try { audio.load(); } catch (_) {}
      }
      return;
    }
    const t = Math.max(0, Math.min(time, dur - 0.25));
    audio._pendingSeek = t;
    try { audio.currentTime = t; } catch (_) {}
    syncPositionState(audio);
  };

  // --- MEDIA SESSION API (lock screen / notification controls on iOS & Android) ---
  const setMediaSession = (audio, trackId, title) => {
    if (!('mediaSession' in navigator)) return;
    try {
      const artJpg = new URL(`giradischi/artwork/${trackId}.jpg`, window.location.href).href;
      const artPng = new URL(`giradischi/artwork/${trackId}.png`, window.location.href).href;

      const artwork = [
        { src: artJpg, sizes: '96x96',   type: 'image/jpeg' },
        { src: artJpg, sizes: '128x128', type: 'image/jpeg' },
        { src: artJpg, sizes: '192x192', type: 'image/jpeg' },
        { src: artJpg, sizes: '256x256', type: 'image/jpeg' },
        { src: artJpg, sizes: '384x384', type: 'image/jpeg' },
        { src: artJpg, sizes: '512x512', type: 'image/jpeg' },
        { src: artPng, sizes: '512x512', type: 'image/png' }
      ];

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
            const a = currentPlayingItem.querySelector('.track-audio') || audio;
            if (a) a.play().catch(() => {});
          } else {
            audio.play().catch(() => {});
          }
        }],
        ['pause', () => {
          if (currentPlayingItem) {
            const a = currentPlayingItem.querySelector('.track-audio') || audio;
            if (a) a.pause();
          } else {
            audio.pause();
          }
        }],
        ['stop', () => {
          if (currentPlayingItem) {
            const a = currentPlayingItem.querySelector('.track-audio') || audio;
            if (a) {
              a.pause();
              a._pendingSeek = null;
              a.currentTime = 0;
            }
            if (currentPlayingItem._stopTrack) currentPlayingItem._stopTrack();
          } else {
            audio.pause();
            audio._pendingSeek = null;
            audio.currentTime = 0;
          }
        }],
        ['seekbackward', (d) => {
          const a = currentPlayingItem ? (currentPlayingItem.querySelector('.track-audio') || audio) : audio;
          if (a) {
            seekAudio(a, Math.max(0, a.currentTime - (d.seekOffset || 10)));
          }
        }],
        ['seekforward', (d) => {
          const a = currentPlayingItem ? (currentPlayingItem.querySelector('.track-audio') || audio) : audio;
          if (a) {
            seekAudio(a, Math.min(a.duration || 0, a.currentTime + (d.seekOffset || 10)));
          }
        }],
        ['seekto', (d) => {
          const a = currentPlayingItem ? (currentPlayingItem.querySelector('.track-audio') || audio) : audio;
          if (a && d.seekTime != null) {
            seekAudio(a, d.seekTime);
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

      syncPositionState(audio);
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
  let isAdvancing = false;

  const playTrackItem = (item) => {
    if (!item) return;
    // Stop previous track if different
    if (currentPlayingItem && currentPlayingItem !== item) {
      const prevItem = currentPlayingItem;
      const prevAudio = prevItem.querySelector('.track-audio');
      if (prevAudio) {
        prevAudio.pause();
        prevAudio._pendingSeek = null;
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
      audio._pendingSeek = null;
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
    if (isAdvancing) return;
    isAdvancing = true;
    setTimeout(() => { isAdvancing = false; }, 600);
    const idx = trackItems.indexOf(currentPlayingItem);
    const nextIdx = (idx + 1) % trackItems.length;
    playTrackItem(trackItems[nextIdx]);
  };

  const playPrev = () => {
    if (isAdvancing) return;
    isAdvancing = true;
    setTimeout(() => { isAdvancing = false; }, 600);
    const idx = trackItems.indexOf(currentPlayingItem);
    const prevIdx = (idx - 1 + trackItems.length) % trackItems.length;
    playTrackItem(trackItems[prevIdx]);
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

    const renderProgress = () => {
      if (!audio || !audio.duration) return;
      const pos = audio._pendingSeek != null && audio.paused ? audio._pendingSeek : audio.currentTime;
      if (progressFill) progressFill.style.width = `${(pos / audio.duration) * 100}%`;
      if (currentTimeEl) currentTimeEl.textContent = formatTime(pos);
      if (durationEl) durationEl.textContent = formatTime(audio.duration);
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
        if (audio._pendingSeek != null) {
          seekAudio(audio, audio._pendingSeek);
          renderProgress();
        }
        if (currentPlayingItem === item) {
          syncPositionState(audio);
        }
      });

      audio.addEventListener('timeupdate', () => {
        if (!audio.duration) return;
        renderProgress();

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
        // Auto-play next track (cycle) seamlessly: 1 -> 2 -> 3 ... -> 10 -> 1
        playNext();
      });

      // Once playback has really started, re-apply a pending seek: mobile browsers
      // may otherwise play from 0:00 while reporting the chosen position.
      audio.addEventListener('playing', () => {
        const target = audio._pendingSeek;
        if (target == null) return;
        audio._pendingSeek = null;
        try { audio.currentTime = target; } catch (_) {}
        if (currentPlayingItem === item) syncPositionState(audio);
      });

      audio.addEventListener('play', () => {
        updatePlayState(true);
        setMediaSession(audio, trackId, trackTitle);
      });

      audio.addEventListener('pause', () => {
        updatePlayState(false);
        // Only update lockscreen state if this track is still the active one and hasn't ended
        if (currentPlayingItem === item && !audio.ended) {
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'paused';
          }
          syncPositionState(audio);
        }
      });

      audio.addEventListener('seeked', () => {
        if (!audio.paused && audio.readyState >= 3) audio._pendingSeek = null;
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
      seekAudio(audio, ratio * audio.duration);
      renderProgress();
    });
  });

  // Respect reduced motion settings
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');

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

  // Keep the existing audio/lock-screen synchronization independent of visuals.
  document.addEventListener('visibilitychange', () => {
    if (currentPlayingItem) {
      const audio = currentPlayingItem.querySelector('.track-audio');
      if (audio) syncPositionState(audio);
    }
  });

  // Run intro immediately
  runIntro();
  setTimeout(() => { if (intro && !intro.classList.contains('is-hidden')) intro.classList.add('is-hidden'); }, 2500);
})();
