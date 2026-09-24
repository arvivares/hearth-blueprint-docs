# Etapa 1 — Arquitectura global y contratos

Juego competitivo de logos: la TV muestra un logo que se revela por etapas y 9–30 jugadores responden desde el móvil. Esta etapa solo produce documentación y contratos. No se crean pantallas, servidor ni lógica de juego.

## Entregables

Carpeta `docs/` y contratos compartidos:

| Archivo | Contenido |
|---|---|
| `docs/00-contexto.md` | Contexto maestro copiado tal cual como referencia permanente |
| `docs/01-arquitectura.md` | Componentes, diagrama, flujo TV/anfitrión/móvil |
| `docs/02-estructura.md` | Estructura de carpetas del repositorio (monorepo) |
| `docs/03-roles-y-autenticacion.md` | Roles, credenciales, vinculación de pantalla |
| `docs/04-maquina-de-estados.md` | Estados, transiciones, pausas, abortos, reconexión |
| `docs/05-datos.md` | Datos públicos vs privados, protección del contenido, modelo PostgreSQL |
| `docs/06-contratos-http.md` | Endpoints HTTPS |
| `docs/07-contratos-websocket.md` | Mensajes Colyseus y estado sincronizado |
| `docs/08-despliegue.md` | Qué se despliega dónde, variables, conexión Lovable ↔ Colyseus |
| `docs/09-decisiones.md` | Registro de decisiones (ADR) |
| `docs/10-riesgos.md` | Riesgos principales y mitigación |
| `docs/11-requisitos.md` | Requisitos confirmados vs parámetros propuestos |
| `packages/contracts/` | Tipos TypeScript y esquemas Zod de mensajes, estados y errores (solo tipos, sin lógica) |
| `roadmap.md` | Etapas siguientes, sin implementarlas |
| `LICENSE` | MIT |

## Arquitectura propuesta

```text
 [TV / Pantalla]  [Anfitrión]   [Móviles x9-30]
        \             |             /
         \  HTTPS + WSS (SDK Colyseus)
          v           v            v
   +--------------------------------------+
   | Servidor de juego (Node + Colyseus)  |  despliegue independiente
   |  - Salas aisladas, reloj, puntuación |
   |  - API HTTPS: salas, imágenes etapa  |
   +------------------+-------------------+
                      | (solo servidor)
                 [PostgreSQL]               despliegue independiente
   App web (React, TanStack Start) -> solo interfaz; alojable en Lovable o fuera
```

- La app web solo sirve la interfaz; nunca contiene catálogo, respuestas ni secretos.
- El servidor Colyseus es la única autoridad: fase, ronda, reloj, revelado, validez, puntuación, límites.
- PostgreSQL solo es accesible desde el servidor de juego.

## Roles y autenticación (sin cuentas)

- **Anfitrión**: crea la sala por HTTPS y recibe un `hostToken` secreto (solo en su dispositivo).
- **Pantalla**: se vincula con un código de un solo uso que el anfitrión autoriza; recibe un `screenToken` distinto.
- **Jugador**: entra por QR o código de sala con alias; recibe un `playerToken` para reconectar. El alias no autentica.
- Los tokens se firman en el servidor; nunca se acepta un `role` declarado por el cliente. El QR solo lleva el código de sala.
- Anfitrión y pantalla no ocupan plaza de jugador.

## Máquina de estados

```text
LOBBY -> PREPARING -> COUNTDOWN -> ROUND_ACTIVE -> ROUND_RESULTS
                         ^                              |
                         +------- (quedan rondas) ------+
                                                        v
                                                  FINAL_RESULTS
Cualquier estado activo -> PAUSED -> (reanuda al estado previo)
Cualquier estado -> ABORTED (anfitrión, pantalla perdida largo tiempo, caída del servidor)
```

- PREPARING espera la confirmación de la pantalla antes de COUNTDOWN.
- Si la pantalla se desconecta durante la partida, se pasa a PAUSED automáticamente.
- Jugadores tardíos esperan a la siguiente partida.
- Reinicio del servidor: la partida queda ABORTED y se conserva lo ya guardado.

## Datos públicos y privados

- **Públicos** (estado sincronizado): fase, ronda, etapa de revelado, fin de ronda según el servidor, jugadores (alias, conectado, puntos, aciertos), clasificación.
- **Privados por jugador** (mensajes dirigidos): resultado de sus intentos, si ya acertó, espera por límite.
- **Solo servidor**: respuestas, alias del catálogo, imagen original, tokens.
- Imágenes: el servidor genera versiones parciales por etapa y las sirve con identificadores opacos, comprobando sala, ronda y etapa autorizada en cada petición. Los móviles no reciben la imagen.

## Contratos (resumen)

**HTTPS**
- `POST /api/rooms` → código de sala + `hostToken`
- `POST /api/rooms/:code/screen-pairing` (anfitrión) → código de vinculación
- `POST /api/rooms/:code/screen` → `screenToken`
- `POST /api/rooms/:code/players` → `playerToken`
- `GET /api/rooms/:code` → existencia y estado público
- `GET /api/media/:opaqueId` (pantalla autorizada) → imagen de la etapa vigente
- `GET /health`

**WebSocket** (cliente → servidor, intenciones)
- Anfitrión: `host:configure`, `host:start`, `host:pause`, `host:resume`, `host:next`, `host:abort`
- Pantalla: `screen:ready`
- Jugador: `player:attempt { attemptId, roundId, text }` (idempotente por `attemptId`)
- Todos: `clock:sync`

**WebSocket** (servidor → cliente)
- Estado sincronizado del esquema Colyseus
- `attempt:result` privado, `clock:pong`, `error { code }`

Cada mensaje tendrá esquema Zod, límite de tamaño y frecuencia, y lista de errores (`ROOM_FULL`, `ROOM_NOT_FOUND`, `GAME_IN_PROGRESS`, `RATE_LIMITED`, `ROUND_CLOSED`, `ALREADY_SCORED`, `FORBIDDEN`).

## Conexión Lovable ↔ Colyseus y despliegue

- La app web lee una única variable pública (`VITE_GAME_SERVER_URL`) y se conecta por `wss://` con el SDK oficial de Colyseus. Sin pasarelas propietarias.
- **Despliegue independiente obligatorio**: servidor Colyseus (proceso Node persistente con WebSocket) y PostgreSQL. No pueden ejecutarse dentro del alojamiento de Lovable.
- **App web**: puede publicarse en Lovable o en cualquier alojamiento; se documenta cómo construirla fuera.
- Se documentan opciones para el servidor (VPS con Docker Compose, Fly.io, Railway, Render) con coste, WebSocket persistente y licencias; la recomendación inicial es VPS + Docker Compose por ser totalmente open source y reproducible. La elección queda pendiente de ti.
- CORS: lista de orígenes permitidos (previsualización, dominio publicado, local).

## Requisitos confirmados vs propuestos

- **Confirmados**: TV + móviles, sin cuentas, QR/código, Colyseus + Node + TS, PostgreSQL, servidor autoritativo, estados listados, independencia de Lovable, MIT, sin IA para validar.
- **Propuestos (ajustables)**: 10 rondas × 25 s, 5 etapas, 1000/800/600/400/200 puntos, 2 s entre intentos, reconexión 60 s, 9–30 jugadores (a medir), tardíos esperan, código de sala de 4–6 caracteres, tiempo de pausa máximo antes de abortar.

## Decisiones y riesgos (contenido previsto)

- **Decisiones**: monorepo con app web + servidor + contratos; tokens firmados por rol; imágenes por etapa generadas en servidor; sin escalado horizontal; normalización determinista con alias.
- **Riesgos**: fuga de respuestas por imágenes o bundle; latencia desigual en la red del local; pérdida de la pantalla; 30 conexiones simultáneas sin medir; reinicio del servidor a mitad de partida; licencias de logos de terceros; desviaciones entre versiones del SDK cliente y servidor.

## Fuera de alcance

Pantallas, lógica de juego, código del servidor, base de datos real, generación de imágenes y despliegue.
