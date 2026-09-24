/** Puntos por primer acierto según la etapa de revelado vigente (1..N). */
export function pointsForStage(stage: number, table: readonly number[]): number {
  if (stage < 1 || table.length === 0) return 0;
  return table[Math.min(stage, table.length) - 1] ?? 0;
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
