// Unannounced titles never resolve. Only visible cards animate, without touching audio.
(function () {
  const cards = [...document.querySelectorAll('[data-unreleased]')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const alphabet = 'ABCDEFGHKLMNPQRSTVXYZ0123456789';
  const visible = new Set();
  let timer;
  const randomChar = () => alphabet[Math.floor(Math.random() * alphabet.length)];
  const states = cards.map((card) => ({
    card,
    title: card.querySelector('[data-scramble="title"]'),
    time: card.querySelector('[data-scramble="time"]'),
    letters: Array.from({ length: 6 }, randomChar)
  }));
  const animate = () => {
    timer = null;
    if (document.hidden || reducedMotion.matches || !visible.size) return;
    states.forEach((state) => {
      if (!visible.has(state.card)) return;
      if (state.title) {
        const index = Math.floor(Math.random() * state.letters.length);
        state.letters[index] = randomChar();
        state.letters[(index + 2) % state.letters.length] = randomChar();
        state.title.textContent = state.letters.join('');
      }
      if (state.time) state.time.textContent = `${Math.floor(Math.random() * 10)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`;
    });
    timer = setTimeout(animate, 180);
  };
  const sync = () => {
    clearTimeout(timer);
    timer = null;
    if (reducedMotion.matches) {
      states.forEach(({ title, time }) => {
        if (title) title.textContent = '??????';
        if (time) time.textContent = '–:––';
      });
      return;
    }
    animate();
  };
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (isIntersecting) visible.add(target);
        else visible.delete(target);
      });
      sync();
    }, { rootMargin: '60px' });
    cards.forEach((card) => observer.observe(card));
  } else cards.forEach((card) => visible.add(card));
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', sync);
  sync();
})();
