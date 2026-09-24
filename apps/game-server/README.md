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
