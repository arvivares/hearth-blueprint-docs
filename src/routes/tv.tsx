import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { api, errorText, SERVER_URL } from "@/game/api";
import { clearSession, loadSession, saveSession, type StoredSession } from "@/game/session";
import { useGameRoom, useRemaining } from "@/game/useGameRoom";
import { Button, Card, ErrorBox, Input, joinUrl, Shell } from "@/game/ui";
import { TvView } from "@/game/views/TvView";

export const Route = createFileRoute("/tv")({
  validateSearch: z.object({ room: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Pantalla TV — PeekRush" },
      { name: "description", content: "Pantalla compartida: QR de entrada, logo, temporizador y clasificación." },
      { property: "og:title", content: "Pantalla TV — PeekRush" },
      { property: "og:description", content: "Pantalla compartida: QR de entrada, logo, temporizador y clasificación." },
    ],
  }),
  component: TvPage,
});

function TvPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const roomCode = (search.room ?? "").toUpperCase();
  const [code, setCode] = useState(roomCode);
  const [pairingCode, setPairingCode] = useState("");
  const [session, setSession] = useState<StoredSession | null>(null);
  const [hostSession, setHostSession] = useState<StoredSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mediaSrc, setMediaSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!roomCode) return;
    const s = loadSession("screen", roomCode);
    const h = loadSession("host", roomCode);
    setHostSession(h);
    if (s) {
      setSession(s);
    } else if (h) {
      // Si el anfitrión abrió esta pantalla, auto-vinculamos la pantalla de TV al instante
      api
        .screenPairing(roomCode, h.token)
        .then((p) => api.linkScreen(roomCode, p.pairingCode))
        .then((linked) => {
          const newScreen = { roomId: h.roomId, token: linked.screenToken };
          saveSession("screen", roomCode, newScreen);
          setSession(newScreen);
        })
        .catch((err) => setError(errorText(err)));
    }
  }, [roomCode]);

  const room = useGameRoom(session?.roomId ?? null, session?.token ?? null);
  const hostRoom = useGameRoom(hostSession?.roomId ?? null, hostSession?.token ?? null);
  const remaining = useRemaining(room.state?.phaseEndsAt || undefined, room.clockOffset);

  // Confirmar al servidor que la pantalla puede mostrar la ronda preparada.
  const st = room.state;
  useEffect(() => {
    if (st?.phase === "PREPARING" && st.phaseEndsAt > 0 && st.roundId) {
      setMediaSrc(null);
      room.send("screen:ready", { roundId: st.roundId });
    }
  }, [st?.phase, st?.phaseEndsAt, st?.roundId, room.send]);

  // La imagen de cada etapa se pide al servidor con la credencial de pantalla (nunca una URL pública).
  useEffect(() => {
    const cur = room.state?.roundId;
    const id =
      room.reveal?.roundId === cur && room.reveal?.mediaId ? room.reveal.mediaId : room.media?.roundId === cur ? room.media?.mediaId : undefined;
    if (!id || !session) return;
    let url: string | null = null;
    fetch(`${SERVER_URL}/api/media/${id}`, { headers: { authorization: `Bearer ${session.token}` } })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => setMediaSrc((url = URL.createObjectURL(b))))
      .catch(() => setMediaSrc(null));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [room.media?.mediaId, room.reveal?.mediaId, room.state?.roundId, session]);

  async function link(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const c = code.trim().toUpperCase();
    try {
      const r = await api.linkScreen(c, pairingCode.trim());
      const s = { roomId: r.roomId, token: r.screenToken };
      saveSession("screen", c, s);
      setSession(s);
      navigate({ search: { room: c } });
    } catch (err) {
      setError(errorText(err));
    }
  }

  if (!session || room.status === "error" || (room.status === "closed" && room.error))
    return (
      <Shell title="Vincular pantalla TV">
        <ErrorBox>{error || room.error}</ErrorBox>
        <Card className="space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-white">Sincronizar monitor o televisor</h2>
            <p className="text-xs text-zinc-400">
              El anfitrión genera el código de vinculación de 6 dígitos desde su panel.
            </p>
          </div>
          <form className="space-y-4" onSubmit={link}>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5" htmlFor="room-code">
                Código de sala (5 letras)
              </label>
              <Input
                id="room-code"
                aria-label="Código de sala"
                placeholder="EJ. 7KX9P"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={5}
                className="font-mono uppercase tracking-widest text-lg py-3 bg-white/[0.05]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5" htmlFor="pairing-code">
                Código de vinculación (6 dígitos)
              </label>
              <Input
                id="pairing-code"
                aria-label="Código de vinculación"
                placeholder="000000"
                value={pairingCode}
                onChange={(e) => setPairingCode(e.target.value)}
                maxLength={6}
                inputMode="numeric"
                className="font-mono tracking-[0.25em] text-lg py-3 bg-white/[0.05]"
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" className="w-full sm:w-auto">Vincular pantalla</Button>
              {session && (
                <button
                  type="button"
                  className="text-xs text-zinc-400 hover:text-white underline underline-offset-4"
                  onClick={() => {
                    clearSession("screen", code);
                    setSession(null);
                  }}
                >
                  Olvidar sesión previa
                </button>
              )}
            </div>
          </form>
        </Card>
      </Shell>
    );

  const c = roomCode || search.room!;
  if (!room.state)
    return (
      <div className="relative grid h-[100dvh] place-items-center bg-[#000000] text-zinc-400">
        <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 h-[350px] w-full max-w-4xl apple-glow opacity-60" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p className="text-base font-medium tracking-tight text-zinc-300">
            {room.error ?? "Iniciando tablero de juego…"}{" "}
            <span className="font-mono text-white font-bold">{c}</span>
          </p>
        </div>
      </div>
    );

  const isHost = !!hostSession;
  const activePlayers = Object.values(room.state.players).filter((p) => p.connected).length;

  return (
    <TvView
      s={room.state}
      code={c}
      joinUrl={joinUrl(c)}
      joinHost={window.location.host}
      remainingMs={remaining}
      mediaSrc={mediaSrc}
      revealAnswer={room.reveal && room.reveal.roundId === room.state.roundId ? room.reveal.answer : null}
      connection={room.status}
      host={
        isHost
          ? {
              canStart: room.state.phase === "LOBBY" && activePlayers > 0,
              playerCount: activePlayers,
              onStart: () => hostRoom.send("host:start", {}),
              onPause: () => hostRoom.send("host:pause", {}),
              onResume: () => hostRoom.send("host:resume", {}),
              onNext: () => hostRoom.send("host:next", {}),
              onAbort: () => hostRoom.send("host:abort", {}),
              onReset: () => hostRoom.send("host:reset", {}),
            }
          : undefined
      }
    />
  );
}
