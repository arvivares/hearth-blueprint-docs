import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { api, errorText } from "@/game/api";
import { loadSession, type StoredSession } from "@/game/session";
import { useGameRoom } from "@/game/useGameRoom";
import { ErrorBox, joinUrl, Shell } from "@/game/ui";
import { HostView } from "@/game/views/HostView";

export const Route = createFileRoute("/host")({
  validateSearch: z.object({ room: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Panel del anfitrión — PeekRush" },
      { name: "description", content: "Configura la sala, vincula la pantalla y controla la partida." },
      { property: "og:title", content: "Panel del anfitrión — PeekRush" },
      { property: "og:description", content: "Configura la sala, vincula la pantalla y controla la partida." },
    ],
  }),
  component: HostPage,
});

function HostPage() {
  const { room: code } = Route.useSearch();
  const [session, setSession] = useState<StoredSession | null | undefined>(undefined);
  const [pairing, setPairing] = useState<{ code: string; expiresAt: number } | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  useEffect(() => {
    setSession(code ? loadSession("host", code) : null);
    if (code) setUrl(joinUrl(code));
  }, [code]);
  const room = useGameRoom(session?.roomId ?? null, session?.token ?? null);

  if (session === undefined) return null;
  if (!code || !session)
    return (
      <Shell title="Panel del anfitrión">
        <ErrorBox>No hay credenciales de anfitrión para esta sala en este navegador.</ErrorBox>
        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold text-black hover:bg-zinc-200 transition active:scale-95 shadow-md shadow-white/5"
          >
            Volver al inicio
          </Link>
        </div>
      </Shell>
    );

  const recentError = room.lastServerError && Date.now() - room.lastServerError.at < 8000 ? room.lastServerError.code : null;

  return (
    <HostView
      s={room.state}
      code={code}
      joinUrl={url}
      connection={room.status}
      connectionError={room.error}
      serverError={recentError}
      pairing={pairing}
      pairingError={pairingError}
      onPair={async () => {
        setPairingError(null);
        try {
          const r = await api.screenPairing(code, session.token);
          setPairing({ code: r.pairingCode, expiresAt: r.expiresAt });
        } catch (e) {
          setPairingError(errorText(e));
        }
      }}
      onConfigure={(cfg) => room.send("host:configure", cfg)}
      onCommand={(t) => room.send(t)}
      onKick={(playerId) => room.send("host:kick", { playerId })}
    />
  );
}
