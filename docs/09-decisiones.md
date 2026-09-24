# 09 — Registro de decisiones (ADR)

Formato: contexto → decisión → alternativas → estado.

**ADR-001 Monorepo con la app Lovable en la raíz.** Lovable exige su estructura en la raíz. Se añaden `apps/game-server` y `packages/contracts` al lado. Alt: repos separados (duplica contratos). *Aceptada.*

**ADR-002 Colyseus como servidor autoritativo.** Requisito del contexto; salas aisladas, estado sincronizado y reconexión nativos. Alt: Socket.IO a mano. *Confirmada.*

**ADR-003 Credenciales por rol firmadas en servidor.** Sin cuentas; tokens HMAC ligados a sala y rol. Alt: JWT con librería (equivalente), sesiones en BD. *Propuesta.*

**ADR-004 Vinculación de pantalla con código de un solo uso.** El QR no lleva permisos. Alt: QR secundario privado mostrado en el panel del anfitrión. *Propuesta.*

**ADR-005 Imágenes por etapa generadas en servidor.** Evita revelar el logo por CSS o URL. Librería prevista: `sharp` en el servidor Node. *Propuesta.*

**ADR-006 Validación por normalización + alias.** Minúsculas, sin acentos, sin espacios/puntuación; comparación exacta con alias del catálogo. Sin IA ni difusa en MVP. *Confirmada.*

**ADR-007 Estado vivo en memoria, persistencia por ronda.** Sin recuperación tras reinicio: partidas marcadas `aborted`. *Confirmada.*

**ADR-008 Una instancia, sin escalado horizontal.** *Confirmada* hasta medir.

**ADR-009 Contratos en Zod compartidos.** Validación idéntica en cliente y servidor. *Aceptada.*

**ADR-010 Alojamiento del servidor.** Recomendado VPS + Docker Compose. *Pendiente de decisión del usuario.*

**ADR-011 Licencia MIT para código propio; logos con procedencia documentada aparte.** *Confirmada.*
