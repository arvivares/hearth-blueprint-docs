# 12 · Auditoría y pruebas del flujo completo

Fecha: 2026-09-24 · Alcance: servidor Colyseus + PostgreSQL + cliente web. Sin funcionalidades nuevas.

> **Aviso importante.** Todo lo medido aquí se obtuvo con clientes automáticos en la **misma máquina**
> (red de bucle local). Una simulación **no demuestra** la experiencia con teléfonos reales: Wi-Fi
> compartido, bloqueo de pantalla, cambio de red, teclados de iOS/Android y pantallas/TV reales
> están pendientes de la prueba manual (`13-prueba-manual.md`).

## 1. Entorno de las mediciones

| Elemento | Valor |
|---|---|
| Máquina | Sandbox Linux (gVisor, kernel 4.19), 16 vCPU virtuales, 32 GB RAM |
| Node.js | v22.22.0 |
| Base de datos | PostgreSQL 17 local (mismo host) |
| Red | loopback; sin Wi-Fi, sin Internet, sin proxy TLS |
| Servidor | proceso independiente (`tsx src/index.ts`), medido por `/proc/<pid>` cada 500 ms |
| Clientes | `colyseus.js` 0.16 en otro proceso Node (no navegadores) |
| Contenido | paquete ficticio propio (12 logos SVG) |

## 2. Hallazgos y correcciones

| # | Problema encontrado | Gravedad | Corrección | Prueba |
|---|---|---|---|---|
| H1 | Cualquiera podía crear salas vía `POST /matchmake/create/logo` saltándose la API; las salas nunca se liberaban (fuga de memoria / DoS) | Alta | Clave interna por proceso: solo `POST /api/rooms` crea salas; `onCreate` rechaza el resto | `audit.test.ts` #1 |
| H2 | Sin límite general de mensajes WebSocket: un cliente podía inundar `clock:sync` u otros tipos | Alta | Cubo de fichas por conexión (ráfaga 20, 10/s); exceso descartado con `RATE_LIMITED`; ≥100 descartes en 10 s cierra la conexión (código 4008) | #4 |
| H3 | Los intentos rechazados (enfriamiento, ronda cerrada, ya acertado) se guardaban en memoria y PostgreSQL: spam con `attemptId` nuevos hacía crecer ambos | Media | Solo se guardan intentos evaluados (acierto/fallo), que ya están limitados por el enfriamiento | #4 (≤ 25 filas tras 400 envíos) |
| H4 | Tramas WebSocket sin tope (por defecto de la librería, 100 MB) | Media | `maxPayload` 16 KB; la trama excesiva cierra solo esa conexión | #2 |
| H5 | Tipos de mensaje como `toString`/`constructor` pasaban la comprobación `in` | Baja | Comprobación con `hasOwnProperty` | #2 |
| H6 | Detrás de un proxy inverso todos los usuarios comparten IP en el límite por IP (30 móviles bloqueados) | Media (despliegue) | Variable `TRUST_PROXY` | Documentado; no medible en local |
| H7 | En el cliente web, un corte de conexión era definitivo hasta recargar la página (típico al bloquear el móvil) | Alta (experiencia) | Reconexión automática con espera creciente (1 s→10 s, 12 intentos), reintento inmediato al volver a primer plano o recuperar red; el botón de envío se desactiva mientras reconecta | Playwright: socket cerrado en plena ronda → reconecta y responde |

## 3. Resultados medidos

### 3.1 Pruebas automatizadas — `npm test`: **44/44 aprobadas**

| Archivo | Pruebas | Cubre |
|---|---|---|
| rules | normalización, alias, puntuación, empates | reglas puras |
| content | importación, versionado, restricciones BD | catálogo |
| multiplayer | 30 jugadores + host + pantalla, jugador 31 rechazado, aislamiento entre 2 salas, tokens manipulados/cruzados, pairing único, expulsión | base multijugador |
| game | partida completa, duplicados, respuestas tardías, pausa, reconexión en ronda, empates, persistencia | motor |
| **audit (nuevo)** | creación directa bloqueada; 9 mensajes inválidos + trama gigante; permisos por rol y tokens cruzados en 2 salas; spam; ningún jugador recibe solución/aliases antes del cierre (inspección de todo mensaje y estado recibido); imágenes futuras/original bloqueadas para pantalla, y todas para host/jugador; caída del anfitrión (la partida sigue, recupera control); caída de pantalla (pausa, nueva pantalla invalida la anterior, reanudar); reconexión de jugador sin duplicar; **caída del servidor con `kill -9`** (cliente detecta cierre, al reiniciar la partida queda `aborted`, sala 404, tokens viejos rechazados) | auditoría |

### 3.2 Carga — `npm run loadtest` (2 salas × (30 jugadores + pantalla + anfitrión) = 64 clientes simultáneos)

| Métrica | Tiempos acelerados (×0,1; 3 rondas de 12 s) | **Tiempo real** (1 ronda de 120 s) |
|---|---|---|
| Partidas completadas | 2/2 (`FINAL_RESULTS`) | 2/2 |
| Intentos enviados / confirmados | 504 / 504 | 168 / 168 |
| Latencia de confirmación p50 / p95 / p99 / máx | 2,7 / 27,1 / 40,8 / 43,2 ms | 3,7 / 36,7 / 39,5 / 39,9 ms |
| Entrada (HTTP + WebSocket) p50 / p95 / máx | 230 / 309 / 312 ms | 525 / 714 / 720 ms (60 entradas a la vez) |
| Errores HTTP / WS / imágenes | 0 | 0 |
| Desconexiones inesperadas | 0 | 0 |
| Filtraciones de solución a jugadores | 0 | 0 |
| RSS del servidor reposo → pico | — → 271 MB | 225 → 268 MB |
| CPU media / pico (100 % = 1 núcleo) | 10,8 % / 146 % | 3,4 % / 166 % |

Los picos de CPU coinciden con la preparación de ronda (generación de las 5 etapas pixeladas con Sharp).
Resultados en bruto: `docs/results/loadtest-2x30-*.json`.

## 4. Objetivos pendientes (no demostrados)

- Experiencia con **teléfonos reales iOS y Android** en la misma Wi-Fi, con TV real → `13-prueba-manual.md`.
- Latencia por Wi-Fi/4G con TLS (`wss://`) y servidor remoto (no loopback).
- Legibilidad del QR y del logo a distancia en una TV real.
- Comportamiento del teclado virtual real (solo emulado con viewports).
- Despliegue con Docker Compose (archivos preparados, **no ejecutados** en este entorno).
- Límite real de salas/jugadores por núcleo; el objetivo de 9–30 jugadores por sala sigue sin medirse con personas.

## 5. Limitaciones conocidas

- Salas en memoria: un reinicio del servidor termina las partidas en curso (quedan `aborted`); no hay reanudación.
- Una única instancia de servidor (sin escalado horizontal ni Redis).
- Si la pantalla se desconecta la partida se pausa; si no vuelve en 10 min, se interrumpe.
- El anfitrión desconectado no detiene la partida, pero nadie puede pausarla hasta que vuelva.
- El límite por IP no distingue móviles tras la misma NAT; con 30 jugadores y el límite por defecto (120 entradas/min) hay margen, pero no para muchas salas en la misma red.
- La reconexión automática reutiliza el token guardado en el navegador; en modo privado o si se borran datos, el jugador vuelve a entrar con otro alias.
- Mediciones con clientes Node, no navegadores; no incluyen renderizado ni descarga en móviles.

## 6. Cómo reproducir

```bash
cd apps/game-server
npm test                                    # 44 pruebas (necesita PostgreSQL, TEST_DATABASE_URL)
DATABASE_URL=postgres://.../logos npm run loadtest -- --rooms 2 --players 30 --rounds 3 --scale 0.1
DATABASE_URL=postgres://.../logos npm run loadtest -- --rounds 1 --scale 1   # tiempo real
```
