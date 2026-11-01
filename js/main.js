// RocciaMusic: a persistent music player, separate from decorative media.
(function () {
  const intro = document.getElementById('intro');
  const slash = intro ? intro.querySelector('.slash') : null;
  const audio = document.getElementById('music-audio');
  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  };
  const tracks = Array.from(document.querySelectorAll('.giradischi-item'), (item) => {
    const source = item.querySelector('.track-source');
    return {
      item,
      id: item.dataset.trackId,
      title: item.querySelector('.track-title').textContent.trim(),
      src: source.content.querySelector('audio').getAttribute('src'),
      duration: Number(source.dataset.duration) || 0,
      position: 0,
      button: item.querySelector('.track-play-btn'),
      fill: item.querySelector('.track-progress-fill'),
      time: item.querySelector('.track-time-current'),
      total: item.querySelector('.track-time-duration')
    };
  });
  let currentTrack = null;
  let pendingSeek = null;
  let wantsPlayback = false;
  let playRequest = 0;
  let lastSyncSec = -1;

  const renderProgress = (track) => {
    if (track.fill) track.fill.style.width = `${track.duration ? Math.min(100, track.position / track.duration * 100) : 0}%`;
    if (track.time) track.time.textContent = formatTime(track.position);
    if (track.total) track.total.textContent = formatTime(track.duration);
  };
  const updatePlayState = (track, playing) => {
    track.item.classList.toggle('is-playing', playing);
    track.button?.setAttribute('title', playing ? 'Pausa' : 'Play');
    track.button?.setAttribute('aria-label', `${playing ? 'Pausa' : 'Riproduci'} ${track.title}`);
    track.button?.setAttribute('aria-pressed', String(playing));
  };
  const setPlaybackState = (state) => {
    try { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = state; } catch (_) {}
  };
  const syncPositionState = () => {
    if (!currentTrack || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    try {
      navigator.mediaSession?.setPositionState?.({
        duration: audio.duration,
        playbackRate: audio.playbackRate || 1,
        position: Math.min(audio.duration, Math.max(0, pendingSeek ?? audio.currentTime))
      });
    } catch (_) {}
  };
  const setMediaSession = () => {
    if (!currentTrack || !('mediaSession' in navigator)) return;
    try {
      if (typeof MediaMetadata === 'function') {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: 'RocciaMusic',
          album: 'Roccia',
          // The files really are 512x512 JPEGs. Do not advertise fictitious sizes.
          artwork: [{
            src: new URL(`giradischi/artwork/${currentTrack.id}.jpg`, document.baseURI).href,
            sizes: '512x512',
            type: 'image/jpeg'
          }]
        });
      }
    } catch (_) {}
    setPlaybackState(audio.paused ? 'paused' : 'playing');
    syncPositionState();
  };
  const preparePlayback = () => {
    // Synchronous: the hero must relinquish its media element before audio.play().
    window.dispatchEvent(new Event('rocciamusic:beforeplay'));
    try {
      if (navigator.audioSession && navigator.audioSession.type !== 'playback') {
        navigator.audioSession.type = 'playback';
      }
    } catch (_) {} // Older browsers can play without Audio Session API support.
  };
  const showPlaybackError = (track, error) => {
    if (error?.name === 'AbortError') return; // A new selection cancelled an old play.
    let message = track.item.querySelector('.track-playback-error');
    if (!message) {
      message = document.createElement('p');
      message.className = 'track-playback-error';
      message.setAttribute('role', 'status');
      track.item.append(message);
    }
    message.textContent = error?.name === 'NotAllowedError'
      ? 'Tocca Play per avviare la musica.'
      : 'Non riesco a riprodurre il brano. Tocca Play per riprovare.';
  };
  const applyPendingSeek = () => {
    if (pendingSeek == null || !Number.isFinite(audio.duration) || audio.readyState < 1) return;
    const target = Math.min(pendingSeek, Math.max(0, audio.duration - 0.25));
    try { audio.currentTime = target; } catch (_) {}
  };
  const seekTrack = (track, seconds) => {
    if (!Number.isFinite(seconds)) return;
    track.position = Math.max(0, Math.min(seconds, Math.max(0, track.duration - 0.25)));
    if (track === currentTrack) {
      pendingSeek = track.position;
      applyPendingSeek();
      syncPositionState();
    }
    renderProgress(track);
  };
  const pause = () => {
    wantsPlayback = false;
    ++playRequest;
    audio.pause();
    if (currentTrack) updatePlayState(currentTrack, false);
    setPlaybackState('paused');
    syncPositionState();
    // Keep the selected track and artwork so lock-screen Play resumes it.
  };
  const playTrack = (track, restart = false) => {
    if (!track) return;
    preparePlayback();
    const request = ++playRequest;
    if (currentTrack !== track) {
      if (currentTrack) {
        currentTrack.position = pendingSeek ?? (audio.ended ? 0 : audio.currentTime);
        updatePlayState(currentTrack, false);
        renderProgress(currentTrack);
      }
      currentTrack = track;
      audio.dataset.track = track.id;
      pendingSeek = restart ? 0 : track.position;
      audio.src = track.src;
      audio.preload = 'auto';
      audio.load();
      lastSyncSec = -1;
    } else if (restart || audio.ended) {
      pendingSeek = 0;
      track.position = 0;
    }
    wantsPlayback = true;
    track.item.querySelector('.track-playback-error')?.remove();
    applyPendingSeek();
    setMediaSession();
    // Call in the original tap/transport/ended handler, without an async prefetch.
    audio.play().catch((error) => {
      if (request !== playRequest) return;
      wantsPlayback = false;
      updatePlayState(track, false);
      setPlaybackState('paused');
      showPlaybackError(track, error);
    });
  };
  const advance = (offset) => {
    if (!tracks.length) return;
    const index = currentTrack ? tracks.indexOf(currentTrack) : (offset > 0 ? -1 : 0);
    playTrack(tracks[(index + offset + tracks.length) % tracks.length], true);
  };

  // Register once: transport handlers always use the current track on this element.
  const handlers = {
    play: () => playTrack(currentTrack || tracks[0]),
    pause,
    stop: () => { pause(); if (currentTrack) seekTrack(currentTrack, 0); },
    seekbackward: (details) => { if (currentTrack) seekTrack(currentTrack, (pendingSeek ?? audio.currentTime) - (details.seekOffset || 10)); },
    seekforward: (details) => { if (currentTrack) seekTrack(currentTrack, (pendingSeek ?? audio.currentTime) + (details.seekOffset || 10)); },
    seekto: (details) => { if (currentTrack) seekTrack(currentTrack, details.seekTime); },
    nexttrack: () => advance(1),
    previoustrack: () => advance(-1)
  };
  if ('mediaSession' in navigator) {
    Object.entries(handlers).forEach(([action, handler]) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch (_) {}
    });
  }

  audio.addEventListener('loadedmetadata', () => {
    if (!currentTrack) return;
    if (Number.isFinite(audio.duration)) currentTrack.duration = audio.duration;
    applyPendingSeek();
    renderProgress(currentTrack);
    syncPositionState();
  });
  audio.addEventListener('play', () => {
    if (!currentTrack || audio.paused) return;
    wantsPlayback = true;
    updatePlayState(currentTrack, true);
    setMediaSession();
  });
  audio.addEventListener('playing', () => {
    if (!currentTrack || audio.paused) return;
    applyPendingSeek();
    wantsPlayback = true;
    updatePlayState(currentTrack, true);
    setMediaSession();
  });
  audio.addEventListener('pause', () => {
    // load() when changing songs may queue a pause from the previous resource.
    if (!currentTrack || !audio.paused || audio.ended) return;
    wantsPlayback = false;
    updatePlayState(currentTrack, false);
    setPlaybackState('paused');
    syncPositionState();
  });
  audio.addEventListener('timeupdate', () => {
    if (!currentTrack || !audio.readyState) return;
    currentTrack.position = pendingSeek ?? audio.currentTime;
    renderProgress(currentTrack);
    const second = Math.floor(audio.currentTime);
    if (second !== lastSyncSec) { lastSyncSec = second; syncPositionState(); }
  });
  audio.addEventListener('seeked', () => {
    if (pendingSeek != null && Math.abs(audio.currentTime - pendingSeek) < 0.5 && !audio.paused) pendingSeek = null;
    if (currentTrack) { currentTrack.position = pendingSeek ?? audio.currentTime; renderProgress(currentTrack); }
    syncPositionState();
  });
  audio.addEventListener('ratechange', syncPositionState);
  audio.addEventListener('ended', () => {
    if (!currentTrack || !audio.ended) return;
    currentTrack.position = 0;
    pendingSeek = null;
    updatePlayState(currentTrack, false);
    renderProgress(currentTrack);
    // No timer: background tabs can freeze timers. Reuse the unlocked element.
    advance(1);
  });
  audio.addEventListener('error', () => {
    if (!currentTrack || !audio.error) return;
    wantsPlayback = false;
    updatePlayState(currentTrack, false);
    setPlaybackState('paused');
    showPlaybackError(currentTrack, audio.error);
  });

  tracks.forEach((track) => {
    renderProgress(track);
    updatePlayState(track, false);
    const toggle = () => {
      if (track === currentTrack && (wantsPlayback || !audio.paused)) pause();
      else playTrack(track);
    };
    track.button?.addEventListener('click', (event) => { event.stopPropagation(); toggle(); });
    track.item.querySelector('.giradischi-vinyl-wrap')?.addEventListener('click', toggle);
    track.item.querySelector('.track-progress-bar')?.addEventListener('click', (event) => {
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      if (!rect.width || !track.duration) return;
      seekTrack(track, Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * track.duration);
    });
  });

  // Never unload, pause or restart music just because Safari becomes hidden.
  document.addEventListener('visibilitychange', () => {
    if (!currentTrack) return;
    if (!document.hidden) setMediaSession();
    else syncPositionState();
  });
  window.addEventListener('pageshow', () => { if (currentTrack) setMediaSession(); });

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

  // Run intro immediately
  runIntro();
  setTimeout(() => { if (intro && !intro.classList.contains('is-hidden')) intro.classList.add('is-hidden'); }, 2500);
})();
