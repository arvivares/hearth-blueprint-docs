# 06 — Contratos HTTPS

Base: `https://<GAME_SERVER_HOST>`. JSON. Esquemas en `packages/contracts/src/http.ts`.
Errores: `{ error: ErrorCode, message?: string }` con el código HTTP indicado.

| Método y ruta | Credencial | Petición | Respuesta 2xx | Errores |
|---|---|---|---|---|
| `GET /health` | — | — | `{ ok: true, version }` | — |
| `POST /api/rooms` | — (límite por IP) | `{ config?: Partial<GameConfig> }` | `201 { roomCode, roomId, hostToken }` | 400 `INVALID_INPUT`, 429 `RATE_LIMITED` |
| `GET /api/rooms/:code` | — | — | `{ roomCode, phase, playerCount, maxPlayers, acceptingPlayers }` | 404 `ROOM_NOT_FOUND` |
| `POST /api/rooms/:code/screen-pairing` | Bearer `hostToken` | — | `{ pairingCode, expiresAt }` | 401, 403 `FORBIDDEN` |
| `POST /api/rooms/:code/screen` | — | `{ pairingCode }` | `{ screenToken, roomId }` | 403 `PAIRING_INVALID` |
| `POST /api/rooms/:code/players` | — | `{ alias, playerToken? }` | `{ playerToken, playerId, roomId, alias, waiting }` | 404, 409 `ROOM_FULL`, 400 `ALIAS_INVALID` |
| `GET /api/media/:opaqueId` | Bearer `screenToken` | — | `image/webp` | 403 `FORBIDDEN`, 404 |

Notas:
- `playerToken?` en `players` permite recuperar identidad existente (recarga).
- CORS: solo orígenes de `ALLOWED_ORIGINS`.
- Tamaño máximo de cuerpo: 4 KB (propuesto).
- Tras obtener el token, el cliente hace `client.joinById(roomId, { token })` por WSS.
