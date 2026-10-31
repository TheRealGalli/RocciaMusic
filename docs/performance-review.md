# Revisione mobile — 31 ottobre 2026

Il codice precedente avviava il ciclo canvas sia al caricamento del documento sia a `loadeddata`, creando due catene permanenti di `requestAnimationFrame`. Le catene continuavano a richiedere callback fuori schermo. Ogni evento `resize` riscriveva inoltre entrambe le dimensioni del canvas, anche se la sua misura non cambiava. Gli 11 MP3 avevano tutti `preload="auto"`.

Confronto locale a freddo in Chrome, viewport mobile 390×844 con rapporto pixel 3, server con supporto Range e lo stesso percorso di scroll veloce:

| Misura | Prima | Dopo |
| --- | ---: | ---: |
| Disegni del video in 2 secondi visibili | 246 | 49 |
| Callback decorativi in 2 secondi fuori schermo | 152 | 0 |
| Riallocazioni del canvas per 100 resize identici | 200 | 0 |
| Video caricato sul telefono | 3.195.690 byte | 711.796 byte |
| Immagini trasferite nel percorso di prova | 2.661.614 byte | 1.028.376 byte |
| Dimensioni del canvas sul telefono | 686×686 | 515×515 |

La variante mobile conserva la trasparenza, usa 24 fps ed è priva della traccia audio decorativa. La variante desktop conserva il flusso video originale rimuovendo solo l’audio. Immagini e audio originali non sono stati modificati. Gli MP3 vengono richiesti inizialmente come metadati; durante la riproduzione si suggerisce il buffering del brano corrente e del successivo, senza chiamare `load()` sugli audio né perdere il punto di ripresa. I browser possono interpretare diversamente l’indicazione `preload`.

L’animazione ha un solo ciclo, sospeso fuori schermo o quando la pagina non è attiva. La compatibilità senza `requestVideoFrameCallback` è verificata separatamente. `ResizeObserver` e controlli sulle dimensioni evitano riallocazioni quando cambia soltanto la barra del browser. Su telefono sono ridotti blur e filtri, mantenendo il segnale rosso sul giradischi in riproduzione. Il poster HTML resta disponibile quando autoplay, risparmio dati o preferenze di movimento impediscono l’animazione.

Il blocco di codice di play, pausa, seek, avanzamento e MediaSession è rimasto identico. È conservata anche la protezione iOS che evita di mettere in pausa il video decorativo mentre un brano sta suonando. Non vengono cambiati i link o il meccanismo di condivisione.

Verifiche eseguite: regressioni Chrome per tutte le 11 tracce e condivisione; WebKit con profilo iPhone per scroll rapido, resize, audio reale, seek, fine brano e passaggio al successivo, link in ingresso, dati della condivisione, modalità con movimento ridotto e protezione del background simulato. In WebKit il poster è visibile quando autoplay viene negato e il video si avvia dopo un tap.

Questi dati misurano carico e comportamento in laboratorio. Non sono una misura della memoria complessiva di Safari e non dimostrano la risoluzione di tutti i crash sul telefono reale. Blocco schermo, pressione di memoria del dispositivo e browser interno di Instagram richiedono anche una prova sul dispositivo dell’utente.

Ripetizione: `node scripts/test_sharing.mjs`, `node scripts/test_performance.mjs after`, `node scripts/test_performance.mjs fallback --raf-fallback` (Node 22+ e Chrome, con `CHROME_BIN` configurabile). I rapporti JSON sono salvati nella cartella temporanea del test.
