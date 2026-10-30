# Prince of Cornellà

Repo: https://github.com/realbluehead/Prince-of-Cornella (públic; abans es deia `story-runner`).

El joc on es treballa ara és **`poc/palau/`**: un plataformes a l'estil *Prince of Persia* (1989) en HTML5 Canvas i JavaScript pur, sense dependències ni compilació. A la pantalla de títol es diu «Prince of Cornellà», amb un retrat animat de l'heroi en guàrdia (`drawPortrait()` a `game.js`), però el nivell encara passa al «Palau de la Lluna». El nom del repo fa pensar que acabarà ambientat a Cornellà, però encara no hi ha res fet en aquesta direcció.

La resta del repo (Nx 15 + Angular 14, del 2022) és un projecte antic que no té res a veure amb el joc. No el toquis, ni facis `npm install`, si no t'ho demanen:
- `libs/adventure` + `apps/ga`: motor d'aventura de text (escenes, sortides, objectes, regles, inventari) amb un joc de prova en anglès (`apps/ga/src/app/game.ts`).
- `libs/ants` + `apps/life`: simulació de formigues, a mig fer.
- `apps/*-e2e`: plantilles de Cypress.

## Com executar-lo

- Obre `poc/palau/index.html` directament (funciona amb `file://`), o arrenca un servidor estàtic a http://localhost:8123: és `palau` a `.claude/launch.json` del repo, o `prince-of-cornella` al `launch.json` de `~/workspace/claude`.
- `sprites.html` és una galeria amb totes les animacions de l'heroi i del guarda. Serveix per revisar poses sense haver de jugar.
- No hi ha tests. Per comprovar un canvi, obre'l al navegador i juga. `window.__game` exposa `prince`, `guard`, `game`, `held` i `pressed`, de manera que des de la consola pots llegir l'estat o simular tecles (`__game.held.right = true`).

## Arquitectura (`poc/palau/js/`)

Són quatre scripts clàssics (IIFE, sense mòduls) que es carreguen en aquest ordre i s'exporten com a globals: `Sprite` → `Anims` → `Level` → `game.js`.

| Fitxer | Què hi ha |
|---|---|
| `sprite.js` | Esquelet procedural (malucs, genolls, turmells, espatlles, colzes, cap, espasa) rasteritzat píxel a píxel en un buffer de 112×128 amb contorn. Els caps són mapes de bits de caràcters (`HEADS`). Les paletes `prince` i `guard` són a `PALETTES`. |
| `anims.js` | Més de 40 animacions per fotogrames clau: `{ frames: [[pose, ticks], …], loop? }`, i el motor interpola entre poses. `poseAt(anim, t)`. |
| `level.js` | El mapa com a cadenes de caràcters (`MAP`) i el decorat procedural de cada sala, pre-renderitzat amb un RNG amb llavor. També dibuixa les rajoles dinàmiques (blocs, terra, punxes). |
| `game.js` | So amb WebAudio sintetitzat, entrada (teclat + botons tàctils), classe `Actor`, màquina d'estats de l'heroi, IA del guarda, trampes, dibuix, HUD i bucle de pas fix a 60 Hz. |

### Coordenades i mides
- Pantalla de 320×204: 192 px de joc (`GAMEH`) + 12 px de HUD. El canvas s'escala amb `image-rendering: pixelated`.
- Les rajoles fan `TW = 32` d'ample i les files `RH = 63` d'alt, amb 3 files (`ROWS`). El terra de la fila `r` és a `floorY(r) = r*63 + 60`.
- Cada sala té 10 columnes (`ROOMW = 320`) i la càmera salta de sala en sala sense desplaçament continu: `room = floor(prince.x / 320)`.
- `actor.x` és el centre dels peus i `actor.y` el terra. `face` val 1 (dreta) o -1 (esquerra); el sprite sempre es dibuixa mirant a la dreta i s'emmiralla.

### Llegenda del mapa (`level.js`)
`' '` buit · `_` terra · `#` bloc de pedra · `T` torxa · `O` finestra · `I` columna · `S` punxes · `L` rajola fluixa · `P` poció · `B` placa de pressió (obre la porta) · `D` porta de sortida · `K` posició del guarda.
Cada fila de `MAP` és la concatenació de les sales, 10 caràcters per sala. Si n'afegeixes una, `COLS` es recalcula sol, però hi ha valors fixos que també cal tocar: `[0, 1, 2]` a `start()`, `Math.min(2, …)` a `render()` i les llunes de `renderRoom`.

### Poses (`sprite.js`)
Els angles són en graus: 0 = cap avall i els positius van cap endavant. Claus: `t` tors, `hd` cap, `rh/rk/ra` maluc/genoll/turmell de la cama del davant, `lh/lk/la` els de la cama del fons, `rs/re` i `ls/le` espatlla i colze dels braços, `sw` angle de l'espasa (`null` = sense espasa), `face` boca oberta, `pot` poció a la mà, `hx/hy` desplaçament del maluc. `g: 1` (per defecte, via `resolve`) calcula `hy` perquè el peu més baix toqui a terra; `g: 0` vol dir pose a l'aire o ancorada a una vora.

### Estats de l'heroi (`updatePrince`)
`idle, turn, startRun, run, stop, slide, bump, step, crouch, crouchUp, land, landRun, jumpPrep, jumpUp, grabUp, hang, climb, standJump, runJump, air, fall, drink, drawSword, drawDone, garde, gardeTurn, advance, retreat, strike, block, hurt, win, dead`.
Patró: `a.go(estat, animació, ticksDeBarreja)` canvia l'estat i l'animació, `a.at` és el tick dins l'animació i `a.done` indica que s'ha acabat. Els esdeveniments van lligats a ticks concrets (p. ex. el cop es resol a `at === 13`).
Física de caiguda: més de 30 px → aterratge ajupit, més de 80 → perd 1 de vida, més de 140 → mort.

## Convencions
- Tot en **català**: comentaris, textos del joc, missatges (`say(...)`) i README.
- Sense dependències, sense build, sense imatges externes: tot es dibuixa per codi. Mantén-ho així si no et diuen el contrari.
- Codi compacte, amb línies llargues i diverses sentències per línia, com el que ja hi ha.
- Si canvies controls o mecàniques, actualitza també `poc/palau/README.md` i la pantalla de títol d'`index.html`.

## Estat i idees obertes
- Ara hi ha 1 nivell de 3 sales, 1 guarda, 2 pocions, punxes, rajoles fluixes, placa + porta i combat amb espasa.
- L'heroi està inspirat en una foto de referència: cabell i barba foscos amb pèls grisos, plomífer blau marí i bufanda negra amb ratlles crues.
- Pendent, segons el nom del repo: ambientar-lo a Cornellà (decorat, textos, enemics) i, possiblement, rebatejar el joc i la carpeta `poc/palau`.
- No està publicat enlloc (no hi ha GitHub Pages).
