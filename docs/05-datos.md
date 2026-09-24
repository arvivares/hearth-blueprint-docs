# 05 — Datos públicos y privados

## Clasificación

| Dato | Visibilidad | Canal |
|---|---|---|
| Fase, ronda, etapa, `phaseEndsAt`, nº de rondas | Pública (sala) | Estado sincronizado |
| Jugadores: id público, alias, conectado, puntos, aciertos, `answeredThisRound` (bool) | Pública (sala) | Estado sincronizado |
| Clasificación | Pública (sala) | Estado sincronizado |
| Respuesta correcta y logo completo | Pública **solo en ROUND_RESULTS/FINAL** | Mensaje a la pantalla |
| Resultado de mis intentos, cooldown | Privada del jugador | Mensaje dirigido |
| Textos enviados por jugadores | Solo servidor | — |
| Catálogo: respuestas, alias, originales | Solo servidor | — |
| Tokens y secretos | Solo servidor / su dueño | — |

El estado sincronizado nunca contiene campos privados (Colyseus no filtra por cliente de forma fiable sin `@filter`; se evita por diseño).

## Protección del contenido

- Imágenes por etapa generadas en el servidor (pixelado/recorte reales, no CSS) y almacenadas con id opaco aleatorio.
- `GET /api/media/:opaqueId` exige `screenToken`, comprueba sala, ronda actual y que la etapa ≤ etapa autorizada. Etapas futuras → 403.
- Cabeceras `Cache-Control: no-store`; sin nombres descriptivos ni metadatos EXIF.
- Los móviles no reciben imágenes.

## Modelo PostgreSQL (propuesto)

```text
catalog_item(id, slug_privado, created_at)
catalog_version(id, item_id, version, answer, aliases jsonb, image_path, license_note)
game(id, room_code, status[in_progress|finished|aborted], config jsonb, started_at, ended_at)
game_round(id, game_id, index, catalog_version_id, started_at, ended_at)
game_player(id, game_id, alias, final_score, correct_count, final_rank)
attempt(id uuid = attemptId, round_id, player_id, normalized_text, correct, stage, points, received_at)
  UNIQUE(attempt.id)  -- idempotencia
```

- Cada partida referencia `catalog_version`: editar una pregunta crea versión nueva y no altera resultados pasados.
- El estado vivo de la sala está en memoria del servidor; se persiste al cerrar cada ronda y al final.
