import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Tv,
  ArrowRight,
  Sparkles,
  User,
  Zap,
  Trophy,
  Smartphone,
  Eye,
  Crown,
  CheckCircle2,
  Radio,
  ExternalLink,
} from "lucide-react";
import { api, errorText, type GlobalLeaderboardEntry } from "@/game/api";
import { saveSession } from "@/game/session";
import { ErrorBox } from "@/game/ui";
import { PresenterAudio, type Language } from "@/components/PresenterAudio";
import { cn } from "@/lib/utils";

type HomeTab = "play" | "rules" | "records";

const I18N = {
  es: {
    metaTitle: "PeekRush — El Party Game de Logos para TV y Móviles",
    metaDesc: "El party game multijugador donde tu móvil es el mando. Adivina 1.000 marcas reales en tiempo real frente a la tele con multiplicadores de velocidad.",
    heroBadge: "Party Game de Logos",
    heroTitle: "Adivina el logo.\nEn tiempo real.",
    heroSubtitle: "El party game donde tu móvil es el mando. Proyecta en la tele y compite con amigos.",
    badgeMultiplier: "Multiplicador hasta x3.5",
    badgeCatalog: "1.000 Marcas Reales",
    badgeController: "Tu móvil es el mando",
    badgePlayers: "1 a 16+ Jugadores",

    // Pestañas
    tabPlay: "Jugar",
    tabRules: "Cómo se juega",
    tabRecords: "Récords",

    // Panel Jugar - Anfitrión
    hostTitle: "Crear sala (Pantalla TV)",
    hostDesc: "Abre el tablero central en tu tele o monitor. Tus amigos verán los logos aquí y usarán sus móviles como mandos.",
    createRoomBtn: "Crear sala de fiesta",
    playSoloBtn: "Jugar en solitario (Arcade)",
    creatingRoom: "Iniciando juego...",

    // Panel Jugar - Jugador
    playerTitle: "Entrar a una sala",
    playerDesc: "¿Ya tienes la sala en la tele? Introduce el código de 5 letras y tu apodo:",
    roomCodePlaceholder: "CÓDIGO (ej. 7KX9P)",
    aliasPlaceholder: "Tu apodo (ej. Alex)",
    joinBtn: "¡A Jugar!",
    joiningBtn: "Conectando...",
    joinTip: "Sin descargas · Conexión instantánea desde cualquier navegador móvil",

    // Panel Cómo se juega
    howTitle: "¿Cómo se juega a PeekRush?",
    howSubtitle: "Diversión de salón inmediata en 3 sencillos pasos:",
    step1Title: "1. Pon la pantalla grande",
    step1Desc: "Abre la sala en la tele o proyector. Aparecerá el código de 5 letras y el código QR gigante.",
    step2Title: "2. Tu móvil es el mando",
    step2Desc: "Cada jugador abre peekrush.inmerzion.io en su móvil o escanea el QR. ¡Sin instalar apps ni registros!",
    step3Title: "3. Adivina y multiplica",
    step3Desc: "El logo se va revelando segundo a segundo. ¡Quien acierte antes multiplica sus puntos hasta x3.5!",
    audioSectionTitle: "Guía de audio de la presentadora",
    audioSectionDesc: "Escucha a la locutora explicar las reglas con voz neuronal y visualizador en vivo.",

    // Panel Récords
    recordsTitle: "Salón de la Fama Global",
    recordsSubtitle: "Los récords históricos y mejores puntuaciones de PeekRush en todo el mundo.",
    colRank: "Puesto",
    colPlayer: "Jugador",
    colScore: "Récord",
    colCorrect: "Aciertos",
    colWins: "Victorias",
    recordsCta: "¿Crees que puedes superar el récord? ¡Crea una sala y demuestra tus reflejos!",

    // Footer
    demoPrompt: "¿Quieres explorar la interfaz sin conectar dispositivos?",
    demoAction: "Abrir demostración",
    footerNote: "PeekRush · Desarrollado para disfrutar con amigos frente a la pantalla grande",
  },
  en: {
    metaTitle: "PeekRush — The Logo Party Game for TV & Phones",
    metaDesc: "The multiplayer party game where your phone is the controller. Guess 1,000 real global brands in real time on TV with speed multipliers.",
    heroBadge: "Logo Party Game",
    heroTitle: "Guess the brand.\nIn real time.",
    heroSubtitle: "The party game where your phone is the controller. Cast to the big TV and compete with friends.",
    badgeMultiplier: "Up to x3.5 Multiplier",
    badgeCatalog: "1,000 Real Brands",
    badgeController: "Phone as Controller",
    badgePlayers: "1 to 16+ Players",

    // Tabs
    tabPlay: "Play",
    tabRules: "How to Play",
    tabRecords: "Leaderboard",

    // Play Panel - Host
    hostTitle: "Host on TV",
    hostDesc: "Launch the main game board on your TV or monitor. Your friends will watch logos here and use their phones as controllers.",
    createRoomBtn: "Create party room",
    playSoloBtn: "Play solo (Arcade mode)",
    creatingRoom: "Starting game...",

    // Play Panel - Player
    playerTitle: "Join a room",
    playerDesc: "Already launched on TV? Enter the 5-letter room code and your nickname:",
    roomCodePlaceholder: "CODE (e.g. 7KX9P)",
    aliasPlaceholder: "Your nickname (e.g. Alex)",
    joinBtn: "Play Now!",
    joiningBtn: "Connecting...",
    joinTip: "No app download needed · Connects instantly on any mobile browser",

    // How to Play Panel
    howTitle: "How to Play PeekRush?",
    howSubtitle: "Living room party fun in 3 simple steps:",
    step1Title: "1. Cast on the big screen",
    step1Desc: "Open the room on your TV or projector. The display shows the 5-letter room code and giant QR.",
    step2Title: "2. Your phone is the controller",
    step2Desc: "Players open peekrush.inmerzion.io on their phones or scan the QR. No apps to install!",
    step3Title: "3. Guess and multiply",
    step3Desc: "The logo sharpens second by second. Guess first to multiply your score up to x3.5!",
    audioSectionTitle: "Host audio guide",
    audioSectionDesc: "Listen to the announcer explain the rules with neural voice and live visualizer.",

    // Records Panel
    recordsTitle: "Global Hall of Fame",
    recordsSubtitle: "The all-time greatest scores and champions of PeekRush worldwide.",
    colRank: "Rank",
    colPlayer: "Player",
    colScore: "Best Score",
    colCorrect: "Correct",
    colWins: "Wins",
    recordsCta: "Think you can beat the record? Create a room and test your reflexes!",

    // Footer
    demoPrompt: "Want to explore the interface without connecting devices?",
    demoAction: "Open demo",
    footerNote: "PeekRush · Designed for friends and family in front of the big screen",
  },
};

const INITIAL_LEADERBOARD: GlobalLeaderboardEntry[] = [
  { alias: "Cuquito", bestScore: 6400, totalCorrect: 8, gamesPlayed: 1, gamesWon: 1, lastPlayed: "2026-09-24T19:52:26.429Z" },
  { alias: "Bebita", bestScore: 5800, totalCorrect: 8, gamesPlayed: 1, gamesWon: 0, lastPlayed: "2026-09-24T19:52:26.429Z" },
  { alias: "Alan", bestScore: 4400, totalCorrect: 7, gamesPlayed: 1, gamesWon: 1, lastPlayed: "2026-09-24T18:12:30.297Z" },
  { alias: "Pochi", bestScore: 2400, totalCorrect: 5, gamesPlayed: 1, gamesWon: 1, lastPlayed: "2026-09-24T22:20:10.507Z" },
  { alias: "Vieja jugadora", bestScore: 1800, totalCorrect: 3, gamesPlayed: 1, gamesWon: 0, lastPlayed: "2026-09-24T22:20:10.507Z" },
];

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { room?: string; tab?: HomeTab } => {
    const raw = search.room;
    const cleanRoom = raw ? String(raw).replace(/['"]/g, "").trim().toUpperCase() : undefined;
    const rawTab = search.tab;
    const cleanTab: HomeTab | undefined =
      rawTab === "rules" || rawTab === "records" || rawTab === "play" ? (rawTab as HomeTab) : undefined;
    return {
      ...(cleanRoom ? { room: cleanRoom } : {}),
      ...(cleanTab ? { tab: cleanTab } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "PeekRush — El Party Game de Logos para TV y Móviles" },
      { name: "description", content: "El party game multijugador donde tu móvil es el mando. Adivina 1.000 marcas reales en tiempo real frente a la tele con multiplicadores de velocidad." },
      { property: "og:title", content: "PeekRush — El Party Game de Logos para TV y Móviles" },
      { property: "og:description", content: "El party game multijugador donde tu móvil es el mando. Adivina 1.000 marcas reales en tiempo real frente a la tele con multiplicadores de velocidad." },
    ],
  }),
  component: Home,
});

function Home() {
  const search = Route.useSearch();
  const initialRoom = search.room ? String(search.room).toUpperCase() : "";
  const initialTab: HomeTab = search.tab || "play";
  const navigate = useNavigate();
  const [lang, setLang] = useState<Language>("es");
  const [tab, setTab] = useState<HomeTab>(initialTab);
  const [code, setCode] = useState(initialRoom);
  const [alias, setAlias] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<GlobalLeaderboardEntry[]>(INITIAL_LEADERBOARD);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("peekrush_lang") as Language | null;
      if (saved === "es" || saved === "en") setLang(saved);
    } catch {}
  }, []);

  useEffect(() => {
    let active = true;
    api
      .leaderboard()
      .then((data) => {
        if (active && Array.isArray(data) && data.length > 0) {
          setLeaderboard(data.slice(0, 5));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const changeLanguage = (newLang: Language) => {
    setLang(newLang);
    try {
      localStorage.setItem("peekrush_lang", newLang);
    } catch {}
  };

  const handleTabChange = (newTab: HomeTab) => {
    setTab(newTab);
    navigate({
      search: (prev: any) => ({
        ...prev,
        tab: newTab === "play" ? undefined : newTab,
      }),
      replace: true,
    });
  };

  const t = I18N[lang];

  // Crear sala y lanzar pantalla de TV
  async function create(solo = false) {
    setBusy(true);
    setError(null);
    try {
      const r = await api.createRoom();
      saveSession("host", r.roomCode, { roomId: r.roomId, token: r.hostToken });

      const pairing = await api.screenPairing(r.roomCode, r.hostToken);
      const screen = await api.linkScreen(r.roomCode, pairing.pairingCode);
      saveSession("screen", r.roomCode, { roomId: r.roomId, token: screen.screenToken });

      if (solo) {
        const p = await api.joinPlayer(r.roomCode, "Tú");
        saveSession("player", r.roomCode, { roomId: r.roomId, token: p.playerToken, alias: p.alias, playerId: p.playerId });
      }

      navigate({ to: "/tv", search: { room: r.roomCode } });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  // Entrar a jugar con código y alias
  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    const cleanAlias = alias.trim();
    if (!cleanCode) return;

    if (cleanAlias) {
      setJoinBusy(true);
      setError(null);
      try {
        const r = await api.joinPlayer(cleanCode, cleanAlias);
        const s = { roomId: r.roomId, token: r.playerToken, alias: r.alias, playerId: r.playerId };
        saveSession("player", cleanCode, s);
        navigate({ to: "/play", search: { room: cleanCode } });
      } catch (err) {
        setError(errorText(err));
      } finally {
        setJoinBusy(false);
      }
    } else {
      navigate({ to: "/play", search: { room: cleanCode } });
    }
  }

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[#000000] text-foreground selection:bg-white selection:text-black flex flex-col justify-between">
      {/* Luz ambiental sutil estilo Apple */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 h-[500px] w-full max-w-4xl apple-glow opacity-80" />

      <div className="relative z-10 mx-auto max-w-3xl w-full px-4 py-6 sm:py-10 space-y-8 sm:space-y-10">
        {/* Barra Superior Minimalista */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-1">
              PeekRush<span className="text-amber-400">.</span>
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/[0.08] px-2.5 py-0.5 text-[11px] font-medium text-zinc-300">
              <Sparkles className="h-3 w-3 text-amber-400" />
              {t.heroBadge}
            </span>
          </div>

          {/* Selector de idioma */}
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

        {/* Hero Section */}
        <div className="text-center space-y-3 pt-1">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-white whitespace-pre-line leading-[1.08]">
            {t.heroTitle}
          </h1>
          <p className="mx-auto max-w-lg text-base sm:text-lg text-zinc-400 font-normal leading-relaxed">
            {t.heroSubtitle}
          </p>

          {/* Badges de juego refinados */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] border border-white/[0.08] px-3 py-1 text-xs font-medium text-zinc-300">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              {t.badgeMultiplier}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] border border-white/[0.08] px-3 py-1 text-xs font-medium text-zinc-300">
              <Smartphone className="h-3.5 w-3.5 text-zinc-400" />
              {t.badgeController}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] border border-white/[0.08] px-3 py-1 text-xs font-medium text-zinc-300">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              {t.badgeCatalog}
            </span>
          </div>
        </div>

        {/* Selector de Pestañas Menú Jackbox (Jugar / Cómo se juega / Récords) */}
        <div className="flex justify-center">
          <nav
            role="tablist"
            aria-label="Modos de la pantalla de inicio"
            className="inline-flex rounded-full bg-white/[0.05] border border-white/[0.08] p-1.5 backdrop-blur-md gap-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "play"}
              onClick={() => handleTabChange("play")}
              className={cn(
                "rounded-full px-5 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-2",
                tab === "play"
                  ? "bg-white text-black shadow-md shadow-white/10"
                  : "text-zinc-400 hover:text-white hover:bg-white/[0.04]",
              )}
            >
              <Tv className="h-4 w-4" />
              <span>{t.tabPlay}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "rules"}
              onClick={() => handleTabChange("rules")}
              className={cn(
                "rounded-full px-5 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-2",
                tab === "rules"
                  ? "bg-white text-black shadow-md shadow-white/10"
                  : "text-zinc-400 hover:text-white hover:bg-white/[0.04]",
              )}
            >
              <Radio className="h-4 w-4 text-amber-400" />
              <span>{t.tabRules}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "records"}
              onClick={() => handleTabChange("records")}
              className={cn(
                "rounded-full px-5 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-2",
                tab === "records"
                  ? "bg-white text-black shadow-md shadow-white/10"
                  : "text-zinc-400 hover:text-white hover:bg-white/[0.04]",
              )}
            >
              <Trophy className="h-4 w-4 text-yellow-400" />
              <span>{t.tabRecords}</span>
            </button>
          </nav>
        </div>

        <ErrorBox>{error}</ErrorBox>

        {/* PESTAÑA 1: JUGAR (Menú Principal con Crear Sala TV y Entrar con Móvil) */}
        {tab === "play" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Tarjeta de Anfitrión (Acción Principal de Salón / TV) */}
            <section
              aria-label={t.hostTitle}
              className="rounded-3xl apple-glass p-6 sm:p-8 border border-white/[0.1] shadow-xl space-y-5"
            >
              <div className="flex items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/[0.08] border border-white/[0.1] text-amber-400">
                    <Tv className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-white">
                      {t.hostTitle}
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-md">
                      {t.hostDesc}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => create(false)}
                  disabled={busy}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-4 font-bold text-black text-sm transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-40 shadow-lg shadow-white/10"
                >
                  {busy ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                      <span>{t.creatingRoom}</span>
                    </>
                  ) : (
                    <>
                      <Tv className="h-4 w-4" />
                      <span>{t.createRoomBtn}</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => create(true)}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] px-6 py-4 font-semibold text-white text-sm transition-all active:scale-[0.98] disabled:opacity-40 shrink-0"
                >
                  <User className="h-4 w-4 text-zinc-400" />
                  <span>{t.playSoloBtn}</span>
                </button>
              </div>
            </section>

            {/* Tarjeta de Jugador (Mando móvil con código y apodo directo) */}
            <section
              aria-label={t.playerTitle}
              className="rounded-3xl apple-glass p-6 sm:p-8 border border-white/[0.08] space-y-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-indigo-400" />
                  <h3 className="text-lg font-semibold tracking-tight text-white">
                    {t.playerTitle}
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-zinc-400">
                  {t.playerDesc}
                </p>
              </div>

              <form onSubmit={handleJoin} className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <input
                      aria-label="Código de sala"
                      placeholder={t.roomCodePlaceholder}
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      maxLength={5}
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck="false"
                      className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.1] px-4 py-3.5 font-mono text-lg uppercase tracking-widest text-white placeholder:text-zinc-600 placeholder:font-sans placeholder:tracking-normal placeholder:text-xs outline-none transition focus:border-white/30 focus:bg-white/[0.07] focus:ring-4 focus:ring-white/[0.04] text-center font-bold"
                    />
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-[11px] text-zinc-500">
                      {code.length}/5
                    </span>
                  </div>

                  <input
                    aria-label="Tu apodo"
                    placeholder={t.aliasPlaceholder}
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    maxLength={16}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                    className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.1] px-4 py-3.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-white/30 focus:bg-white/[0.07] focus:ring-4 focus:ring-white/[0.04]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!code.trim() || joinBusy}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-white/[0.12] hover:bg-white/[0.2] border border-white/[0.16] px-6 py-3.5 font-bold text-white text-sm transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  {joinBusy ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      <span>{t.joiningBtn}</span>
                    </>
                  ) : (
                    <>
                      <span>{t.joinBtn}</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <p className="text-[11px] text-zinc-500 text-center flex items-center justify-center gap-1.5 pt-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>{t.joinTip}</span>
              </p>
            </section>
          </div>
        )}

        {/* PESTAÑA 2: CÓMO SE JUEGA (Presentación en 3 Pasos + Guía de Audio de la Presentadora) */}
        {tab === "rules" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* 3 Pasos de Fiesta */}
            <section
              aria-label={t.howTitle}
              className="rounded-3xl apple-glass p-6 sm:p-8 border border-white/[0.08] space-y-6"
            >
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  {t.howTitle}
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400">
                  {t.howSubtitle}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md">
                      01
                    </span>
                    <Tv className="h-4 w-4 text-zinc-400" />
                  </div>
                  <h3 className="text-sm font-bold text-white">
                    {t.step1Title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {t.step1Desc}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded-md">
                      02
                    </span>
                    <Smartphone className="h-4 w-4 text-zinc-400" />
                  </div>
                  <h3 className="text-sm font-bold text-white">
                    {t.step2Title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {t.step2Desc}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md">
                      03
                    </span>
                    <Zap className="h-4 w-4 text-amber-400" />
                  </div>
                  <h3 className="text-sm font-bold text-white">
                    {t.step3Title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {t.step3Desc}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => setTab("play")}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-xs font-bold text-black transition-all hover:bg-zinc-200 active:scale-95 shadow-md"
                >
                  <span>{t.tabPlay}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </section>

            {/* Audio Oficial de la Presentadora con Visualizador de Ondas */}
            <section aria-label="Audio de la presentadora">
              <PresenterAudio lang={lang} />
            </section>
          </div>
        )}

        {/* PESTAÑA 3: RÉCORDS (Salón de la Fama Global) */}
        {tab === "records" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <section
              aria-label={t.recordsTitle}
              className="rounded-3xl apple-glass p-6 sm:p-8 border border-white/[0.08] space-y-5"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-400" />
                  <h2 className="text-xl font-bold tracking-tight text-white">
                    {t.recordsTitle}
                  </h2>
                </div>
                <p className="text-xs sm:text-sm text-zinc-400">
                  {t.recordsSubtitle}
                </p>
              </div>

              <div className="divide-y divide-white/[0.06]">
                {leaderboard.map((entry, idx) => {
                  const medals = ["🥇", "🥈", "🥉"];
                  const medal = medals[idx] || `${idx + 1}º`;
                  return (
                    <div
                      key={entry.alias + idx}
                      className="flex items-center justify-between py-3.5 px-2 hover:bg-white/[0.02] rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-base font-bold w-6 text-center">
                          {medal}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-white flex items-center gap-1.5">
                            {entry.alias}
                            {idx === 0 && <Crown className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />}
                          </p>
                          <p className="text-[11px] text-zinc-400">
                            {entry.totalCorrect} {t.colCorrect.toLowerCase()} · {entry.gamesWon} {t.colWins.toLowerCase()}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-mono text-base font-extrabold text-amber-400">
                          {entry.bestScore.toLocaleString()} pts
                        </span>
                        <p className="text-[10px] text-zinc-500 font-mono">
                          {new Date(entry.lastPlayed).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 text-center">
                <p className="text-xs text-zinc-300 font-medium">
                  {t.recordsCta}
                </p>
              </div>
            </section>
          </div>
        )}

        {/* Footer Minimalista */}
        <footer className="pt-4 pb-8 text-center space-y-3">
          <p className="text-xs text-zinc-500">
            {t.demoPrompt}{" "}
            <button
              type="button"
              onClick={() => navigate({ to: "/demo", search: { view: "tv", phase: "LOBBY" } })}
              className="text-zinc-300 underline underline-offset-4 hover:text-white transition inline-flex items-center gap-1"
            >
              <span>{t.demoAction}</span>
              <ExternalLink className="h-3 w-3" />
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
