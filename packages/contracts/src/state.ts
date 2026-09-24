import type { Phase } from "./common";

/** Forma pública del estado sincronizado por Colyseus. Sin datos privados. */
export interface PublicPlayer {
  alias: string;
  connected: boolean;
  score: number;
  correctCount: number;
  answeredThisRound: boolean;
  waiting: boolean;
}

export interface RankingEntry {
  playerId: string;
  rank: number; // compartido en empate: puntos, luego aciertos
}

export interface PublicRoomState {
  phase: Phase;
  previousPhase?: Phase;
  roundIndex: number;
  totalRounds: number;
  roundId: string;
  revealStage: number;
  totalStages: number;
  phaseEndsAt: number; // ms, reloj del servidor
  screenConnected: boolean;
  hostConnected: boolean;
  players: Record<string, PublicPlayer>;
  ranking: RankingEntry[];
}

/** Transiciones permitidas (documentación ejecutable; la lógica vivirá en el servidor). */
export const ALLOWED_TRANSITIONS: Record<Phase, readonly Phase[]> = {
  LOBBY: ["PREPARING", "ABORTED"],
  PREPARING: ["COUNTDOWN", "PAUSED", "ABORTED"],
  COUNTDOWN: ["ROUND_ACTIVE", "PAUSED", "ABORTED"],
  ROUND_ACTIVE: ["ROUND_RESULTS", "PAUSED", "ABORTED"],
  ROUND_RESULTS: ["PREPARING", "FINAL_RESULTS", "PAUSED", "ABORTED"],
  PAUSED: ["PREPARING", "COUNTDOWN", "ROUND_ACTIVE", "ROUND_RESULTS", "ABORTED"],
  FINAL_RESULTS: ["LOBBY"],
  ABORTED: [],
};
