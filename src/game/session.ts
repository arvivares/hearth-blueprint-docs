// Credenciales emitidas por el servidor, guardadas en este navegador para recuperar la sesión.
// No son datos de juego: el estado siempre viene del servidor.
export interface StoredSession {
  roomId: string;
  token: string;
  alias?: string;
  playerId?: string;
}

const key = (role: string, code: string) => `logos:${role}:${code.toUpperCase()}`;

export function loadSession(role: string, code: string): StoredSession | null {
  try {
    const raw = localStorage.getItem(key(role, code));
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}
export const saveSession = (role: string, code: string, s: StoredSession) =>
  localStorage.setItem(key(role, code), JSON.stringify(s));
export const clearSession = (role: string, code: string) => localStorage.removeItem(key(role, code));
