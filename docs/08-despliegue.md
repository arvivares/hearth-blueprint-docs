# 08 — Despliegue y conexión Lovable ↔ Colyseus

## Qué se despliega dónde

| Pieza | Despliegue | ¿Puede ir en Lovable? |
|---|---|---|
| App web (interfaz) | Hosting web estático/SSR | Sí (opcional); también en cualquier hosting |
| Servidor de juego Colyseus | Proceso Node persistente con WebSocket | **No** — requiere despliegue independiente |
| PostgreSQL | Servicio propio junto al servidor | **No** — independiente |

El alojamiento de Lovable ejecuta funciones sin estado de corta duración: no sirve para salas vivas ni WebSockets persistentes. Por eso Colyseus y PostgreSQL van aparte.

## Conexión

- App web: una única variable pública `VITE_GAME_SERVER_URL` (p. ej. `https://game.midominio.com`). El SDK deriva `wss://`.
- Sin pasarela intermedia: el navegador habla directo con el servidor de juego.
- El servidor admite solo orígenes en `ALLOWED_ORIGINS` (dominio publicado, previsualización, `http://localhost:8080`).
- Si el servidor no responde, la app muestra un error real; nunca datos simulados.

## Variables de entorno (servidor, privadas)

`PORT`, `DATABASE_URL`, `TOKEN_SECRET`, `ALLOWED_ORIGINS`, `MEDIA_DIR`, `CONTENT_DIR`, `LOG_LEVEL`. Se entregará `deploy/.env.example` sin valores reales.

## Opciones de alojamiento del servidor (pendiente de decisión)

| Opción | Pros | Contras |
|---|---|---|
| **VPS + Docker Compose + Caddy** (recomendada) | 100 % open source, reproducible, TLS automático, barato | Mantenimiento propio |
| Fly.io | Despliegue sencillo, WebSocket OK | Plataforma propietaria (sustituible) |
| Railway / Render | Muy sencillo, Postgres incluido | Coste variable, algunos planes duermen el proceso |
| Colyseus Cloud | Especializado | Servicio gestionado propietario: no obligatorio por el principio del proyecto |

Una sola instancia con muchas salas aisladas. Sin escalado horizontal hasta medir necesidad.

## Entornos

- Local: `docker compose up` (Postgres + servidor) + `bun dev` (web).
- Staging y producción: mismo compose con distintas variables.
- Criterio final: partida completa con varios dispositivos reales en un despliegue independiente de Lovable.
