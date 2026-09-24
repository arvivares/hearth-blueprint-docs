# 13 · Prueba manual con móviles iOS y Android y pantalla compartida

Objetivo: comprobar con personas y dispositivos reales lo que la simulación no puede demostrar.
Duración estimada: 45 min. Rellenar la hoja de resultados al final.

## Preparación

- Servidor desplegado con HTTPS/WSS (no `localhost`), `TOKEN_SECRET`, `ALLOWED_ORIGINS` y, si hay proxy, `TRUST_PROXY=1`.
- Catálogo ficticio importado (`npm run db:seed`).
- **Pantalla**: TV o proyector con navegador (o portátil por HDMI) en horizontal, a pantalla completa.
- **Anfitrión**: un portátil o móvil.
- **Jugadores**: mínimo 6 teléfonos: ≥ 2 iPhone (Safari; uno con iOS antiguo si es posible), ≥ 2 Android (Chrome; uno de gama baja), resto variado. Ideal: 10–30 personas.
- Red: la Wi-Fi del lugar real. Anotar si algunos usan datos móviles.
- Anotar modelo, sistema y navegador de cada teléfono.

## Casos

| # | Paso | Resultado esperado |
|---|---|---|
| 1 | Crear sala en el anfitrión y vincular la TV con el código | La TV muestra QR y código grandes |
| 2 | Escanear el QR desde el fondo de la sala (3–5 m) con cámara de iOS y Android | Abre la página de entrada con la sala ya rellenada |
| 3 | Entrar escribiendo el código manualmente | Funciona igual |
| 4 | Poner el mismo alias en dos teléfonos | El segundo recibe aviso de alias en uso |
| 5 | Abrir el teclado en la pantalla de respuesta (iOS y Android) | Campo y botón **Enviar** siguen visibles; confirmaciones visibles sobre el teclado |
| 6 | Iniciar partida; todos responden a la vez | Cada uno ve su confirmación privada en < 1 s; la TV no muestra respuestas |
| 7 | Varios aciertan la misma ronda | Todos puntúan; la ronda no se cierra con el primer acierto |
| 8 | Pulsar Enviar muchas veces seguidas | Aviso de espera; nunca suma dos veces |
| 9 | Bloquear el teléfono 20 s en plena ronda y desbloquear | Reconecta solo, mantiene puntuación |
| 10 | Pasar un teléfono de Wi-Fi a datos móviles | Reconecta solo |
| 11 | Cerrar el navegador del jugador y volver a abrir la página | Recupera la sesión con el mismo alias |
| 12 | Desenchufar o cerrar la TV durante una ronda | La partida se pausa; al vincular de nuevo y reanudar, continúa |
| 13 | Cerrar la pestaña del anfitrión y volver | La partida continúa; recupera los controles |
| 14 | Leer el logo y el temporizador desde el fondo de la sala | Legible |
| 15 | Final de partida | Clasificación final correcta en TV y puntuación en cada móvil |
| 16 | (Opcional) Reiniciar el servidor | Todos ven "conexión perdida"; la partida queda interrumpida |

## Hoja de resultados

| Caso | iPhone 1 | iPhone 2 | Android 1 | Android 2 | Otros | Observaciones |
|---|---|---|---|---|---|---|
| 1–16 | ✅/❌ | | | | | |

Registrar además: número de jugadores, tiempo percibido de confirmación, incidencias de red,
capturas de pantalla de cualquier fallo y la hora exacta (para cruzar con los registros del servidor).
