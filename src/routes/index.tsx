import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Gamepad2,
  Tv,
  Smartphone,
  Zap,
  ArrowRight,
  Sparkles,
  Wifi,
  Radio,
  Monitor,
  Flame,
} from "lucide-react";
import { api, errorText } from "@/game/api";
import { saveSession } from "@/game/session";
import { ErrorBox } from "@/game/ui";
import { PresenterAudio, type Language } from "@/components/PresenterAudio";
import { cn } from "@/lib/utils";

const I18N = {
  es: {
    metaTitle: "PeekRush — Juego de logos multijugador con TV y móviles",
    metaDesc: "Crea una sala o entra con un código para adivinar logos en tiempo real desde tu móvil.",
    brandTagline: "EL SHOW MULTIJUGADOR DEFINITIVO DE LOGOTIPOS",
    statusOnline: "RED EN LÍNEA",
    systemBadge: "SISTEMA v2.4",
    playerBadge: "CONSOLA DE JUGADOR // ACCESO MÓVIL",
    playerTitle: "Entrar a una Partida",
    playerDesc: "Introduce el código de 5 letras que se muestra en la pantalla de televisión:",
    roomCodePlaceholder: "CÓDIGO DE 5 LETRAS",
    joinBtn: "Entrar al Juego",
    hostBadge: "CONTROL DE SALA // 1-20 JUGADORES",
    hostTitle: "Crear Nueva Sala",
    hostDesc: "Inicia una sesión multijugador privada y obtén el código de sincronización para la pantalla TV.",
    createRoomBtn: "Iniciar Sala de Juego",
    creatingRoom: "Iniciando sala...",
    screenBadge: "ARENA PANTALLA GIGANTE // 4K",
    screenTitle: "Vincular Pantalla TV",
    screenDesc: "Convierte este monitor o televisión en el tablero central interactivo con código QR gigante para los jugadores.",
    linkScreenBtn: "Abrir Pantalla TV",
    demoBadge: "MODO SANDBOX",
    demoTitle: "¿Quieres probar la interfaz sin conectar dispositivos?",
    demoAction: "Abrir Demostración con Datos Ficticios",
    telemetryLine: "PEEKRUSH PROTOCOL // ELEVENLABS NEURAL ENGINE // DOCKER CLUSTER // INMERZION.IO",
  },
  en: {
    metaTitle: "PeekRush — Multiplayer Logo Party Game with TV & Phones",
    metaDesc: "Create a room or enter with a code to guess logos in real time from your mobile phone.",
    brandTagline: "THE ULTIMATE MULTIPLAYER LOGO SHOWDOWN",
    statusOnline: "GRID ONLINE",
    systemBadge: "SYSTEM v2.4",
    playerBadge: "PLAYER CONSOLE // MOBILE ACCESS",
    playerTitle: "Join Live Match",
    playerDesc: "Enter the 5-letter room code displayed on the main TV screen:",
    roomCodePlaceholder: "5-LETTER ROOM CODE",
    joinBtn: "Enter Arena",
    hostBadge: "MATCH CONTROL // 1-20 PLAYERS",
    hostTitle: "Host New Match",
    hostDesc: "Create a private multiplayer room and get the sync code for the big screen display.",
    createRoomBtn: "Launch Game Room",
    creatingRoom: "Launching...",
    screenBadge: "BIG SCREEN ARENA // 4K",
    screenTitle: "Link TV Display",
    screenDesc: "Turn this TV or monitor into the central gameboard with a giant QR code for all players.",
    linkScreenBtn: "Open TV Screen",
    demoBadge: "SANDBOX MODE",
    demoTitle: "Want to test drive the interface without mobile devices?",
    demoAction: "Open Interactive Mock Demo",
    telemetryLine: "PEEKRUSH PROTOCOL // ELEVENLABS NEURAL ENGINE // DOCKER CLUSTER // INMERZION.IO",
  },
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PeekRush — Juego de logos multijugador con TV y móviles" },
      { name: "description", content: "Crea una sala o entra con un código para adivinar logos en tiempo real desde tu móvil." },
      { property: "og:title", content: "PeekRush — Juego de logos multijugador con TV y móviles" },
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
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[#060913] text-foreground selection:bg-cyan-500 selection:text-black">
      {/* Fondo holográfico futurista */}
      <div className="pointer-events-none fixed inset-0 cyber-grid opacity-30" />
      <div className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 h-96 w-[700px] rounded-full bg-cyan-500/10 blur-[120px]" />
      <div className="pointer-events-none fixed -bottom-40 right-10 h-96 w-96 rounded-full bg-amber-400/5 blur-[120px]" />

      <main className="relative z-10 mx-auto max-w-4xl space-y-6 px-4 py-6 sm:py-10">
        {/* Cabecera Principal Arcade Cyberpunk */}
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-cyan-500/20 bg-gradient-to-r from-[#0d1424]/90 via-[#0a0f1c]/90 to-[#070b16]/90 p-4 sm:p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-3.5">
            {/* Logomarca de neón */}
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-amber-400 p-[2px] shadow-[0_0_20px_rgba(0,240,255,0.4)]">
              <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#070b16]">
                <Flame className="h-6 w-6 text-amber-400 animate-pulse" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,240,255,0.3)]">
                  PEEK<span className="text-cyan-400">RUSH</span>
                </span>
                <span className="rounded-md border border-cyan-500/30 bg-cyan-950/60 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-300">
                  {t.systemBadge}
                </span>
              </div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {t.brandTagline}
              </p>
            </div>
          </div>

          {/* Estado de red y selector de idioma */}
          <div className="flex items-center gap-3 ml-auto">
            <div className="hidden sm:flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3 py-1.5 font-mono text-xs text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <Wifi className="h-3.5 w-3.5" />
              <span className="font-bold">{t.statusOnline}</span>
            </div>

            {/* Language Switcher */}
            <div className="inline-flex rounded-xl border border-cyan-500/30 bg-black/50 p-1 text-xs font-mono font-bold shadow-inner">
              <button
                type="button"
                onClick={() => changeLanguage("es")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all duration-200",
                  lang === "es"
                    ? "bg-cyan-400 text-black font-black shadow-[0_0_15px_rgba(0,240,255,0.6)]"
                    : "text-muted-foreground hover:text-cyan-200",
                )}
                aria-pressed={lang === "es"}
              >
                <span>🇪🇸</span>
                <span>ES</span>
              </button>
              <button
                type="button"
                onClick={() => changeLanguage("en")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all duration-200",
                  lang === "en"
                    ? "bg-cyan-400 text-black font-black shadow-[0_0_15px_rgba(0,240,255,0.6)]"
                    : "text-muted-foreground hover:text-cyan-200",
                )}
                aria-pressed={lang === "en"}
              >
                <span>🇬🇧</span>
                <span>EN</span>
              </button>
            </div>
          </div>
        </header>

        <ErrorBox>{error}</ErrorBox>

        {/* Presentadora Virtual IA con visualizador de espectro Web Audio API */}
        <section aria-label="Presentadora IA de PeekRush">
          <PresenterAudio lang={lang} onLanguageChange={changeLanguage} />
        </section>

        {/* Consola Principal de Jugador (Hero de Acción Inmediata) */}
        <section
          aria-label={t.playerTitle}
          className="relative overflow-hidden rounded-3xl border border-cyan-400/40 bg-gradient-to-b from-[#101a2e]/95 via-[#0b1220]/95 to-[#070b14]/95 p-6 sm:p-8 shadow-[0_10px_40px_-10px_rgba(0,240,255,0.2)] backdrop-blur-xl"
        >
          {/* Acento lumínico superior */}
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display font-extrabold text-lg sm:text-xl text-white">
                    {t.playerTitle}
                  </h2>
                  <p className="font-mono text-xs text-cyan-300/80">
                    {t.playerDesc}
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-950/50 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                {t.playerBadge}
              </span>
            </div>

            <form onSubmit={handleJoin} className="flex flex-col sm:flex-row gap-3">
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
                  className="w-full rounded-2xl border-2 border-cyan-500/40 bg-black/60 px-5 py-4 font-mono text-xl sm:text-2xl font-black uppercase tracking-[0.25em] text-white placeholder:text-muted-foreground/40 placeholder:tracking-normal placeholder:font-sans placeholder:text-base outline-none transition focus:border-cyan-400 focus:bg-black/80 focus:shadow-[0_0_25px_rgba(0,240,255,0.4)]"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-xs text-cyan-400/50">
                  {code.length}/5
                </span>
              </div>

              <button
                type="submit"
                disabled={!code.trim()}
                className="group relative inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 px-8 py-4 font-display font-black text-black text-base sm:text-lg uppercase tracking-wider transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(255,230,0,0.4)] hover:shadow-[0_0_40px_rgba(255,230,0,0.6)] shrink-0"
              >
                <span>{t.joinBtn}</span>
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
            </form>
          </div>
        </section>

        {/* Paneles de Operación (Anfitrión de Sala y Pantalla TV en 2 columnas) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Tarjeta Anfitrión: Crear Sala */}
          <section
            aria-label={t.hostTitle}
            className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-cyan-500/25 bg-gradient-to-b from-[#0f1728]/90 via-[#0a0f1d]/90 to-[#070b16]/90 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-cyan-400/50 hover:shadow-[0_0_30px_rgba(0,240,255,0.2)]"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 group-hover:scale-105 transition-transform">
                  <Gamepad2 className="h-6 w-6" />
                </div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-400/80 rounded-md border border-cyan-500/20 bg-cyan-950/40 px-2 py-0.5">
                  {t.hostBadge}
                </span>
              </div>

              <div>
                <h3 className="font-display text-xl font-bold text-white">
                  {t.hostTitle}
                </h3>
                <p className="mt-1 font-sans text-sm text-muted-foreground leading-relaxed">
                  {t.hostDesc}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-cyan-500/15">
              <button
                type="button"
                onClick={create}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/50 bg-cyan-500/15 px-5 py-3.5 font-mono text-sm font-bold uppercase tracking-wider text-cyan-300 transition-all hover:bg-cyan-400 hover:text-black hover:shadow-[0_0_20px_rgba(0,240,255,0.5)] active:scale-[0.98] disabled:opacity-40"
              >
                <Zap className="h-4 w-4" />
                <span>{busy ? t.creatingRoom : t.createRoomBtn}</span>
              </button>
            </div>
          </section>

          {/* Tarjeta Pantalla TV: Vincular */}
          <section
            aria-label={t.screenTitle}
            className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-cyan-500/25 bg-gradient-to-b from-[#0f1728]/90 via-[#0a0f1d]/90 to-[#070b16]/90 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-cyan-400/50 hover:shadow-[0_0_30px_rgba(0,240,255,0.2)]"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-400 group-hover:scale-105 transition-transform">
                  <Tv className="h-6 w-6" />
                </div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-400/80 rounded-md border border-amber-500/20 bg-amber-950/30 px-2 py-0.5">
                  {t.screenBadge}
                </span>
              </div>

              <div>
                <h3 className="font-display text-xl font-bold text-white">
                  {t.screenTitle}
                </h3>
                <p className="mt-1 font-sans text-sm text-muted-foreground leading-relaxed">
                  {t.screenDesc}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-cyan-500/15">
              <button
                type="button"
                onClick={() => navigate({ to: "/tv" })}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/15 px-5 py-3.5 font-mono text-sm font-bold uppercase tracking-wider text-amber-300 transition-all hover:bg-amber-400 hover:text-black hover:shadow-[0_0_20px_rgba(255,230,0,0.5)] active:scale-[0.98]"
              >
                <Monitor className="h-4 w-4" />
                <span>{t.linkScreenBtn}</span>
              </button>
            </div>
          </section>
        </div>

        {/* Sandbox de Entrenamiento y Telemetría Footer */}
        <footer className="space-y-4 pt-2 pb-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-cyan-500/20 bg-black/40 px-5 py-3.5 text-xs text-muted-foreground backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <span>{t.demoTitle}</span>
            </div>
            <button
              type="button"
              onClick={() => navigate({ to: "/demo", search: { view: "tv", phase: "LOBBY" } })}
              className="font-mono text-xs font-bold text-cyan-400 underline underline-offset-4 hover:text-cyan-300 transition"
            >
              {t.demoAction} →
            </button>
          </div>

          <div className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
              {t.telemetryLine}
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
