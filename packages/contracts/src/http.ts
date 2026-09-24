import { z } from "zod";
import { Alias, ErrorCode, GameConfig, Phase, RoomCode } from "./common";

export const ApiError = z.object({ error: ErrorCode, message: z.string().optional() });

export const HealthResponse = z.object({ ok: z.literal(true), version: z.string() });

export const CreateRoomRequest = z.object({ config: GameConfig.partial().optional() });
export const CreateRoomResponse = z.object({
  roomCode: RoomCode,
  roomId: z.string(),
  hostToken: z.string(),
});

export const RoomInfoResponse = z.object({
  roomCode: RoomCode,
  phase: Phase,
  playerCount: z.number().int(),
  maxPlayers: z.number().int(),
  acceptingPlayers: z.boolean(),
});

export const ScreenPairingResponse = z.object({
  pairingCode: z.string().regex(/^\d{6}$/),
  expiresAt: z.number(),
});

export const ScreenLinkRequest = z.object({ pairingCode: z.string().regex(/^\d{6}$/) });
export const ScreenLinkResponse = z.object({ screenToken: z.string(), roomId: z.string() });

export const JoinPlayerRequest = z.object({ alias: Alias, playerToken: z.string().optional() });
export const JoinPlayerResponse = z.object({
  playerToken: z.string(),
  playerId: z.string(),
  roomId: z.string(),
  alias: Alias,
  waiting: z.boolean(),
});

export type CreateRoomResponse = z.infer<typeof CreateRoomResponse>;
export type JoinPlayerResponse = z.infer<typeof JoinPlayerResponse>;
export type RoomInfoResponse = z.infer<typeof RoomInfoResponse>;
