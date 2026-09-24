# 07 — Contratos WebSocket (Colyseus)

Conexión: `new Client(VITE_GAME_SERVER_URL).joinById(roomId, { token })`. El rol se deduce del token en `onAuth`.
Esquemas Zod en `packages/contracts/src/messages.ts`. Todo mensaje se valida; los inválidos devuelven `error`.

## Estado sincronizado (público)

```ts
RoomState {
  phase: Phase; previousPhase?: Phase;
  roundIndex: number; totalRounds: number; roundId: string;
  revealStage: number; totalStages: number;
  phaseEndsAt: number;           // ms, reloj del servidor
  screenConnected: boolean; hostConnected: boolean;
  players: Map<playerId, { alias, connected, score, correctCount, answeredThisRound, waiting }>;
  ranking: { playerId, rank }[]; // rank compartido en empate
}
```

## Cliente → servidor (intenciones)

| Tipo | Rol | Carga | Límite |
|---|---|---|---|
| `host:configure` | host | `Partial<GameConfig>` | solo LOBBY |
| `host:start` / `host:pause` / `host:resume` / `host:next` / `host:abort` / `host:reset` | host | `{}` | 1/s |
| `host:kick` | host | `{ playerId }` | — |
| `screen:ready` | screen | `{ roundId }` | — |
| `player:attempt` | player | `{ attemptId: uuid, roundId, text (1–60) }` | 1 cada 2 s (propuesto) por jugador |
| `clock:sync` | todos | `{ clientSentAt }` | 1/s |

## Servidor → cliente

| Tipo | Destino | Carga |
|---|---|---|
| `attempt:result` | jugador que envió | `{ attemptId, roundId, status: correct|incorrect|already_scored|round_closed|rate_limited|duplicate, points?, retryAt? }` |
| `round:media` | pantalla | `{ roundId, stage, mediaId }` |
| `round:reveal` | pantalla | `{ roundId, answer, mediaId }` (solo al cerrar la ronda) |
| `clock:pong` | solicitante | `{ clientSentAt, serverNow }` |
| `error` | solicitante | `{ code: ErrorCode, ref? }` |

## Idempotencia y reconexión

- Un `attemptId` ya procesado devuelve el mismo resultado original con `status: duplicate` y los puntos originales; nunca suma de nuevo.
- Al reconectar (`allowReconnection` 60 s, propuesto), el servidor envía el estado vigente y los `attempt:result` de la ronda actual ya procesados.
