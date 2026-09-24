/**
 * Prueba de carga reproducible: N salas simultáneas, cada una con anfitrión + pantalla + J jugadores,
 * partida completa. El servidor corre en un PROCESO APARTE para medir solo su CPU y memoria.
 *
 *   DATABASE_URL=postgres://... npx tsx scripts/loadtest.ts [--rooms 2] [--players 30] [--rounds 3] [--scale 0.1]
 *
 * Mide: latencia de confirmación (envío -> attempt:result), tiempo de entrada, errores,
 * desconexiones inesperadas, filtraciones de la solución, CPU y RSS del servidor.
 * Escribe docs/results/loadtest-<fecha>.json.
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { Client, type Room } from "colyseus.js";
import pg from "pg";

const arg = (k: string, d: number) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? Number(process.argv[i + 1]) : d; };
const ROOMS = arg("rooms", 2), PLAYERS = arg("players", 30), ROUNDS = arg("rounds", 3), SCALE = arg("scale", 0.1);
const DB = process.env.DATABASE_URL ?? "postgres://postgres@localhost:5433/logos";
const PORT = 20000 + Math.floor(Math.random() * 20000);
const BASE = `http://localhost:${PORT}`, WS = `ws://localhost:${PORT}`;
const here = path.dirname(fileURLToPath(import.meta.url));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const lat: number[] = [], joinMs: number[] = [];
const errors: Record<string, number> = {};
const bump = (k: string) => (errors[k] = (errors[k] ?? 0) + 1);
let unexpectedLeaves = 0, leaks = 0, sent = 0, received = 0;
const samples: { t: number; rssMB: number; cpuPct: number }[] = [];

async function api(p: string, body?: unknown, token?: string) {
  const r = await fetch(BASE + p, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!r.ok) bump(`http_${r.status}`);
  return (await r.json().catch(() => ({}))) as any;
}
function pct(a: number[], p: number) { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!.toFixed(1); }

function sampler(pid: number) {
  const hz = 100; // USER_HZ habitual en Linux
  let last = { t: Date.now(), ticks: 0 };
  return setInterval(() => {
    try {
      const f = readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1]!.split(" ");
      const ticks = Number(f[11]) + Number(f[12]);
      const rss = Number(readFileSync(`/proc/${pid}/status`, "utf8").match(/VmRSS:\s+(\d+)/)![1]) / 1024;
      const now = Date.now();
      if (last.ticks) samples.push({ t: now, rssMB: +rss.toFixed(1), cpuPct: +((((ticks - last.ticks) / hz) * 1000 * 100) / (now - last.t)).toFixed(1) });
      last = { t: now, ticks };
    } catch {}
  }, 500);
}

async function runRoom(idx: number) {
  const c = await api("/api/rooms", { config: { rounds: ROUNDS, roundSeconds: 120, maxPlayers: PLAYERS } });
  const host = await new Client(WS).joinById(c.roomId, { token: c.hostToken });
  host.onMessage("*", () => {});
  const pc = await api(`/api/rooms/${c.roomCode}/screen-pairing`, {}, c.hostToken);
  const st = (await api(`/api/rooms/${c.roomCode}/screen`, { pairingCode: pc.pairingCode })).screenToken;
  const screen = await new Client(WS).joinById(c.roomId, { token: st });
  let readyFor = "", answer = "";
  screen.onMessage("round:reveal", (m) => (answer = m.answer));
  screen.onMessage("round:media", async (m) => { const r = await fetch(`${BASE}/api/media/${m.mediaId}`, { headers: { authorization: `Bearer ${st}` } }); if (!r.ok) bump(`media_${r.status}`); await r.arrayBuffer(); });
  screen.onMessage("*", () => {});
  screen.onStateChange((s: any) => { if (s.phase === "PREPARING" && s.phaseEndsAt > 0 && s.roundId !== readyFor) { readyFor = s.roundId; screen.send("screen:ready", { roundId: s.roundId }); } });

  const players: { room: Room; inbox: string[]; pending: Map<string, number>; closed: boolean }[] = [];
  await Promise.all(Array.from({ length: PLAYERS }, async (_, i) => {
    const t0 = performance.now();
    const j = await api(`/api/rooms/${c.roomCode}/players`, { alias: `S${idx}J${i}` });
    const room = await new Client(WS).joinById(j.roomId, { token: j.playerToken });
    joinMs.push(performance.now() - t0);
    const p = { room, inbox: [] as string[], pending: new Map<string, number>(), closed: false };
    room.onMessage("attempt:result", (m) => { received++; const t = p.pending.get(m.attemptId); if (t) { lat.push(performance.now() - t); p.pending.delete(m.attemptId); } });
    room.onMessage("error", (m) => bump(`ws_${m.code}`));
    room.onMessage("*", (type, m) => p.inbox.push(`${String(type)}${JSON.stringify(m)}`));
    room.onStateChange((s: any) => { if (s.phase === "ROUND_ACTIVE") p.inbox.push(JSON.stringify(s.toJSON())); });
    room.onLeave((code) => { if (!p.closed) { unexpectedLeaves++; bump(`leave_${code}`); } });
    players.push(p);
  }));

  // Oráculo exclusivo del script de carga: lee la respuesta de la ronda en PostgreSQL (acceso de operador)
  // para simular aciertos realistas. Los clientes de juego nunca tienen esta vía.
  const db = new pg.Client({ connectionString: DB }); await db.connect();
  host.send("host:start", {});
  let roundsSeen = 0, roundId = "";
  while (host.state.phase !== "FINAL_RESULTS" && host.state.phase !== "ABORTED") {
    await wait(20);
    if (host.state.phase === "ROUND_ACTIVE" && host.state.roundId !== roundId) {
      roundId = host.state.roundId; roundsSeen++;
      const row = (await db.query(
        `SELECT v.answer FROM play.game_round r JOIN content.catalog_version v ON v.id=r.catalog_version_id WHERE r.id=$1`, [roundId])).rows[0];
      const correct: string = row?.answer ?? "?";
      const secret = correct.toLowerCase();
      const ends = host.state.phaseEndsAt as number;
      const offset = Date.now() - performance.now();
      // Cada jugador: 1-3 fallos espaciados por el enfriamiento y, el 80 %, un acierto en un momento aleatorio.
      players.forEach((p, i) => {
        const sendOne = (text: string) => { if (host.state.roundId !== roundId) return; const id = randomUUID(); p.pending.set(id, performance.now()); sent++; p.room.send("player:attempt", { attemptId: id, roundId, text }); };
        const wrongs = 1 + (i % 3);
        const gap = 2000 * SCALE + 30;
        for (let k = 0; k < wrongs; k++) setTimeout(() => sendOne(`fallo ${k}`), 50 + k * gap + Math.random() * 20);
        if (i % 5 !== 0) setTimeout(() => sendOne(correct), 50 + wrongs * gap + Math.random() * Math.max(1, ends - (performance.now() + offset) - wrongs * gap - 500));
      });
      // Todas las entradas antes del cierre: comprobar que nadie recibió la solución.
      setTimeout(() => { for (const p of players) if (p.inbox.join("").toLowerCase().includes(`"${secret}"`) && !p.inbox.some((m) => m.startsWith("round:reveal"))) leaks++; }, Math.max(0, ends - Date.now() - 200));
    }
  }
  await db.end();
  const final = host.state.phase;
  for (const p of players) { p.closed = true; p.room.leave(); }
  host.leave(); screen.leave();
  return { roomCode: c.roomCode, final, roundsSeen, answerRevealed: !!answer };
}

async function main() {
  const env = { ...process.env, PORT: String(PORT), DATABASE_URL: DB, GAME_TIME_SCALE: String(SCALE), TOKEN_SECRET: "l".repeat(40), JOIN_LIMIT: "10000", CREATE_ROOM_LIMIT: "1000" };
  const child = spawn(process.execPath, ["--import", "tsx", path.join(here, "../src/index.ts")], { env, stdio: ["ignore", "pipe", "pipe"] });
  child.stderr.on("data", (d) => { if (/error/i.test(String(d))) bump("server_stderr"); });
  for (let i = 0; ; i++) { try { if ((await fetch(BASE + "/health")).ok) break; } catch {} if (i > 150) throw new Error("el servidor no arranca"); await wait(100); }
  await wait(1500);
  const timer = sampler(child.pid!);
  const idle = samples.at(-1);
  const t0 = Date.now();
  const rooms = await Promise.all(Array.from({ length: ROOMS }, (_, i) => runRoom(i)));
  const durationS = (Date.now() - t0) / 1000;
  await wait(600);
  clearInterval(timer);
  child.kill("SIGTERM");
  const pending = sent - received;
  const result = {
    date: new Date().toISOString(),
    env: { node: process.version, cpus: os.cpus().length, cpuModel: os.cpus()[0]?.model, memGB: +(os.totalmem() / 2 ** 30).toFixed(1), platform: `${os.type()} ${os.release()}`, network: "loopback (mismo host, sin Wi-Fi ni Internet)" },
    params: { rooms: ROOMS, playersPerRoom: PLAYERS, roundsPerRoom: ROUNDS, timeScale: SCALE, roundSeconds: 120 * SCALE, clientsTotal: ROOMS * (PLAYERS + 2) },
    rooms, durationS,
    attempts: { sent, confirmed: received, unconfirmed: pending },
    confirmLatencyMs: { n: lat.length, p50: pct(lat, 50), p95: pct(lat, 95), p99: pct(lat, 99), max: pct(lat, 100) },
    joinMs: { n: joinMs.length, p50: pct(joinMs, 50), p95: pct(joinMs, 95), max: pct(joinMs, 100) },
    errors, unexpectedLeaves, answerLeaks: leaks,
    server: { idleRssMB: idle?.rssMB, peakRssMB: Math.max(...samples.map((s) => s.rssMB)), avgCpuPct: +(samples.reduce((a, s) => a + s.cpuPct, 0) / samples.length).toFixed(1), peakCpuPct: Math.max(...samples.map((s) => s.cpuPct)) },
  };
  const out = path.join(here, "../../../docs/results");
  mkdirSync(out, { recursive: true });
  const file = path.join(out, `loadtest-${ROOMS}x${PLAYERS}-${result.date.slice(0, 19).replace(/[:T]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  console.log("guardado en", file);
  const ok = rooms.every((r) => r.final === "FINAL_RESULTS" && r.roundsSeen === ROUNDS) && leaks === 0 && pending === 0 && unexpectedLeaves === 0;
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
