/**
 * Prueba reproducible con clientes independientes reales (HTTP + WebSocket).
 * Arranca el servidor en un puerto libre y lo cierra al terminar.
 * Ejecutar: cd apps/game-server && npm test
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client, type Room } from "colyseus.js";
import { startServer } from "../src/app";

const PLAYERS = Number(process.env.TEST_PLAYERS ?? 30);
let base = "";
let ws = "";
let server: Awaited<ReturnType<typeof startServer>>;

async function api(path: string, body?: unknown, token?: string) {
  const res = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as any };
}

/** Cada llamada crea un Client nuevo: conexiones independientes. */
const connect = (roomId: string, options: Record<string, unknown>) => new Client(ws).joinById(roomId, options);

async function waitFor(fn: () => boolean, ms = 5000) {
  const t0 = Date.now();
  while (!fn()) {
    if (Date.now() - t0 > ms) throw new Error("timeout esperando condición");
    await new Promise((r) => setTimeout(r, 25));
  }
}

function nextMessage(room: Room, type: string, ms = 3000) {
  return new Promise<any>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`sin mensaje ${type}`)), ms);
    room.onMessage(type, (m) => {
      clearTimeout(t);
      resolve(m);
    });
  });
}

async function expectRejected(p: Promise<unknown>) {
  await assert.rejects(p);
}

async function createRoomWithScreen() {
  const created = await api("/api/rooms", {});
  assert.equal(created.status, 201);
  const { roomCode, roomId, hostToken } = created.json;
  const host = await connect(roomId, { token: hostToken });
  host.onMessage("*", () => {});
  const pairing = await api(`/api/rooms/${roomCode}/screen-pairing`, {}, hostToken);
  assert.equal(pairing.status, 200);
  const linked = await api(`/api/rooms/${roomCode}/screen`, { pairingCode: pairing.json.pairingCode });
  assert.equal(linked.status, 200);
  const screen = await connect(roomId, { token: linked.json.screenToken });
  screen.onMessage("*", () => {});
  return { roomCode, roomId, hostToken, host, screen, pairingCode: pairing.json.pairingCode, screenToken: linked.json.screenToken };
}

let A: Awaited<ReturnType<typeof createRoomWithScreen>>;
let B: Awaited<ReturnType<typeof createRoomWithScreen>>;
const playersA: { room: Room; token: string; playerId: string }[] = [];

before(async () => {
  server = await startServer(0);
  base = `http://localhost:${server.port}`;
  ws = `ws://localhost:${server.port}`;
  A = await createRoomWithScreen();
  B = await createRoomWithScreen();
});

after(async () => {
  for (const r of [A?.host, A?.screen, B?.host, B?.screen, ...playersA.map((p) => p.room)]) {
    try { await Promise.race([r?.leave(), new Promise((ok) => setTimeout(ok, 300))]); } catch {}
  }
  await Promise.race([server.close(), new Promise((r) => setTimeout(r, 2000))]);

});

test("salas distintas tienen códigos e ids distintos", () => {
  assert.notEqual(A.roomCode, B.roomCode);
  assert.notEqual(A.roomId, B.roomId);
});

test(`${PLAYERS} jugadores entran; anfitrión y pantalla no ocupan plaza`, async () => {
  for (let i = 0; i < PLAYERS; i++) {
    const j = await api(`/api/rooms/${A.roomCode}/players`, { alias: `Jugador ${i + 1}` });
    assert.equal(j.status, 200, JSON.stringify(j.json));
    const room = await connect(j.json.roomId, { token: j.json.playerToken });
    room.onMessage("*", () => {});
    playersA.push({ room, token: j.json.playerToken, playerId: j.json.playerId });
  }
  await waitFor(() => A.host.state.players.size === PLAYERS);
  assert.equal(A.host.state.hostConnected, true);
  assert.equal(A.host.state.screenConnected, true);
  assert.equal(A.screen.state.players.size, PLAYERS);
  const info = await api(`/api/rooms/${A.roomCode}`);
  assert.equal(info.json.playerCount, PLAYERS);
  assert.equal(info.json.maxPlayers, 30);
});

test("jugador extra recibe ROOM_FULL", async () => {
  if (PLAYERS < 30) return;
  const j = await api(`/api/rooms/${A.roomCode}/players`, { alias: "Sobrante" });
  assert.equal(j.status, 409);
  assert.equal(j.json.error, "ROOM_FULL");
});

test("aislamiento: la sala B no ve jugadores de A y rechaza sus tokens", async () => {
  assert.equal(B.host.state.players.size, 0);
  await expectRejected(connect(B.roomId, { token: playersA[0].token }));
  await expectRejected(connect(B.roomId, { token: A.hostToken }));
  await expectRejected(connect(B.roomId, { token: A.screenToken }));
  const pairingWithOtherHost = await api(`/api/rooms/${B.roomCode}/screen-pairing`, {}, A.hostToken);
  assert.equal(pairingWithOtherHost.status, 403);
  // Un token de A usado para "recuperar" en B crea una identidad nueva, no reutiliza la de A.
  const j = await api(`/api/rooms/${B.roomCode}/players`, { alias: "Visitante", playerToken: playersA[0].token });
  assert.equal(j.status, 200);
  assert.notEqual(j.json.playerId, playersA[0].playerId);
  const r = await connect(B.roomId, { token: j.json.playerToken });
  await waitFor(() => B.host.state.players.size === 1);
  assert.equal(A.host.state.players.size, PLAYERS);
  await r.leave();
});

test("permisos: sin token, token manipulado o role declarado no conceden acceso", async () => {
  await expectRejected(connect(A.roomId, {}));
  await expectRejected(connect(A.roomId, { role: "host" }));
  const [body, sig] = playersA[0].token.split(".");
  const forged = JSON.parse(Buffer.from(body, "base64url").toString());
  forged.role = "host";
  await expectRejected(connect(A.roomId, { token: `${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${sig}` }));
  const asPlayer = await api(`/api/rooms/${A.roomCode}/screen-pairing`, {}, playersA[0].token);
  assert.equal(asPlayer.status, 403);
  const asScreen = await api(`/api/rooms/${A.roomCode}/screen-pairing`, {}, A.screenToken);
  assert.equal(asScreen.status, 403);
});

test("permisos: jugador y pantalla no pueden ejecutar acciones de anfitrión", async () => {
  const p = playersA[1].room;
  const e1 = nextMessage(p, "error");
  p.send("host:kick", { playerId: playersA[2].playerId });
  assert.equal((await e1).code, "FORBIDDEN");
  const e2 = nextMessage(A.screen, "error");
  A.screen.send("host:kick", { playerId: playersA[2].playerId });
  assert.equal((await e2).code, "FORBIDDEN");
  const e3 = nextMessage(p, "error");
  p.send("screen:ready", { roundId: "x" });
  assert.equal((await e3).code, "FORBIDDEN");
  assert.equal(A.host.state.players.size, PLAYERS);
});

test("vinculación de pantalla: código de un solo uso; nueva pantalla invalida la anterior", async () => {
  const reuse = await api(`/api/rooms/${A.roomCode}/screen`, { pairingCode: A.pairingCode });
  assert.equal(reuse.status, 403);
  const pairing = await api(`/api/rooms/${A.roomCode}/screen-pairing`, {}, A.hostToken);
  const linked = await api(`/api/rooms/${A.roomCode}/screen`, { pairingCode: pairing.json.pairingCode });
  const screen2 = await connect(A.roomId, { token: linked.json.screenToken });
  await expectRejected(connect(A.roomId, { token: A.screenToken }));
  assert.equal(A.host.state.screenConnected, true);
  await screen2.leave();
});

test("recuperar sesión: el jugador reconecta con su token y conserva identidad y plaza", async () => {
  const victim = playersA[3];
  await victim.room.leave();
  await waitFor(() => A.host.state.players.get(victim.playerId)?.connected === false);
  const again = await api(`/api/rooms/${A.roomCode}/players`, { alias: "otro", playerToken: victim.token });
  assert.equal(again.json.playerId, victim.playerId);
  assert.equal(again.json.alias, "Jugador 4");
  const room = await connect(A.roomId, { token: again.json.playerToken });
  room.onMessage("*", () => {});
  await waitFor(() => A.host.state.players.get(victim.playerId)?.connected === true);
  assert.equal(A.host.state.players.size, PLAYERS);
  victim.room = room;
});

test("anfitrión expulsa a un jugador y su token deja de servir", async () => {
  const target = playersA[4];
  A.host.send("host:kick", { playerId: target.playerId });
  await waitFor(() => !A.host.state.players.has(target.playerId));
  await expectRejected(connect(A.roomId, { token: target.token }));
});
