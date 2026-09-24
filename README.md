# ⚡ PeekRush

> **Adivina el logotipo en tiempo real.**  
> Juego multijugador interactivo estilo *party game* donde una pantalla compartida revela marcas progresivamente y los jugadores compiten respondiendo al instante desde su móvil o navegador.

[![Production](https://img.shields.io/badge/Production-peekrush.inmerzion.io-black?style=for-the-badge&logo=vercel)](https://peekrush.inmerzion.io)
[![Demo](https://img.shields.io/badge/Live_Demo-Interactive_Sim-indigo?style=for-the-badge)](https://peekrush.inmerzion.io/demo)
[![Stack](https://img.shields.io/badge/Stack-React_19_•_TanStack_•_Colyseus_•_PostgreSQL-emerald?style=for-the-badge)](#arquitectura-y-tecnologías)

---

## 📸 Vista Previa y Modos de Juego

PeekRush combina la emoción de los concursos televisivos con la inmediatez de la tecnología web en tiempo real:

- **Modo Fiesta / Multijugador (TV + Móviles):**  
  El anfitrión crea una sala desde cualquier ordenador o Smart TV. La pantalla muestra un código QR gigante y un código de sala de 5 caracteres. Los participantes escanean el QR con la cámara de su teléfono móvil, eligen un alias y ya están listos para competir sin instalar ninguna aplicación.
- **Modo Individual ("Jugar solo"):**  
  Permite disfrutar de la experiencia completa en solitario directamente desde el navegador, respondiendo con el teclado físico o táctil.
- **Revelado Progresivo:**  
  Los logotipos reales se descubren por fases (desenfoque, silueta y nitidez progresiva). Cuanto antes reconozcas la marca, mayor puntuación obtendrás.
- **Clasificación Dual:**  
  Podio inmediato al finalizar la partida y tabla histórica de récords globales persistida en PostgreSQL.
- **Guía de Audio Neuronal:**  
  Presentadora virtual con voz neuronal sintetizada (ElevenLabs) y analizador de espectro de audio interactivo estilo Siri / Apple Voice Memos.
- **Analítica Respetuosa:**  
  Integración con Plausible Analytics sin cookies ni seguimiento invasivo de datos personales.

---

## 🛠 Arquitectura y Tecnologías

```
┌────────────────────────────────────────────────────────┐
│                   Cliente Web (SSR/SPA)                │
│       TanStack Start / React 19 + Tailwind CSS         │
│             (Móvil / Pantalla TV / Demo)               │
└───────────────▲────────────────────────▲───────────────┘
                │ HTTP API               │ WebSocket
                │                        │ (Colyseus.js)
┌───────────────▼────────────────────────▼───────────────┐
│               Servidor de Juego (Node.js)              │
│       Colyseus Realtime Room + Express HTTP API        │
│          Máquina de estados + Sharp (Sprites)          │
└───────────────────────────▲────────────────────────────┘
                            │ SQL Queries
┌───────────────────────────▼────────────────────────────┐
│                  Base de Datos                         │
│            PostgreSQL 16 (play & catalog)              │
└────────────────────────────────────────────────────────┘
```

### Stack Técnico

| Componente | Tecnologías |
|---|---|
| **Frontend** | React 19, TanStack Start, TanStack Router, TanStack Query, Tailwind CSS 4, Lucide Icons |
| **Tiempo Real** | Colyseus 0.16 (WebSocket room server & synchronised state machine) |
| **Servidor Game** | Node.js, Express, TypeScript, Sharp (generación y pixelación de logos) |
| **Base de Datos** | PostgreSQL 16 (esquemas `play`, `catalog`, `analytics`) |
| **Audio & TTS** | ElevenLabs Multilingual V2 + Web Audio API (Analizador FFT en tiempo real) |
| **Infraestructura** | Docker Compose, Nginx (Reverse Proxy + HTTP/2 + SSL), Let's Encrypt |

---

## 📁 Estructura del Proyecto

```
peekrush/
├── apps/
│   └── game-server/         # Servidor WebSocket Colyseus y API REST
│       ├── src/
│       │   ├── LogoRoom.ts  # Lógica de juego, rondas y sincronización
│       │   ├── app.ts       # Endpoints REST (salas, leaderboard, health)
│       │   └── db/          # Repositorio de base de datos PostgreSQL
│       └── scripts/         # Migraciones, simulación y carga de catálogo
├── src/                     # Aplicación web cliente (TanStack Start)
│   ├── components/          # Componentes UI (PresenterAudio, Dialogs...)
│   ├── game/                # Vistas de juego (TvView, PlayerView, DemoView)
│   └── routes/              # Enrutador TanStack (index, play, tv, demo)
├── public/                  # Activos estáticos, audios generados y logos
├── deploy/                  # Configuración de despliegue Docker y Nginx
│   ├── docker-compose.yml   # Orquestación de servicios (web, game, db)
│   ├── nginx/               # Configuración de proxy inverso
│   └── deploy.sh            # Script de despliegue automatizado con verificación
└── scripts/                 # Scripts utilitarios (generador de locuciones ElevenLabs)
```

---

## 🚀 Puesta en Marcha Local

### Prerrequisitos

- **Node.js** v20+ o **Bun**
- **Docker** y **Docker Compose**

### 1. Clonar el repositorio

```bash
git clone https://github.com/arvivares/hearth-blueprint-docs.git peekrush
cd peekrush
```

### 2. Instalar dependencias

```bash
# Dependencias del cliente web
npm install

# Dependencias del game server
cd apps/game-server
npm install
cd ../..
```

### 3. Iniciar la base de datos

Puedes levantar una instancia local de PostgreSQL con Docker:

```bash
docker run -d \
  --name peekrush-postgres \
  -e POSTGRES_USER=peekrush \
  -e POSTGRES_PASSWORD=peekrush \
  -e POSTGRES_DB=peekrush \
  -p 5432:5432 \
  postgres:16-alpine
```

Ejecuta las migraciones y carga inicial de marcas:

```bash
cd apps/game-server
npm run db:migrate
npm run db:seed
cd ../..
```

### 4. Iniciar servidores en modo desarrollo

En dos terminales independientes:

```bash
# Terminal 1: Servidor de juego Colyseus (puerto 2567)
cd apps/game-server
npm run dev

# Terminal 2: Cliente web TanStack Start (puerto 3000)
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 🎙️ Generación de Locuciones de la Presentadora

El audio explicativo de la anfitriona y sus capítulos se sincronizan mediante ElevenLabs:

```bash
# Requiere definir ELEVENLABS_API_KEY
node scripts/generate-presenter-audio.mjs
```

Genera automáticamente los ficheros optimizados en `public/audio/`:
- `presentadora-es.mp3` (Español)
- `presentadora-en.mp3` (Inglés)

---

## 🐳 Despliegue en Producción

El proyecto incluye un pipeline automatizado en `deploy/deploy.sh`:

```bash
./deploy/deploy.sh
```

El script ejecuta:
1. Recompilación de imágenes Docker para cliente web y servidor de juego.
2. Migraciones automáticas de base de datos.
3. Despliegue con *health checks* de disponibilidad en HTTP, WebSocket y base de datos.
4. Pruebas end-to-end automáticas post-despliegue en producción.

---

## 🔗 Integración con Lovable

This project was built with [Lovable](https://lovable.dev).

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a381d655-8d58-461f-9104-81f5378495f8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable.

---

## 📄 Licencia

Distribuido bajo licencia MIT. Ver `LICENSE` para más detalles.
