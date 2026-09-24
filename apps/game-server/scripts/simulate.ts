/**
 * Simulación reproducible de una partida completa con clientes independientes.
 * - Sin argumentos: arranca un servidor propio en un puerto libre.
 * - SERVER_URL=http://host:2567 : usa un servidor ya desplegado.
 * Variables: PLAYERS (8), ROUNDS (3), SCALE (0.1 = 10x más rápido), SEED (42).
 * Los bots aciertan o fallan de forma pseudoaleatoria determinista por SEED.
 * Ejecutar: npm run simulate
 */
import { randomUUID } from "node:crypto";
import { Client, type Room } from "colyseus.js";
import { startServer } from "../src/app";
import { matchMaker } from "colyseus";
import { DEMO_CATALOG } from "../src/content/catalog";
import type { LogoRoom } from "../src/LogoRoom";

const PLAYERS = Number(process.env.PLAYERS ?? 8);
const ROUNDS = Number(process.env.ROUNDS ?? 3);
const SCALE = Number(process.env.SCALE ?? 0.1);
let seed = Number(process.env.SEED ?? 42);
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);

async function main() {
  let base = process.env.SERVER_URL;
  let close: (() => Promise<unknown>) | null = null;
  if (!base) {
    const s = await startServer(0, { timeScale: SCALE });
    base = `http://localhost:${s.port}`;
    close = s.close;
  }
  const ws = base.replace(/^http/, "ws");
  const post = async (path: string, body: unknown, token?: string) =>
    (await fetch(base + path, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })).json() as Promise<any>;

  const created = await post("/api/rooms", { config: { rounds: ROUNDS } });
  console.log(`Sala ${created.roomCode} creada`);
  const host = await new Client(ws).joinById(created.roomId, { token: created.hostToken });
  host.onMessage("*", () => {});
  const pairing = await post(`/api/rooms/${created.roomCode}/screen-pairing`, {}, created.hostToken);
  const link = await post(`/api/rooms/${created.roomCode}/screen`, { pairingCode: pairing.pairingCode });
  const screen = await new Client(ws).joinById(created.roomId, { token: link.screenToken });
  screen.onMessage("*", () => {});
  let readyFor = "";
  let revealed = "";
  screen.onMessage("round:reveal", (m) => (revealed = m.answer));
  screen.onStateChange((s: any) => {
    if (s.phase === "PREPARING" && s.phaseEndsAt > 0 && s.roundId !== readyFor) {
      readyFor = s.roundId;
      screen.send("screen:ready", { roundId: s.roundId });
    }
  });

  // Los bots conocen el catálogo ficticio (solo en esta simulación) para poder acertar.
  const answers = DEMO_CATALOG.map((c) => c.answer);
  const bots: { alias: string; room: Room; skill: number }[] = [];
  for (let i = 0; i < PLAYERS; i++) {
    const j = await post(`/api/rooms/${created.roomCode}/players`, { alias: `Bot ${i + 1}` });
    const room = await new Client(ws).joinById(j.roomId, { token: j.playerToken });
    room.onMessage("*", () => {});
    bots.push({ alias: j.alias, room, skill: 0.3 + rand() * 0.6 });
  }

  let lastRound = "";
  host.onStateChange((s: any) => {
    if (s.phase === "ROUND_ACTIVE" && s.roundId !== lastRound) {
      lastRound = s.roundId;
      console.log(`\nRonda ${s.roundIndex + 1}/${s.totalRounds}`);
      for (const b of bots) {
        const delay = rand() * s.roundSeconds * 1000 * SCALE * 0.9;
        const willKnow = rand() < b.skill;
        setTimeout(() => {
          // Primero un intento erróneo; si "sabe", prueba todas las candidatas respetando el enfriamiento.
          // Con servidor propio, el bot que "sabe" consulta la respuesta en proceso; con servidor remoto prueba el catálogo.
          const local = close ? (matchMaker.getLocalRoomById(created.roomId) as LogoRoom | undefined)?.round?.item.answer : undefined;
          const guesses = willKnow ? ["no lo sé", ...(local ? [local] : [...answers].sort(() => rand() - 0.5))] : ["no lo sé"];
          guesses.forEach((g, k) =>
            setTimeout(() => b.room.send("player:attempt", { attemptId: randomUUID(), roundId: s.roundId, text: g }), k * (2000 * SCALE + 20)),
          );
        }, delay);
      }
    }
  });

  host.send("host:start", {});
  let shown = "";
  await new Promise<void>((resolve) => {
    host.onStateChange((s: any) => {
      if (s.phase === "ROUND_RESULTS" && shown !== s.roundId) {
        shown = s.roundId;
        setTimeout(() => {
          const players = (host.state.toJSON() as any).players as Record<string, any>;
          const correct = Object.values(players).filter((p) => p.answeredThisRound).length;
          console.log(`  Solución: ${revealed} · aciertos: ${correct}/${PLAYERS}`);
        }, 50);
      }
      if (s.phase === "FINAL_RESULTS") resolve();
    });
  });

  const s: any = host.state.toJSON();
  console.log("\nClasificación final");
  for (const r of s.ranking) {
    const p = s.players[r.playerId];
    console.log(`  ${String(r.rank).padStart(2)}. ${p.alias.padEnd(8)} ${String(p.score).padStart(5)} pts · ${p.correctCount} aciertos`);
  }
  for (const r of [host, screen, ...bots.map((b) => b.room)]) void r.leave();
  if (close) await Promise.race([close(), new Promise((r) => setTimeout(r, 1000))]);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
