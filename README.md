# RocciaMusic.com (Static)

Sito musicale statico per GitHub Pages, con hero loop trasparente su canvas e 11 giradischi interattivi con player audio personalizzato.

Ogni traccia ha un pulsante di condivisione, una pagina statica in `brani/` con metadati Open Graph e file in `assets/share/`: copertina JPEG 1080×1080 e video MP4 con i primi 15 secondi. I link aprono il player esistente sulla traccia corretta; se il browser blocca l’autoplay, compare un invito ad ascoltare con un tap. `js/sharing.js` non modifica il codice del player in `js/main.js`.

Dopo aver aggiunto o aggiornato un brano in `index.html`, rigenerare i materiali con `python3 scripts/build_sharing.py` (Pillow e ffmpeg necessari; `--skip-video` aggiorna solo immagini e pagine). Per una nuova versione audio con lo stesso nome, aggiornare anche il parametro `?v=` del suo URL per evitare la vecchia copia nella cache. Pubblicare insieme HTML, MP3 e materiali rigenerati.

Verifica nel browser: `node scripts/test_sharing.mjs` (Node 22+ e Google Chrome; impostare `CHROME_BIN` se necessario). Il test usa un profilo temporaneo e un server locale con supporto alle richieste Range, per verificare anche lo spostamento nel brano. I test della condivisione controllano i dati passati al menu nativo; la visualizzazione finale va provata su WhatsApp/Instagram reali, che gestiscono autonomamente anteprime e formati accettati.



