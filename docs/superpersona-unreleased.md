# SUPERPERSONA: tracce non ancora disponibili

La griglia contiene 24 giradischi nell'ordine dell'album. I 12 elementi con `data-unreleased` hanno un player visivo con emoji e pulsante disabilitato, senza sorgente audio. `main.js` e `sharing.js` li escludono dalla sequenza e dalle azioni di condivisione. Titoli confermati e parti anatomiche rimangono leggibili; i dieci titoli non annunciati mostrano sei caratteri variabili. Le durate degli inediti sono sequenze illustrative, indicate come non annunciate per le tecnologie assistive.

`js/unreleased.js` aggiorna solo i giradischi visibili, ogni 180 ms su desktop e 240 ms su telefono, e si ferma quando la pagina è nascosta. Sul telefono gli aggiornamenti si sospendono anche durante lo scorrimento e riprendono 180 ms dopo l’ultimo movimento. Il contenimento del layout isola ogni giradischi senza tagliare le estensioni. Con movimento ridotto usa punti interrogativi e una durata non specificata. I valori animati non vengono comunicati come aggiornamenti ai lettori di schermo e non entrano nei metadati audio.

I controlli di ascolto rimangono nelle singole tracce. Non è presente una barra flottante. Rimane un solo elemento audio persistente, con riproduzione sequenziale e controlli dello schermo bloccato.

La revisione grafica mantiene tipografia bianca e rimuove il riepilogo numerico sotto il titolo dell'album. Le cinque copertine riviste hanno file WebP nuovi e formati da 320 e 640 pixel; le versioni precedenti sono conservate. Per Le ali sono aggiornate anche l'immagine di condivisione con intestazione SUPERPERSONA e la copertina dello schermo bloccato.

Verifiche: `scripts/test_sharing.mjs` copre animazione dei titoli, movimento ridotto, pulsanti inediti disabilitati, colore dei titoli, assenza della barra flottante, riproduzione sequenziale, condivisione e collegamenti ai 12 brani. `scripts/test_webkit.mjs` verifica riproduzione reale e controlli nel motore Safari con profilo iPhone. Il controllo del layout comprende 24 immagini, 24 barre, schermi da 320/390/1440 pixel e allineamento delle barre nella prima riga.

I test controllano anche l’assenza di aggiornamenti dei caratteri durante lo scorrimento, fuori schermo e con pagina nascosta. `scripts/test_performance.mjs` controlla la sospensione del video fuori vista, l’assenza di allocazioni duplicate al ridimensionamento e zero byte MP3 prima della selezione.

Revisione delle copertine 03: Le scaglie mostra un drago rosso metallico dietro lo strumento; Le ali conserva le grandi ali superiori e laterali lasciando vuota la zona sotto la macchina. Radici tecnologiche, tentacoli neri e sigillo alchemico restano nella versione precedente approvata.
