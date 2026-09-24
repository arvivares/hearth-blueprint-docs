import { randomBytes } from "node:crypto";
import type { Db } from "./db/pool";
/** Ajustes del proceso. `timeScale` < 1 acelera todos los tiempos (solo pruebas y simulación). */
export const settings = {
  db: null as Db | null,
  timeScale: Number(process.env.GAME_TIME_SCALE ?? 1),
  countdownMs: 3000,
  resultsMs: 8000,
  prepareTimeoutMs: 15000,
  maxPauseMs: 10 * 60_000,
  /** Clave por proceso: solo el endpoint HTTP puede crear salas (bloquea /matchmake/create). */
  internalRoomKey: randomBytes(24).toString("hex"),
};

export const scaled = (ms: number) => Math.max(1, Math.round(ms * settings.timeScale));
