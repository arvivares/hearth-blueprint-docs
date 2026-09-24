// Textos de presentación. Sin reglas de juego: solo traducen estados del servidor.
export const PHASE_LABEL: Record<string, string> = {
  LOBBY: "Sala de espera",
  PREPARING: "Preparando ronda",
  COUNTDOWN: "¡Atentos!",
  ROUND_ACTIVE: "Ronda en juego",
  ROUND_RESULTS: "Resultados de la ronda",
  FINAL_RESULTS: "Clasificación final",
  PAUSED: "Partida en pausa",
  ABORTED: "Partida interrumpida",
};

export const ATTEMPT_TEXT: Record<string, { title: string; tone: "success" | "error" | "info" }> = {
  correct: { title: "¡Correcto!", tone: "success" },
  incorrect: { title: "No es esa. Prueba otra vez.", tone: "error" },
  already_scored: { title: "Ya acertaste esta ronda.", tone: "info" },
  round_closed: { title: "La ronda ya ha terminado.", tone: "info" },
  rate_limited: { title: "Espera un momento antes de volver a intentarlo.", tone: "info" },
  duplicate: { title: "Respuesta ya recibida.", tone: "info" },
};

export const SERVER_ERROR_TEXT: Record<string, string> = {
  FORBIDDEN: "No tienes permiso para esta acción.",
  INVALID_PHASE: "El servidor no admite esta acción en la fase actual (el motor de rondas llega en la siguiente etapa).",
  INVALID_INPUT: "Datos no válidos.",
  RATE_LIMITED: "Demasiado rápido. Espera un momento.",
  ROUND_CLOSED: "La ronda ya ha terminado.",
  ALREADY_SCORED: "Ya acertaste esta ronda.",
};
export const serverErrorText = (code: string) => SERVER_ERROR_TEXT[code] ?? code;

export const formatSeconds = (ms: number | null) => (ms === null ? "--" : String(Math.ceil(ms / 1000)));
