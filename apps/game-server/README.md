# Servidor de juego (Colyseus) — despliegue independiente

Node.js 22 + TypeScript + Colyseus 0.16.5 (cliente `colyseus.js` 0.16.22). Versiones fijadas en `package-lock.json`.

## Ejecutar

```sh
cd apps/game-server
npm ci
npm start            # http://localhost:2567 (HTTP y WebSocket en el mismo puerto)
```

Variables (opcionales en local, obligatorias en producción):

| Variable | Uso |
|---|---|
| `PORT` | Puerto (2567 por defecto) |
| `TOKEN_SECRET` | Secreto de firma, ≥32 caracteres. Sin él se genera uno aleatorio (las sesiones no sobreviven al reinicio) |
| `ALLOWED_ORIGINS` | Orígenes web permitidos, separados por comas. Vacío = todos (solo desarrollo) |

App web: `VITE_GAME_SERVER_URL=https://tu-servidor` (en local se usa `http://localhost:2567`) y `bun dev` en la raíz.
Rutas: `/` crear o entrar · `/host` anfitrión · `/tv` pantalla · `/play` jugador.

## Prueba reproducible con varios clientes

```sh
cd apps/game-server
npm test                 # 30 jugadores + anfitrión + pantalla + segunda sala
TEST_PLAYERS=10 npm test # otro tamaño
```

Arranca un servidor real en un puerto libre y abre conexiones HTTP + WebSocket independientes (un `Client` por dispositivo). Comprueba:
capacidad de 30 jugadores sin contar anfitrión ni pantalla, `ROOM_FULL` en el 31, aislamiento entre dos salas, rechazo de tokens ausentes, manipulados o de otra sala, un `role` declarado por el cliente que se ignora, acciones de anfitrión prohibidas a jugador y pantalla, código de vinculación de un solo uso, sustitución de pantalla, recuperación de sesión y expulsión.

Nota: es una prueba funcional en una sola máquina, no una prueba de carga en red real.

## Motor de juego (etapa 4)

El servidor controla fases, tiempos, etapas de revelado, validación y puntuación:
`LOBBY → PREPARING → (pantalla confirma) → COUNTDOWN → ROUND_ACTIVE → ROUND_RESULTS → … → FINAL_RESULTS`, con `PAUSED` (manual o si se pierde la pantalla) y `ABORTED`.

- Reglas puras y probadas sin navegador: `src/rules/normalize.ts` (mayúsculas, acentos, espacios, signos + alias exactos) y `src/rules/scoring.ts` (1000/800/600/400/200 por etapa, desempate por puntos → aciertos → posición compartida).
- Intentos idempotentes por `attemptId`; un acierto por jugador y ronda; 2 s entre intentos; respuestas tardías → `round_closed`.
- La solución solo se envía al cerrar la ronda. Los móviles nunca reciben imágenes.
- Imágenes: catálogo **ficticio propio** (`src/content/catalog.ts`, logos generados por código). Cada etapa se pixela en el servidor y se sirve con id opaco; `/api/media/:id` exige credencial de pantalla y rechaza etapas futuras y el original hasta el cierre.
- El historial de la partida queda en memoria (`history`); se persistirá en PostgreSQL en la etapa de persistencia.

## Partida completa reproducible

```sh
npm run simulate                          # servidor propio, 8 bots, 3 rondas, 10x más rápido
PLAYERS=20 ROUNDS=5 SCALE=0.2 SEED=7 npm run simulate
SERVER_URL=https://tu-servidor npm run simulate   # contra un servidor desplegado
```

`GAME_TIME_SCALE=0.3 npm start` acelera los tiempos del servidor para probar a mano con la TV y móviles.
