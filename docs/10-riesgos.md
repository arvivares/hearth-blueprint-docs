# 10 — Riesgos principales

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R1 | Fuga de respuestas (bundle, nombres de archivo, URLs de etapas futuras) | Alto | Catálogo solo en servidor, ids opacos, permiso por etapa, prueba que inspecciona el bundle |
| R2 | 30 jugadores simultáneos sin medir | Alto | Prueba de carga con clientes simulados antes de afirmar capacidad |
| R3 | Wi‑Fi del local con latencia desigual | Medio | Reloj del servidor, puntuación por etapa (no por ms), resincronización |
| R4 | Pantalla desconectada a mitad | Medio | Pausa automática; no avanzar sin visualización |
| R5 | Reinicio del servidor en partida | Medio | Persistencia por ronda, marcado `aborted`, comunicado claro |
| R6 | Reenvíos que duplican puntos | Alto | `attemptId` único + UNIQUE en BD |
| R7 | Suplantación de roles | Alto | Tokens por rol firmados; nunca `role` del cliente |
| R8 | Derechos sobre logos de terceros | Medio/legal | Registro de procedencia y permisos por recurso |
| R9 | Incompatibilidad de versiones SDK cliente/servidor Colyseus | Medio | Versiones fijadas y lockfiles; prueba de integración |
| R10 | Plataformas que duermen procesos inactivos | Medio | Elegir alojamiento con proceso siempre activo |
| R11 | Alias ofensivos | Bajo | Longitud máxima, lista de bloqueo simple, expulsión por anfitrión |
