# 03 — Roles y autenticación

Sin cuentas personales. Cada rol obtiene una credencial distinta emitida por el servidor.

| Rol | Cómo obtiene credencial | Puede | No puede |
|---|---|---|---|
| Anfitrión | `POST /api/rooms` → `hostToken` | Configurar, iniciar, pausar, reanudar, avanzar, abortar, autorizar pantalla, expulsar | Responder como jugador |
| Pantalla | Código de vinculación de un solo uso generado por el anfitrión → `screenToken` | Recibir estado completo público, pedir imagen de la etapa vigente, confirmar `screen:ready` | Administrar la sala |
| Jugador | `POST /api/rooms/:code/players` con alias → `playerToken` | Enviar intentos, ver su resultado | Ver textos de otros, ver respuestas, administrar |

## Credenciales

- Tokens firmados por el servidor (HMAC, secreto `TOKEN_SECRET` solo en servidor) con `{ roomId, role, subjectId, exp }`.
- Colyseus valida el token en `onAuth`; el rol sale del token, nunca de un campo `role` enviado por el cliente.
- Cada token está ligado a una sala: no sirve en otra.
- `hostToken` y `screenToken` no aparecen en URLs, QR ni logs.

## Vinculación de pantalla

1. Anfitrión pide `POST /api/rooms/:code/screen-pairing` → `pairingCode` de 6 dígitos, válido 5 min (propuesto), un uso.
2. La TV introduce el código → `POST /api/rooms/:code/screen` → `screenToken`.
3. Si hay una pantalla activa, la nueva la sustituye solo con nueva autorización del anfitrión.

Alternativa aceptada: anfitrión y pantalla en el mismo navegador (el anfitrión abre la TV desde su panel y la vinculación ocurre automáticamente); sigue emitiendo dos tokens diferentes.

## Identidad del jugador

- `playerToken` en `localStorage` del móvil permite recuperar identidad al recargar (ventana propuesta 60 s de gracia en Colyseus + token vigente mientras dure la sala).
- El alias es solo visible; puede repetirse con sufijo automático. No autentica.
- Anfitrión y pantalla no ocupan plazas de jugador.
