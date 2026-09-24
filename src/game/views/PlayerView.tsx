import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ATTEMPT_TEXT, PHASE_LABEL, formatSeconds, serverErrorText } from "../labels";
import type { AttemptResult, ConnectionStatus, RoomSnapshot } from "../useGameRoom";
import { ConnectionDot } from "../ui";

export interface PlayerViewProps {
  s: RoomSnapshot | null;
  playerId: string;
  alias: string;
  connection: ConnectionStatus | "demo";
  connectionError: string | null;
  remainingMs: number | null;
  lastResult: AttemptResult | null;
  pending: boolean;
  errorCode: string | null;
  onSubmit: (text: string) => void;
  fill?: boolean;
}

/**
 * Mando del jugador (móvil vertical) con diseño minimalista estilo Apple.
 */
export function PlayerView(p: PlayerViewProps) {
  const me = p.s?.players[p.playerId];
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const phase = p.s?.phase ?? "LOBBY";
  const canAnswer = phase === "ROUND_ACTIVE" && !!me && !me.answeredThisRound && !me.waiting && (p.connection === "connected" || p.connection === "demo");
  const result = p.lastResult && p.lastResult.roundId === p.s?.roundId ? p.lastResult : null;
  const feedback = result ? ATTEMPT_TEXT[result.status] : null;

  // Limpiar el campo tras una respuesta procesada por el servidor
  useEffect(() => {
    if (result) setText("");
  }, [result?.attemptId]);

  return (
    <div className={cn("flex flex-col bg-[#000000] text-foreground select-none relative", p.fill ? "h-full" : "h-[100dvh]")}>
      {/* Cabecera estilo iOS */}
      <header className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-5 pb-3.5 pt-[max(0.85rem,env(safe-area-inset-top))] bg-black/40 backdrop-blur-xl shrink-0">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-white tracking-tight" data-testid="my-alias">
            {p.alias}
          </p>
          <ConnectionDot status={p.connection} />
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-white" data-testid="my-score">
            {me?.score ?? 0}
          </p>
          <p className="text-[11px] text-zinc-500 font-medium">puntos · {me?.correctCount ?? 0} aciertos</p>
        </div>
      </header>

      {/* Área central interactiva */}
      <main className="flex min-h-0 flex-1 flex-col justify-center gap-4 overflow-y-auto px-5 py-6 text-center relative z-10">
        {p.connectionError && (
          <p role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-300">
            {p.connectionError}
          </p>
        )}

        <div className="space-y-3">
          <span className="inline-block rounded-full bg-white/[0.06] border border-white/[0.08] px-3.5 py-1 text-xs font-medium text-zinc-400">
            {PHASE_LABEL[phase] ?? phase}
          </span>

          {phase === "ROUND_ACTIVE" && (
            <p className="font-mono text-6xl sm:text-7xl font-bold tabular-nums text-white tracking-tight">
              {formatSeconds(p.remainingMs)}
            </p>
          )}

          <StatusMessage phase={phase} answered={!!me?.answeredThisRound} waiting={!!me?.waiting} />
        </div>
      </main>

      {/* Pie de página con teclado / formulario de respuesta */}
      <footer className="space-y-3 border-t border-white/[0.08] bg-black/80 backdrop-blur-2xl px-5 pb-[max(1.2rem,env(safe-area-inset-bottom))] pt-4 shrink-0">
        <div aria-live="polite" className="min-h-6">
          {p.pending && (
            <p className="text-center text-xs text-zinc-400 animate-pulse">
              Comprobando respuesta…
            </p>
          )}

          {!p.pending && feedback && (
            <div
              data-testid="attempt-feedback"
              className={cn(
                "rounded-2xl px-4 py-3 text-center text-sm font-semibold transition-all",
                feedback.tone === "success" && "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300",
                feedback.tone === "error" && "bg-red-500/15 border border-red-500/30 text-red-300",
                feedback.tone === "info" && "bg-white/[0.06] border border-white/[0.08] text-zinc-300",
              )}
            >
              {feedback.title}
              {result?.status === "correct" && result.points !== undefined && ` · +${result.points} pts`}
            </div>
          )}

          {!p.pending && !feedback && p.errorCode && (
            <p className="rounded-2xl bg-white/[0.06] border border-white/[0.08] px-4 py-3 text-center text-xs text-zinc-300">
              {serverErrorText(p.errorCode)}
            </p>
          )}
        </div>

        {!me?.answeredThisRound && (
          <form
            className="flex flex-col gap-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              const t = text.trim();
              if (!t || !canAnswer || p.pending) return;
              p.onSubmit(t);
              inputRef.current?.focus();
            }}
          >
            <input
              ref={inputRef}
              aria-label="Tu respuesta"
              placeholder={canAnswer ? "¿Qué empresa es?" : "Espera a la siguiente ronda"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={60}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
              enterKeyHint="send"
              disabled={!canAnswer}
              className="w-full rounded-2xl bg-white/[0.06] border border-white/[0.1] px-5 py-3.5 text-lg text-white placeholder:text-zinc-600 outline-none transition focus:border-white/30 focus:bg-white/[0.08] focus:ring-4 focus:ring-white/[0.04] disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={!canAnswer || p.pending || !text.trim()}
              className="w-full rounded-2xl bg-white px-5 py-3.5 font-semibold text-black text-base transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-white/5"
            >
              Enviar respuesta
            </button>
          </form>
        )}
      </footer>
    </div>
  );
}

function StatusMessage({ phase, answered, waiting }: { phase: string; answered: boolean; waiting: boolean }) {
  if (waiting) return <p className="text-sm text-zinc-400">La partida ya ha empezado. Entrarás en la siguiente ronda.</p>;
  if (answered) return <p className="text-xl font-bold text-emerald-400">¡Acertaste! Espera a la siguiente ronda.</p>;

  const text: Record<string, string> = {
    LOBBY: "Estás dentro. Mira la televisión: la partida empieza enseguida.",
    PREPARING: "Preparando el siguiente logo…",
    COUNTDOWN: "¡Prepárate!",
    ROUND_ACTIVE: "Mira la pantalla y escribe el nombre de la empresa.",
    ROUND_RESULTS: "Mira la solución en la pantalla.",
    FINAL_RESULTS: "¡Fin de la partida! Mira la clasificación en la pantalla.",
    PAUSED: "Partida en pausa.",
    ABORTED: "La partida se ha interrumpido.",
  };

  return <p className="text-sm sm:text-base text-zinc-300 max-w-xs mx-auto leading-relaxed">{text[phase] ?? ""}</p>;
}
