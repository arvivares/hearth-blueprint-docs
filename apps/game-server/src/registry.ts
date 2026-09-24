import { randomInt, randomUUID } from "node:crypto";
import type { GameConfig } from "../../../packages/contracts/src/common";

/** Registro en memoria de salas vivas (una instancia de servidor). */
export interface PlayerIdentity {
  playerId: string;
  alias: string;
  reservedAt: number;
}

export interface RoomRecord {
  roomId: string;
  roomCode: string;
  config: GameConfig;
  players: Map<string, PlayerIdentity>;
  pairing: { code: string; expiresAt: number; failures: number } | null;
  screenGen: number;
  acceptingPlayers: boolean;
}

const byCode = new Map<string, RoomRecord>();
const byId = new Map<string, RoomRecord>();

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newRoomCode(): string {
  for (;;) {
    let code = "";
    for (let i = 0; i < 5; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    if (!byCode.has(code)) return code;
  }
}

export function registerRoom(rec: RoomRecord) {
  byCode.set(rec.roomCode, rec);
  byId.set(rec.roomId, rec);
}

export function unregisterRoom(roomId: string) {
  const rec = byId.get(roomId);
  if (!rec) return;
  byId.delete(roomId);
  byCode.delete(rec.roomCode);
}

export const getByCode = (code: string) => byCode.get(code.toUpperCase());
export const getById = (id: string) => byId.get(id);

export function uniqueAlias(rec: RoomRecord, alias: string): string {
  const taken = new Set([...rec.players.values()].map((p) => p.alias.toLowerCase()));
  if (!taken.has(alias.toLowerCase())) return alias;
  for (let n = 2; ; n++) {
    const candidate = `${alias.slice(0, 17)} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export function reservePlayer(rec: RoomRecord, alias: string): PlayerIdentity {
  const identity = { playerId: randomUUID(), alias: uniqueAlias(rec, alias), reservedAt: Date.now() };
  rec.players.set(identity.playerId, identity);
  return identity;
}

export const newPairingCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
