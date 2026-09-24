/**
 * Normalización determinista de respuestas (sin IA ni coincidencia aproximada).
 * - Minúsculas.
 * - Sin acentos ni diacríticos.
 * - Se eliminan espacios, signos y símbolos: solo quedan letras y dígitos.
 * - "&" equivale a "y" / "and" solo si el catálogo lo define como alias.
 */
export function normalizeAnswer(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** Acierto si la forma normalizada coincide exactamente con la respuesta o con un alias. */
export function isCorrectAnswer(text: string, answer: string, aliases: readonly string[]): boolean {
  const n = normalizeAnswer(text);
  if (!n) return false;
  return [answer, ...aliases].some((a) => normalizeAnswer(a) === n);
}
