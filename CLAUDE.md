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
- No hi ha tests. Per comprovar un canvi, obre'l al navegador i juga.
- `index.html?sala=N` comença a la sala N, amb les reixes de les sales anteriors ja obertes.
- `window.__game` exposa `prince`, `foes`, `L` (el nivell), `game`, `held`, `pressed` i `start`. També té `step(n)`, que avança n ticks i redibuixa. Funciona fins i tot amb la pestanya amagada (quan `requestAnimationFrame` està aturat), i així pots fer proves deterministes de recorregut, per exemple: `__game.held.right = true; __game.step(60)`.

## Arquitectura (`poc/palau/js/`)

Són quatre scripts clàssics (IIFE, sense mòduls) que es carreguen en aquest ordre i s'exporten com a globals: `Sprite` → `Anims` → `Level` → `game.js`.

| Fitxer | Què hi ha |
|---|---|
| `sprite.js` | Esquelet procedural (malucs, genolls, turmells, espatlles, colzes, cap, espasa) rasteritzat píxel a píxel en un buffer de 112×128 amb contorn. Els caps són mapes de bits de caràcters (`HEADS`). Les paletes `prince`, `guard` i `mykola` són a `PALETTES`. |
| `anims.js` | Més de 40 animacions per fotogrames clau: `{ frames: [[pose, ticks], …], loop? }`, i el motor interpola entre poses. `poseAt(anim, t)`. |
| `level.js` | El mapa com a cadenes de caràcters (`MAP`) i el decorat procedural de cada sala, pre-renderitzat amb un RNG amb llavor. També dibuixa les rajoles dinàmiques (blocs, terra, punxes). |
| `game.js` | So amb WebAudio sintetitzat, entrada (teclat + botons tàctils), classe `Actor`, màquina d'estats de l'heroi, IA del guarda, trampes, dibuix, HUD i bucle de pas fix a 60 Hz. |

### Coordenades i mides
- Pantalla de 320×204: 192 px de joc (`GAMEH`) + 12 px de HUD. El canvas s'escala amb `image-rendering: pixelated`.
- Les rajoles fan `TW = 32` d'ample i les files `RH = 63` d'alt, amb 3 files (`ROWS`). El terra de la fila `r` és a `floorY(r) = r*63 + 60`.
- Cada sala té 10 columnes (`ROOMW = 320`) i la càmera salta de sala en sala sense desplaçament continu: `room = floor(prince.x / 320)`.
- `actor.x` és el centre dels peus i `actor.y` el terra. `face` val 1 (dreta) o -1 (esquerra); el sprite sempre es dibuixa mirant a la dreta i s'emmiralla.

### Llegenda del mapa (`level.js`)
El nivell es defineix a `ROOMS`: una entrada per sala amb les seves 3 files de 10 caràcters. `MAP` s'hi construeix a partir d'aquesta llista, i `NROOMS` i `COLS` es calculen sols.
`' '` buit · `_` terra · `#` bloc de pedra · `T` torxa · `O` finestra · `I` columna · `S` punxes · `L` rajola fluixa · `B` placa de pressió · `V` palanca · `G` reixa · `D` porta de sortida · pocions `P` vida, `Q` vida màxima, `X` verí, `F` ploma · enemics `K` guarda, `M` en Mykola.
**Activadors i objectius:** les palanques i plaques (`V`, `B`) s'aparellen per ordre d'esquerra a dreta amb les reixes i portes (`G`, `D`). La primera activadora obre el primer objectiu, i així successivament. Si el nombre no quadra, surt un avís a la consola. Si afegeixes o treus una palanca, comprova que l'ordre segueix sent el que vols.
`START` diu on apareix l'heroi a cada sala, que és el que fa servir `?sala=N`.
Cada tipus de poció es configura a `POTIONS` (color i efecte). L'efecte s'aplica a `drinkEffect()` de `game.js`.

### Poses (`sprite.js`)
Els angles són en graus: 0 = cap avall i els positius van cap endavant. Claus: `t` tors, `hd` cap, `rh/rk/ra` maluc/genoll/turmell de la cama del davant, `lh/lk/la` els de la cama del fons, `rs/re` i `ls/le` espatlla i colze dels braços, `sw` angle de l'espasa (`null` = sense espasa), `face` boca oberta, `pot` poció a la mà, `hx/hy` desplaçament del maluc. `g: 1` (per defecte, via `resolve`) calcula `hy` perquè el peu més baix toqui a terra; `g: 0` vol dir pose a l'aire o ancorada a una vora.

### Enemics
`foes` és una llista d'`Actor` amb `kind` igual a `'guard'` o `'mykola'`. La vida, la probabilitat de parar i la d'atacar de cada tipus són a `FOE_STATS`, i la IA és a `updateFoe(g)`. L'heroi lluita sempre contra l'enemic més proper de la mateixa fila (`foeNear(range)`).
En Mykola crida «My name is Mykola!» quan veu l'heroi, de tant en tant mentre lluita i quan rep un cop (`shout()`). El crit apareix en una bafarada i, si el navegador té `speechSynthesis`, també es diu en veu alta. Per dibuixar-lo, `drawPose` fa servir el cap `HEADS.mykola`, amb les ulleres de pasta (`G` muntura, `g` vidre).

### En Diego (l'heroi)
- **Frases:** `diego(text?)` mostra la frase en una bafarada, només per escrit. L'usuari no vol que en Diego parli en veu alta. Sense argument tria una frase a l'atzar de `DIEGO`. Es crida sola cada 18–38 s (`chatCool`) i també en moments concrets: «Suena terrible» per una caiguda forta o el verí, «Es así» quan cau un enemic i «No te falta razón» quan s'obre una reixa. Quan mor, diu una de les frases de `DIEGO_DIES` («Aaahhh, esto es peor que una PR de Miguel»...), i la pantalla de mort espera 150 ticks perquè es pugui llegir. Les bafarades de tots els personatges passen per `talk(a, text, ticks)`. Només en Mykola fa servir la veu sintetitzada (`speak()`).
- **Ball:** després de 300 ticks quiet (`idleT`), passa a l'estat `dance` amb l'animació `macarena` o `gangnam`. Qualsevol tecla l'atura. `sing()` toca una tonada pròpia de `SONGS`, i no la melodia ni la lletra de les cançons reals, que tenen drets d'autor.
- **Sortida:** a la porta passa a l'estat `enter`. Fa `enterTurn` fins a quedar d'esquena (pose `back: 1`, cap `HEADS.princeBack`) i després `walkIn`. `drawActor` el retalla dins del forat de la porta mentre es fa petit i s'esvaeix.

### L'Olivia i el gos (personatges que no juguen)
- `OLIVIA_PATHS` diu per a cada sala la fila i les columnes del tros de terra on passeja. Ha de ser terra continu, sense forats ni rajoles fluixes. Quan en Diego entra en una d'aquestes sales, l'Olivia hi apareix en un punt a l'atzar. Com que només es veu una sala alhora, sembla que sigui sempre la mateixa nena.
- `updateOlivia()` va canviant entre tres estats: `walk`, `sing` (animació `sway` i una frase de `KPOP` a la bafarada) i `hunt` (`huntStep`: apareix un bitxo, l'Olivia llança la bola amb l'animació `throw`, la bola fa tres sotracs i el bitxo queda caçat o s'escapa). Saluda en Diego una sola vegada per visita.
- El gos (`dog`, `updateDog`, `drawDog`) és un mapa de bits que segueix l'Olivia i de tant en tant borda.
- L'Olivia es dibuixa a escala 0.8 (`size`), i per això l'ull blau fa 2 píxels: si fos d'un, l'escalat el faria desaparèixer.
- Drets d'autor: el gos és original, només inspirat en la Pochita. Els bitxos són inventats i no hi ha pokémons de debò. Les cançons no tenen lletres reals.

### Morir i continuar
Quan mor, la pantalla de mort ofereix continuar (Enter o tocar). `respawn()` torna a posar en Diego al `START` de la sala on ha mort (`deathRoom()`), amb la vida plena i la `maxHp` que ja tenia. El món no es reinicia: les reixes obertes, les pocions begudes, les rajoles caigudes i els enemics morts es queden igual. Els enemics vius tornen a la seva posició inicial (`home`) amb la vida plena. R crida `start()` i torna a començar el joc de zero.

### Estats de l'heroi (`updatePrince`)
`idle, dance, enter, pull, turn, startRun, run, stop, slide, bump, step, crouch, crouchUp, land, landRun, jumpPrep, jumpUp, grabUp, hang, climb, standJump, runJump, air, fall, drink, drawSword, drawDone, garde, gardeTurn, advance, retreat, strike, block, hurt, dead`.
Patró: `a.go(estat, animació, ticksDeBarreja)` canvia l'estat i l'animació, `a.at` és el tick dins l'animació i `a.done` indica que s'ha acabat. Els esdeveniments van lligats a ticks concrets (p. ex. el cop es resol a `at === 13`).
Física de caiguda: més de 30 px → aterratge ajupit, més de 80 → perd 1 de vida, més de 140 → mort.

## Convencions
- Tot en **català**: comentaris, textos del joc, missatges (`say(...)`) i README.
- Sense dependències, sense build, sense imatges externes: tot es dibuixa per codi. Mantén-ho així si no et diuen el contrari.
- Codi compacte, amb línies llargues i diverses sentències per línia, com el que ja hi ha.
- Si canvies controls o mecàniques, actualitza també `poc/palau/README.md` i la pantalla de títol d'`index.html`.

## Estat i idees obertes
- Ara hi ha 1 nivell de 10 sales, amb 3 guardes, en Mykola, 4 tipus de poció, 4 palanques, 2 plaques, 5 reixes, punxes, rajoles fluixes i la porta de sortida.
- Saltar dues rajoles de punxes demana prémer ↑ corrent dins dels ~18 px d'abans de les punxes, i és igual de difícil que a la sala 2 original. Sempre es pot passar amb pas amb compte (Maj + →).
- L'heroi està inspirat en una foto de referència: cabell i barba foscos amb pèls grisos, plomífer blau marí i bufanda negra amb ratlles crues.
- Pendent, segons el nom del repo: ambientar-lo a Cornellà (decorat, textos, enemics) i, possiblement, rebatejar el joc i la carpeta `poc/palau`.
## Publicació
El joc es publica a GitHub Pages des de la branca **`gh-pages`**, que conté una còpia plana de `poc/palau/`: https://realbluehead.github.io/Prince-of-Cornella/
Per publicar-lo, primer fes commit a `main` i després copia `poc/palau/.` a l'arrel de `gh-pages` (amb un `git worktree`), fes-hi commit i puja-ho. No facis canvis directament a `gh-pages`: s'han de fer a `main`, perquè si no es perden quan es torna a publicar.
