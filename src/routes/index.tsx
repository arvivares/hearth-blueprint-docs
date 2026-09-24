import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, errorText } from "@/game/api";
import { saveSession } from "@/game/session";
import { Button, Card, ErrorBox, Input, Shell } from "@/game/ui";
import { PresenterAudio, type Language } from "@/components/PresenterAudio";
import { cn } from "@/lib/utils";

const I18N = {
  es: {
    metaTitle: "PeekRush — Juego de logos con TV y móviles",
    metaDesc: "Crea una sala o entra con un código para adivinar logos desde tu móvil.",
    hostTitle: "Anfitrión",
    createRoomBtn: "Crear sala",
    playerTitle: "Jugador",
    roomCodePlaceholder: "Código de sala",
    joinBtn: "Entrar",
    screenTitle: "Pantalla (TV)",
    linkScreenBtn: "Vincular esta pantalla",
    demoQuestion: "¿Solo quieres ver el diseño?",
    demoAction: "Abrir la demostración (datos ficticios)",
  },
  en: {
    metaTitle: "PeekRush — Multiplayer Logo Party Game with TV & Phones",
    metaDesc: "Create a room or join with a code to guess logos from your mobile phone.",
    hostTitle: "Host",
    createRoomBtn: "Create room",
    playerTitle: "Player",
    roomCodePlaceholder: "Room code",
    joinBtn: "Join",
    screenTitle: "Screen (TV)",
    linkScreenBtn: "Link this screen",
    demoQuestion: "Just want to check out the design?",
    demoAction: "Open demo (mock data)",
  },
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PeekRush — Juego de logos con TV y móviles" },
      { name: "description", content: "Crea una sala o entra con un código para adivinar logos desde tu móvil." },
      { property: "og:title", content: "PeekRush — Juego de logos con TV y móviles" },
      { property: "og:description", content: "Crea una sala o entra con un código para adivinar logos desde tu móvil." },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<Language>("es");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("peekrush_lang") as Language | null;
      if (saved === "es" || saved === "en") setLang(saved);
    } catch {}
  }, []);

  const changeLanguage = (newLang: Language) => {
    setLang(newLang);
    try {
      localStorage.setItem("peekrush_lang", newLang);
    } catch {}
  };

  const t = I18N[lang];

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

  const headerRight = (
    <div className="inline-flex rounded-xl border border-border bg-card p-1 text-xs font-bold shadow-sm">
      <button
        type="button"
        onClick={() => changeLanguage("es")}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition",
          lang === "es"
            ? "bg-primary text-primary-foreground shadow"
            : "text-muted-foreground hover:text-foreground",
        )}
        aria-pressed={lang === "es"}
      >
        <span>🇪🇸</span>
        <span>Español</span>
      </button>
      <button
        type="button"
        onClick={() => changeLanguage("en")}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition",
          lang === "en"
            ? "bg-primary text-primary-foreground shadow"
            : "text-muted-foreground hover:text-foreground",
        )}
        aria-pressed={lang === "en"}
      >
        <span>🇬🇧</span>
        <span>English</span>
      </button>
    </div>
  );

  return (
    <Shell title="PeekRush" headerRight={headerRight}>
      <ErrorBox>{error}</ErrorBox>

      {/* Presentadora con voz en el idioma seleccionado */}
      <PresenterAudio lang={lang} onLanguageChange={changeLanguage} />

      <Card>
        <h2 className="font-semibold text-lg">{t.hostTitle}</h2>
        <Button onClick={create} disabled={busy} className="w-full sm:w-auto">
          {t.createRoomBtn}
        </Button>
      </Card>

      <Card>
        <h2 className="font-semibold text-lg">{t.playerTitle}</h2>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) navigate({ to: "/play", search: { room: code.trim().toUpperCase() } });
          }}
        >
          <Input
            aria-label={t.roomCodePlaceholder}
            placeholder={t.roomCodePlaceholder}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={5}
            className="font-mono uppercase tracking-widest text-center sm:text-left"
          />
          <Button type="submit" className="shrink-0">
            {t.joinBtn}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-semibold text-lg">{t.screenTitle}</h2>
        <Button onClick={() => navigate({ to: "/tv" })} className="w-full sm:w-auto">
          {t.linkScreenBtn}
        </Button>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        {t.demoQuestion}{" "}
        <button
          type="button"
          className="underline hover:text-primary transition"
          onClick={() => navigate({ to: "/demo", search: { view: "tv", phase: "LOBBY" } })}
        >
          {t.demoAction}
        </button>
      </p>
    </Shell>
  );
}
