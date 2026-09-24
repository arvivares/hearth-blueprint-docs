import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { api, errorText } from "@/game/api";
import { clearSession, loadSession, saveSession, type StoredSession } from "@/game/session";
import { useGameRoom, useRemaining } from "@/game/useGameRoom";
import { Button, ErrorBox, Input } from "@/game/ui";
import { PlayerView } from "@/game/views/PlayerView";

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

function EntryLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] flex-col justify-end gap-6 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-10">
      <div className="flex-1 content-center">
        <p className="font-display text-sm font-extrabold tracking-widest text-primary">LOGOS</p>
        <h1 className="font-display text-4xl font-extrabold leading-tight">{title}</h1>
      </div>
      {children}
    </main>
  );
}

function PlayPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const code = (search.room ?? "").toUpperCase();
  const [codeInput, setCodeInput] = useState(code);
  const [alias, setAlias] = useState("");
  const [session, setSession] = useState<StoredSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

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
        if (r.playerId !== stored.playerId) return clearSession("player", code);
        setSession(stored);
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setChecked(true));
  }, [code]);

  const room = useGameRoom(session?.roomId ?? null, session?.token ?? null);
  const remaining = useRemaining(room.state?.phase === "ROUND_ACTIVE" ? room.state.phaseEndsAt : undefined, room.clockOffset);

  // El envío queda pendiente hasta que el servidor responde (resultado o error).
  useEffect(() => {
    if (pending && room.lastAttempt?.attemptId === pending) setPending(null);
  }, [room.lastAttempt, pending]);
  useEffect(() => {
    if (pending && room.lastServerError?.ref === "player:attempt") setPending(null);
  }, [room.lastServerError, pending]);

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
      <EntryLayout title="Entra en la sala">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); navigate({ search: { room: codeInput.trim().toUpperCase() } }); }}>
          <Input aria-label="Código de sala" placeholder="CÓDIGO" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} maxLength={5} autoCapitalize="characters" className="text-center font-mono text-3xl uppercase tracking-[0.3em]" />
          <Button type="submit" size="xl" className="w-full" disabled={codeInput.trim().length < 5}>Continuar</Button>
        </form>
      </EntryLayout>
    );

  if (!checked) return <div className="grid min-h-[100dvh] place-items-center text-muted-foreground">Comprobando sesión…</div>;

  if (!session)
    return (
      <EntryLayout title={`Sala ${code}`}>
        <ErrorBox>{error}</ErrorBox>
        <form className="space-y-3" onSubmit={join}>
          <label className="block text-sm font-semibold text-muted-foreground" htmlFor="alias">¿Cómo te llamamos?</label>
          <Input id="alias" aria-label="Alias" placeholder="Tu alias" value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={20} required autoComplete="nickname" enterKeyHint="go" />
          <Button type="submit" size="xl" className="w-full" disabled={!alias.trim()}>Unirme</Button>
        </form>
      </EntryLayout>
    );

  const recentError = room.lastServerError && Date.now() - room.lastServerError.at < 6000 ? room.lastServerError.code : null;

  return (
    <PlayerView
      s={room.state}
      playerId={session.playerId!}
      alias={session.alias ?? ""}
      connection={room.status}
      connectionError={room.error}
      remainingMs={remaining}
      lastResult={room.lastAttempt}
      pending={!!pending}
      errorCode={recentError}
      onSubmit={(text) => {
        if (!room.state) return;
        const attemptId = crypto.randomUUID();
        setPending(attemptId);
        room.send("player:attempt", { attemptId, roundId: room.state.roundId, text });
      }}
    />
  );
}
