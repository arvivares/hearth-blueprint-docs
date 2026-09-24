/** Puntos por primer acierto según la etapa de revelado vigente (1..N). */
export function pointsForStage(stage: number, table: readonly number[]): number {
  if (stage < 1 || table.length === 0) return 0;
  return table[Math.min(stage, table.length) - 1] ?? 0;
}

/**
 * Puntuación dinámica con multiplicador de tiempo por segundo.
 * Cada segundo restante otorga un multiplicador de +0.10x sobre los puntos base de la etapa.
 * Quien adivina antes gana muchos más puntos gracias a la velocidad, lo que le da una
 * ventaja decisiva en la partida y en el podio global de mejores puntuaciones.
 *
 * Ejemplo con ronda de 15 segundos:
 * - Acierto en segundo 1 (14s restantes, etapa 1: 1000 pts base): 1.0 + 1.4 = x2.40 -> 2,400 pts
 * - Acierto en segundo 5 (10s restantes, etapa 2: 800 pts base):  1.0 + 1.0 = x2.00 -> 1,600 pts
 * - Acierto en segundo 10 (5s restantes, etapa 4: 400 pts base):  1.0 + 0.5 = x1.50 -> 600 pts
 * - Acierto en segundo 14 (1s restante, etapa 5: 200 pts base):   1.0 + 0.1 = x1.10 -> 220 pts
 */
export function calculateDynamicScore(
  stage: number,
  table: readonly number[],
  remainingMs: number,
): { points: number; basePoints: number; multiplier: number; remainingSec: number } {
  const basePoints = pointsForStage(stage, table);
  const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const multiplier = Number((1.0 + remainingSec * 0.1).toFixed(2));
  const points = Math.round(basePoints * multiplier);
  return { points, basePoints, multiplier, remainingSec };
}

export interface Standing {
  playerId: string;
  score: number;
  correctCount: number;
}

/**
 * Clasificación: puntuación total, después número de aciertos y, si persiste,
 * posición compartida (ranking de competición: 1, 2, 2, 4). No usa tiempos.
 * Orden secundario estable por playerId solo para presentar una lista determinista.
 */
export function computeRanking(players: readonly Standing[]): { playerId: string; rank: number }[] {
  const sorted = [...players].sort(
    (a, b) => b.score - a.score || b.correctCount - a.correctCount || a.playerId.localeCompare(b.playerId),
  );
  const out: { playerId: string; rank: number }[] = [];
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    const tied = prev && prev.score === p.score && prev.correctCount === p.correctCount;
    out.push({ playerId: p.playerId, rank: tied ? out[i - 1]!.rank : i + 1 });
  });
  return out;
}

/** Etapa de revelado según el tiempo transcurrido de la ronda. */
export function stageForElapsed(elapsedMs: number, roundMs: number, stages: number): number {
  if (stages <= 1) return 1;
  const per = roundMs / stages;
  return Math.max(1, Math.min(stages, 1 + Math.floor(elapsedMs / per)));
}
