-- 001: catálogo privado versionado y registro de partidas.
-- Toda la base es exclusiva del servidor de juego: el navegador nunca se conecta.
--   content.* -> PRIVADO (respuestas, alias, imágenes originales, procedencia)
--   play.*    -> partidas; los textos enviados y las respuestas no salen por la API
--   play.public_game_results -> proyección segura (sin respuestas ni textos)

CREATE SCHEMA IF NOT EXISTS content;
CREATE SCHEMA IF NOT EXISTS play;

-- ---------- Catálogo ----------

CREATE TABLE content.catalog_image (
  sha256      text PRIMARY KEY CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  mime        text NOT NULL CHECK (mime IN ('image/png', 'image/webp', 'image/svg+xml')),
  bytes       bytea NOT NULL CHECK (octet_length(bytes) BETWEEN 1 AND 2097152),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE content.catalog_item (
  id          text PRIMARY KEY CHECK (id ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE content.catalog_version (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id         text NOT NULL REFERENCES content.catalog_item(id) ON DELETE RESTRICT,
  version         integer NOT NULL CHECK (version >= 1),
  answer          text NOT NULL CHECK (char_length(answer) BETWEEN 1 AND 60),
  aliases         text[] NOT NULL DEFAULT '{}',
  category        text NOT NULL CHECK (char_length(category) BETWEEN 1 AND 40),
  difficulty      smallint NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  image_sha256    text NOT NULL REFERENCES content.catalog_image(sha256) ON DELETE RESTRICT,
  source_author   text NOT NULL CHECK (char_length(source_author) >= 1),
  source_license  text NOT NULL CHECK (char_length(source_license) >= 1),
  source_url      text,
  source_notes    text,
  content_hash    text NOT NULL,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, version)
);
-- Como mucho una versión activa por elemento.
CREATE UNIQUE INDEX catalog_one_active_version ON content.catalog_version(item_id) WHERE active;

-- Las versiones son inmutables: solo se puede cambiar `active`. Así una partida
-- antigua sigue apuntando exactamente al contenido con el que se jugó.
CREATE FUNCTION content.forbid_version_edit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'catalog_version es inmutable: no se borra, se desactiva';
  END IF;
  IF (NEW.item_id, NEW.version, NEW.answer, NEW.aliases, NEW.category, NEW.difficulty, NEW.image_sha256,
      NEW.source_author, NEW.source_license, NEW.source_url, NEW.source_notes, NEW.content_hash)
     IS DISTINCT FROM
     (OLD.item_id, OLD.version, OLD.answer, OLD.aliases, OLD.category, OLD.difficulty, OLD.image_sha256,
      OLD.source_author, OLD.source_license, OLD.source_url, OLD.source_notes, OLD.content_hash) THEN
    RAISE EXCEPTION 'catalog_version es inmutable: crea una versión nueva';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER catalog_version_immutable BEFORE UPDATE OR DELETE ON content.catalog_version
  FOR EACH ROW EXECUTE FUNCTION content.forbid_version_edit();

-- ---------- Partidas ----------

CREATE TABLE play.game (
  id          uuid PRIMARY KEY,
  room_code   text NOT NULL,
  status      text NOT NULL CHECK (status IN ('in_progress', 'finished', 'aborted')),
  config      jsonb NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  CHECK ((status = 'in_progress') = (ended_at IS NULL))
);

CREATE TABLE play.game_player (
  game_id        uuid NOT NULL REFERENCES play.game(id) ON DELETE CASCADE,
  player_id      uuid NOT NULL,
  alias          text NOT NULL CHECK (char_length(alias) BETWEEN 1 AND 20),
  final_score    integer CHECK (final_score >= 0),
  correct_count  integer CHECK (correct_count >= 0),
  final_rank     integer CHECK (final_rank >= 1),
  PRIMARY KEY (game_id, player_id),
  UNIQUE (game_id, alias)
);

CREATE TABLE play.game_round (
  id                  uuid PRIMARY KEY,
  game_id             uuid NOT NULL REFERENCES play.game(id) ON DELETE CASCADE,
  round_index         integer NOT NULL CHECK (round_index >= 0),
  item_id             text NOT NULL REFERENCES content.catalog_item(id) ON DELETE RESTRICT,
  catalog_version_id  bigint NOT NULL REFERENCES content.catalog_version(id) ON DELETE RESTRICT,
  started_at          timestamptz NOT NULL DEFAULT now(),
  ended_at            timestamptz,
  UNIQUE (game_id, round_index),
  UNIQUE (game_id, item_id)            -- sin preguntas repetidas en una partida
);

CREATE TABLE play.attempt (
  id               uuid PRIMARY KEY,   -- attemptId del cliente: idempotencia
  game_id          uuid NOT NULL,
  round_id         uuid NOT NULL REFERENCES play.game_round(id) ON DELETE CASCADE,
  player_id        uuid NOT NULL,
  status           text NOT NULL CHECK (status IN ('correct', 'incorrect', 'already_scored', 'round_closed', 'rate_limited')),
  normalized_text  text NOT NULL,
  stage            smallint NOT NULL CHECK (stage >= 0),
  points           integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  received_at      timestamptz NOT NULL,
  FOREIGN KEY (game_id, player_id) REFERENCES play.game_player(game_id, player_id) ON DELETE CASCADE,
  CHECK (status = 'correct' OR points = 0)
);
-- Un único acierto por jugador y ronda.
CREATE UNIQUE INDEX attempt_one_correct_per_round ON play.attempt(round_id, player_id) WHERE status = 'correct';
CREATE INDEX attempt_by_round ON play.attempt(round_id);

-- Proyección pública: resultados sin respuestas, alias del catálogo ni textos enviados.
CREATE VIEW play.public_game_results AS
  SELECT g.id AS game_id, g.room_code, g.status, g.started_at, g.ended_at,
         p.player_id, p.alias, p.final_score, p.correct_count, p.final_rank
  FROM play.game g JOIN play.game_player p ON p.game_id = g.id;
