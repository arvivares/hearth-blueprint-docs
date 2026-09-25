import {
  CreateRoomResponse,
  JoinPlayerResponse,
  RoomInfoResponse,
  ScreenLinkResponse,
  ScreenPairingResponse,
} from "../../packages/contracts/src/http";

export const SERVER_URL: string =
  (import.meta.env.VITE_GAME_SERVER_URL as string | undefined) ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:2567");

export class ApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

async function call(path: string, body?: unknown, token?: string) {
  let res: Response;
  try {
    res = await fetch(SERVER_URL + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? null : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("SERVER_UNREACHABLE", 0);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.error ?? "INTERNAL", res.status);
  return json;
}

export interface GlobalLeaderboardEntry {
  alias: string;
  bestScore: number;
  totalCorrect: number;
  gamesPlayed: number;
  gamesWon: number;
  lastPlayed: string;
}

export const api = {
  createRoom: async () => CreateRoomResponse.parse(await call("/api/rooms", {})),
  roomInfo: async (code: string) => RoomInfoResponse.parse(await call(`/api/rooms/${code}`)),
  screenPairing: async (code: string, hostToken: string) =>
    ScreenPairingResponse.parse(await call(`/api/rooms/${code}/screen-pairing`, {}, hostToken)),
  linkScreen: async (code: string, pairingCode: string) =>
    ScreenLinkResponse.parse(await call(`/api/rooms/${code}/screen`, { pairingCode })),
  joinPlayer: async (code: string, alias: string, playerToken?: string) =>
    JoinPlayerResponse.parse(await call(`/api/rooms/${code}/players`, { alias, playerToken })),
  leaderboard: async (): Promise<GlobalLeaderboardEntry[]> => {
    return (await call("/api/leaderboard")) as GlobalLeaderboardEntry[];
  },
};

export const ERROR_TEXT: Record<string, string> = {
  SERVER_UNREACHABLE: "No se puede conectar con el servidor de juego.",
  ROOM_NOT_FOUND: "No existe ninguna sala con ese código.",
  ROOM_FULL: "La sala está llena.",
  PAIRING_INVALID: "Código de vinculación incorrecto o caducado.",
  ALIAS_INVALID: "El alias debe tener entre 1 y 20 caracteres.",
  FORBIDDEN: "No tienes permiso para esta acción.",
  UNAUTHORIZED: "Sesión no válida.",
  RATE_LIMITED: "Demasiados intentos. Espera un momento.",
};
export const errorText = (e: unknown) =>
  e instanceof ApiError ? (ERROR_TEXT[e.code] ?? e.code) : e instanceof Error ? e.message : String(e);
