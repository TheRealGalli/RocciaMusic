# RocciaMusic.com (Static)

Landing page musicale statica e performante per GitHub Pages, con hero parallax e 4 player SoundCloud.

## Struttura
```
index.html
css/
  style.css
  animations.css
js/
  main.js
  particles.js (opzionale)
assets/images/
  hero-bg.jpg (da fornire)
```

## Come usare
1. Sostituisci `assets/images/hero-bg.jpg` con la tua immagine (1920x1080, WebP/JPG).
2. Avvia un server locale:
```bash
python3 -m http.server 8000
```
3. Apri `http://localhost:8000`.

## Modifica player SoundCloud
- Gli `iframe` sono in `index.html` (classe `sc-frame`).
- Gli URL sono caricati in lazy con `data-src`. Per cambiare, sostituisci il valore di `data-src`.

## Deploy GitHub Pages
1. Effettua push su GitHub.
2. Settings → Pages → Source: `main`.
3. (Opzionale) Configura custom domain.

## Accessibilità e performance
- HTML semantico, focus visibile, contrasto alto.
- `prefers-reduced-motion` rispettato.
- Iframe SoundCloud caricati via IntersectionObserver.

## Licenze
- Immagini e tracce appartengono ai rispettivi autori.


