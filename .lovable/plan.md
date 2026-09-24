# Etapa 1 — Arquitectura y contratos (solo documentación)

Esta etapa no construye pantallas ni juego. Produce documentos y contratos que fijan cómo encajarán la app de Lovable (pantalla de sala + mandos móviles) y el servidor persistente de Colyseus.

Nota: no he podido leer un "contexto maestro" en el proyecto (está vacío, con la plantilla inicial). Todo lo específico del juego queda marcado como **propuesto** y se ajustará cuando me pases ese documento.

## Requisitos confirmados

- El escritorio actúa como pantalla común de la partida; los móviles son los mandos de cada jugador.
- Sin cuentas: se entra con código de sala y apodo.
- El estado de la partida vive en un servidor Colyseus persistente, separado de la app.
- Alojamiento del servidor aún por decidir.

## Parámetros propuestos (a confirmar)

- 2–8 jugadores por sala, código de 4 letras, reconexión de 60 segundos.
- Ritmo por rondas con temporizador por fase.
- Sesión del jugador guardada en el navegador del móvil para reconectar sin volver a escribir el código.
- Sin base de datos en la etapa 1: la partida vive en memoria del servidor; solo se añadiría persistencia si se piden historiales o rankings.

## Documentos que voy a crear

Todos en `docs/` del proyecto:

1. `docs/00-vision.md` — resumen del producto, formato de partida, alcance por etapas.
2. `docs/01-arquitectura.md` — diagrama de piezas (app web, pantalla de sala, mando móvil, servidor Colyseus), qué se despliega junto y qué por separado.
3. `docs/02-estructura-carpetas.md` — estructura de carpetas y componentes previstos para la app y para el repositorio del servidor.
4. `docs/03-roles-y-acceso.md` — roles (anfitrión/pantalla, jugador, espectador), cómo se identifica cada uno sin cuentas, qué puede hacer cada rol.
5. `docs/04-maquina-de-estados.md` — fases de la sala y transiciones, con diagrama en texto.
6. `docs/05-datos.md` — qué datos son públicos (visibles en la pantalla común) y cuáles privados (solo en el móvil de su dueño), y cómo se separan.
7. `docs/06-contratos.md` — contrato completo de mensajes: eventos cliente→servidor, servidor→cliente, forma del estado sincronizado y los pocos endpoints HTTP (salud, crear sala, buscar sala).
8. `docs/07-despliegue.md` — estrategia de despliegue, variables de entorno, entornos de prueba y producción, y comparación de opciones de alojamiento para el servidor.
9. `docs/08-decisiones.md` — registro de decisiones (cada una con contexto, decisión, alternativas y estado).
10. `docs/09-riesgos.md` — riesgos principales con impacto y mitigación.
11. `roadmap.md` — lista de etapas siguientes, sin implementarlas.

## Detalle técnico

- **Separación de despliegue**: la app de Lovable se publica como sitio web; el servidor Colyseus se despliega aparte (repositorio propio, proceso Node de larga vida con WebSocket). La app no puede hospedar Colyseus, por eso son dos despliegues.
- **Conexión**: el cliente usa `colyseus.js` contra una URL pública `wss://…` leída de una variable de entorno pública. La pantalla crea o reserva la sala y recibe el código; los móviles se unen por código con `joinById`/`join` y un token de reconexión guardado en el navegador.
- **Contrato de estado**: esquema Colyseus con `room` (fase, ronda, temporizador), `players` (id, apodo, conectado, puntuación) y un canal privado por jugador mediante mensajes dirigidos, nunca dentro del estado público.
- **Mensajes**: se documentan con nombre, dirección, carga útil y validación esperada (Zod en el servidor), más los códigos de error de unión (sala llena, código inexistente, partida ya empezada).
- **CORS y orígenes**: se documenta la lista de orígenes permitidos (previsualización, dominio publicado, desarrollo local).
- **Opciones de alojamiento evaluadas**: Colyseus Cloud, Railway, Fly.io y VPS propio, con criterios de coste, WebSocket persistente y facilidad de despliegue; recomendación incluida, decisión pendiente tuya.

## Fuera de alcance en esta etapa

Pantallas, lógica de juego, código del servidor, base de datos y despliegue real.
