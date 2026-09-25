import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Gamepad2,
  Tv,
  ArrowRight,
  Sparkles,
  User,
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
    heroSubtitle: "Juega en grupo frente a la pantalla respondiendo desde tu propio teléfono.",
    playerTitle: "Entrar a la partida",
    playerDesc: "Introduce el código de 5 letras que aparece en la televisión:",
    roomCodePlaceholder: "Código de sala (ej. 7KX9P)",
    joinBtn: "Entrar",
    hostTitle: "Crear sala y empezar juego",
    hostDesc: "Abre el tablero central en esta pantalla para jugar en grupo con móviles o en solitario desde este navegador.",
    createRoomBtn: "Crear sala",
    playSoloBtn: "Jugar solo",
    creatingRoom: "Iniciando juego...",
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
    hostTitle: "Create room & start game",
    hostDesc: "Launch the main gameboard on this screen to play with friends or solo from this browser.",
    createRoomBtn: "Create room",
    playSoloBtn: "Play solo",
    creatingRoom: "Starting game...",
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

  async function create(solo = false) {
    setBusy(true);
    setError(null);
    try {
      const r = await api.createRoom();
      saveSession("host", r.roomCode, { roomId: r.roomId, token: r.hostToken });

      // Auto-vincular la pantalla de televisión para arrancar el juego de inmediato
      const pairing = await api.screenPairing(r.roomCode, r.hostToken);
      const screen = await api.linkScreen(r.roomCode, pairing.pairingCode);
      saveSession("screen", r.roomCode, { roomId: r.roomId, token: screen.screenToken });

      if (solo) {
        const p = await api.joinPlayer(r.roomCode, "Tú");
        saveSession("player", r.roomCode, { roomId: r.roomId, token: p.playerToken, alias: p.alias, playerId: p.playerId });
      }

      // Lanzar directamente la pantalla de juego
      navigate({ to: "/tv", search: { room: r.roomCode } });
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

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-10 sm:space-y-12">
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

        {/* Hero con Titular a la Izquierda y "Cómo se juega" a la Derecha */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center pt-2">
          {/* Columna Izquierda: Adivina el logo / En tiempo real */}
          <div className="lg:col-span-5 flex flex-col justify-center space-y-4 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 self-center lg:self-start rounded-full bg-white/[0.06] border border-white/[0.08] px-3.5 py-1 text-xs font-medium text-amber-300">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>{lang === "es" ? "Multijugador en tiempo real" : "Real-time multiplayer"}</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl font-black tracking-tight text-white whitespace-pre-line leading-[1.05]">
              {t.heroTitle}
            </h1>
            <p className="text-base sm:text-lg text-zinc-400 font-normal leading-relaxed max-w-lg mx-auto lg:mx-0">
              {t.heroSubtitle}
            </p>
          </div>

          {/* Columna Derecha: Cómo se juega (PresenterAudio con Animación y Locución) */}
          <div className="lg:col-span-7">
            <section aria-label="Cómo se juega">
              <PresenterAudio lang={lang} />
            </section>
          </div>
        </div>

        <ErrorBox>{error}</ErrorBox>

        {/* Bloque Crear sala: Inicia el juego en esta pantalla */}
        <section
          aria-label={t.hostTitle}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 rounded-3xl apple-glass p-6 sm:p-8 border border-white/[0.08]"
        >
          <div className="flex items-start sm:items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] border border-white/[0.08] text-white">
              <Tv className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold tracking-tight text-white">
                {t.hostTitle}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-md leading-relaxed">
                {t.hostDesc}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => create(true)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] px-6 py-4 font-semibold text-white text-sm transition-all active:scale-[0.98] disabled:opacity-40"
              title="Juega tú solo desde este navegador"
            >
              <User className="h-4 w-4" />
              <span>{t.playSoloBtn}</span>
            </button>

            <button
              type="button"
              onClick={() => create(false)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-4 font-semibold text-black text-sm transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-40 shadow-md shadow-white/10"
            >
              {busy ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  <span>{t.creatingRoom}</span>
                </>
              ) : (
                <>
                  <span>{t.createRoomBtn}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </section>

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
