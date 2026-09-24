# 11 — Requisitos confirmados vs parámetros propuestos

## Confirmados (contexto maestro o usuario)

- TV/escritorio como pantalla compartida; móviles como mandos, desde navegador.
- Entrada por QR o código de sala; sin cuentas ni instalaciones.
- Roles jugador, pantalla, anfitrión con credenciales distintas; QR sin permisos.
- Servidor autoritativo Node + TS + Colyseus, persistente e independiente.
- PostgreSQL, nunca accesible desde el navegador.
- HTTPS + WSS, sin pasarela propietaria obligatoria.
- Estados LOBBY, PREPARING, COUNTDOWN, ROUND_ACTIVE, ROUND_RESULTS, FINAL_RESULTS, PAUSED, ABORTED.
- La ronda no empieza sin confirmación de la pantalla.
- Un jugador puntúa una vez por ronda; el primer acierto no cierra la ronda.
- Intentos idempotentes con `attemptId` y `roundId`.
- Normalización determinista + alias; sin IA en MVP.
- Desempate: puntos, luego aciertos, luego posición compartida.
- Imágenes parciales servidas por etapa; sin ocultación solo con CSS.
- Sin recuperación transparente tras reinicio.
- Una instancia, sin escalado horizontal. Sin pagos, chat, voz, vídeo ni cuentas.
- Ejecutable fuera de Lovable; MIT; inventario de licencias.

## Propuestos (ajustables)

| Parámetro | Valor |
|---|---|
| Jugadores por sala | 9–30 (objetivo, no medido) |
| Rondas | 10 |
| Duración de ronda | 25 s |
| Etapas de revelado | 5 (una cada 5 s) |
| Puntos por etapa | 1000 / 800 / 600 / 400 / 200 |
| Intervalo entre intentos | 2 s |
| Reconexión | 60 s |
| Cuenta atrás | 3 s |
| Resultados de ronda | 8 s |
| Espera de `screen:ready` | 15 s |
| Pausa máxima antes de abortar | 10 min |
| Código de sala | 5 caracteres sin ambiguos (sin 0/O/1/I) |
| Código de vinculación de pantalla | 6 dígitos, 5 min, un uso |
| Longitud de alias / respuesta | 1–20 / 1–60 caracteres |
| Incorporaciones tardías | Esperan a la siguiente partida |
| Alojamiento del servidor | VPS + Docker Compose (pendiente) |
