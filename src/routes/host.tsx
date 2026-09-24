import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { api, errorText } from "@/game/api";
import { loadSession, type StoredSession } from "@/game/session";
import { useGameRoom } from "@/game/useGameRoom";
import { Button, Card, ErrorBox, joinUrl, Participants, RoomQR, Shell } from "@/game/ui";

export const Route = createFileRoute("/host")({
  validateSearch: z.object({ room: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Panel del anfitrión — Logos" },
      { name: "description", content: "Gestiona la sala: vincula la pantalla y controla a los participantes." },
      { property: "og:title", content: "Panel del anfitrión — Logos" },
      { property: "og:description", content: "Gestiona la sala: vincula la pantalla y controla a los participantes." },
    ],
  }),
  component: HostPage,
});

function HostPage() {
  const { room: code } = Route.useSearch();
  const [session, setSession] = useState<StoredSession | null | undefined>(undefined);
  const [pairing, setPairing] = useState<{ code: string; expiresAt: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setSession(code ? loadSession("host", code) : null), [code]);
  const { state, status, error: connError, lastServerError, send } = useGameRoom(session?.roomId ?? null, session?.token ?? null);

  if (session === undefined) return null;
  if (!code || !session)
    return (
      <Shell title="Panel del anfitrión">
        <ErrorBox>No hay credenciales de anfitrión para esta sala en este navegador.</ErrorBox>
        <Link to="/" className="underline">Volver</Link>
      </Shell>
    );

  async function newPairing() {
    setError(null);
    try {
      const r = await api.screenPairing(code!, session!.token);
      setPairing({ code: r.pairingCode, expiresAt: r.expiresAt });
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <Shell title={`Sala ${code}`}>
      <p className="text-sm text-muted-foreground">Conexión: {status}</p>
      <ErrorBox>{connError || error || (lastServerError && `Servidor: ${lastServerError}`)}</ErrorBox>
      <Card>
        <h2 className="font-semibold">Entrada de jugadores</h2>
        <RoomQR url={joinUrl(code)} />
        <p className="text-sm">Código: <strong className="tracking-widest">{code}</strong></p>
      </Card>
      <Card>
        <h2 className="font-semibold">Pantalla</h2>
        <p className="text-sm text-muted-foreground">Abre /tv en la pantalla e introduce el código de sala y este código de vinculación.</p>
        <Button onClick={newPairing}>Generar código de vinculación</Button>
        {pairing && (
          <p className="text-sm">
            Código de vinculación: <strong data-testid="pairing-code" className="text-lg tracking-widest">{pairing.code}</strong>{" "}
            (un solo uso, caduca {new Date(pairing.expiresAt).toLocaleTimeString()})
          </p>
        )}
      </Card>
      <Card>
        <h2 className="font-semibold">Participantes</h2>
        <Participants state={state} onKick={(playerId) => send("host:kick", { playerId })} />
      </Card>
    </Shell>
  );
}
