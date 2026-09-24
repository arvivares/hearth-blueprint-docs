import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createTestDb, DEMO_PACK } from "./db-helper";
import { importPack } from "../src/content/import";
import * as repo from "../src/db/repo";

let t: Awaited<ReturnType<typeof createTestDb>>;
before(async () => (t = await createTestDb(false)));
after(async () => t.drop());

async function packCopy(mutate?: (m: any) => void) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pack-"));
  await cp(DEMO_PACK, dir, { recursive: true });
  if (mutate) {
    const m = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8"));
    mutate(m);
    await writeFile(path.join(dir, "manifest.json"), JSON.stringify(m));
  }
  return dir;
}

test("validación: rechaza campos inválidos, ambigüedades e imágenes peligrosas sin tocar la BD", async () => {
  const bad = await packCopy((m) => {
    m.items[0].difficulty = 9;
    m.items[1].aliases = [m.items[2].answer.toUpperCase()];
    delete m.items[3].source.license;
  });
  const r = await importPack(t.db, bad);
  assert.ok(r.errors.length >= 2, r.errors.join("\n"));
  const ambiguous = await packCopy((m) => (m.items[1].aliases = [m.items[2].answer.toUpperCase()]));
  const r2 = await importPack(t.db, ambiguous);
  assert.ok(r2.errors.some((e) => e.includes("también es respuesta")), r2.errors.join("\n"));
  const evil = await packCopy();
  await writeFile(path.join(evil, "images", "img-001.svg"), '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const r3 = await importPack(t.db, evil);
  assert.ok(r3.errors.some((e) => e.includes("scripts")));
  assert.equal(await repo.activeCatalogCount(t.db), 0);
});

test("importación idempotente del paquete ficticio", async () => {
  const r1 = await importPack(t.db, DEMO_PACK);
  assert.deepEqual(r1.errors, []);
  assert.equal(r1.created.length, 12);
  const r2 = await importPack(t.db, DEMO_PACK);
  assert.equal(r2.created.length, 0);
  assert.equal(r2.unchanged.length, 12);
  assert.equal(await repo.activeCatalogCount(t.db), 12);
});

test("selección sin repeticiones y limitada al catálogo disponible", async () => {
  const q = await repo.selectQuestions(t.db, 50);
  assert.equal(q.length, 12);
  assert.equal(new Set(q.map((x) => x.itemId)).size, 12);
  assert.ok(q.every((x) => x.image.bytes.length > 0));
});

test("cambiar el catálogo no modifica partidas existentes; versiones inmutables", async () => {
  const [q] = await repo.selectQuestions(t.db, 1);
  const gameId = randomUUID();
  const playerId = randomUUID();
  await repo.createGame(t.db, { id: gameId, roomCode: "TEST1", config: {}, players: [{ id: playerId, alias: "Ana" }] });
  const roundId = randomUUID();
  await repo.createRound(t.db, { id: roundId, gameId, index: 0, itemId: q!.itemId, versionId: q!.versionId });

  const changed = await packCopy((m) => {
    const it = m.items.find((i: any) => i.id === q!.itemId);
    it.answer = it.answer + " Nuevo";
  });
  const r = await importPack(t.db, changed);
  assert.deepEqual(r.created, [q!.itemId]);
  const played = await t.db.query(
    "SELECT v.answer, v.version, v.active FROM play.game_round r JOIN content.catalog_version v ON v.id = r.catalog_version_id WHERE r.id = $1",
    [roundId],
  );
  assert.equal(played.rows[0].answer, q!.answer);
  assert.equal(played.rows[0].version, 1);
  assert.equal(played.rows[0].active, false);
  const current = await t.db.query("SELECT answer, version FROM content.catalog_version WHERE item_id = $1 AND active", [q!.itemId]);
  assert.equal(current.rows[0].version, 2);

  await assert.rejects(t.db.query("UPDATE content.catalog_version SET answer = 'X' WHERE id = $1", [q!.versionId]), /inmutable/);
  await assert.rejects(t.db.query("DELETE FROM content.catalog_version WHERE id = $1", [q!.versionId]), /inmutable/);
});

test("restricciones anti-duplicados en partidas", async () => {
  const [a, b] = await repo.selectQuestions(t.db, 2);
  const gameId = randomUUID();
  const p1 = randomUUID();
  await repo.createGame(t.db, { id: gameId, roomCode: "TEST2", config: {}, players: [{ id: p1, alias: "Luis" }] });
  // Alias duplicado en la misma partida.
  await assert.rejects(t.db.query("INSERT INTO play.game_player(game_id, player_id, alias) VALUES ($1,$2,'Luis')", [gameId, randomUUID()]));
  const r0 = randomUUID();
  await repo.createRound(t.db, { id: r0, gameId, index: 0, itemId: a!.itemId, versionId: a!.versionId });
  // Misma pregunta dos veces en una partida.
  await assert.rejects(repo.createRound(t.db, { id: randomUUID(), gameId, index: 1, itemId: a!.itemId, versionId: a!.versionId }));
  // Mismo índice de ronda.
  await assert.rejects(repo.createRound(t.db, { id: randomUUID(), gameId, index: 0, itemId: b!.itemId, versionId: b!.versionId }));

  const att = { gameId, roundId: r0, playerId: p1, normalized: "x", stage: 1, receivedAt: Date.now() };
  const id = randomUUID();
  await repo.recordAttempt(t.db, { ...att, id, status: "correct", points: 1000 });
  await repo.recordAttempt(t.db, { ...att, id, status: "correct", points: 1000 }); // reenvío: ignorado
  await assert.rejects(repo.recordAttempt(t.db, { ...att, id: randomUUID(), status: "correct", points: 800 })); // segundo acierto
  const n = await t.db.query("SELECT count(*)::int AS n FROM play.attempt WHERE round_id = $1", [r0]);
  assert.equal(n.rows[0].n, 1);
  // Intento de un jugador que no pertenece a la partida.
  await assert.rejects(repo.recordAttempt(t.db, { ...att, id: randomUUID(), playerId: randomUUID(), status: "incorrect", points: 0 }));
});

test("la vista pública no expone respuestas ni textos enviados", async () => {
  const cols = await t.db.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='play' AND table_name='public_game_results'",
  );
  const names = cols.rows.map((r) => r.column_name);
  assert.ok(!names.some((n) => /answer|alias_list|normalized|aliases/.test(n)));
});

test("reinicio del proceso: partidas a medias quedan interrumpidas", async () => {
  const n = await repo.abortStaleGames(t.db);
  assert.ok(n >= 2);
  const s = await t.db.query("SELECT count(*)::int AS n FROM play.game WHERE status = 'in_progress'");
  assert.equal(s.rows[0].n, 0);
});
