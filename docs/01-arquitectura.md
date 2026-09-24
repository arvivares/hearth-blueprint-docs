# 01 — Arquitectura global

Estado: **propuesta**, etapa 1. Nada de esto está implementado todavía.

## Componentes

```text
 [TV / Pantalla]     [Anfitrión]        [Móviles 9-30 (objetivo, sin medir)]
   navegador          navegador            navegador
        \                 |                    /
         \    HTTPS (API)  +  WSS (SDK colyseus.js)
          v               v                   v
   +-----------------------------------------------+
   | apps/game-server  (Node.js + TS + Colyseus)   |  <- servicio persistente propio
   |  - LogoRoom: una instancia por sala, aislada  |
   |  - Reloj, revelado, validación, puntuación    |
   |  - API HTTPS: salas, tokens, imágenes/etapa   |
   |  - Catálogo privado + generador de etapas     |
   +-----------------------+-----------------------+
                           | TCP interno (nunca desde el navegador)
                    +------v------+
                    | PostgreSQL  |  <- servicio propio
                    +-------------+

   App web (este proyecto, React + TanStack Start)
   -> solo interfaz: /tv, /host, /play. Alojable en Lovable o en cualquier hosting.
```

## Responsabilidades

| Componente | Hace | Nunca hace |
|---|---|---|
| App web | Renderiza, envía intenciones, muestra estado recibido | Calcular aciertos, puntos o tiempos; contener catálogo o secretos |
| Servidor de juego | Autoridad única sobre fase, ronda, reloj, revelado, validez, puntuación, permisos, límites | Confiar en datos calculados por el cliente |
| PostgreSQL | Catálogo versionado, configuración, resultados | Ser accesible desde el navegador |

## Flujo de una partida

1. Anfitrión abre `/host` → `POST /api/rooms` → recibe `roomCode` + `hostToken`.
2. Anfitrión genera código de vinculación → la TV abre `/tv`, lo introduce → recibe `screenToken`.
3. La TV muestra QR (`/play?room=CODE`) y participantes.
4. Jugadores entran con alias → `playerToken` guardado en el navegador para reconectar.
5. Anfitrión inicia → PREPARING → TV confirma `screen:ready` → COUNTDOWN → rondas.
6. Durante ROUND_ACTIVE la TV pide la imagen de la etapa vigente por id opaco; los móviles envían intentos.
7. ROUND_RESULTS → siguiente ronda o FINAL_RESULTS; resultados persistidos en PostgreSQL.

## Separación de capas en el servidor

- `rules/` — lógica pura (normalización, puntuación, desempate, máquina de estados). Probable sin navegador ni red.
- `rooms/` — adaptación a Colyseus (transporte).
- `http/` — API HTTPS.
- `content/` — catálogo privado y generación de imágenes por etapa.
- `db/` — acceso a PostgreSQL.
