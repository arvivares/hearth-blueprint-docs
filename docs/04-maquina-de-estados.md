# 04 — Máquina de estados

```text
            host:start             screen:ready         fin cuenta atrás
  LOBBY ───────────────> PREPARING ─────────────> COUNTDOWN ─────────────> ROUND_ACTIVE
    ^                                                  ^                        │ reloj servidor = 0
    │ host:reset                                       │ quedan rondas          v  (o host:next)
    │                                                  └──────────────── ROUND_RESULTS
    │                                                                           │ no quedan rondas
    └─────────────────────────────────────────────────────────────── FINAL_RESULTS

  PREPARING | COUNTDOWN | ROUND_ACTIVE | ROUND_RESULTS ──(host:pause | pantalla caída)──> PAUSED
  PAUSED ──(host:resume y pantalla conectada)──> estado previo (reloj reanudado con lo que restaba)
  Cualquiera salvo FINAL_RESULTS ──(host:abort | pausa > límite | reinicio de proceso)──> ABORTED
```

## Transiciones

| Desde | Evento | Hacia | Guardas |
|---|---|---|---|
| LOBBY | `host:start` | PREPARING | ≥1 jugador (propuesto: mínimo configurable), pantalla vinculada |
| PREPARING | `screen:ready { roundId }` | COUNTDOWN | La pantalla confirma que muestra el estado inicial |
| PREPARING | timeout 15 s (propuesto) sin `screen:ready` | PAUSED | — |
| COUNTDOWN | 3 s (propuesto) | ROUND_ACTIVE | — |
| ROUND_ACTIVE | reloj a 0 o `host:next` | ROUND_RESULTS | — |
| ROUND_RESULTS | 8 s (propuesto) o `host:next` | PREPARING / FINAL_RESULTS | según rondas restantes |
| activo | `host:pause` o pantalla desconectada | PAUSED | guarda `previousPhase` y tiempo restante |
| PAUSED | `host:resume` | previo | pantalla conectada |
| PAUSED | 10 min (propuesto) | ABORTED | — |
| no final | `host:abort` | ABORTED | — |

## Reglas

- Etapas de revelado avanzan por tiempo dentro de ROUND_ACTIVE (propuesto: 5 etapas en 25 s, cada 5 s).
- El servidor publica `phaseEndsAt` (hora del servidor); los clientes estiman desfase con `clock:sync`.
- Anfitrión desconectado: la partida sigue si la pantalla está conectada; sin anfitrión 5 min (propuesto) en LOBBY → sala cerrada.
- Jugadores que entran tras LOBBY quedan en `waiting` hasta la siguiente partida.
- Reinicio del proceso servidor: no hay recuperación transparente; al arrancar, las partidas `in_progress` en BD se marcan `aborted`.
