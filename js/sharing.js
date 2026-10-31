// Sharing is deliberately separate from main.js: playback uses its existing play button.
(function () {
  'use strict';

  const items = Array.from(document.querySelectorAll('.giradischi-item'));
  if (!items.length) return;
  const siteRoot = new URL('.', document.baseURI);
  const trackURL = (id) => new URL(`brani/${id}/`, siteRoot).href;
  const assetURL = (id, extension) => new URL(`assets/share/${id}.${extension}`, siteRoot).href;
  const dialog = document.getElementById('track-share-dialog');

  if (dialog && typeof dialog.showModal === 'function') {
    const heading = dialog.querySelector('#share-track-name');
    const preview = dialog.querySelector('.share-preview');
    const linkInput = dialog.querySelector('.share-link-input');
    const status = dialog.querySelector('.share-status');
    const linkButton = dialog.querySelector('[data-share-link]');
    const fileButton = dialog.querySelector('[data-share-file]');
    const formats = Array.from(dialog.querySelectorAll('[data-share-format]'));
    const download = dialog.querySelector('[data-share-download]');
    let selected = null;
    let format = 'jpg';
    let revision = 0;
    let preparedFile = null;
    let sharing = false;
    let opener = null;
    let request = null;

    const canShareFile = (file) => {
      try { return !!navigator.share && !!navigator.canShare && navigator.canShare({ files: [file] }); }
      catch (_) { return false; }
    };
    const setBusy = (busy) => {
      sharing = busy;
      linkButton.disabled = busy;
      fileButton.disabled = busy || !preparedFile || !canShareFile(preparedFile);
    };
    const prepareFormat = async () => {
      const token = ++revision;
      if (request) request.abort();
      request = new AbortController();
      preparedFile = null;
      fileButton.disabled = true;
      const url = assetURL(selected.id, format);
      const filename = `rocciamusic-${selected.id}.${format}`;
      download.href = url;
      download.download = filename;
      download.textContent = format === 'mp4' ? 'Salva video · 15 secondi' : 'Salva immagine';
      formats.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.shareFormat === format)));
      const loadingMessage = format === 'mp4' ? 'Primi 15 secondi del brano. Preparazione video…' : 'Preparazione immagine…';
      status.textContent = loadingMessage;
      try {
        const response = await fetch(url, { signal: request.signal });
        if (!response.ok) throw new Error('File non disponibile');
        const blob = await response.blob();
        if (token !== revision || !dialog.open) return;
        preparedFile = new File([blob], filename, { type: format === 'mp4' ? 'video/mp4' : 'image/jpeg' });
        const supported = canShareFile(preparedFile);
        fileButton.disabled = !supported || sharing;
        fileButton.textContent = format === 'mp4' ? 'Condividi video · 15 s' : 'Condividi immagine';
        if (status.textContent === loadingMessage) {
          status.textContent = supported
            ? (format === 'mp4' ? 'Video pronto: copertina e primi 15 secondi del brano.' : 'Immagine pronta per la condivisione.')
            : 'Per questo browser usa “Salva”, poi apri l’app in cui vuoi pubblicare.';
        }
      } catch (error) {
        if (token !== revision || error.name === 'AbortError') return;
        status.textContent = 'Impossibile preparare il file. Puoi riprovare o condividere il link.';
      }
    };

    items.forEach((item) => {
      const id = item.dataset.trackId;
      const title = item.querySelector('.track-title').textContent.trim();
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'track-share-btn';
      button.setAttribute('aria-label', `Condividi ${title}`);
      button.setAttribute('aria-haspopup', 'dialog');
      button.title = 'Condividi traccia';
      button.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg>';
      // A sibling of the vinyl, so this tap never bubbles through its play handler.
      item.classList.add('share-enabled');
      item.prepend(button);
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        opener = button;
        selected = { id, title };
        format = 'jpg';
        heading.textContent = title;
        preview.src = assetURL(id, 'jpg');
        preview.alt = `Quadrato di condivisione: ${title}`;
        linkInput.value = trackURL(id);
        linkButton.textContent = navigator.share ? 'Condividi link' : 'Copia link';
        dialog.showModal();
        prepareFormat();
      });
    });

    dialog.querySelector('[data-share-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
    dialog.addEventListener('close', () => {
      ++revision;
      if (request) request.abort();
      preparedFile = null;
      if (opener) opener.focus({ preventScroll: true });
    });
    formats.forEach((button) => button.addEventListener('click', () => {
      if (sharing) return;
      format = button.dataset.shareFormat;
      prepareFormat();
    }));

    const copyLink = async () => {
      const url = linkInput.value;
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(url);
        status.textContent = 'Link copiato. Incollalo nella chat o nell’adesivo Link della storia.';
      } catch (_) {
        linkInput.focus();
        linkInput.select();
        status.textContent = 'Tieni premuto sul link selezionato e scegli Copia.';
      }
    };
    dialog.querySelector('[data-share-copy]').addEventListener('click', copyLink);
    linkButton.addEventListener('click', async () => {
      if (sharing || !selected) return;
      if (!navigator.share) { copyLink(); return; }
      setBusy(true);
      try {
        await navigator.share({ title: selected.title, text: `Ascolta ${selected.title} su RocciaMusic`, url: linkInput.value });
        status.textContent = 'Link passato al menu di condivisione.';
      } catch (error) {
        if (error.name !== 'AbortError') status.textContent = 'Condivisione non disponibile. Usa “Copia link”.';
      } finally { setBusy(false); }
    });
    fileButton.addEventListener('click', async () => {
      if (sharing || !preparedFile || !canShareFile(preparedFile)) return;
      setBusy(true);
      try {
        // The file is already loaded: share() runs during the user's tap, including on iOS.
        await navigator.share({ files: [preparedFile] });
        status.textContent = 'File passato al menu di condivisione. Aggiungi il link per far ascoltare il brano intero.';
      } catch (error) {
        if (error.name !== 'AbortError') status.textContent = 'L’app non accetta questo file. Usa “Salva” e caricalo dall’app.';
      } finally { setBusy(false); }
    });
  }

  // Only a valid incoming track link requests playback. Ordinary visits are unchanged.
  const incoming = new URL(window.location.href).searchParams.get('track');
  const target = items.find((item) => item.dataset.trackId === incoming);
  if (!target) return;
  const audio = target.querySelector('.track-audio');
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
    items.forEach((item) => item.querySelector('.track-audio')?.removeEventListener('play', clearPrompt));
  };
  items.forEach((item) => item.querySelector('.track-audio')?.addEventListener('play', clearPrompt));
  const intro = document.getElementById('intro');
  if (intro) intro.classList.add('is-hidden');
  requestAnimationFrame(() => target.scrollIntoView({ block: 'center', behavior: 'instant' }));
  play.click();
})();
