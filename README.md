# RocciaMusic.com (Static)

Sito musicale statico per GitHub Pages, con hero loop trasparente su canvas e 11 giradischi interattivi con player audio personalizzato.

Il pulsante su ogni traccia apre direttamente il pannello nativo di condivisione di iPhone/Android, passando solo titolo e URL. Nei browser senza condivisione nativa copia il link, oppure permette di copiarlo manualmente se manca anche l’accesso agli appunti. Non ci sono menu intermedi né allegati da condividere.

Ogni link in `brani/` contiene metadati Open Graph e una copertina JPEG in `assets/share/`, usata dalle app per generare automaticamente l’anteprima del link (la resa finale dipende dall’app). Il link apre il player esistente sulla traccia corretta; se il browser blocca l’autoplay, compare un invito ad ascoltare con un tap. `js/sharing.js` non modifica il codice del player in `js/main.js`.

Dopo aver aggiunto o aggiornato un brano in `index.html`, rigenerare le anteprime con `python3 scripts/build_sharing.py` (Pillow necessario). Per una nuova versione audio con lo stesso nome, aggiornare anche il parametro `?v=` del suo URL per evitare la vecchia copia nella cache. Pubblicare insieme HTML, MP3 e anteprime rigenerate.

Verifica nel browser: `node scripts/test_sharing.mjs` (Node 22+ e Google Chrome; impostare `CHROME_BIN` se necessario). Il test usa un profilo temporaneo e un server locale con supporto alle richieste Range, per verificare anche lo spostamento nel brano. I test della condivisione controllano i dati passati al menu nativo; la visualizzazione finale va provata su WhatsApp/Instagram reali, che gestiscono autonomamente anteprime dei link.

L’animazione decorativa è separata in `js/hero.js`: un solo ciclo, sincronizzato ai fotogrammi video e sospeso fuori schermo. Il canvas si ridimensiona soltanto quando cambia davvero il suo spazio, mentre l’altezza iniziale usa `svh` per stabilizzare lo scroll mobile. I telefoni caricano un video più piccolo e senza traccia audio; con movimento ridotto o risparmio dati resta il poster. La protezione iOS che evita di mettere in pausa il video mentre suona un brano è mantenuta. Play, seek, ciclo e MediaSession del player restano invariati.

Gli MP3 iniziano con `preload="metadata"`; `js/media-loading.js` consente il buffering del solo brano corrente e del successivo, senza sostituire sorgenti, chiamare `load()` o azzerare le posizioni. Gli originali audio e delle immagini restano intatti. Per aggiornare le varianti delle immagini: `python3 scripts/build_responsive_images.py` (Pillow). Per rigenerare i video decorativi: `python3 scripts/build_hero_media.py` (ffmpeg con libvpx).

Misure ripetibili: `node scripts/test_performance.mjs after`; `node scripts/test_performance.mjs fallback --raf-fallback` controlla anche browser senza notifiche dei fotogrammi video. I rapporti sono scritti nella cartella temporanea e verificano l’assenza di cicli fuori schermo e di riallocazioni del canvas per ridimensionamenti identici. Sono misure di laboratorio; crash per esaurimento memoria e standby vanno verificati anche su iPhone reali.



