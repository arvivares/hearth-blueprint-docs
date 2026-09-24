import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "colyseus.js";
import type { PublicPlayer, RankingEntry } from "../../packages/contracts/src/state";
import { SERVER_URL } from "./api";

export interface RoomSnapshot {
  phase: string;
  previousPhase: string;
  roomCode: string;
  maxPlayers: number;
  roundIndex: number;
  totalRounds: number;
  roundSeconds: number;
  roundId: string;
  revealStage: number;
  totalStages: number;
  phaseEndsAt: number;
  hostConnected: boolean;
  screenConnected: boolean;
  players: Record<string, PublicPlayer>;
  ranking: RankingEntry[];
}

export type ConnectionStatus = "idle" | "connecting" | "connected" | "closed" | "error";

export interface AttemptResult {
  attemptId: string;
  roundId: string;
  status: "correct" | "incorrect" | "already_scored" | "round_closed" | "rate_limited" | "duplicate";
  points?: number;
  retryAt?: number;
}

export interface ServerErrorMsg {
  code: string;
  ref?: string;
  at: number;
}

/** Conexión real al servidor Colyseus. Sin datos simulados ni respaldo local. */
export function useGameRoom(roomId: string | null, token: string | null) {
  const [state, setState] = useState<RoomSnapshot | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastServerError, setLastServerError] = useState<ServerErrorMsg | null>(null);
  const [lastAttempt, setLastAttempt] = useState<AttemptResult | null>(null);
  const [media, setMedia] = useState<{ roundId: string; stage: number; mediaId: string } | null>(null);
  const [reveal, setReveal] = useState<{ roundId: string; answer: string; mediaId: string } | null>(null);
  // Desfase estimado reloj servidor - reloj local (ms). Solo para mostrar el tiempo.
  const [clockOffset, setClockOffset] = useState(0);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    if (!roomId || !token) return;
    let cancelled = false;
    let syncTimer: ReturnType<typeof setInterval> | undefined;
    setStatus("connecting");
    setError(null);
    (async () => {
      try {
        const { Client } = await import("colyseus.js");
        const room = await new Client(SERVER_URL).joinById(roomId, { token });
        if (cancelled) return void room.leave();
        roomRef.current = room;
        setStatus("connected");
        room.onStateChange((s) => setState(s.toJSON() as RoomSnapshot));
        room.onMessage("error", (m: { code: string; ref?: string }) => setLastServerError({ ...m, at: Date.now() }));
        room.onMessage("attempt:result", (m: AttemptResult) => setLastAttempt(m));
        room.onMessage("round:media", (m) => setMedia(m));
        room.onMessage("round:reveal", (m) => setReveal(m));
        room.onMessage("clock:pong", (m: { clientSentAt: number; serverNow: number }) => {
          const now = Date.now();
          setClockOffset(m.serverNow - (m.clientSentAt + (now - m.clientSentAt) / 2));
        });
        room.onMessage("*", () => {});
        const sync = () => room.send("clock:sync", { clientSentAt: Date.now() });
        sync();
        syncTimer = setInterval(sync, 15_000);
        room.onLeave((code) => {
          clearInterval(syncTimer);
          setStatus("closed");
          if (code === 4003) setError("Has sido expulsado de la sala.");
          else if (code === 4000) setError("Esta sesión se abrió en otra pestaña o dispositivo.");
          else if (code !== 1000) setError("Conexión con el servidor perdida.");
        });
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        const msg = e instanceof Error ? e.message : String(e);
        setError(
          msg.includes("FORBIDDEN") || msg.includes("UNAUTHORIZED")
            ? "Sesión no válida para esta sala."
            : `No se pudo conectar: ${msg || "servidor no disponible"}`,
        );
      }
    })();
    return () => {
      cancelled = true;
      clearInterval(syncTimer);
      roomRef.current?.leave();
      roomRef.current = null;
    };
  }, [roomId, token]);

  const send = useCallback((type: string, payload: unknown = {}) => roomRef.current?.send(type, payload), []);
  return { state, status, error, lastServerError, lastAttempt, media, reveal, clockOffset, send };
}

/** Milisegundos restantes hasta `endsAt` (hora del servidor), refrescado en pantalla. */
export function useRemaining(endsAt: number | undefined, offset: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endsAt]);
  if (!endsAt) return null;
  return Math.max(0, endsAt - (now + offset));
}
