import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { api, errorText } from "@/game/api";
import { saveSession } from "@/game/session";
import { Button, Card, ErrorBox, Input, Shell } from "@/game/ui";
import { PresenterAudio } from "@/components/PresenterAudio";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Logos — Juego de logos con TV y móviles" },
      { name: "description", content: "Crea una sala o entra con un código para adivinar logos desde tu móvil." },
      { property: "og:title", content: "Logos — Juego de logos con TV y móviles" },
      { property: "og:description", content: "Crea una sala o entra con un código para adivinar logos desde tu móvil." },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.createRoom();
      saveSession("host", r.roomCode, { roomId: r.roomId, token: r.hostToken });
      navigate({ to: "/host", search: { room: r.roomCode } });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="PeekRush">
      <ErrorBox>{error}</ErrorBox>
      <PresenterAudio />
      <Card>
        <h2 className="font-semibold">Anfitrión</h2>
        <Button onClick={create} disabled={busy}>Crear sala</Button>
      </Card>
      <Card>
        <h2 className="font-semibold">Jugador</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) navigate({ to: "/play", search: { room: code.trim().toUpperCase() } });
          }}
        >
          <Input aria-label="Código de sala" placeholder="Código de sala" value={code} onChange={(e) => setCode(e.target.value)} maxLength={5} />
          <Button type="submit">Entrar</Button>
        </form>
      </Card>
      <Card>
        <h2 className="font-semibold">Pantalla (TV)</h2>
        <Button onClick={() => navigate({ to: "/tv" })}>Vincular esta pantalla</Button>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        ¿Solo quieres ver el diseño?{" "}
        <button className="underline" onClick={() => navigate({ to: "/demo", search: { view: "tv", phase: "LOBBY" } })}>
          Abrir la demostración (datos ficticios)
        </button>
      </p>
    </Shell>
  );
}
