import { useEffect, useRef, useState } from "react";
import type { Room } from "colyseus.js";
import type { PublicPlayer } from "../../packages/contracts/src/state";
import { SERVER_URL } from "./api";

export interface RoomSnapshot {
  phase: string;
  roomCode: string;
  maxPlayers: number;
  hostConnected: boolean;
  screenConnected: boolean;
  players: Record<string, PublicPlayer>;
}

type Status = "idle" | "connecting" | "connected" | "closed" | "error";

/** Conexión real al servidor Colyseus. Sin datos simulados ni respaldo local. */
export function useGameRoom(roomId: string | null, token: string | null) {
  const [state, setState] = useState<RoomSnapshot | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastServerError, setLastServerError] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    if (!roomId || !token) return;
    let cancelled = false;
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
        room.onMessage("error", (m: { code: string }) => setLastServerError(m.code));
        room.onMessage("*", () => {});
        room.onLeave((code) => {
          setStatus("closed");
          if (code === 4003) setError("Has sido expulsado de la sala.");
          else if (code === 4000) setError("Esta sesión se abrió en otra pestaña o dispositivo.");
          else if (code !== 1000) setError("Conexión con el servidor perdida.");
        });
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg.includes("FORBIDDEN") || msg.includes("UNAUTHORIZED") ? "Sesión no válida para esta sala." : `No se pudo conectar: ${msg || "servidor no disponible"}`);
      }
    })();
    return () => {
      cancelled = true;
      roomRef.current?.leave();
      roomRef.current = null;
    };
  }, [roomId, token]);

  const send = (type: string, payload: unknown = {}) => roomRef.current?.send(type, payload);
  return { state, status, error, lastServerError, send };
}
