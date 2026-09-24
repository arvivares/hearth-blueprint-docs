import { Play, Pause, FastForward, Smartphone, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { PHASE_LABEL, formatSeconds } from "../labels";
import type { ConnectionStatus, RoomSnapshot } from "../useGameRoom";
import { ConnectionDot, RoomQR } from "../ui";

export interface HostControls {
  canStart: boolean;
  playerCount: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onNext: () => void;
  onAbort: () => void;
  onReset: () => void;
}

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
  /** Controles del anfitrión si esta pantalla fue creada por el anfitrión */
  host?: HostControls;
}

/** Pantalla compartida principal (TV 16:9) con diseño minimalista estilo Apple */
export function TvView({
  s,
  code,
  joinUrl,
  joinHost,
  remainingMs,
  mediaSrc,
  revealAnswer,
  connection,
  fill,
  host,
}: TvViewProps) {
  const players = Object.entries(s.players);
  const inLobby = s.phase === "LOBBY";

  return (
    <div className={cn("grid grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-[#000000] text-foreground select-none relative", fill ? "h-full" : "h-[100dvh]")}>
      {/* Luz ambiental superior */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[350px] w-full max-w-5xl apple-glow opacity-50" />

      {/* Cabecera Minimalista */}
      <header className="relative z-10 flex items-center justify-between gap-6 border-b border-white/[0.08] px-[3vw] py-[1.8vh] bg-black/40 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-5">
          <span className="text-[2.2vw] font-bold tracking-tight text-white">
            PeekRush<span className="text-zinc-500">.</span>
          </span>

          <span className="rounded-full bg-white/[0.08] border border-white/[0.08] px-3.5 py-1 text-[1.1vw] font-medium text-zinc-300">
            {PHASE_LABEL[s.phase] ?? s.phase}
          </span>

          {!inLobby && s.totalRounds > 0 && (
            <span className="font-mono text-[1.1vw] text-zinc-400">
              Ronda {Math.min(s.roundIndex + 1, s.totalRounds)} de {s.totalRounds}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-5">
          {/* Controles de anfitrión durante la partida */}
          {host && !inLobby && (
            <div className="flex items-center gap-2 mr-2">
              {s.phase === "ROUND_ACTIVE" && (
                <>
                  <button
                    type="button"
                    onClick={host.onPause}
                    className="flex items-center gap-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] px-3.5 py-1.5 text-[0.9vw] font-semibold text-white transition active:scale-95"
                    title="Pausar el juego"
                  >
                    <Pause className="h-[0.9vw] w-[0.9vw]" />
                    <span>Pausar</span>
                  </button>
                  <button
                    type="button"
                    onClick={host.onNext}
                    className="flex items-center gap-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] px-3.5 py-1.5 text-[0.9vw] font-semibold text-white transition active:scale-95"
                    title="Cerrar ronda actual"
                  >
                    <FastForward className="h-[0.9vw] w-[0.9vw]" />
                    <span>Cerrar ronda</span>
                  </button>
                </>
              )}
              {s.phase === "PAUSED" && (
                <button
                  type="button"
                  onClick={host.onResume}
                  className="flex items-center gap-1.5 rounded-full bg-white text-black px-4 py-1.5 text-[0.9vw] font-semibold transition active:scale-95 shadow-sm"
                >
                  <Play className="h-[0.9vw] w-[0.9vw] fill-black" />
                  <span>Reanudar</span>
                </button>
              )}
              {s.phase === "ROUND_RESULTS" && (
                <button
                  type="button"
                  onClick={host.onNext}
                  className="flex items-center gap-1.5 rounded-full bg-white text-black px-4 py-1.5 text-[0.9vw] font-semibold transition active:scale-95 shadow-sm"
                >
                  <FastForward className="h-[0.9vw] w-[0.9vw] fill-black" />
                  <span>Siguiente ronda</span>
                </button>
              )}
              {(s.phase === "FINAL_RESULTS" || s.phase === "ABORTED") && (
                <button
                  type="button"
                  onClick={host.onReset}
                  className="flex items-center gap-1.5 rounded-full bg-white text-black px-4 py-1.5 text-[0.9vw] font-semibold transition active:scale-95 shadow-sm"
                >
                  <RotateCcw className="h-[0.9vw] w-[0.9vw]" />
                  <span>Nueva partida</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => confirm("¿Interrumpir partida?") && host.onAbort()}
                className="flex items-center gap-1 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-1.5 text-[0.85vw] font-medium text-red-300 transition active:scale-95"
              >
                Interrumpir
              </button>
            </div>
          )}

          <span className="text-[1.1vw] text-zinc-400">
            Código <strong className="font-mono text-[1.6vw] font-bold tracking-[0.2em] text-white ml-1">{code}</strong>
          </span>
          <ConnectionDot status={connection} />
        </div>
      </header>

      {inLobby ? (
        /* VISTA DE LOBBY / ESPERA */
        <main className="relative z-10 grid min-h-0 grid-cols-[auto_minmax(0,1fr)] gap-[3.5vw] p-[3vw]">
          <section className="flex flex-col items-center justify-center gap-[2.5vh]">
            <RoomQR url={joinUrl} size={480} className="!w-[min(48vh,30vw)] shadow-2xl rounded-3xl" />
            <div className="text-center space-y-1">
              <p className="text-[1.3vw] text-zinc-400">
                Escanea el código QR o entra en <strong className="text-white font-semibold">{joinHost}/play</strong>
              </p>
              <p className="font-mono text-[5vw] font-bold leading-none tracking-[0.2em] text-white pt-1">{code}</p>
            </div>
          </section>

          <section className="flex min-h-0 flex-col gap-[2vh]">
            <div className="flex items-baseline justify-between border-b border-white/[0.08] pb-3">
              <h2 className="text-[2vw] font-bold tracking-tight text-white">Jugadores conectados</h2>
              <span className="font-mono text-[1.6vw] text-zinc-400">
                <strong className="text-white">{players.length}</strong>/{s.maxPlayers}
              </span>
            </div>

            <ScreenStatus s={s} />

            <ul className="grid min-h-0 auto-rows-min grid-cols-2 lg:grid-cols-3 gap-[1vw] overflow-y-auto" data-testid="participants">
              {players.length === 0 && (
                <li className="col-span-full py-12 text-center text-[1.4vw] text-zinc-500">
                  Esperando a que los jugadores se unan con sus móviles…
                </li>
              )}
              {players.map(([id, p]) => (
                <li
                  key={id}
                  className={cn(
                    "truncate rounded-2xl apple-glass px-[1.2vw] py-[1.2vh] text-[1.3vw] font-semibold text-white border border-white/[0.08] shadow-sm transition",
                    !p.connected && "opacity-40",
                  )}
                >
                  {p.alias}
                </li>
              ))}
            </ul>

            {/* Controles de anfitrión en la sala de espera */}
            {host && (
              <div className="mt-auto pt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={host.onStart}
                  disabled={!host.canStart}
                  className={cn(
                    "inline-flex items-center justify-center gap-2.5 rounded-2xl px-8 py-3.5 font-bold text-[1.2vw] transition-all shadow-lg",
                    host.canStart
                      ? "bg-white text-black hover:bg-zinc-200 active:scale-95 shadow-white/10"
                      : "bg-white/[0.08] text-zinc-500 cursor-not-allowed border border-white/[0.08]",
                  )}
                >
                  <Play className={cn("h-[1.2vw] w-[1.2vw]", host.canStart ? "fill-black" : "fill-zinc-500")} />
                  <span>{host.canStart ? "Iniciar partida" : "Esperando al menos 1 jugador…"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.open(joinUrl, "_blank")}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] px-5 py-3.5 font-medium text-zinc-300 hover:text-white text-[1.05vw] transition active:scale-95"
                  title="Abrir el mando móvil en una nueva pestaña para unirte tú también"
                >
                  <Smartphone className="h-[1.1vw] w-[1.1vw]" />
                  <span>Jugar desde esta máquina</span>
                </button>
              </div>
            )}
          </section>
        </main>
      ) : (
        /* VISTA DE RONDA ACTIVA / RESULTADOS */
        <main className="relative z-10 grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(20rem,25vw)] gap-[2vw] p-[2.5vw]">
          <section className="relative flex min-h-0 flex-col gap-[2vh]">
            {/* Contenedor del logotipo estilo vitrina de museo Apple */}
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-3xl apple-glass border border-white/[0.08] shadow-2xl p-[3vw]">
              {mediaSrc ? (
                <img
                  src={mediaSrc}
                  alt="Logo parcialmente revelado"
                  className="max-h-full max-w-full object-contain transition-all duration-300 drop-shadow-2xl"
                />
              ) : (
                <p className="text-[1.8vw] font-medium text-zinc-500">
                  {s.phase === "PAUSED" ? "En pausa" : "Preparando logo…"}
                </p>
              )}

              {/* Banner de respuesta descubierta */}
              {revealAnswer && (
                <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-white text-black py-[1.6vh] text-center font-display text-[2.8vw] font-bold shadow-2xl transition-all">
                  {revealAnswer}
                </div>
              )}
            </div>

            {/* Barra inferior de etapa y temporizador */}
            <div className="flex items-center justify-between px-2">
              <StageDots stage={s.revealStage} total={s.totalStages} />
              <Timer remainingMs={remainingMs} phase={s.phase} />
            </div>
          </section>

          {/* Columna lateral: Clasificación en vivo */}
          <aside className="flex min-h-0 flex-col gap-[2vh]">
            <Ranking s={s} />

            <div className="mt-auto flex items-center gap-[1vw] rounded-2xl apple-glass p-[1vw] border border-white/[0.08]">
              <RoomQR url={joinUrl} size={84} className="p-1 rounded-xl shrink-0" />
              <p className="text-[0.95vw] text-zinc-400 leading-snug">
                ¿Llegas tarde? Escanea para unirte en la próxima ronda
              </p>
            </div>
          </aside>
        </main>
      )}
    </div>
  );
}

function ScreenStatus({ s }: { s: RoomSnapshot }) {
  return (
    <p className="text-[1.05vw] text-zinc-500">
      Anfitrión {s.hostConnected ? "conectado" : "desconectado"} · Pantalla {s.screenConnected ? "vinculada" : "sin vincular"}
    </p>
  );
}

function StageDots({ stage, total }: { stage: number; total: number }) {
  if (!total) return <span />;
  return (
    <div className="flex items-center gap-[0.5vw]" aria-label={`Etapa ${stage} de ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-[0.8vw] w-[2.8vw] rounded-full transition-all duration-300",
            i < stage ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]" : "bg-white/[0.12]",
          )}
        />
      ))}
    </div>
  );
}

function Timer({ remainingMs, phase }: { remainingMs: number | null; phase: string }) {
  if (remainingMs === null) return <span />;
  const urgent = remainingMs <= 5000 && phase === "ROUND_ACTIVE";
  return (
    <div
      className={cn(
        "font-mono text-[4.5vw] font-bold leading-none tabular-nums transition-colors",
        urgent ? "text-red-400" : "text-white",
      )}
      aria-live="off"
    >
      {formatSeconds(remainingMs)}
      <span className="ml-1 text-[1.4vw] font-normal text-zinc-500">s</span>
    </div>
  );
}

function Ranking({ s }: { s: RoomSnapshot }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[1.2vh]">
      <h2 className="text-[1.6vw] font-bold tracking-tight text-white border-b border-white/[0.08] pb-2">
        Clasificación
      </h2>
      {s.ranking.length === 0 ? (
        <p className="text-[1.1vw] text-zinc-500">Aparecerá al cerrar la primera ronda.</p>
      ) : (
        <ol className="min-h-0 space-y-[0.6vh] overflow-y-auto" data-testid="ranking">
          {s.ranking.slice(0, 8).map((r) => {
            const p = s.players[r.playerId];
            if (!p) return null;
            const isFirst = r.rank === 1;
            return (
              <li
                key={r.playerId}
                className={cn(
                  "grid grid-cols-[2.5vw_minmax(0,1fr)_auto] items-center rounded-2xl px-[1.2vw] py-[0.9vh] text-[1.2vw] font-medium transition",
                  isFirst
                    ? "bg-white text-black font-bold shadow-md"
                    : "apple-glass text-white border border-white/[0.06]",
                )}
              >
                <span className="font-mono text-[1.1vw]">{r.rank}</span>
                <span className="truncate">{p.alias}</span>
                <span className="font-mono tabular-nums text-[1.1vw]">{p.score}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
