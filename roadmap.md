# Roadmap

- [x] Etapa 1 — Arquitectura, contratos y documentación
- [ ] Etapa 2 — Lógica pura del juego (normalización, puntuación, desempate, estados) con pruebas
- [ ] Etapa 3 — Servidor Colyseus + API HTTPS + tokens por rol
- [ ] Etapa 4 — PostgreSQL: catálogo versionado y resultados
- [ ] Etapa 5 — Imágenes por etapa protegidas
- [ ] Etapa 6 — Interfaces TV, anfitrión y mando móvil conectadas al servidor real
- [ ] Etapa 7 — Reconexión, pausas y casos límite
- [ ] Etapa 8 — Pruebas de carga (objetivo 9–30 jugadores)
- [ ] Etapa 9 — Despliegue independiente reproducible (bloqueado: elegir alojamiento)

## Etapa 2 (hecha) — Base multijugador
- [x] Servidor Colyseus independiente (salas, tokens por rol, QR, pantalla, sesión)
- [x] Cliente real mínimo (/host, /tv, /play)
- [x] Prueba reproducible multi-cliente (aislamiento, permisos, capacidad)

## Etapa 3 (hecha) — Interfaces TV / móvil / anfitrión
- [x] Sistema visual y vistas TV (horizontal), móvil (vertical), anfitrión
- [x] Estado público ampliado en servidor (ronda, reloj, etapa, clasificación) + host:configure
- [x] Demostración separada e identificada (/demo)
