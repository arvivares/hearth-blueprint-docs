import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { api, errorText } from "@/game/api";
import { clearSession, loadSession, saveSession, type StoredSession } from "@/game/session";
import { useGameRoom } from "@/game/useGameRoom";
import { Button, Card, ErrorBox, Input, joinUrl, Participants, RoomQR, Shell } from "@/game/ui";

export const Route = createFileRoute("/tv")({
  validateSearch: z.object({ room: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Pantalla de la sala — Logos" },
      { name: "description", content: "Pantalla compartida: muestra el QR de entrada y los participantes." },
      { property: "og:title", content: "Pantalla de la sala — Logos" },
      { property: "og:description", content: "Pantalla compartida: muestra el QR de entrada y los participantes." },
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
  useEffect(() => {
    if (search.room) setSession(loadSession("screen", search.room));
  }, [search.room]);
  const room = useGameRoom(session?.roomId ?? null, session?.token ?? null);

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
          <form className="space-y-2" onSubmit={link}>
            <Input aria-label="Código de sala" placeholder="Código de sala" value={code} onChange={(e) => setCode(e.target.value)} maxLength={5} />
            <Input aria-label="Código de vinculación" placeholder="Código de vinculación (6 dígitos)" value={pairingCode} onChange={(e) => setPairingCode(e.target.value)} maxLength={6} inputMode="numeric" />
            <Button type="submit">Vincular</Button>
            {session && (
              <button type="button" className="ml-3 text-sm underline" onClick={() => { clearSession("screen", code); setSession(null); }}>
                Olvidar sesión anterior
              </button>
            )}
          </form>
        </Card>
      </Shell>
    );

  const c = search.room!;
  return (
    <Shell title={`Sala ${c}`}>
      <p className="text-sm text-muted-foreground">Conexión: {room.status}</p>
      <ErrorBox>{room.error}</ErrorBox>
      <Card>
        <div className="flex flex-wrap items-center gap-6">
          <RoomQR url={joinUrl(c)} />
          <div>
            <p className="text-muted-foreground">Entra en</p>
            <p className="text-lg">{typeof window !== "undefined" ? `${window.location.host}/play` : ""}</p>
            <p className="mt-2 text-muted-foreground">con el código</p>
            <p className="text-5xl font-bold tracking-widest">{c}</p>
          </div>
        </div>
      </Card>
      <Card>
        <Participants state={room.state} />
      </Card>
    </Shell>
  );
}
