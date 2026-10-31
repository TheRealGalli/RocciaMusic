// Load track metadata initially; allow the current and next song to buffer.
// Changing preload is only a hint: never call load(), replace src, or reset a seek.
(function () {
  const tracks = Array.from(document.querySelectorAll('.track-audio'));
  tracks.forEach((audio, index) => audio.addEventListener('play', () => {
    const next = (index + 1) % tracks.length;
    tracks.forEach((track, i) => {
      track.preload = i === index || i === next ? 'auto' : 'metadata';
    });
  }));
})();
