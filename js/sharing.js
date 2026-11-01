// Sharing is deliberately separate from main.js: playback uses its existing play button.
(function () {
  'use strict';

  const items = Array.from(document.querySelectorAll('.giradischi-item'));
  if (!items.length) return;
  const siteRoot = new URL('.', document.baseURI);
  const trackURL = (id) => new URL(`brani/${id}/`, siteRoot).href;
  const feedback = document.createElement('p');
  feedback.className = 'share-feedback';
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  feedback.hidden = true;
  document.body.append(feedback);
  let feedbackTimer;
  let sharing = false;
  const notify = (message) => {
    clearTimeout(feedbackTimer);
    feedback.textContent = message;
    feedback.hidden = false;
    feedbackTimer = setTimeout(() => { feedback.hidden = true; }, 4000);
  };
  const copyLink = async (url) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      notify('Link copiato. Incollalo nella chat.');
    } catch (_) {
      // Only for browsers that offer neither native sharing nor clipboard access.
      window.prompt('Copia il link della traccia:', url);
    }
  };

  items.forEach((item) => {
    const id = item.dataset.trackId;
    const title = item.querySelector('.track-title').textContent.trim();
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'track-share-btn';
    button.setAttribute('aria-label', `Condividi ${title}`);
    button.title = 'Condividi traccia';
    button.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg>';
    // A sibling of the vinyl: sharing never triggers its playback handler.
    item.classList.add('share-enabled');
    item.prepend(button);
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (sharing) return;
      sharing = true;
      button.disabled = true;
      feedback.hidden = true;
      const url = trackURL(id);
      try {
        if (typeof navigator.share === 'function') {
          // Called directly during the tap: just the URL and title, no files or extra menu.
          await navigator.share({ title, url });
        } else {
          await copyLink(url);
        }
      } catch (error) {
        if (error.name !== 'AbortError') await copyLink(url);
      } finally {
        sharing = false;
        button.disabled = false;
      }
    });
  });

  // Only a valid incoming track link requests playback. Ordinary visits are unchanged.
  const incoming = new URL(window.location.href).searchParams.get('track');
  const target = items.find((item) => item.dataset.trackId === incoming);
  if (!target) return;
  const audio = document.getElementById('music-audio');
  const play = target.querySelector('.track-play-btn');
  if (!audio || !play) return;
  target.classList.add('is-shared-track');
  const prompt = document.createElement('button');
  prompt.type = 'button';
  prompt.className = 'shared-track-start';
  prompt.textContent = '▶ Ascolta questa traccia';
  prompt.setAttribute('aria-label', `Ascolta ${target.querySelector('.track-title').textContent.trim()}`);
  target.append(prompt);
  prompt.addEventListener('click', (event) => { event.stopPropagation(); play.click(); });
  // Never create another audio element or change the playback/seek/MediaSession logic.
  const clearPrompt = () => {
    prompt.remove();
    audio.removeEventListener('playing', clearPrompt);
  };
  audio.addEventListener('playing', clearPrompt);
  const intro = document.getElementById('intro');
  if (intro) intro.classList.add('is-hidden');
  requestAnimationFrame(() => target.scrollIntoView({ block: 'center', behavior: 'instant' }));
  play.click();
})();
