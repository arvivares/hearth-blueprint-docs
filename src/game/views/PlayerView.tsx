import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ATTEMPT_TEXT, PHASE_LABEL, formatSeconds, serverErrorText } from "../labels";
import type { AttemptResult, ConnectionStatus, RoomSnapshot } from "../useGameRoom";
import { Button, ConnectionDot } from "../ui";

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
 * Mando del jugador (móvil vertical). La zona de envío va al final de un
 * contenedor de altura 100dvh: con `interactive-widget=resizes-content` el
 * teclado encoge el contenedor y el envío y la confirmación siguen visibles.
 */
export function PlayerView(p: PlayerViewProps) {
  const me = p.s?.players[p.playerId];
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const phase = p.s?.phase ?? "LOBBY";
  const canAnswer = phase === "ROUND_ACTIVE" && !!me && !me.answeredThisRound && !me.waiting && (p.connection === "connected" || p.connection === "demo");
  const result = p.lastResult && p.lastResult.roundId === p.s?.roundId ? p.lastResult : null;
  const feedback = result ? ATTEMPT_TEXT[result.status] : null;

  // Limpiar el campo tras una respuesta procesada por el servidor.
  useEffect(() => {
    if (result) setText("");
  }, [result?.attemptId]);

  return (
    <div className={cn("flex flex-col bg-background", p.fill ? "h-full" : "h-[100dvh]")}>
      <header className="flex items-center justify-between gap-3 border-b px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-extrabold" data-testid="my-alias">{p.alias}</p>
          <ConnectionDot status={p.connection} />
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-3xl font-bold tabular-nums text-primary" data-testid="my-score">{me?.score ?? 0}</p>
          <p className="text-xs text-muted-foreground">puntos · {me?.correctCount ?? 0} aciertos</p>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col justify-center gap-4 overflow-y-auto px-4 py-4 text-center">
        {p.connectionError && <p role="alert" className="rounded-xl border border-destructive/60 bg-destructive/10 p-3 text-sm">{p.connectionError}</p>}
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{PHASE_LABEL[phase] ?? phase}</p>
        {phase === "ROUND_ACTIVE" && (
          <p className="font-mono text-6xl font-bold tabular-nums">{formatSeconds(p.remainingMs)}</p>
        )}
        <StatusMessage phase={phase} answered={!!me?.answeredThisRound} waiting={!!me?.waiting} />
      </main>

      <footer className="space-y-3 border-t bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div aria-live="polite" className="min-h-6">
          {p.pending && <p className="text-center text-sm text-muted-foreground">Enviando…</p>}
          {!p.pending && feedback && (
            <p
              data-testid="attempt-feedback"
              className={cn(
                "rounded-xl px-4 py-3 text-center font-bold",
                feedback.tone === "success" && "bg-success text-success-foreground",
                feedback.tone === "error" && "bg-accent/20 text-foreground",
                feedback.tone === "info" && "bg-muted text-foreground",
              )}
            >
              {feedback.title}
              {result?.status === "correct" && result.points !== undefined && ` +${result.points}`}
            </p>
          )}
          {!p.pending && !feedback && p.errorCode && (
            <p className="rounded-xl bg-muted px-4 py-3 text-center text-sm">{serverErrorText(p.errorCode)}</p>
          )}
        </div>
        {!me?.answeredThisRound && (
          <form
            className="flex flex-col gap-3"
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
              placeholder={canAnswer ? "¿Qué empresa es?" : "Espera a que empiece la ronda"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={60}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
              enterKeyHint="send"
              disabled={!canAnswer}
              className="w-full rounded-xl border border-input bg-background px-4 py-4 text-xl outline-none focus:border-ring focus:ring-2 focus:ring-ring/40 disabled:opacity-50"
            />
            <Button type="submit" size="xl" disabled={!canAnswer || p.pending || !text.trim()}>
              Enviar respuesta
            </Button>
          </form>
        )}
      </footer>
    </div>
  );
}

function StatusMessage({ phase, answered, waiting }: { phase: string; answered: boolean; waiting: boolean }) {
  if (waiting) return <p className="text-xl">La partida ya ha empezado. Entrarás en la siguiente.</p>;
  if (answered) return <p className="font-display text-3xl font-extrabold text-success">¡Acertaste! Espera a la siguiente ronda.</p>;
  const text: Record<string, string> = {
    LOBBY: "Estás dentro. Mira la pantalla: la partida empieza enseguida.",
    PREPARING: "Preparando el siguiente logo…",
    COUNTDOWN: "¡Prepárate!",
    ROUND_ACTIVE: "Mira la pantalla y escribe el nombre de la empresa.",
    ROUND_RESULTS: "Mira la solución en la pantalla.",
    FINAL_RESULTS: "¡Fin de la partida! Mira la clasificación.",
    PAUSED: "Partida en pausa.",
    ABORTED: "La partida se ha interrumpido.",
  };
  return <p className="text-xl">{text[phase] ?? ""}</p>;
}
