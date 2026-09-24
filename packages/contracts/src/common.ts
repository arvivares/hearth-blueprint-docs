import { z } from "zod";

export const PROTOCOL_VERSION = 1;

export const Phase = z.enum([
  "LOBBY",
  "PREPARING",
  "COUNTDOWN",
  "ROUND_ACTIVE",
  "ROUND_RESULTS",
  "FINAL_RESULTS",
  "PAUSED",
  "ABORTED",
]);
export type Phase = z.infer<typeof Phase>;

export const Role = z.enum(["host", "screen", "player"]);
export type Role = z.infer<typeof Role>;

export const ErrorCode = z.enum([
  "INVALID_INPUT",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "ROOM_NOT_FOUND",
  "ROOM_FULL",
  "GAME_IN_PROGRESS",
  "PAIRING_INVALID",
  "ALIAS_INVALID",
  "RATE_LIMITED",
  "ROUND_CLOSED",
  "ALREADY_SCORED",
  "INVALID_PHASE",
  "INTERNAL",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

// Código de sala: 5 caracteres sin ambiguos (propuesto).
export const RoomCode = z.string().regex(/^[A-HJ-NP-Z2-9]{5}$/);
export const Alias = z.string().trim().min(1).max(20);
export const AnswerText = z.string().trim().min(1).max(60);

/** Parámetros ajustables. Valores por defecto = propuesta inicial, no confirmados. */
export const GameConfig = z.object({
  rounds: z.number().int().min(1).max(30).default(10),
  roundSeconds: z.number().int().min(10).max(120).default(25),
  revealStages: z.number().int().min(2).max(10).default(5),
  pointsByStage: z.array(z.number().int().nonnegative()).default([1000, 800, 600, 400, 200]),
  attemptCooldownMs: z.number().int().min(500).default(2000),
  reconnectSeconds: z.number().int().min(10).default(60),
  maxPlayers: z.number().int().min(1).max(50).default(30),
});
export type GameConfig = z.infer<typeof GameConfig>;
