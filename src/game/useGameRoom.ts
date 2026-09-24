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

const MAX_RETRIES = 12;

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
  // Reconexión automática: cada incremento de `gen` repite la conexión con el mismo token.
  const [gen, setGen] = useState(0);
  const tries = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scheduleRetry = useCallback((immediate = false) => {
    clearTimeout(retryTimer.current);
    if (tries.current >= MAX_RETRIES) return false;
    const delay = immediate ? 0 : Math.min(1000 * 2 ** tries.current, 10_000);
    tries.current += 1;
    retryTimer.current = setTimeout(() => setGen((g) => g + 1), delay);
    return true;
  }, []);

  // Al volver a primer plano (pantalla bloqueada en iOS/Android) o recuperar red, reintentar ya.
  useEffect(() => {
    const wake = () => {
      if (document.visibilityState === "visible" && !roomRef.current && roomId && token) {
        tries.current = 0;
        scheduleRetry(true);
      }
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    return () => {
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
    };
  }, [roomId, token, scheduleRetry]);

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
        tries.current = 0;
        setStatus("connected");
        setError(null);
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
          if (roomRef.current === room) roomRef.current = null;
          if (cancelled) return;
          if (code === 4003) return setClosed("Has sido expulsado de la sala.");
          if (code === 4000) return setClosed("Esta sesión se abrió en otra pestaña o dispositivo.");
          if (code === 1000) return setClosed(null);
          // Corte de red, servidor reiniciado o exceso de mensajes (4008): reintentar con espera creciente.
          setStatus("connecting");
          setError("Conexión perdida. Reconectando…");
          if (!scheduleRetry()) setClosed("Conexión con el servidor perdida.");
        });
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        const fatal = /FORBIDDEN|UNAUTHORIZED|ROOM_NOT_FOUND|not found/i.test(msg);
        if (!fatal && tries.current > 0 && scheduleRetry()) {
          setStatus("connecting");
          setError("Conexión perdida. Reconectando…");
          return;
        }
        setStatus("error");
        setError(
          msg.includes("FORBIDDEN") || msg.includes("UNAUTHORIZED")
            ? "Sesión no válida para esta sala."
            : `No se pudo conectar: ${msg || "servidor no disponible"}`,
        );
      }
    })();
    function setClosed(msg: string | null) {
      setStatus("closed");
      setError(msg);
    }
    return () => {
      cancelled = true;
      clearInterval(syncTimer);
      clearTimeout(retryTimer.current);
      roomRef.current?.leave();
      roomRef.current = null;
    };
  }, [roomId, token, gen, scheduleRetry]);

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
