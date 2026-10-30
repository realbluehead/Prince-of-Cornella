# Prince of Cornellà (POC)

Prova de concepte d'un joc de plataformes a l'estil *Prince of Persia*, en HTML5 Canvas i JavaScript pur (sense dependències ni compilació).

- **Jugar:** obre `index.html` al navegador (funciona amb `file://` o amb qualsevol servidor estàtic, p. ex. `npx serve poc/palau`).
- **Galeria d'animacions:** `sprites.html` mostra totes les animacions de l'heroi, del guarda i d'en Mykola.
- **Anar a una sala:** `index.html?sala=7` comença a la sala 7, amb les reixes de les sales anteriors ja obertes.

## Com funciona

- `js/sprite.js` — esquelet procedural (malucs, genolls, espatlles, colzes, cap, espasa) rasteritzat píxel a píxel amb contorn. L'heroi està inspirat en la foto de referència: cabell i barba foscos amb pèls grisos, jaqueta plomífera blau marí i bufanda negra amb ratlles crues (amb moviment secundari).
- `js/anims.js` — més de 40 animacions per fotogrames clau amb interpolació: repòs, arrencar a córrer, córrer, frenar, girar, pas amb compte, ajupir-se, gatejar, salt vertical, penjar-se, enfilar-se, despenjar-se, salt endavant, salt llarg, caiguda, aterratges (suau, ajupit, dur), beure poció, mort, punxes, victòria i esgrima (desenfundar, en guàrdia, avançar, recular, atacar, parar, rebre un cop).
- `js/level.js` — nivell de 10 sales amb pantalla fixa, decorat procedural (maons, finestres amb la ciutat de nit, torxes, columnes, estendards), trampes, palanques i reixes.
- `js/game.js` — màquina d'estats, física, combat amb IA dels enemics, rajoles fluixes, punxes, palanques i plaques que obren reixes, pocions i porta de sortida.

## El nivell

L'heroi és en **Diego**. De tant en tant diu «No te falta razón», «Es así» o «Suena terrible» (de vegades segons el que passa: verí, una caiguda, un enemic vençut o una reixa que s'obre). Si s'està quiet 5 segons, es posa a ballar la Macarena o el Gangnam Style tot cantant una tonada pròpia. Quan arriba a la porta de sortida, s'hi gira d'esquena i hi entra caminant.

A les sales 1, 2, 4, 5, 7 i 8 passeja l'**Olivia**, una nena de cabell ros i llarg i ulls blaus, amb el seu gos: un cadellet taronja inspirat en la Pochita. Va cantant (exclamacions típiques del k-pop, sense lletres de cançons reals) i caçant bitxos inventats amb una bola vermella i blanca. Quan en Diego s'hi acosta, el saluda.

Deu sales amb tres guardes i, a l'última, en **Mykola**: porta ulleres negres de pasta i va cridant «My name is Mykola!» (si el navegador pot, també ho diu en veu alta).

| Poció | Color | Efecte |
|---|---|---|
| Vida | vermella | recupera un punt de vida |
| Vida màxima | blava (flascó gran) | un punt de vida més, per sempre |
| Verí | verda | treu un punt de vida |
| Ploma | groga | durant 30 s caus a poc a poc i cap caiguda fa mal |

Si en Diego mor, continua des de l'entrada de la sala on ha mort, amb la vida plena. Les reixes que ja ha obert, les pocions que ja s'ha begut i els enemics que ja ha vençut es queden com estaven. Amb R es torna a començar el joc des del principi.

Cada palanca o placa obre una reixa. Algunes reixes són a la mateixa sala i d'altres més endavant.

## Controls

| Tecla | Acció |
|---|---|
| ← → | córrer / girar |
| ↑ | saltar, enfilar-se a un replà, entrar per la porta |
| ↑ + → | salt endavant (corrent: salt llarg) |
| ↓ | ajupir-se, despenjar-se d'una vora |
| Maj + → | pas amb compte (s'atura a la vora) |
| Maj (mantenir en caure) | agafar-se a una vora |
| Maj / Espai | beure poció, estirar una palanca, atacar amb l'espasa |
| ↑ (en combat) | parar el cop |
| Enter (després de morir) | continuar a la mateixa sala |
| R | tornar a començar des del principi |
