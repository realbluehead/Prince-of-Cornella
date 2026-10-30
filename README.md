# Prince of Cornellà (POC)

Prova de concepte d'un joc de plataformes a l'estil *Prince of Persia*, en HTML5 Canvas i JavaScript pur (sense dependències ni compilació).

- **Jugar:** obre `index.html` al navegador (funciona amb `file://` o amb qualsevol servidor estàtic, p. ex. `npx serve poc/palau`).
- **Galeria d'animacions:** `sprites.html` mostra totes les animacions de l'heroi i del guarda.

## Com funciona

- `js/sprite.js` — esquelet procedural (malucs, genolls, espatlles, colzes, cap, espasa) rasteritzat píxel a píxel amb contorn. L'heroi està inspirat en la foto de referència: cabell i barba foscos amb pèls grisos, jaqueta plomífera blau marí i bufanda negra amb ratlles crues (amb moviment secundari).
- `js/anims.js` — més de 40 animacions per fotogrames clau amb interpolació: repòs, arrencar a córrer, córrer, frenar, girar, pas amb compte, ajupir-se, gatejar, salt vertical, penjar-se, enfilar-se, despenjar-se, salt endavant, salt llarg, caiguda, aterratges (suau, ajupit, dur), beure poció, mort, punxes, victòria i esgrima (desenfundar, en guàrdia, avançar, recular, atacar, parar, rebre un cop).
- `js/level.js` — nivell de 3 sales amb pantalla fixa, decorat procedural (maons, finestres amb la ciutat de nit, torxes, columnes, estendards) i trampes.
- `js/game.js` — màquina d'estats, física, combat amb IA del guarda, rajoles fluixes, punxes, placa de pressió i porta de sortida.

## Controls

| Tecla | Acció |
|---|---|
| ← → | córrer / girar |
| ↑ | saltar, enfilar-se a un replà, entrar per la porta |
| ↑ + → | salt endavant (corrent: salt llarg) |
| ↓ | ajupir-se, despenjar-se d'una vora |
| Maj + → | pas amb compte (s'atura a la vora) |
| Maj (mantenir en caure) | agafar-se a una vora |
| Maj / Espai | beure poció, atacar amb l'espasa |
| ↑ (en combat) | parar el cop |
| R | reiniciar |
