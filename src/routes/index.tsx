import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Gamepad2,
  Tv,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { api, errorText } from "@/game/api";
import { saveSession } from "@/game/session";
import { ErrorBox } from "@/game/ui";
import { PresenterAudio, type Language } from "@/components/PresenterAudio";
import { cn } from "@/lib/utils";

const I18N = {
  es: {
    metaTitle: "PeekRush — Juego de logos para TV y móviles",
    metaDesc: "Crea una sala o entra con un código para adivinar logos en tiempo real desde tu móvil.",
    heroTitle: "Adivina el logo.\nEn tiempo real.",
    heroSubtitle: "Juega en grupo frente a la pantalla de televisión respondiendo desde tu propio teléfono.",
    playerTitle: "Entrar a la partida",
    playerDesc: "Introduce el código de 5 letras que aparece en la televisión:",
    roomCodePlaceholder: "Código de sala (ej. 7KX9P)",
    joinBtn: "Entrar",
    hostTitle: "Crear sala",
    hostDesc: "Inicia una nueva partida como anfitrión y obtén el código de sincronización para la televisión.",
    createRoomBtn: "Crear sala",
    creatingRoom: "Creando...",
    screenTitle: "Pantalla TV",
    screenDesc: "Convierte este televisor o monitor en el tablero central con el código QR gigante.",
    linkScreenBtn: "Vincular pantalla",
    demoPrompt: "¿Quieres explorar la interfaz sin conectar dispositivos?",
    demoAction: "Abrir demostración",
    footerNote: "PeekRush · Desarrollado para disfrutar con amigos frente a la pantalla grande",
  },
  en: {
    metaTitle: "PeekRush — Multiplayer Logo Game for TV & Phones",
    metaDesc: "Create a room or join with a code to guess logos in real time from your smartphone.",
    heroTitle: "Guess the brand.\nIn real time.",
    heroSubtitle: "Play together in front of the TV screen and submit your answers directly from your phone.",
    playerTitle: "Join the game",
    playerDesc: "Enter the 5-letter room code shown on the TV screen:",
    roomCodePlaceholder: "Room code (e.g. 7KX9P)",
    joinBtn: "Join",
    hostTitle: "Create room",
    hostDesc: "Host a new multiplayer match and generate the sync code for the big screen.",
    createRoomBtn: "Create room",
    creatingRoom: "Creating...",
    screenTitle: "TV Screen",
    screenDesc: "Turn this TV or display into the central gameboard with a giant QR code for players.",
    linkScreenBtn: "Link screen",
    demoPrompt: "Want to preview the interface without connecting devices?",
    demoAction: "Open demo",
    footerNote: "PeekRush · Designed for friends and family in front of the big screen",
  },
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PeekRush — Juego de logos para TV y móviles" },
      { name: "description", content: "Crea una sala o entra con un código para adivinar logos en tiempo real desde tu móvil." },
      { property: "og:title", content: "PeekRush — Juego de logos para TV y móviles" },
      { property: "og:description", content: "Crea una sala o entra con un código para adivinar logos en tiempo real desde tu móvil." },
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

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode) {
      navigate({ to: "/play", search: { room: cleanCode } });
    }
  };

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[#000000] text-foreground selection:bg-white selection:text-black">
      {/* Luz ambiental sutil estilo Apple */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 h-[500px] w-full max-w-4xl apple-glow opacity-80" />

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-8 sm:py-14 space-y-10 sm:space-y-14">
        {/* Barra Superior Minimalista */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              PeekRush<span className="text-zinc-500">.</span>
            </span>
          </div>

          {/* Selector de idioma tipo Apple Segmented Control */}
          <div className="inline-flex rounded-full bg-white/[0.06] border border-white/[0.08] p-1 text-xs font-medium backdrop-blur-md">
            <button
              type="button"
              onClick={() => changeLanguage("es")}
              className={cn(
                "rounded-full px-3.5 py-1 transition-all duration-200",
                lang === "es"
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-white",
              )}
              aria-pressed={lang === "es"}
            >
              Español
            </button>
            <button
              type="button"
              onClick={() => changeLanguage("en")}
              className={cn(
                "rounded-full px-3.5 py-1 transition-all duration-200",
                lang === "en"
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-white",
              )}
              aria-pressed={lang === "en"}
            >
              English
            </button>
          </div>
        </header>

        {/* Hero Minimalista estilo Apple */}
        <div className="text-center space-y-3 pt-2">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-white whitespace-pre-line leading-[1.08]">
            {t.heroTitle}
          </h1>
          <p className="mx-auto max-w-lg text-base sm:text-lg text-zinc-400 font-normal leading-relaxed">
            {t.heroSubtitle}
          </p>
        </div>

        <ErrorBox>{error}</ErrorBox>

        {/* Entrada Rápida de Jugador (Estilo Apple Spotlight / Search) */}
        <section
          aria-label={t.playerTitle}
          className="rounded-3xl apple-glass p-6 sm:p-8 space-y-4"
        >
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-white">
              {t.playerTitle}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              {t.playerDesc}
            </p>
          </div>

          <form onSubmit={handleJoin} className="flex flex-col sm:flex-row gap-3 pt-1">
            <div className="relative flex-1">
              <input
                aria-label={t.roomCodePlaceholder}
                placeholder={t.roomCodePlaceholder}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={5}
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.1] px-5 py-4 font-mono text-xl uppercase tracking-widest text-white placeholder:text-zinc-600 placeholder:font-sans placeholder:tracking-normal placeholder:text-sm outline-none transition focus:border-white/30 focus:bg-white/[0.07] focus:ring-4 focus:ring-white/[0.04]"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-xs text-zinc-500">
                {code.length}/5
              </span>
            </div>

            <button
              type="submit"
              disabled={!code.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-8 py-4 font-semibold text-black text-base transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-white/10 shrink-0"
            >
              <span>{t.joinBtn}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </section>

        {/* Guía de Audio de la Presentadora con Visualizador Minimalista */}
        <section aria-label="Guía de la presentadora">
          <PresenterAudio lang={lang} />
        </section>

        {/* Bloques Secundarios: Anfitrión y Pantalla TV en 2 Columnas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {/* Tarjeta Anfitrión */}
          <section
            aria-label={t.hostTitle}
            className="flex flex-col justify-between rounded-3xl apple-glass apple-glass-interactive p-6 space-y-6"
          >
            <div className="space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06] border border-white/[0.08] text-white">
                <Gamepad2 className="h-5 w-5" />
              </div>

              <div>
                <h3 className="text-lg font-semibold tracking-tight text-white">
                  {t.hostTitle}
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  {t.hostDesc}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={create}
              disabled={busy}
              className="inline-flex items-center justify-center rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] px-4 py-3 text-sm font-medium text-white transition active:scale-[0.98] disabled:opacity-40"
            >
              {busy ? t.creatingRoom : t.createRoomBtn}
            </button>
          </section>

          {/* Tarjeta Pantalla TV */}
          <section
            aria-label={t.screenTitle}
            className="flex flex-col justify-between rounded-3xl apple-glass apple-glass-interactive p-6 space-y-6"
          >
            <div className="space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06] border border-white/[0.08] text-white">
                <Tv className="h-5 w-5" />
              </div>

              <div>
                <h3 className="text-lg font-semibold tracking-tight text-white">
                  {t.screenTitle}
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  {t.screenDesc}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate({ to: "/tv" })}
              className="inline-flex items-center justify-center rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] px-4 py-3 text-sm font-medium text-white transition active:scale-[0.98]"
            >
              {t.linkScreenBtn}
            </button>
          </section>
        </div>

        {/* Footer Minimalista */}
        <footer className="pt-4 pb-8 text-center space-y-3">
          <p className="text-xs text-zinc-500">
            {t.demoPrompt}{" "}
            <button
              type="button"
              onClick={() => navigate({ to: "/demo", search: { view: "tv", phase: "LOBBY" } })}
              className="text-zinc-300 underline underline-offset-4 hover:text-white transition"
            >
              {t.demoAction}
            </button>
          </p>
          <p className="text-[11px] text-zinc-600">
            {t.footerNote}
          </p>
        </footer>
      </div>
    </div>
  );
}
