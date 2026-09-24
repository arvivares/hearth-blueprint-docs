/** Ajustes del proceso. `timeScale` < 1 acelera todos los tiempos (solo pruebas y simulación). */
export const settings = {
  timeScale: Number(process.env.GAME_TIME_SCALE ?? 1),
  countdownMs: 3000,
  resultsMs: 8000,
  prepareTimeoutMs: 15000,
  maxPauseMs: 10 * 60_000,
};

export const scaled = (ms: number) => Math.max(1, Math.round(ms * settings.timeScale));
