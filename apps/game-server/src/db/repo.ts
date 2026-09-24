import type { Db } from "./pool";

/** Pregunta tal como se jugará: instantánea de una versión inmutable del catálogo. */
export interface Question {
  versionId: string;
  itemId: string;
  version: number;
  answer: string;
  aliases: string[];
  category: string;
  difficulty: number;
  image: { bytes: Buffer; mime: string };
}

export const activeCatalogCount = async (db: Db) =>
  Number((await db.query("SELECT count(*) FROM content.catalog_version WHERE active")).rows[0].count);

/**
 * Selección aleatoria sin repeticiones: cada elemento aparece como mucho una vez
 * (una versión activa por elemento + UNIQUE(game_id, item_id) en game_round).
 */
export async function selectQuestions(db: Db, n: number, exclude: string[] = []): Promise<Question[]> {
  const r = await db.query(
    `SELECT v.id, v.item_id, v.version, v.answer, v.aliases, v.category, v.difficulty, i.bytes, i.mime
       FROM content.catalog_version v JOIN content.catalog_image i ON i.sha256 = v.image_sha256
      WHERE v.active AND NOT (v.item_id = ANY($2))
      ORDER BY random() LIMIT $1`,
    [n, exclude],
  );
  return r.rows.map((x) => ({
    versionId: String(x.id),
    itemId: x.item_id,
    version: x.version,
    answer: x.answer,
    aliases: x.aliases,
    category: x.category,
    difficulty: x.difficulty,
    image: { bytes: x.bytes, mime: x.mime },
  }));
}

export async function createGame(db: Db, g: { id: string; roomCode: string; config: unknown; players: { id: string; alias: string }[] }) {
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    await c.query("INSERT INTO play.game(id, room_code, status, config) VALUES ($1,$2,'in_progress',$3)", [g.id, g.roomCode, g.config]);
    for (const p of g.players) {
      await c.query("INSERT INTO play.game_player(game_id, player_id, alias) VALUES ($1,$2,$3)", [g.id, p.id, p.alias]);
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

export const createRound = (db: Db, r: { id: string; gameId: string; index: number; itemId: string; versionId: string }) =>
  db.query("INSERT INTO play.game_round(id, game_id, round_index, item_id, catalog_version_id) VALUES ($1,$2,$3,$4,$5)", [
    r.id,
    r.gameId,
    r.index,
    r.itemId,
    r.versionId,
  ]);

export const endRound = (db: Db, roundId: string) => db.query("UPDATE play.game_round SET ended_at = now() WHERE id = $1 AND ended_at IS NULL", [roundId]);

export const recordAttempt = (
  db: Db,
  a: { id: string; gameId: string; roundId: string; playerId: string; status: string; normalized: string; stage: number; points: number; receivedAt: number },
) =>
  db.query(
    `INSERT INTO play.attempt(id, game_id, round_id, player_id, status, normalized_text, stage, points, received_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8, to_timestamp($9 / 1000.0)) ON CONFLICT (id) DO NOTHING`,
    [a.id, a.gameId, a.roundId, a.playerId, a.status, a.normalized, a.stage, a.points, a.receivedAt],
  );

export async function finishGame(db: Db, gameId: string, results: { playerId: string; score: number; correctCount: number; rank: number }[]) {
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    for (const r of results) {
      await c.query("UPDATE play.game_player SET final_score=$3, correct_count=$4, final_rank=$5 WHERE game_id=$1 AND player_id=$2", [
        gameId,
        r.playerId,
        r.score,
        r.correctCount,
        r.rank,
      ]);
    }
    await c.query("UPDATE play.game SET status='finished', ended_at=now() WHERE id=$1 AND status='in_progress'", [gameId]);
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

export const abortGame = (db: Db, gameId: string) =>
  db.query("UPDATE play.game SET status='aborted', ended_at=now() WHERE id=$1 AND status='in_progress'", [gameId]);

/** Al arrancar el proceso: partidas que quedaron a medias se marcan como interrumpidas. */
export async function abortStaleGames(db: Db) {
  const r = await db.query("UPDATE play.game SET status='aborted', ended_at=now() WHERE status='in_progress' RETURNING id");
  return r.rowCount ?? 0;
}

export interface GlobalLeaderboardEntry {
  alias: string;
  bestScore: number;
  totalCorrect: number;
  gamesPlayed: number;
  gamesWon: number;
  lastPlayed: string;
}

export async function getGlobalLeaderboard(db: Db, limit = 10): Promise<GlobalLeaderboardEntry[]> {
  const r = await db.query(
    `SELECT gp.alias,
            COALESCE(MAX(gp.final_score), 0) AS best_score,
            COALESCE(SUM(gp.correct_count), 0) AS total_correct,
            COUNT(DISTINCT gp.game_id) AS games_played,
            COUNT(CASE WHEN gp.final_rank = 1 THEN 1 END) AS games_won,
            MAX(g.ended_at) AS last_played
       FROM play.game_player gp
       JOIN play.game g ON g.id = gp.game_id
      WHERE g.status = 'finished' AND gp.final_score IS NOT NULL
      GROUP BY gp.alias
      ORDER BY best_score DESC, total_correct DESC, games_won DESC
      LIMIT $1`,
    [limit],
  );
  return r.rows.map((row) => ({
    alias: String(row.alias),
    bestScore: Number(row.best_score),
    totalCorrect: Number(row.total_correct),
    gamesPlayed: Number(row.games_played),
    gamesWon: Number(row.games_won),
    lastPlayed: row.last_played ? new Date(row.last_played).toISOString() : "",
  }));
}

