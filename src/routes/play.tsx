import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { api, errorText } from "@/game/api";
import { clearSession, loadSession, saveSession, type StoredSession } from "@/game/session";
import { useGameRoom, useRemaining } from "@/game/useGameRoom";
import { Button, ErrorBox, Input } from "@/game/ui";
import { PlayerView } from "@/game/views/PlayerView";

export const Route = createFileRoute("/play")({
  validateSearch: z.object({ room: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Entrar a jugar — PeekRush" },
      { name: "description", content: "Únete a la sala con tu alias y responde desde el móvil." },
      { property: "og:title", content: "Entrar a jugar — PeekRush" },
      { property: "og:description", content: "Únete a la sala con tu alias y responde desde el móvil." },
    ],
  }),
  component: PlayPage,
});

function EntryLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] bg-[#000000] text-foreground select-none overflow-x-hidden selection:bg-white selection:text-black">
      {/* Luz ambiental sutil */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 h-[380px] w-full max-w-xl apple-glow opacity-70" />

      <main className="relative z-10 mx-auto flex min-h-[100dvh] max-w-md flex-col justify-between px-5 pb-[max(1.8rem,env(safe-area-inset-bottom))] pt-8 sm:pt-12">
        <header className="flex items-center justify-between">
          <Link
            to="/"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-white transition active:scale-95 border border-white/[0.06]"
            title="Volver al inicio"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-xs font-semibold tracking-tight text-zinc-500">
            PeekRush<span className="text-zinc-400">.</span>
          </span>
        </header>

        <div className="my-auto space-y-4 py-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">{title}</h1>
          {subtitle && <p className="text-sm text-zinc-400 max-w-xs mx-auto leading-relaxed">{subtitle}</p>}
        </div>

        <div className="w-full space-y-4 apple-glass rounded-3xl p-6 sm:p-7 border border-white/[0.08] shadow-2xl">
          {children}
        </div>
      </main>
    </div>
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
      <EntryLayout title="Entra en la sala" subtitle="Introduce el código de 5 caracteres que aparece en la televisión.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); navigate({ search: { room: codeInput.trim().toUpperCase() } }); }}>
          <Input
            aria-label="Código de sala"
            placeholder="CÓDIGO"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            maxLength={5}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck="false"
            className="text-center font-mono text-3xl font-bold uppercase tracking-[0.3em] py-4 bg-white/[0.05]"
          />
          <Button type="submit" size="xl" className="w-full" disabled={codeInput.trim().length < 5}>
            Continuar
          </Button>
        </form>
      </EntryLayout>
    );

  if (!checked)
    return (
      <div className="relative grid min-h-[100dvh] place-items-center bg-[#000000] text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p className="text-sm font-medium tracking-tight text-zinc-400">Comprobando sesión…</p>
        </div>
      </div>
    );

  if (!session)
    return (
      <EntryLayout title={`Sala ${code}`} subtitle="Escribe el nombre con el que aparecerás en la pantalla.">
        <ErrorBox>{error}</ErrorBox>
        <form className="space-y-4" onSubmit={join}>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5" htmlFor="alias">
              Tu nombre o alias
            </label>
            <Input
              id="alias"
              aria-label="Alias"
              placeholder="Ej. Lucas"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              maxLength={20}
              required
              autoComplete="nickname"
              enterKeyHint="go"
              className="text-lg py-3.5 bg-white/[0.05]"
            />
          </div>
          <Button type="submit" size="xl" className="w-full" disabled={!alias.trim()}>
            Unirme a la partida
          </Button>
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
