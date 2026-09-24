import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Play, Pause, FastForward, PowerOff, ShieldAlert, Monitor, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { PHASE_LABEL, serverErrorText } from "../labels";
import type { ConnectionStatus, RoomSnapshot } from "../useGameRoom";
import { Button, Card, ConnectionDot, RoomQR } from "../ui";

export interface HostViewProps {
  s: RoomSnapshot | null;
  code: string;
  joinUrl: string;
  connection: ConnectionStatus | "demo";
  connectionError: string | null;
  serverError: string | null;
  pairing: { code: string; expiresAt: number } | null;
  pairingError: string | null;
  onPair: () => void;
  onConfigure: (cfg: { rounds: number; roundSeconds: number; maxPlayers: number }) => void;
  onCommand: (type: "host:start" | "host:pause" | "host:resume" | "host:next" | "host:abort" | "host:reset") => void;
  onKick: (playerId: string) => void;
}

const ACTIVE = ["PREPARING", "COUNTDOWN", "ROUND_ACTIVE", "ROUND_RESULTS"];

/** Panel del anfitrión con estética minimalista Apple */
export function HostView(p: HostViewProps) {
  const s = p.s;
  const phase = s?.phase ?? "LOBBY";
  const players = s ? Object.entries(s.players) : [];
  const [cfg, setCfg] = useState({ rounds: 10, roundSeconds: 25, maxPlayers: 30 });

  useEffect(() => {
    if (s) setCfg({ rounds: s.totalRounds ?? 10, roundSeconds: s.roundSeconds ?? 25, maxPlayers: s.maxPlayers ?? 30 });
  }, [s?.totalRounds, s?.roundSeconds, s?.maxPlayers]);

  const can = {
    start: phase === "LOBBY" && !!s?.screenConnected && players.length > 0,
    pause: ACTIVE.includes(phase),
    resume: phase === "PAUSED",
    next: phase === "ROUND_ACTIVE" || phase === "ROUND_RESULTS",
    abort: phase !== "FINAL_RESULTS" && phase !== "ABORTED" && phase !== "LOBBY",
  };

  return (
    <div className="relative min-h-[100dvh] bg-[#000000] text-foreground select-none overflow-x-hidden selection:bg-white selection:text-black">
      {/* Luz ambiental sutil */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 h-[400px] w-full max-w-4xl apple-glow opacity-60" />

      <main className="relative z-10 mx-auto min-h-[100dvh] max-w-4xl space-y-6 px-4 py-8 sm:py-12">
        {/* Cabecera Minimalista */}
        <header className="flex items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-white transition active:scale-95 border border-white/[0.06]"
              title="Volver a la portada"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div>
              <span className="text-xs font-semibold tracking-tight text-zinc-500 block">
                Panel del Anfitrión
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Sala <span className="font-mono tracking-[0.15em] text-white">{p.code}</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full bg-white/[0.08] border border-white/[0.08] px-3.5 py-1 text-xs font-medium text-zinc-300">
              {PHASE_LABEL[phase] ?? phase}
            </span>
            <ConnectionDot status={p.connection} />
          </div>
        </header>

        {(p.connectionError || p.serverError) && (
          <p role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {p.connectionError ?? serverErrorText(p.serverError!)}
          </p>
        )}

        {/* Control Principal de la Partida */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-white">Control de la partida</h2>
            {!s?.screenConnected && phase === "LOBBY" && (
              <span className="text-xs text-amber-400">Vincula la pantalla TV antes de empezar</span>
            )}
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            <Button
              onClick={() => p.onCommand("host:start")}
              disabled={!can.start}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4 fill-black" />
              <span>Iniciar partida</span>
            </Button>

            <Button
              variant="ghost"
              onClick={() => p.onCommand("host:pause")}
              disabled={!can.pause}
              className="flex items-center gap-2"
            >
              <Pause className="h-4 w-4" />
              <span>Pausar</span>
            </Button>

            <Button
              variant="ghost"
              onClick={() => p.onCommand("host:resume")}
              disabled={!can.resume}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              <span>Reanudar</span>
            </Button>

            <Button
              variant="ghost"
              onClick={() => p.onCommand("host:next")}
              disabled={!can.next}
              className="flex items-center gap-2"
            >
              <FastForward className="h-4 w-4" />
              <span>{phase === "ROUND_ACTIVE" ? "Cerrar ronda" : "Siguiente"}</span>
            </Button>

            {(phase === "FINAL_RESULTS" || phase === "ABORTED") && (
              <Button onClick={() => p.onCommand("host:reset")}>Nueva partida</Button>
            )}

            <Button
              variant="danger"
              onClick={() => confirm("¿Interrumpir la partida?") && p.onCommand("host:abort")}
              disabled={!can.abort}
              className="ml-auto"
            >
              Interrumpir
            </Button>
          </div>
        </Card>

        {/* Configuración y Vinculación en 2 Columnas */}
        <div className="grid gap-5 md:grid-cols-2">
          {/* Ajustes de Partida */}
          <Card>
            <h2 className="text-lg font-semibold tracking-tight text-white">Configuración</h2>
            <form
              className="grid grid-cols-3 gap-3 pt-1"
              onSubmit={(e) => {
                e.preventDefault();
                p.onConfigure(cfg);
              }}
            >
              <NumberField label="Rondas" value={cfg.rounds} min={1} max={30} onChange={(v) => setCfg({ ...cfg, rounds: v })} disabled={phase !== "LOBBY"} />
              <NumberField label="Segundos" value={cfg.roundSeconds} min={10} max={120} onChange={(v) => setCfg({ ...cfg, roundSeconds: v })} disabled={phase !== "LOBBY"} />
              <NumberField label="Máx. jugadores" value={cfg.maxPlayers} min={1} max={50} onChange={(v) => setCfg({ ...cfg, maxPlayers: v })} disabled={phase !== "LOBBY"} />
              <Button type="submit" variant="ghost" className="col-span-3 mt-1" disabled={phase !== "LOBBY"}>
                Guardar cambios
              </Button>
            </form>
            <p className="text-[11px] text-zinc-500">Solo se puede modificar en la sala de espera.</p>
          </Card>

          {/* Vinculación de Pantalla TV */}
          <Card>
            <h2 className="text-lg font-semibold tracking-tight text-white">Vincular pantalla TV</h2>
            <div className="flex items-start gap-4 pt-1">
              <RoomQR url={p.joinUrl} size={100} className="p-1 rounded-2xl shrink-0" />
              <div className="min-w-0 flex-1 space-y-2 text-xs">
                <p className="text-zinc-400">
                  Pantalla TV: <strong className={s?.screenConnected ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
                    {s?.screenConnected ? "Vinculada" : "Sin vincular"}
                  </strong>
                </p>
                <p className="text-zinc-500 leading-relaxed">
                  En la televisión abre <strong className="text-zinc-300">/tv</strong> e introduce el código de sala y el de vinculación.
                </p>
                <Button variant="ghost" size="md" onClick={p.onPair} className="w-full text-xs">
                  Generar código de vinculación
                </Button>
                {p.pairing && (
                  <div className="rounded-xl bg-white/[0.04] p-3 text-center border border-white/[0.06]">
                    <span className="block text-[10px] uppercase tracking-wider text-zinc-500">Código de TV</span>
                    <strong data-testid="pairing-code" className="font-mono text-2xl tracking-[0.25em] text-white">
                      {p.pairing.code}
                    </strong>
                    <span className="block text-[10px] text-zinc-500 mt-0.5">
                      Válido hasta las {new Date(p.pairing.expiresAt).toLocaleTimeString()}
                    </span>
                  </div>
                )}
                {p.pairingError && <p className="text-red-400 text-xs">{p.pairingError}</p>}
              </div>
            </div>
          </Card>
        </div>

        {/* Lista de Participantes */}
        <Card>
          <div className="flex items-baseline justify-between border-b border-white/[0.08] pb-3">
            <h2 className="text-lg font-semibold tracking-tight text-white">Jugadores en la sala</h2>
            <span className="font-mono text-xs text-zinc-400">
              <strong className="text-white">{players.length}</strong>/{s?.maxPlayers ?? "–"}
            </span>
          </div>

          <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] overflow-hidden" data-testid="participants">
            {players.length === 0 && (
              <li className="p-4 text-center text-xs text-zinc-500">
                Ningún jugador conectado todavía. Comparte el código de sala o el QR para empezar.
              </li>
            )}
            {players.map(([id, pl]) => (
              <li key={id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 p-3.5 text-sm apple-glass-subtle">
                <span className={cn("truncate font-medium text-white", !pl.connected && "opacity-40")}>
                  {pl.alias} {!pl.connected && <span className="text-xs text-zinc-500">(desconectado)</span>}
                  {pl.waiting && <span className="text-xs text-zinc-500"> (espera)</span>}
                </span>
                <span className="font-mono tabular-nums text-xs text-zinc-400 mr-2">{pl.score} pts</span>
                <button
                  type="button"
                  className="text-xs text-red-400 hover:text-red-300 transition underline underline-offset-2"
                  onClick={() => p.onKick(id)}
                >
                  Expulsar
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </main>
    </div>
  );
}

function NumberField(props: { label: string; value: number; min: number; max: number; disabled: boolean; onChange: (v: number) => void }) {
  return (
    <label className="space-y-1 text-xs font-medium text-zinc-400 block">
      <span>{props.label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={props.value}
        min={props.min}
        max={props.max}
        disabled={props.disabled}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="w-full rounded-xl bg-white/[0.04] border border-white/[0.1] px-3 py-2 font-mono text-base text-white outline-none focus:border-white/30 focus:bg-white/[0.08] disabled:opacity-40"
      />
    </label>
  );
}
