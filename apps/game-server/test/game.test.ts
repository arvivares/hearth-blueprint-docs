/**
 * Partida completa reproducible con clientes reales y tiempos acelerados (x0.02).
 * Usa el catálogo ficticio propio. Ejecutar: npm test
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client, type Room } from "colyseus.js";
import { matchMaker } from "colyseus";
import { startServer } from "../src/app";
import type { LogoRoom } from "../src/LogoRoom";
import { createTestDb } from "./db-helper";
let testDb: Awaited<ReturnType<typeof createTestDb>>;

const SCALE = 0.02; // 120 s de ronda -> 2,4 s; enfriamiento 2 s -> 40 ms
let base = "";
let server: Awaited<ReturnType<typeof startServer>>;

async function api(path: string, body?: unknown, token?: string) {
  const res = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn: () => boolean, ms = 6000, what = "condición") {
  const t0 = Date.now();
  while (!fn()) {
    if (Date.now() - t0 > ms) throw new Error(`timeout esperando ${what}`);
    await wait(10);
  }
}

interface Player { room: Room; token: string; playerId: string; results: any[]; reveals: any[] }
let host: Room, screen: Room, screenToken: string, roomId: string, roomCode: string;
const media: any[] = [];
const reveals: any[] = [];
const P: Player[] = [];

function track(room: Room, p: Pick<Player, "results" | "reveals">) {
  room.onMessage("attempt:result", (m) => p.results.push(m));
  room.onMessage("round:reveal", (m) => p.reveals.push(m));
  room.onMessage("*", () => {});
}
async function joinPlayer(alias: string, token?: string): Promise<Player> {
  const j = await api(`/api/rooms/${roomCode}/players`, { alias, playerToken: token });
  const room = await new Client(`ws://localhost:${server.port}`).joinById(j.json.roomId, { token: j.json.playerToken });
  const p: Player = { room, token: j.json.playerToken, playerId: j.json.playerId, results: [], reveals: [] };
  track(room, p);
  return p;
}
function attempt(p: Player, text: string, attemptId = randomUUID(), roundId = host.state.roundId) {
  const before = p.results.length;
  p.room.send("player:attempt", { attemptId, roundId, text });
  return { attemptId, result: async () => { await waitFor(() => p.results.length > before, 3000, "resultado"); return p.results.at(-1); } };
}
const live = () => matchMaker.getLocalRoomById(roomId) as LogoRoom;
const answer = () => live().round!.item;
const mediaStatus = async (id: string, token = screenToken) => {
  const res = await fetch(`${base}/api/media/${id}`, { headers: { authorization: `Bearer ${token}` } });
  await res.arrayBuffer();
  return res.status;
};

before(async () => {
  testDb = await createTestDb();
  server = await startServer(0, { timeScale: SCALE, databaseUrl: testDb.url });
  base = `http://localhost:${server.port}`;
  const c = await api("/api/rooms", { config: { rounds: 2, roundSeconds: 120 } });
  ({ roomId, roomCode } = c.json);
  host = await new Client(`ws://localhost:${server.port}`).joinById(roomId, { token: c.json.hostToken });
  host.onMessage("*", () => {});
  const pc = await api(`/api/rooms/${roomCode}/screen-pairing`, {}, c.json.hostToken);
  screenToken = (await api(`/api/rooms/${roomCode}/screen`, { pairingCode: pc.json.pairingCode })).json.screenToken;
  screen = await new Client(`ws://localhost:${server.port}`).joinById(roomId, { token: screenToken });
  screen.onMessage("round:media", (m) => media.push(m));
  screen.onMessage("round:reveal", (m) => reveals.push(m));
  screen.onMessage("*", () => {});
  // La pantalla confirma que puede mostrar cada ronda cuando el servidor la tiene preparada.
  let readyFor = "";
  screen.onStateChange((s: any) => {
    if (s.phase === "PREPARING" && s.phaseEndsAt > 0 && s.roundId !== readyFor) {
      readyFor = s.roundId;
      screen.send("screen:ready", { roundId: s.roundId });
    }
  });
  for (const a of ["Ana", "Luis", "Marta"]) P.push(await joinPlayer(a));
  await waitFor(() => host.state.players.size === 3);
});

after(async () => {
  await Promise.race([server.close(), wait(1500)]);
  await testDb.drop();
});

test("no se puede responder ni iniciar sin permisos o fuera de fase", async () => {
  const r = await attempt(P[0]!, "algo", randomUUID(), "no-round").result();
  assert.equal(r.status, "round_closed");
  const e = new Promise<any>((res) => P[0]!.room.onMessage("error", res));
  P[0]!.room.send("host:start", {});
  assert.equal((await e).code, "FORBIDDEN");
});

test("preparación -> confirmación de pantalla -> cuenta atrás -> ronda activa", async () => {
  const phases: string[] = [];
  host.onStateChange((s: any) => phases.at(-1) !== s.phase && phases.push(s.phase));
  host.send("host:start", {});
  await waitFor(() => host.state.phase === "ROUND_ACTIVE", 6000, "ROUND_ACTIVE");
  assert.deepEqual(phases.slice(phases.indexOf("PREPARING")), ["PREPARING", "COUNTDOWN", "ROUND_ACTIVE"]);
  assert.equal(host.state.revealStage, 1);
  await waitFor(() => media.some((m) => m.stage === 1));
});

test("la solución no aparece en el estado ni en mensajes antes del cierre", () => {
  const item = answer();
  const dump = JSON.stringify(host.state.toJSON()) + JSON.stringify(media);
  assert.ok(!dump.toLowerCase().includes(item.answer.toLowerCase()));
  assert.equal(reveals.length, 0);
  assert.equal(P[0]!.reveals.length, 0);
});

test("imágenes: solo la pantalla y solo etapas ya autorizadas", async () => {
  const round = live().round!;
  assert.equal(await mediaStatus(round.stageIds[0]!), 200);
  assert.equal(await mediaStatus(round.stageIds[0]!, P[0]!.token), 403); // jugador
  assert.equal(await mediaStatus(round.stageIds[4]!), 403); // etapa futura
  assert.equal(await mediaStatus(round.fullId), 403); // original durante la ronda
  assert.equal(await mediaStatus("0".repeat(32)), 404);
});

test("aciertos simultáneos: varios jugadores puntúan en la misma ronda", async () => {
  const item = answer();
  const variant = `  ${item.answer.toUpperCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")}  `;
  const a = attempt(P[0]!, variant);
  const b = attempt(P[1]!, item.answer);
  const [ra, rb] = [await a.result(), await b.result()];
  assert.equal(ra.status, "correct");
  assert.equal(rb.status, "correct");
  assert.equal(ra.points, 1000);
  assert.equal(host.state.phase, "ROUND_ACTIVE"); // el primer acierto no cierra la ronda
  await waitFor(() => host.state.players.get(P[0]!.playerId).score === 1000);
  assert.equal(host.state.players.get(P[0]!.playerId).answeredThisRound, true);
});

test("intento duplicado no suma dos veces; segundo acierto -> already_scored", async () => {
  const first = P[0]!.results.at(-1);
  const dup = await attempt(P[0]!, answer().answer, first.attemptId).result();
  assert.equal(dup.status, "duplicate");
  assert.equal(dup.points, 1000);
  const again = await attempt(P[0]!, answer().answer).result();
  assert.equal(again.status, "already_scored");
  await wait(50);
  assert.equal(host.state.players.get(P[0]!.playerId).score, 1000);
  assert.equal(host.state.players.get(P[0]!.playerId).correctCount, 1);
});

test("error, límite de frecuencia y acierto por alias en etapa posterior", async () => {
  const bad = await attempt(P[2]!, "Empresa Que No Existe").result();
  assert.equal(bad.status, "incorrect");
  const fast = await attempt(P[2]!, "otra").result();
  assert.equal(fast.status, "rate_limited");
  assert.ok(fast.retryAt > Date.now() - 1000);
  await waitFor(() => host.state.revealStage >= 2, 3000, "etapa 2");
  const item = answer();
  const text = item.aliases[0] ?? item.answer;
  const ok = await attempt(P[2]!, text).result();
  assert.equal(ok.status, "correct");
  assert.equal(ok.points, [1000, 800, 600, 400, 200][host.state.revealStage - 1]);
});

test("reconexión durante la ronda: conserva puntos y recibe sus resultados sin repetir efectos", async () => {
  const p = P[2]!;
  await waitFor(() => host.state.players.get(p.playerId).score > 0, 3000, "sincronía");
  const scoreBefore = host.state.players.get(p.playerId).score;
  const before = p.results.length;
  await p.room.leave();
  await waitFor(() => host.state.players.get(p.playerId).connected === false);
  const again = await joinPlayer("x", p.token);
  assert.equal(again.playerId, p.playerId);
  console.log("DBG", host.state.phase, JSON.stringify(p.results), [...live().attempts.values()].filter(a=>a.playerId===p.playerId).length);
  await waitFor(() => again.results.length >= before - 0 && again.results.length > 0, 3000, "historial");
  await wait(100);
  // Solo se reenvían los intentos evaluados (los rechazos por enfriamiento no se guardan).
  const evaluated = p.results.filter((r) => r.status === "correct" || r.status === "incorrect");
  assert.deepEqual(again.results.map((r) => r.status), evaluated.map((r) => r.status));
  assert.equal(host.state.players.get(p.playerId).score, scoreBefore);
  P[2] = again;
});

test("cierre de ronda: se revela la solución; respuestas tardías rechazadas", async () => {
  const oldRound = host.state.roundId;
  const item = answer();
  host.send("host:next", {});
  await waitFor(() => host.state.phase === "ROUND_RESULTS");
  await waitFor(() => reveals.length === 1 && P[0]!.reveals.length === 1);
  assert.equal(reveals[0].answer, item.answer);
  assert.equal(P[0]!.reveals[0].mediaId, ""); // los móviles no reciben la imagen
  assert.equal(await mediaStatus(reveals[0].mediaId), 200); // original ya permitido a la pantalla
  const late = await attempt(P[1]!, item.answer, randomUUID(), oldRound).result();
  assert.equal(late.status, "round_closed");
  assert.equal(host.state.ranking.length, 3);
});

test("ronda 2: pausa congela la ronda y reanudar continúa", async () => {
  await waitFor(() => host.state.phase === "ROUND_ACTIVE" && host.state.roundIndex === 1, 6000, "ronda 2");
  host.send("host:pause", {});
  await waitFor(() => host.state.phase === "PAUSED");
  const r = await attempt(P[0]!, answer().answer).result();
  assert.equal(r.status, "round_closed");
  await wait(200);
  assert.equal(host.state.phase, "PAUSED");
  host.send("host:resume", {});
  await waitFor(() => host.state.phase === "ROUND_ACTIVE");
});

test("fin por tiempo, clasificación final con empate compartido", async () => {
  await waitFor(() => host.state.phase === "ROUND_RESULTS", 6000, "cierre por tiempo");
  await waitFor(() => host.state.phase === "FINAL_RESULTS", 6000, "final");
  const ranking = host.state.ranking.map((r: any) => ({ id: r.playerId, rank: r.rank }));
  const rankOf = (p: Player) => ranking.find((r: any) => r.id === p.playerId)!.rank;
  assert.equal(rankOf(P[0]!), 1);
  assert.equal(rankOf(P[1]!), 1); // mismos puntos y aciertos -> posición compartida
  assert.equal(rankOf(P[2]!), 3);
  assert.equal(live().history.length, 2);
});

test("persistencia: partida, rondas sin repetir, intentos únicos y clasificación guardada", async () => {
  const gameId = live().gameId!;
  const db = testDb.db;
  await waitFor(() => true);
  await wait(200);
  const g = (await db.query("SELECT status, ended_at FROM play.game WHERE id = $1", [gameId])).rows[0];
  assert.equal(g.status, "finished");
  const rounds = (await db.query("SELECT item_id, ended_at FROM play.game_round WHERE game_id = $1 ORDER BY round_index", [gameId])).rows;
  assert.equal(rounds.length, 2);
  assert.notEqual(rounds[0].item_id, rounds[1].item_id);
  assert.ok(rounds.every((r) => r.ended_at));
  const players = (await db.query("SELECT player_id, final_score, final_rank FROM play.game_player WHERE game_id = $1", [gameId])).rows;
  assert.equal(players.length, 3);
  for (const p of P) {
    const row = players.find((x) => x.player_id === p.playerId)!;
    assert.equal(row.final_score, host.state.players.get(p.playerId).score);
  }
  const correct = (await db.query("SELECT count(*)::int AS n FROM play.attempt WHERE game_id = $1 AND status = 'correct'", [gameId])).rows[0].n;
  assert.equal(correct, 3); // Ana, Luis y Marta en la ronda 1; el duplicado no se guardó dos veces
});

test("nueva partida: el anfitrión vuelve a la sala de espera con marcadores a cero", async () => {
  host.send("host:reset", {});
  await waitFor(() => host.state.phase === "LOBBY");
  assert.equal(host.state.players.get(P[0]!.playerId).score, 0);
});
