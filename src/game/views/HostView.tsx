import { useEffect, useState } from "react";
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
  onCommand: (type: "host:start" | "host:pause" | "host:resume" | "host:next" | "host:abort") => void;
  onKick: (playerId: string) => void;
}

const ACTIVE = ["PREPARING", "COUNTDOWN", "ROUND_ACTIVE", "ROUND_RESULTS"];

/** Panel del anfitrión. La disponibilidad de botones refleja la fase del servidor; el servidor valida igualmente. */
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
    <main className="mx-auto min-h-[100dvh] max-w-5xl space-y-5 px-4 py-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Panel del anfitrión</p>
          <h1 className="truncate font-display text-3xl font-extrabold">
            Sala <span className="font-mono tracking-[0.15em] text-primary">{p.code}</span>
          </h1>
        </div>
        <div className="text-right">
          <p className="font-semibold">{PHASE_LABEL[phase] ?? phase}</p>
          <ConnectionDot status={p.connection} />
        </div>
      </header>

      {(p.connectionError || p.serverError) && (
        <p role="alert" className="rounded-xl border border-destructive/60 bg-destructive/10 p-3 text-sm">
          {p.connectionError ?? serverErrorText(p.serverError!)}
        </p>
      )}

      <Card>
        <h2 className="font-display text-xl font-bold">Control de la partida</h2>
        {!s?.screenConnected && phase === "LOBBY" && <p className="text-sm text-muted-foreground">Vincula la pantalla antes de empezar.</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => p.onCommand("host:start")} disabled={!can.start}>Iniciar partida</Button>
          <Button variant="ghost" onClick={() => p.onCommand("host:pause")} disabled={!can.pause}>Pausar</Button>
          <Button variant="ghost" onClick={() => p.onCommand("host:resume")} disabled={!can.resume}>Reanudar</Button>
          <Button variant="ghost" onClick={() => p.onCommand("host:next")} disabled={!can.next}>Siguiente</Button>
          <Button variant="danger" onClick={() => confirm("¿Interrumpir la partida?") && p.onCommand("host:abort")} disabled={!can.abort}>Interrumpir</Button>
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl font-bold">Configuración</h2>
          <form
            className="grid grid-cols-3 gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              p.onConfigure(cfg);
            }}
          >
            <NumberField label="Rondas" value={cfg.rounds} min={1} max={30} onChange={(v) => setCfg({ ...cfg, rounds: v })} disabled={phase !== "LOBBY"} />
            <NumberField label="Segundos" value={cfg.roundSeconds} min={10} max={120} onChange={(v) => setCfg({ ...cfg, roundSeconds: v })} disabled={phase !== "LOBBY"} />
            <NumberField label="Máx. jugadores" value={cfg.maxPlayers} min={1} max={50} onChange={(v) => setCfg({ ...cfg, maxPlayers: v })} disabled={phase !== "LOBBY"} />
            <Button type="submit" variant="ghost" className="col-span-3" disabled={phase !== "LOBBY"}>Guardar configuración</Button>
          </form>
          <p className="text-xs text-muted-foreground">Solo se puede cambiar en la sala de espera. El servidor valida los valores.</p>
        </Card>

        <Card>
          <h2 className="font-display text-xl font-bold">Pantalla y entrada</h2>
          <div className="flex items-start gap-4">
            <RoomQR url={p.joinUrl} size={112} className="p-2" />
            <div className="min-w-0 space-y-2 text-sm">
              <p>Pantalla: <strong className={s?.screenConnected ? "text-success" : "text-accent"}>{s?.screenConnected ? "vinculada" : "sin vincular"}</strong></p>
              <p className="text-muted-foreground">En la TV abre <strong className="text-foreground">/tv</strong> e introduce el código de sala y el de vinculación.</p>
              <Button variant="ghost" onClick={p.onPair}>Generar código de vinculación</Button>
              {p.pairing && (
                <p>
                  <strong data-testid="pairing-code" className="font-mono text-2xl tracking-[0.2em] text-primary">{p.pairing.code}</strong>
                  <span className="block text-xs text-muted-foreground">Un solo uso · caduca a las {new Date(p.pairing.expiresAt).toLocaleTimeString()}</span>
                </p>
              )}
              {p.pairingError && <p className="text-destructive">{p.pairingError}</p>}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold">Participantes</h2>
          <span className="font-mono text-sm text-muted-foreground">{players.length}/{s?.maxPlayers ?? "–"}</span>
        </div>
        <ul className="divide-y rounded-xl border" data-testid="participants">
          {players.length === 0 && <li className="p-3 text-sm text-muted-foreground">Nadie todavía.</li>}
          {players.map(([id, pl]) => (
            <li key={id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 p-3 text-sm">
              <span className={cn("truncate font-semibold", !pl.connected && "opacity-50")}>
                {pl.alias} {!pl.connected && <span className="font-normal text-muted-foreground">(desconectado)</span>}
                {pl.waiting && <span className="font-normal text-muted-foreground"> (espera)</span>}
              </span>
              <span className="font-mono tabular-nums">{pl.score}</span>
              <button className="text-xs text-destructive underline" onClick={() => p.onKick(id)}>Expulsar</button>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}

function NumberField(props: { label: string; value: number; min: number; max: number; disabled: boolean; onChange: (v: number) => void }) {
  return (
    <label className="space-y-1 text-xs font-semibold text-muted-foreground">
      {props.label}
      <input
        type="number"
        inputMode="numeric"
        value={props.value}
        min={props.min}
        max={props.max}
        disabled={props.disabled}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-base text-foreground disabled:opacity-50"
      />
    </label>
  );
}
