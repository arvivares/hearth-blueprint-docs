# 02 — Estructura de carpetas

Principio: conservar intacta la estructura que Lovable necesita en la raíz (`src/`, `vite.config.ts`, `package.json`) y añadir el resto a su lado.

```text
/                          App web (TanStack Start) — raíz exigida por Lovable
├── src/
│   ├── routes/
│   │   ├── index.tsx      Portada: entrar con código / crear sala
│   │   ├── tv.tsx         Pantalla compartida
│   │   ├── host.tsx       Panel del anfitrión
│   │   └── play.tsx       Mando del jugador
│   ├── game/              Cliente Colyseus, hooks, sincronía de reloj (sin reglas)
│   └── components/        UI
├── packages/
│   └── contracts/         Tipos y esquemas Zod públicos compartidos (sin secretos)
├── apps/
│   └── game-server/       Servidor Colyseus (despliegue independiente)
│       ├── src/rules/     Lógica pura del juego
│       ├── src/rooms/     LogoRoom (Colyseus)
│       ├── src/http/      API HTTPS
│       ├── src/content/   Catálogo privado + etapas de imagen
│       ├── src/db/        PostgreSQL + migraciones
│       ├── Dockerfile
│       └── test/
├── content-private/       Catálogo y originales — NO se versiona en el repo público (.gitignore)
├── tests/                 Pruebas E2E y de carga (varios clientes)
├── deploy/                docker-compose, Caddy/Nginx, .env.example
├── docs/
└── LICENSE (MIT)
```

## Reglas de importación

- `src/` puede importar `packages/contracts`. Nunca `apps/game-server` ni `content-private`.
- `apps/game-server` puede importar `packages/contracts`.
- `packages/contracts` no importa nada del servidor ni contiene respuestas.
- Se añadirá una comprobación automática (lint o prueba) que falle si el bundle web contiene rutas del servidor o del catálogo.

Estado: estructura **propuesta**; en esta etapa solo existen `docs/` y `packages/contracts/`.
