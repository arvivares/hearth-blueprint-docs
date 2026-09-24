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
export function saveSession(role: string, code: string, s: StoredSession): void {
  try {
    localStorage.setItem(key(role, code), JSON.stringify(s));
  } catch (e) {
    console.warn("No se pudo guardar la sesión:", e);
  }
}

export function clearSession(role: string, code: string): void {
  try {
    localStorage.removeItem(key(role, code));
  } catch (e) {
    console.warn("No se pudo limpiar la sesión:", e);
  }
}

/** Generador seguro de UUID v4 compatible con navegadores antiguos y WebView */
export function safeUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {}
  }
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c: any) =>
    (
      c ^
      ((typeof crypto !== "undefined" && crypto.getRandomValues
        ? crypto.getRandomValues(new Uint8Array(1))[0]
        : Math.floor(Math.random() * 256)) &
        (15 >> (c / 4)))
    ).toString(16),
  );
}


