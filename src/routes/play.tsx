import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { api, errorText } from "@/game/api";
import { clearSession, loadSession, saveSession, type StoredSession } from "@/game/session";
import { useGameRoom } from "@/game/useGameRoom";
import { Button, Card, ErrorBox, Input, Participants, Shell } from "@/game/ui";

export const Route = createFileRoute("/play")({
  validateSearch: z.object({ room: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Entrar a jugar — Logos" },
      { name: "description", content: "Únete a la sala con tu alias y responde desde el móvil." },
      { property: "og:title", content: "Entrar a jugar — Logos" },
      { property: "og:description", content: "Únete a la sala con tu alias y responde desde el móvil." },
    ],
  }),
  component: PlayPage,
});

function PlayPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const code = (search.room ?? "").toUpperCase();
  const [codeInput, setCodeInput] = useState(code);
  const [alias, setAlias] = useState("");
  const [session, setSession] = useState<StoredSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  // Recuperar sesión: el servidor confirma si el token sigue siendo válido.
  useEffect(() => {
    setChecked(false);
    setSession(null);
    if (!code) return setChecked(true);
    const stored = loadSession("player", code);
    if (!stored) return setChecked(true);
    api
      .joinPlayer(code, stored.alias ?? "Jugador", stored.token)
      .then((r) => {
        if (r.playerId !== stored.playerId) {
          // El servidor no reconoció la sesión: descartamos la identidad nueva no deseada.
          clearSession("player", code);
          return;
        }
        setSession(stored);
        setAlias(r.alias);
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setChecked(true));
  }, [code]);

  const room = useGameRoom(session?.roomId ?? null, session?.token ?? null);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const r = await api.joinPlayer(code, alias.trim());
      const s = { roomId: r.roomId, token: r.playerToken, alias: r.alias, playerId: r.playerId };
      saveSession("player", code, s);
      setSession(s);
    } catch (err) {
      setError(errorText(err));
    }
  }

  if (!code)
    return (
      <Shell title="Entrar a jugar">
        <Card>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); navigate({ search: { room: codeInput.trim().toUpperCase() } }); }}>
            <Input aria-label="Código de sala" placeholder="Código de sala" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} maxLength={5} />
            <Button type="submit">Continuar</Button>
          </form>
        </Card>
      </Shell>
    );

  if (!checked) return <Shell title={`Sala ${code}`}><p>Comprobando sesión…</p></Shell>;

  if (!session)
    return (
      <Shell title={`Sala ${code}`}>
        <ErrorBox>{error}</ErrorBox>
        <Card>
          <form className="space-y-2" onSubmit={join}>
            <Input aria-label="Alias" placeholder="Tu alias" value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={20} required />
            <Button type="submit">Unirme</Button>
          </form>
        </Card>
      </Shell>
    );

  return (
    <Shell title={`Sala ${code}`}>
      <p className="text-sm text-muted-foreground">Conexión: {room.status}</p>
      <ErrorBox>{room.error}</ErrorBox>
      <Card>
        <p>Estás dentro como <strong data-testid="my-alias">{session.alias}</strong>. Espera a que empiece la partida.</p>
      </Card>
      <Card>
        <Participants state={room.state} highlight={session.playerId} />
      </Card>
    </Shell>
  );
}
