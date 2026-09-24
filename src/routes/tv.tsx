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
      { title: "Pantalla de la sala — Logos" },
      { name: "description", content: "Pantalla compartida: QR de entrada, logo, temporizador y clasificación." },
      { property: "og:title", content: "Pantalla de la sala — Logos" },
      { property: "og:description", content: "Pantalla compartida: QR de entrada, logo, temporizador y clasificación." },
    ],
  }),
  component: TvPage,
});

function TvPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [code, setCode] = useState(search.room ?? "");
  const [pairingCode, setPairingCode] = useState("");
  const [session, setSession] = useState<StoredSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mediaSrc, setMediaSrc] = useState<string | null>(null);
  useEffect(() => {
    if (search.room) setSession(loadSession("screen", search.room));
  }, [search.room]);
  const room = useGameRoom(session?.roomId ?? null, session?.token ?? null);
  const remaining = useRemaining(room.state?.phaseEndsAt || undefined, room.clockOffset);

  // La imagen de cada etapa se pide al servidor con la credencial de pantalla (nunca una URL pública).
  useEffect(() => {
    const id = room.reveal?.mediaId ?? room.media?.mediaId;
    if (!id || !session) return;
    let url: string | null = null;
    fetch(`${SERVER_URL}/api/media/${id}`, { headers: { authorization: `Bearer ${session.token}` } })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => setMediaSrc((url = URL.createObjectURL(b))))
      .catch(() => setMediaSrc(null));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [room.media?.mediaId, room.reveal?.mediaId, session]);

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
      <Shell title="Vincular pantalla">
        <ErrorBox>{error || room.error}</ErrorBox>
        <Card>
          <p className="text-sm text-muted-foreground">El anfitrión genera el código de vinculación desde su panel.</p>
          <form className="space-y-3" onSubmit={link}>
            <Input aria-label="Código de sala" placeholder="Código de sala" value={code} onChange={(e) => setCode(e.target.value)} maxLength={5} className="font-mono uppercase tracking-widest" />
            <Input aria-label="Código de vinculación" placeholder="Código de vinculación (6 dígitos)" value={pairingCode} onChange={(e) => setPairingCode(e.target.value)} maxLength={6} inputMode="numeric" className="font-mono tracking-widest" />
            <div className="flex items-center gap-3">
              <Button type="submit">Vincular</Button>
              {session && (
                <button type="button" className="text-sm underline" onClick={() => { clearSession("screen", code); setSession(null); }}>
                  Olvidar sesión anterior
                </button>
              )}
            </div>
          </form>
        </Card>
      </Shell>
    );

  const c = search.room!;
  if (!room.state)
    return <div className="grid h-[100dvh] place-items-center text-2xl text-muted-foreground">{room.error ?? "Conectando con el servidor…"}</div>;

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
    />
  );
}
