PROYECTO: JUEGO COMPETITIVO DE LOGOS CON TV Y MÓVILES

Actúa como arquitecto de software y desarrollador de videojuegos web
multijugador. Esta especificación es contexto permanente del proyecto,
no una orden para implementar todas las funcionalidades de una vez.

Implementa únicamente la etapa solicitada en cada mensaje.

PRODUCTO

Estamos construyendo un juego competitivo presencial con una pantalla
compartida y teléfonos móviles como dispositivos de respuesta.

En la TV aparece un logo inicialmente oculto. Se revela progresivamente.
Los jugadores escriben el nombre de la empresa en sus móviles y envían
la respuesta. Todos participan simultáneamente y compiten individualmente.

La entrada es mediante QR o código de sala, desde el navegador.
No se requieren instalaciones ni cuentas personales para jugar.

El QR identifica la sala: no sustituye al servidor ni contiene permisos
de administración.

Objetivo inicial de diseño: entre 9 y 30 jugadores por sala.
Este objetivo debe verificarse mediante pruebas; no presentarlo como
capacidad demostrada antes de medirlo.

PRINCIPIO ARQUITECTÓNICO

La aplicación debe poder ejecutarse completamente fuera de Lovable.

Usar componentes open source para la aplicación, el servidor,
la comunicación multijugador y la persistencia.

No introducir servicios gestionados propietarios como dependencia
obligatoria para crear salas, transmitir mensajes o arbitrar partidas.

Lovable es una herramienta de desarrollo y una opción de alojamiento,
no el motor del juego.

TECNOLOGÍAS PROPUESTAS

Aplicación web:
React y TypeScript, conservando el framework, el router y la estructura
compatibles con el proyecto real de Lovable.
No migrar el proyecto de framework sin una necesidad justificada.

Servidor de juego:
Node.js, TypeScript y Colyseus, con el SDK oficial compatible en el cliente.
Ejecutarlo como servicio persistente independiente.

Persistencia:
PostgreSQL. El navegador nunca se conecta directamente a la base de datos.

Comunicación:
HTTPS para operaciones HTTP y WebSocket seguro para la partida.
El cliente se conecta directamente a nuestro backend, sin una pasarela
propietaria obligatoria.

Versiones:
Seleccionar versiones estables compatibles entre sí, fijarlas y mantener
los archivos de bloqueo de dependencias.
Documentar las licencias de las dependencias utilizadas.

ESTRUCTURA DEL CÓDIGO

Conservar la estructura web que Lovable necesita para funcionar.

Separar claramente:
- Interfaz web.
- Servidor multijugador.
- Contratos y tipos públicos compartidos.
- Catálogo y respuestas privadas.
- Pruebas.
- Documentación y despliegue.

El código compartido con el navegador nunca debe importar secretos,
respuestas correctas ni catálogos privados del servidor.

Separar las reglas del juego de los componentes visuales y del transporte.
La lógica de puntuación debe poder probarse sin abrir un navegador.

ROLES Y PERMISOS

Jugador:
Entra con nombre o alias, envía respuestas y consulta sus resultados.

Pantalla:
Muestra QR, participantes, revelado, temporizador y clasificación.
No puede administrar la sala por conocer su código.

Anfitrión:
Crea y configura la sala, inicia la partida y controla su continuidad.

Autenticar los permisos de anfitrión y de pantalla en el servidor mediante
credenciales distintas de las del jugador.
No conceder permisos porque el cliente envíe role="host".

No incluir credenciales de anfitrión ni de pantalla en el QR público.
Definir un mecanismo de vinculación de pantalla autorizado por el anfitrión.

El anfitrión y la pantalla no consumen plazas de jugador.

SERVIDOR AUTORITATIVO

El servidor es la única autoridad sobre:
- Fase y ronda actuales.
- Selección de preguntas.
- Inicio, duración y cierre de cada ronda.
- Etapa de revelado.
- Validez de las respuestas.
- Puntuación y clasificación.
- Permisos y límites de envío.

Los clientes envían intenciones, nunca resultados calculados por ellos.

No aceptar puntuaciones, aciertos, tiempos de respuesta ni identidades
de jugador declarados libremente por el cliente.

Cada intento incluye un identificador único y el identificador de ronda.
El servidor identifica al jugador a partir de su sesión autenticada.
Procesar los intentos de forma idempotente: reenviar un mensaje no puede
sumar puntos dos veces.

ESTADOS DE LA PARTIDA

Definir una máquina de estados explícita:

LOBBY
PREPARING
COUNTDOWN
ROUND_ACTIVE
ROUND_RESULTS
FINAL_RESULTS

Contemplar PAUSED y ABORTED con transiciones documentadas.

La ronda no empieza hasta que la pantalla haya confirmado que puede
mostrar su estado inicial.

El servidor gobierna el reloj.
Los clientes representan el tiempo restante y se resincronizan.
No prometer sincronización perfecta ni ausencia de latencia.

REGLAS INICIALES AJUSTABLES

Propuesta inicial:
10 rondas de 25 segundos.
5 etapas de revelado.
Puntuación por primer acierto según etapa:
1000, 800, 600, 400 o 200 puntos.

Todos pueden acertar y sumar durante una misma ronda.
El primer acierto no termina automáticamente la ronda para los demás.

Un jugador solo puntúa una vez por ronda.
Tras acertar, su móvil muestra confirmación y queda a la espera.

Aplicar un intervalo mínimo de 2 segundos entre intentos por jugador,
controlado por el servidor.

Comparar respuestas mediante normalización determinista y alias
definidos en el catálogo: mayúsculas, espacios y acentos.
No usar un modelo de IA para decidir aciertos en el MVP.
No introducir coincidencias aproximadas sin pruebas y reglas explícitas.

No mostrar públicamente los textos enviados ni la respuesta correcta
mientras la ronda siga abierta.

Resolver empates sin depender de milisegundos:
puntuación total, después número de aciertos y, si persiste,
posición compartida.

PROTECCIÓN DEL CONTENIDO

Mantener respuestas, alias y originales en el servidor.

No incluir el catálogo completo en el bundle del navegador, archivos
públicos, nombres descriptivos de imágenes ni metadatos reveladores.

No resolver el ocultamiento únicamente enviando la imagen completa
y tapándola con CSS.

Servir versiones parciales de la imagen según la etapa autorizada.
No permitir descargar etapas futuras manipulando una URL.
Usar identificadores opacos y verificar permisos en cada acceso.

Los móviles no necesitan recibir la imagen completa para responder.

CONEXIONES Y RECUPERACIÓN

Conservar una identidad de jugador recuperable al recargar o reconectar.
No utilizar el nombre visible como mecanismo de autenticación.

Propuesta inicial: ventana de reconexión de 60 segundos.
Al reconectar, enviar el estado vigente y el resultado de los intentos
ya procesados, sin repetir sus efectos.

Definir qué sucede si se desconecta la pantalla o el anfitrión.
No dejar avanzar silenciosamente una partida que nadie puede visualizar.

Documentar la política para incorporaciones tardías.
Propuesta: nuevos jugadores durante una partida esperan a la siguiente.

Separar una desconexión de cliente de una caída del servidor.
En el MVP, no prometer recuperación transparente de una partida tras
reiniciar el proceso: marcarla como interrumpida y conservar lo persistido.

PERSISTENCIA Y ALCANCE

Mantener el estado activo de las salas en el servidor de juego.
Usar PostgreSQL para catálogo, configuración y resultados persistentes.

Versionar el contenido de cada partida para que cambiar una pregunta
no altere retroactivamente sus resultados.

Comenzar con una instancia del servidor y múltiples salas aisladas.
No añadir escalado horizontal, Kubernetes ni infraestructura distribuida
sin una necesidad medida.

No añadir pagos, chat, voz, vídeo, cuentas sociales ni otros modos de juego
al MVP.

CALIDAD, SEGURIDAD Y ENTREGA

Validar permisos, estado y contenido de cada mensaje en el servidor.
Limitar tamaño y frecuencia de mensajes.
Evitar que una sala pueda consultar o modificar otra.

Las credenciales privadas solo viven en el servidor.
Las variables públicas contienen únicamente configuración pública.

Las simulaciones deben estar claramente identificadas.
Una maqueta que utiliza almacenamiento local no demuestra multijugador.
Si el backend no está disponible, mostrar un error real: no reemplazar
silenciosamente la conexión por datos falsos.

En cada etapa:
Explicar qué se implementó, cómo probarlo, qué pruebas se ejecutaron
y qué queda pendiente.
No declarar pruebas superadas si no se ejecutaron.

Preparar licencia MIT para nuestro código, inventario de dependencias,
configuración de ejemplo, instrucciones de instalación y despliegue
reproducible.
Documentar por separado la procedencia y permisos de los recursos.

El criterio final es completar una partida con varios dispositivos reales
en un despliegue independiente de Lovable.