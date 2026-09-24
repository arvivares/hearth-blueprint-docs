/**
 * DEMOSTRACIÓN — datos ficticios para revisar el diseño sin servidor.
 * No se usan en /tv, /host ni /play. Solo los importa la ruta /demo.
 */
import type { RoomSnapshot } from "../useGameRoom";

const ALIASES = ["Ana", "Luis", "Marta", "Jorge", "Lucía", "Pablo", "Sara", "Diego", "Elena", "Iván", "Nora", "Hugo"];

function basePlayers(scored: boolean) {
  const scores = [2600, 2400, 2400, 1800, 1600, 1200, 1000, 800, 600, 400, 200, 0];
  return Object.fromEntries(
    ALIASES.map((alias, i) => [
      `demo-${i}`,
      {
        alias,
        connected: i !== 7,
        score: scored ? scores[i]! : 0,
        correctCount: scored ? Math.ceil(scores[i]! / 800) : 0,
        answeredThisRound: scored && i < 4,
        waiting: false,
      },
    ]),
  );
}

// Rank precalculado a mano para la maqueta (el real lo calcula el servidor).
const DEMO_RANKING = [1, 2, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((rank, i) => ({ playerId: `demo-${i}`, rank }));

const base: Omit<RoomSnapshot, "phase"> = {
  previousPhase: "",
  roomCode: "DEMO1",
  maxPlayers: 30,
  roundIndex: 3,
  totalRounds: 10,
  roundSeconds: 25,
  roundId: "demo-round",
  revealStage: 3,
  totalStages: 5,
  phaseEndsAt: 0,
  hostConnected: true,
  screenConnected: true,
  players: basePlayers(true),
  ranking: DEMO_RANKING,
};

export const DEMO_PHASES = ["LOBBY", "ROUND_ACTIVE", "ROUND_RESULTS", "FINAL_RESULTS", "PAUSED"] as const;
export type DemoPhase = (typeof DEMO_PHASES)[number];

export function demoSnapshot(phase: DemoPhase): RoomSnapshot {
  if (phase === "LOBBY") return { ...base, phase, roundIndex: 0, revealStage: 0, players: basePlayers(false), ranking: [] };
  return { ...base, phase };
}

export const DEMO_REMAINING_MS = 12_000;
export const DEMO_ANSWER = "Empresa Ficticia";
