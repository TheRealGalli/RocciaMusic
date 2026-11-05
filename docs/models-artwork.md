# Models — giradischi dell’intro

Immagine rifatta il 5 novembre 2026 con lo strumento integrato ImageGen, usando i file originali della serie come riferimenti. Conserva le due corna e il sottile bordo rosa della proposta precedente e riprende il metallo scuro, il disco e il braccio degli altri giradischi. La revisione finale ripristina il centro rosa del vinile e i piccoli segmenti blu/ciano del cursore del volume, mantenendo prospettiva e strumentazione della versione approvata.

## File pubblicati

- Sorgente trasparente: `giradischi/models-intro_transparent.png` (1315 × 1197, RGBA).
- Immagine del sito: `giradischi/models-intro_transparent.webp`.
- Versioni leggere: `giradischi/responsive/models-intro_transparent-320.webp` e `models-intro_transparent-640.webp`.
- Anteprima di condivisione: `assets/share/models-intro.jpg` (1080 × 1080).
- Copertina del player: `giradischi/artwork/models-intro.jpg` (512 × 512).

Le esportazioni WebP mantengono la trasparenza. In `css/style.css` tutti i giradischi usano uno spazio con proporzioni fisse: il riferimento visivo è il corpo rettangolare dello strumento, non il contorno delle decorazioni. Models e Fake hanno correzioni di scala e posizione dedicate per allineare i loro corpi agli originali. Corna, ali e altri elementi esterni rimangono interi; titoli e player seguono una griglia regolare.

## Riferimenti

1. Proposta precedente di Models: corna e sottile bordo rosa.
2. `giradischi/IMG_6865_transparent.png`: modello del giradischi, pixel art e inquadratura.
3. `giradischi/IMG_6927_transparent.png`: stesso modello, palette e inquadratura.

## Prompt della prima ricostruzione

```text
Use case: style-transfer.
Asset type: replacement transparent pixel-art turntable sprite for the Models - Il Cazzo (intro) track in the RocciaMusic website.
Input images: Image 1 is the edit target, the new Models sprite with two pink horns. Images 2 and 3 are the ORIGINAL CANONICAL SERIES references. Their actual turntable is identical, only surrounding motifs differ.
Primary request: remake image 1 so its turntable is the SAME MODEL AND SAME RENDERING as the original turntable in images 2 and 3. Closely copy the proportions and pixel clusters of their deck: weathered dark olive-charcoal rectangular housing, black vinyl with subtle dark gray grooves on the left, aged metal platter ring, small muted olive-gray center label, original narrow silver bent tonearm on the right, original tiny controls and slider. Straight-on planar top view, no perspective tilt, no 3D depth. Very coarse, restrained 1990s dark fantasy videogame pixel art, small limited palette, worn metal, hard black outlines, no smooth illustration or glossy gradients. The new current deck is too bright, purple, wide and digitally clean: replace that deck with the canonical reference model.
Keep the concept from image 1: exactly two angular devil/cosmic horns protrude above the upper left and upper right corners, with dark burgundy shadows and restrained deep pink/magenta surfaces, plus a very thin pink outline along the outer housing edge. Horns are the only surrounding ornament. Remove cyan glowing vents, cyan meters and purple vinyl glare; no cyan at all. The deck remains dark and desaturated, with only the horns and thin pink edge adding color.
Composition/framing: use a near-square landscape canvas at about 1088:990 aspect ratio. Match the deck's visual scale and position in images 2 and 3: deck occupies approximately x=22%-81%, y=31%-82% of the canvas, vinyl center at x=45%, y=55%. Horns rise behind the deck to about y=7%, extending at most to x=10% and x=92%. Keep the whole sprite comfortably in frame with transparent margins and especially transparent negative space above/between the horns. Do not enlarge the deck to fill the whole canvas. Original series framing is essential.
Constraints: genuine transparent RGBA background including the gap between horns. No black background, no checkerboard painted into image, no ground plane or drop shadow outside the sprite. No wings, bones, hearts, brains, pumpkins, extra decorations, characters, letters, words, logos or watermark. Match the canonical deck in references 2 and 3 as closely as possible. Only the surrounding horns and tiny pink edge are specific to Models.
```

## Prompt finale: dettagli rosa e blu

```text
Use case: precise-object-edit.
Asset type: existing transparent pixel-art turntable sprite, tiny color correction only.
Input images: Image 1 is the edit target, the approved new Models turntable. Image 2 is an OLD version provided ONLY as a color reference for the pink record center and blue/cyan volume indicators. Do not copy image 2's turntable shape, perspective, instrument placement or horns.
Primary request: keep image 1 identical in every detail, changing ONLY these two colors/details: (1) recolor the vinyl record's small circular center label vivid pink/magenta like image 2, preserving the exact label size, boundaries, pixel shading and spindle. (2) restore a few luminous blue/cyan pixel segments in the lower-middle section of the existing narrow vertical volume slider at the lower right of the deck, like the cyan segments on the OLD image 2. Preserve the silver slider handle, slot and all machinery positions. Keep the cyan contained to this small meter/volume strip.
Invariants: identical canvas aspect ratio and size (1315 x 1196), identical transparent margins and object placement, identical planar top-down perspective, identical dark olive-charcoal aged metal housing, vinyl grooves, platter ring, silver tonearm, buttons, controls, pink edge, two dark pink angular horns, coarse pixel grid and dark limited palette. Do not redraw, enlarge, crop, move or distort any part. No new cyan vents on the horns. No purple shine on vinyl. No extra lights, objects, lettering or motifs. Keep everything else unchanged.
Background: preserve genuine RGBA transparency around the whole object and between horns. No painted checkerboard, black background or shadow outside sprite.
```
