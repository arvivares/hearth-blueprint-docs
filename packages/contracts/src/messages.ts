import { z } from "zod";
import { AnswerText, ErrorCode, GameConfig } from "./common";

// ---------- Cliente -> servidor (intenciones) ----------
export const ClientMessages = {
  "host:configure": GameConfig.partial(),
  "host:start": z.object({}),
  "host:pause": z.object({}),
  "host:resume": z.object({}),
  "host:next": z.object({}),
  "host:abort": z.object({}),
  "host:reset": z.object({}),
  "host:kick": z.object({ playerId: z.string() }),
  "screen:ready": z.object({ roundId: z.string() }),
  "player:attempt": z.object({
    attemptId: z.string().uuid(),
    roundId: z.string(),
    text: AnswerText,
  }),
  "clock:sync": z.object({ clientSentAt: z.number() }),
} as const;
export type ClientMessageType = keyof typeof ClientMessages;

/** Rol mínimo requerido por mensaje (el rol sale del token, no del cliente). */
export const MessageRole: Record<ClientMessageType, "host" | "screen" | "player" | "any"> = {
  "host:configure": "host",
  "host:start": "host",
  "host:pause": "host",
  "host:resume": "host",
  "host:next": "host",
  "host:abort": "host",
  "host:reset": "host",
  "host:kick": "host",
  "screen:ready": "screen",
  "player:attempt": "player",
  "clock:sync": "any",
};

// ---------- Servidor -> cliente ----------
export const AttemptStatus = z.enum([
  "correct",
  "incorrect",
  "already_scored",
  "round_closed",
  "rate_limited",
  "duplicate",
]);

export const ServerMessages = {
  "attempt:result": z.object({
    attemptId: z.string().uuid(),
    roundId: z.string(),
    status: AttemptStatus,
    points: z.number().int().optional(),
    multiplier: z.number().optional(),
    retryAt: z.number().optional(),
  }),
  "round:media": z.object({ roundId: z.string(), stage: z.number().int(), mediaId: z.string() }),
  "round:reveal": z.object({ roundId: z.string(), answer: z.string(), mediaId: z.string() }),
  "clock:pong": z.object({ clientSentAt: z.number(), serverNow: z.number() }),
  error: z.object({ code: ErrorCode, ref: z.string().optional() }),
} as const;
export type ServerMessageType = keyof typeof ServerMessages;
