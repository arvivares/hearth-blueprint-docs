import { cn } from "@/lib/utils";
import { PHASE_LABEL, formatSeconds } from "../labels";
import type { ConnectionStatus, RoomSnapshot } from "../useGameRoom";
import { ConnectionDot, RoomQR } from "../ui";

export interface TvViewProps {
  s: RoomSnapshot;
  code: string;
  joinUrl: string;
  joinHost: string;
  remainingMs: number | null;
  mediaSrc: string | null;
  revealAnswer: string | null;
  connection: ConnectionStatus | "demo";
  /** Ocupa el contenedor en lugar de toda la ventana (usado en /demo). */
  fill?: boolean;
}

/** Pantalla compartida, pensada para TV horizontal (16:9) y lectura a distancia. */
export function TvView({ s, code, joinUrl, joinHost, remainingMs, mediaSrc, revealAnswer, connection, fill }: TvViewProps) {
  const players = Object.entries(s.players);
  const inLobby = s.phase === "LOBBY";
  return (
    <div className={cn("grid grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-background text-foreground", fill ? "h-full" : "h-[100dvh]")} >
      <header className="flex items-center justify-between gap-6 border-b px-[3vw] py-[1.5vh]">
        <div className="flex min-w-0 items-baseline gap-6">
          <span className="font-display text-[2.4vw] font-extrabold tracking-tight text-primary">LOGOS</span>
          <span className="truncate text-[1.4vw] font-semibold">{PHASE_LABEL[s.phase] ?? s.phase}</span>
          {!inLobby && s.totalRounds > 0 && (
            <span className="font-mono text-[1.3vw] text-muted-foreground">
              Ronda {Math.min(s.roundIndex + 1, s.totalRounds)}/{s.totalRounds}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-6">
          <span className="text-[1.1vw] text-muted-foreground">
            Código <strong className="font-mono text-[1.8vw] tracking-[0.2em] text-foreground">{code}</strong>
          </span>
          <ConnectionDot status={connection} />
        </div>
      </header>

      {inLobby ? (
        <main className="grid min-h-0 grid-cols-[auto_minmax(0,1fr)] gap-[3vw] p-[3vw]">
          <section className="flex flex-col items-center justify-center gap-[2vh]">
            <RoomQR url={joinUrl} size={480} className="!w-[min(52vh,34vw)] shadow-glow" />
            <p className="text-center text-[1.4vw] text-muted-foreground">
              Escanea o entra en <strong className="text-foreground">{joinHost}/play</strong>
            </p>
            <p className="font-mono text-[6vw] font-bold leading-none tracking-[0.18em] text-primary">{code}</p>
          </section>
          <section className="flex min-h-0 flex-col gap-[2vh]">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-[2.2vw] font-extrabold">Jugadores</h2>
              <span className="font-mono text-[1.8vw]">
                {players.length}<span className="text-muted-foreground">/{s.maxPlayers}</span>
              </span>
            </div>
            <ScreenStatus s={s} />
            <ul className="grid min-h-0 auto-rows-min grid-cols-3 gap-[1vw] overflow-hidden" data-testid="participants">
              {players.length === 0 && <li className="col-span-3 text-[1.4vw] text-muted-foreground">Esperando al primer jugador…</li>}
              {players.map(([id, p]) => (
                <li key={id} className={cn("truncate rounded-xl border bg-card px-[1vw] py-[1vh] text-[1.4vw] font-semibold", !p.connected && "opacity-40")}>
                  {p.alias}
                </li>
              ))}
            </ul>
          </section>
        </main>
      ) : (
        <main className="grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(20rem,26vw)] gap-[2vw] p-[2.5vw]">
          <section className="relative flex min-h-0 flex-col gap-[2vh]">
            <div className="bg-stripes relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-3xl border bg-card">
              {mediaSrc ? (
                <img src={mediaSrc} alt="Logo parcialmente revelado" className="max-h-full max-w-full object-contain p-[3vw]" />
              ) : (
                <p className="text-[2vw] font-semibold text-muted-foreground">{s.phase === "PAUSED" ? "En pausa" : "Imagen oculta"}</p>
              )}
              {revealAnswer && (
                <div className="absolute inset-x-0 bottom-0 bg-primary py-[2vh] text-center font-display text-[3.5vw] font-extrabold text-primary-foreground">
                  {revealAnswer}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <StageDots stage={s.revealStage} total={s.totalStages} />
              <Timer remainingMs={remainingMs} phase={s.phase} />
            </div>
          </section>
          <aside className="flex min-h-0 flex-col gap-[2vh]">
            <Ranking s={s} />
            <div className="mt-auto flex items-center gap-[1vw] rounded-2xl border bg-card p-[1vw]">
              <RoomQR url={joinUrl} size={96} className="p-2" />
              <p className="text-[1vw] text-muted-foreground">Nuevos jugadores entran en la próxima partida</p>
            </div>
          </aside>
        </main>
      )}
    </div>
  );
}

function ScreenStatus({ s }: { s: RoomSnapshot }) {
  return (
    <p className="text-[1.1vw] text-muted-foreground">
      Anfitrión {s.hostConnected ? "conectado" : "desconectado"} · Pantalla {s.screenConnected ? "vinculada" : "sin vincular"}
    </p>
  );
}

function StageDots({ stage, total }: { stage: number; total: number }) {
  if (!total) return <span />;
  return (
    <div className="flex items-center gap-[0.6vw]" aria-label={`Etapa ${stage} de ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn("h-[1.2vw] w-[3vw] rounded-full", i < stage ? "bg-primary" : "bg-muted")} />
      ))}
    </div>
  );
}

function Timer({ remainingMs, phase }: { remainingMs: number | null; phase: string }) {
  const urgent = remainingMs !== null && remainingMs <= 5000 && phase === "ROUND_ACTIVE";
  return (
    <div className={cn("font-mono text-[5vw] font-bold leading-none tabular-nums", urgent ? "text-accent" : "text-foreground")} aria-live="off">
      {formatSeconds(remainingMs)}
      <span className="ml-1 text-[1.6vw] text-muted-foreground">s</span>
    </div>
  );
}

/** Muestra la clasificación tal como la calcula el servidor (rank incluido). */
function Ranking({ s }: { s: RoomSnapshot }) {
  return (
    <div className="flex min-h-0 flex-col gap-[1vh]">
      <h2 className="font-display text-[1.8vw] font-extrabold">Clasificación</h2>
      {s.ranking.length === 0 ? (
        <p className="text-[1.2vw] text-muted-foreground">Aparecerá al cerrar la primera ronda.</p>
      ) : (
        <ol className="min-h-0 space-y-[0.6vh] overflow-hidden" data-testid="ranking">
          {s.ranking.slice(0, 10).map((r) => {
            const p = s.players[r.playerId];
            if (!p) return null;
            return (
              <li key={r.playerId} className={cn("grid grid-cols-[3vw_minmax(0,1fr)_auto] items-center rounded-xl px-[1vw] py-[0.8vh] text-[1.3vw]", r.rank === 1 ? "bg-primary text-primary-foreground" : "bg-card")}>
                <span className="font-mono font-bold">{r.rank}</span>
                <span className="truncate font-semibold">{p.alias}</span>
                <span className="font-mono tabular-nums">{p.score}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
