/**
 * Auditoría de seguridad y robustez con clientes reales y PostgreSQL real.
 * Cubre: creación directa de salas, permisos por rol, mensajes inválidos, spam,
 * filtración de respuestas en TODO lo que recibe un jugador, imágenes futuras,
 * caída/reconexión de anfitrión y pantalla, y caída del servidor (proceso aparte, kill -9).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client, type Room } from "colyseus.js";
import { matchMaker } from "colyseus";
import { startServer } from "../src/app";
import type { LogoRoom } from "../src/LogoRoom";
import { createTestDb } from "./db-helper";

const SCALE = 0.05; // ronda 120 s -> 6 s, enfriamiento 2 s -> 100 ms
let testDb: Awaited<ReturnType<typeof createTestDb>>;
let server: Awaited<ReturnType<typeof startServer>>;
let base = "";
let ws = "";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn: () => boolean, ms = 8000, what = "condición") {
  const t0 = Date.now();
  while (!fn()) {
    if (Date.now() - t0 > ms) throw new Error(`timeout esperando ${what}`);
    await wait(10);
  }
}
async function api(url: string, body?: unknown, token?: string) {
  const res = await fetch(url.startsWith("http") ? url : base + url, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
}

interface Game {
  roomId: string; roomCode: string; hostToken: string; screenToken: string;
  host: Room; screen: Room; players: { room: Room; token: string; id: string; inbox: string[] }[];
}

function autoReady(screen: Room) {
  let readyFor = "";
  screen.onStateChange((s: any) => {
    if (s.phase === "PREPARING" && s.phaseEndsAt > 0 && s.roundId !== readyFor) {
      readyFor = s.roundId;
      screen.send("screen:ready", { roundId: s.roundId });
    }
  });
}
async function linkScreen(g: Pick<Game, "roomCode" | "hostToken" | "roomId">) {
  const pc = await api(`/api/rooms/${g.roomCode}/screen-pairing`, {}, g.hostToken);
  const token = (await api(`/api/rooms/${g.roomCode}/screen`, { pairingCode: pc.json.pairingCode })).json.screenToken as string;
  const room = await new Client(ws).joinById(g.roomId, { token });
  room.onMessage("*", () => {});
  autoReady(room);
  return { token, room };
}
async function newGame(nPlayers: number, config: object = { rounds: 2, roundSeconds: 120 }): Promise<Game> {
  const c = await api("/api/rooms", { config });
  const g: any = { roomId: c.json.roomId, roomCode: c.json.roomCode, hostToken: c.json.hostToken, players: [] };
  g.host = await new Client(ws).joinById(g.roomId, { token: g.hostToken });
  g.host.onMessage("*", () => {});
  const s = await linkScreen(g);
  g.screen = s.room; g.screenToken = s.token;
  for (let i = 0; i < nPlayers; i++) {
    const j = await api(`/api/rooms/${g.roomCode}/players`, { alias: `Jug${i}` });
    const room = await new Client(ws).joinById(g.roomId, { token: j.json.playerToken });
    const inbox: string[] = [];
    room.onMessage("*", (type, m) => inbox.push(`${String(type)} ${JSON.stringify(m)}`));
    room.onStateChange((st: any) => inbox.push(`state ${JSON.stringify(st.toJSON())}`));
    g.players.push({ room, token: j.json.playerToken, id: j.json.playerId, inbox });
  }
  await waitFor(() => g.host.state.players.size === nPlayers, 8000, "jugadores");
  return g as Game;
}
const live = (g: Game) => matchMaker.getLocalRoomById(g.roomId) as LogoRoom;
const nextMsg = (room: Room, type: string) => new Promise<any>((res) => room.onMessage(type, res));
const send = (p: Game["players"][number], text: string, attemptId = randomUUID(), roundId?: string) =>
  p.room.send("player:attempt", { attemptId, roundId: roundId ?? p.room.state.roundId, text });

before(async () => {
  testDb = await createTestDb();
  server = await startServer(0, { timeScale: SCALE, databaseUrl: testDb.url });
  base = `http://localhost:${server.port}`;
  ws = `ws://localhost:${server.port}`;
});
after(async () => {
  await Promise.race([server.close(), wait(1500)]);
  await testDb.drop();
});

test("no se pueden crear salas saltándose la API (/matchmake/create)", async () => {
  const before = matchMaker.stats.local.roomCount;
  const r = await api("/matchmake/create/logo", {});
  // Colyseus responde 200 con {code, error}: lo relevante es que no hay sala ni reserva.
  assert.equal(r.json.room, undefined);
  assert.equal(r.json.code, 403);
  await assert.rejects(new Client(ws).create("logo", {}));
  assert.equal(matchMaker.stats.local.roomCount, before);
});

test("mensajes inválidos: tipo desconocido, prototipo, carga malformada o enorme", async () => {
  const g = await newGame(1);
  const p = g.players[0]!;
  const cases: [string, unknown][] = [
    ["nope", {}], ["toString", {}], ["__proto__", {}], ["constructor", {}],
    ["player:attempt", null], ["player:attempt", "texto"], ["player:attempt", { attemptId: 1, roundId: [], text: {} }],
    ["player:attempt", { attemptId: randomUUID(), roundId: "x", text: "a".repeat(5000) }],
    ["host:configure", { rounds: -1 }],
  ];
  for (const [type, payload] of cases) {
    const e = nextMsg(p.room, "error");
    p.room.send(type, payload as any);
    const got = await e;
    assert.ok(["INVALID_INPUT", "FORBIDDEN"].includes(got.code), `${type}: ${got.code}`);
    await wait(60);
  }
  // Una trama WebSocket por encima de maxPayload cierra solo esa conexión; el servidor sigue.
  const closed = new Promise<number>((res) => p.room.onLeave(res));
  p.room.send("player:attempt", { attemptId: randomUUID(), roundId: "x", text: "b".repeat(64 * 1024) });
  assert.ok((await closed) > 1000);
  assert.equal((await api("/health")).status, 200);
});

test("permisos: jugador y pantalla no ejecutan acciones de anfitrión; tokens cruzados entre salas fallan", async () => {
  const a = await newGame(1);
  const b = await newGame(1);
  for (const [room, type] of [[a.players[0]!.room, "host:start"], [a.screen, "host:start"], [a.screen, "host:kick"], [a.host, "player:attempt"], [a.players[0]!.room, "screen:ready"]] as const) {
    const e = nextMsg(room, "error");
    room.send(type, type === "host:kick" ? { playerId: a.players[0]!.id } : type === "player:attempt" ? { attemptId: randomUUID(), roundId: "r", text: "x" } : type === "screen:ready" ? { roundId: "r" } : {});
    assert.equal((await e).code, "FORBIDDEN", type);
  }
  await assert.rejects(new Client(ws).joinById(b.roomId, { token: a.hostToken }));
  await assert.rejects(new Client(ws).joinById(b.roomId, { token: a.players[0]!.token }));
  await assert.rejects(new Client(ws).joinById(b.roomId, { token: a.screenToken }));
  assert.equal((await api(`/api/rooms/${b.roomCode}/screen-pairing`, {}, a.hostToken)).status, 403);
  // El token de jugador no sirve para descargar imágenes.
  assert.equal(b.host.state.players.size, 1);
});

test("spam: exceso de mensajes se descarta, abuso sostenido cierra la conexión, intentos no crecen en BD", async () => {
  const g = await newGame(2);
  g.host.send("host:start", {});
  await waitFor(() => g.host.state.phase === "ROUND_ACTIVE", 8000, "ronda");
  const spammer = g.players[0]!;
  const errors: string[] = [];
  spammer.room.onMessage("error", (m) => errors.push(m.code));
  const closed = new Promise<number>((res) => spammer.room.onLeave(res));
  for (let i = 0; i < 400; i++) send(spammer, `spam${i}`);
  assert.equal(await closed, 4008);
  assert.ok(errors.includes("RATE_LIMITED"));
  await wait(300);
  const n = await testDb.db.query("SELECT count(*)::int AS n FROM play.attempt WHERE player_id=$1", [spammer.id]);
  assert.ok(n.rows[0].n <= 25, `intentos guardados: ${n.rows[0].n}`);
  // El otro jugador de la misma sala no se ve afectado.
  const ok = nextMsg(g.players[1]!.room, "attempt:result");
  send(g.players[1]!, live(g).round!.item.answer);
  assert.equal((await ok).status, "correct");
  g.host.send("host:abort", {});
});

test("filtración: ningún jugador recibe la solución ni aliases antes del cierre; imágenes futuras bloqueadas", async () => {
  const g = await newGame(3);
  g.host.send("host:start", {});
  await waitFor(() => g.host.state.phase === "ROUND_ACTIVE", 8000, "ronda");
  const round = live(g).round!;
  const secrets = [round.item.answer, ...round.item.aliases].map((s) => s.toLowerCase());
  send(g.players[0]!, "respuesta incorrecta");
  await waitFor(() => g.host.state.revealStage >= 3, 10000, "etapa 3");
  const mid = g.players.flatMap((p) => p.inbox).join("\n").toLowerCase();
  for (const s of secrets) assert.ok(!mid.includes(s), `filtrado antes del cierre: ${s}`);
  // Imágenes: etapa en curso sí, futuras y original no, y nunca para jugador/anfitrión.
  const media = async (id: string, token: string) => (await fetch(`${base}/api/media/${id}`, { headers: { authorization: `Bearer ${token}` } })).status;
  const stage = g.host.state.revealStage as number;
  assert.equal(await media(round.stageIds[stage - 1]!, g.screenToken), 200);
  for (let i = stage; i < round.stageIds.length; i++) assert.equal(await media(round.stageIds[i]!, g.screenToken), 403);
  assert.equal(await media(round.fullId, g.screenToken), 403);
  assert.equal(await media(round.stageIds[0]!, g.hostToken), 403);
  assert.equal(await media(round.stageIds[0]!, g.players[0]!.token), 403);
  assert.equal(await media(round.stageIds[0]!, "basura"), 401);
  // Tras el cierre la solución sí se revela.
  g.host.send("host:next", {});
  await waitFor(() => g.players[0]!.inbox.some((m) => m.startsWith("round:reveal")), 10000, "revelado");
  g.host.send("host:abort", {});
});

test("caída del anfitrión: la partida sigue y el anfitrión recupera el control al reconectar", async () => {
  const g = await newGame(2);
  g.host.send("host:start", {});
  await waitFor(() => g.host.state.phase === "ROUND_ACTIVE", 8000, "ronda");
  g.host.leave(false);
  await waitFor(() => !g.players[0]!.room.state.hostConnected, 4000, "host desconectado");
  const r = nextMsg(g.players[0]!.room, "attempt:result");
  send(g.players[0]!, live(g).round!.item.answer);
  assert.equal((await r).status, "correct");
  const host2 = await new Client(ws).joinById(g.roomId, { token: g.hostToken });
  host2.onMessage("*", () => {});
  await waitFor(() => host2.state.hostConnected === true, 4000, "host reconectado");
  host2.send("host:abort", {});
  await waitFor(() => host2.state.phase === "ABORTED", 4000, "abortada por host reconectado");
});

test("caída de la pantalla: pausa automática; una pantalla nueva vinculada reanuda la partida", async () => {
  const g = await newGame(2);
  g.host.send("host:start", {});
  await waitFor(() => g.host.state.phase === "ROUND_ACTIVE", 8000, "ronda");
  g.screen.leave(false);
  await waitFor(() => g.host.state.phase === "PAUSED", 4000, "pausa");
  const r = nextMsg(g.players[0]!.room, "attempt:result");
  send(g.players[0]!, "lo que sea");
  assert.equal((await r).status, "round_closed"); // en pausa no se aceptan respuestas
  const s2 = await linkScreen(g);
  await waitFor(() => g.host.state.screenConnected, 4000, "pantalla nueva");
  // El token de la pantalla anterior queda invalidado por la nueva vinculación.
  await assert.rejects(new Client(ws).joinById(g.roomId, { token: g.screenToken }));
  g.host.send("host:resume", {});
  await waitFor(() => g.host.state.phase === "ROUND_ACTIVE", 4000, "reanudada");
  s2.room.leave();
  g.host.send("host:abort", {});
});

test("reconexión del jugador durante la ronda conserva puntuación y no duplica", async () => {
  const g = await newGame(1);
  g.host.send("host:start", {});
  await waitFor(() => g.host.state.phase === "ROUND_ACTIVE", 8000, "ronda");
  const p = g.players[0]!;
  const id = randomUUID();
  const r = nextMsg(p.room, "attempt:result");
  send(p, live(g).round!.item.answer, id);
  assert.equal((await r).status, "correct");
  const score = g.host.state.players.get(p.id).score;
  p.room.leave(false);
  const again = await new Client(ws).joinById(g.roomId, { token: p.token });
  const results: any[] = [];
  again.onMessage("attempt:result", (m) => results.push(m));
  again.onMessage("*", () => {});
  await waitFor(() => results.length >= 1, 4000, "reenvío de resultado");
  again.send("player:attempt", { attemptId: id, roundId: again.state.roundId, text: live(g).round!.item.answer });
  await waitFor(() => results.some((m) => m.status === "duplicate"), 4000, "duplicado");
  assert.equal(g.host.state.players.get(p.id).score, score);
  g.host.send("host:abort", {});
});

test("caída del servidor (kill -9): al reiniciar la partida queda interrumpida y los clientes lo detectan", async () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const env = { ...process.env, PORT: String(port), DATABASE_URL: testDb.url, TOKEN_SECRET: "x".repeat(40), GAME_TIME_SCALE: "0.05" };
  const start = () => {
    const child = spawn(process.execPath, ["--import", "tsx", path.join(here, "../src/index.ts")], { env, stdio: "pipe" });
    child.stderr?.on("data", () => {});
    return child;
  };
  const up = async () => { for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://localhost:${port}/health`)).ok) return; } catch {} await wait(100); } throw new Error("no arranca"); };
  let child: ChildProcess = start();
  try {
    await up();
    const c = await api(`http://localhost:${port}/api/rooms`, { config: { rounds: 1 } });
    const host = await new Client(`ws://localhost:${port}`).joinById(c.json.roomId, { token: c.json.hostToken });
    host.onMessage("*", () => {});
    const pc = await api(`http://localhost:${port}/api/rooms/${c.json.roomCode}/screen-pairing`, {}, c.json.hostToken);
    const st = (await api(`http://localhost:${port}/api/rooms/${c.json.roomCode}/screen`, { pairingCode: pc.json.pairingCode })).json.screenToken;
    const screen = await new Client(`ws://localhost:${port}`).joinById(c.json.roomId, { token: st });
    screen.onMessage("*", () => {});
    autoReady(screen);
    const j = await api(`http://localhost:${port}/api/rooms/${c.json.roomCode}/players`, { alias: "Solo" });
    const pr = await new Client(`ws://localhost:${port}`).joinById(c.json.roomId, { token: j.json.playerToken });
    pr.onMessage("*", () => {});
    host.send("host:start", {});
    await waitFor(() => host.state.phase === "ROUND_ACTIVE", 8000, "ronda");
    const lost = new Promise<number>((res) => pr.onLeave(res));
    child.kill("SIGKILL");
    assert.ok((await lost) !== 1000, "el cliente detecta cierre anómalo");
    child = start();
    await up();
    const g = await testDb.db.query("SELECT status FROM play.game WHERE room_code=$1", [c.json.roomCode]);
    assert.equal(g.rows[0].status, "aborted");
    assert.equal((await api(`http://localhost:${port}/api/rooms/${c.json.roomCode}`)).status, 404);
    await assert.rejects(new Client(`ws://localhost:${port}`).joinById(c.json.roomId, { token: j.json.playerToken }));
  } finally {
    child.kill("SIGKILL");
  }
});
