import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
  Play,
  CheckCircle2,
  Flame,
  ShieldCheck,
  Radio,
  ExternalLink,
} from "lucide-react";
import { api, errorText, type GlobalLeaderboardEntry } from "@/game/api";
import { saveSession } from "@/game/session";
import { ErrorBox } from "@/game/ui";
import { PresenterAudio, type Language } from "@/components/PresenterAudio";
import { cn } from "@/lib/utils";

const I18N = {
  es: {
    metaTitle: "PeekRush — El Party Game de Logos para TV y Móviles",
    metaDesc: "El party game multijugador donde tu móvil es el mando. Adivina 1.000 marcas reales en tiempo real frente a la tele con multiplicadores de velocidad.",
    heroBadge: "⚡ Party Game de Logos · Tu móvil es el mando",
    heroTitle: "Adivina el logo.\nEn tiempo real.",
    heroSubtitle: "El juego de fiesta multijugador para tu televisión donde tu móvil es el mando. Proyecta en la pantalla grande, compite con amigos y multiplica tus puntos adivinando antes que nadie.",
    badgeMultiplier: "Multiplicador hasta x3.5",
    badgeCatalog: "1.000 Marcas Reales",
    badgeController: "Tu móvil es el mando",
    badgePlayers: "1 a 16+ Jugadores",

    // Tarjeta Jugador (Jackbox.tv style)
    playerCardTitle: "Entrar a la partida",
    playerCardDesc: "¿Tus amigos ya tienen la sala en la tele? Introduce el código de 5 letras y tu apodo para entrar:",
    roomCodeLabel: "Código de sala",
    roomCodePlaceholder: "CÓDIGO (ej. 7KX9P)",
    aliasLabel: "Tu apodo o nombre",
    aliasPlaceholder: "Tu apodo (ej. Alex)",
    joinBtn: "¡A Jugar!",
    joiningBtn: "Conectando...",
    joinTip: "Sin apps ni descargas · Cualquier navegador móvil se conecta al instante",

    // Tarjeta Anfitrión
    hostCardTitle: "Crear sala en la tele",
    hostCardDesc: "Abre el tablero central en esta pantalla (TV, PC o proyector). Tus amigos verán los logos aquí y usarán sus móviles como mandos.",
    createRoomBtn: "Crear sala de fiesta",
    playSoloBtn: "Jugar en solitario (Arcade)",
    creatingRoom: "Creando sala...",

    // Cómo se juega
    howToPlayBadge: "Guía de Juego",
    howToPlayTitle: "¿Cómo se juega a PeekRush?",
    howToPlaySubtitle: "Inspirado en los mejores party games de salón: diversión inmediata, cero barreras y emoción segundo a segundo.",
    steps: [
      {
        num: "01",
        title: "Pon la pantalla grande",
        desc: "Haz clic en 'Crear sala' en tu tele, ordenador o proyector. Aparecerá el código de 5 letras y un código QR gigante.",
        icon: Tv,
        highlight: "TV / PC / Proyector",
      },
      {
        num: "02",
        title: "Tu móvil es el mando",
        desc: "Cada jugador abre peekrush.inmerzion.io en su móvil o escanea el QR con su cámara. ¡Sin instalar apps ni crear cuentas!",
        icon: Smartphone,
        highlight: "Cero descargas",
      },
      {
        num: "03",
        title: "Revelado en 4 etapas",
        desc: "El logotipo arranca pixelado en la tele y se vuelve más nítido progresivamente durante 20 segundos de máxima adrenalina.",
        icon: Eye,
        highlight: "De silueta a nítido",
      },
      {
        num: "04",
        title: "Multiplicador de velocidad",
        desc: "¡Cada segundo cuenta! Cada segundo restante añade +0.10x. Si aciertas al inicio multiplicas tus puntos hasta x3.5.",
        icon: Zap,
        highlight: "Hasta 3.5x puntos",
      },
      {
        num: "05",
        title: "Podio y récord mundial",
        desc: "Al terminar 5 rondas, la tele corona a los ganadores en el podio y los récords se graban en la clasificación global.",
        icon: Trophy,
        highlight: "Clasificación en vivo",
      },
    ],

    // Simulador interactivo
    simBadge: "Pruébalo aquí mismo",
    simTitle: "Simulador de Ronda en Vivo",
    simSubtitle: "Mira cómo funciona la mecánica en directo: el logo se despixela y el multiplicador de velocidad premia a los más rápidos.",
    simStageLabel: "Etapa de revelado",
    simSelectBrand: "Selecciona una marca de prueba:",
    simBasePoints: "Puntos base",
    simMultiplierBadge: "Multiplicador activo",
    simEstimatedScore: "Puntuación al acertar",
    simTestButton: "Simular acierto ahora",
    simCelebration: "¡Acierto registrado! Sumas puntos con multiplicador de velocidad.",

    // Anfitriona
    hostAudioSectionTitle: "Locutora oficial del juego",
    hostAudioSectionDesc: "Escucha a la presentadora explicar las reglas y ambientar la partida con voz neuronal en vivo.",

    // Leaderboard
    leaderboardBadge: "Top Mundial",
    leaderboardTitle: "Salón de la Fama Global",
    leaderboardSubtitle: "Los récords históricos y mejores jugadores de PeekRush en todo el mundo.",
    colRank: "Puesto",
    colPlayer: "Jugador",
    colBestScore: "Puntuación",
    colCorrect: "Aciertos",
    colWins: "Victorias",
    colLastPlayed: "Última partida",
    leaderboardEmpty: "Aún no hay partidas registradas. ¡Sé el primero en entrar al Salón de la Fama!",
    leaderboardCta: "¿Crees que puedes superar el récord? ¡Crea una sala y demuestra tus reflejos!",

    // Demo & Footer
    demoPrompt: "¿Quieres ver la simulación sincronizada de TV y móvil dividida?",
    demoAction: "Abrir simulador dividido",
    footerNote: "PeekRush · El party game de logos multijugador para jugar con amigos y familia.",
  },
  en: {
    metaTitle: "PeekRush — The Logo Party Game for TV & Smartphones",
    metaDesc: "The multiplayer party game where your phone is the controller. Guess 1,000 real global brands in real time on TV with speed multipliers.",
    heroBadge: "⚡ Logo Party Game · Your phone is the controller",
    heroTitle: "Guess the brand.\nIn real time.",
    heroSubtitle: "The multiplayer party game for your big screen where your phone is the controller. Cast to your TV, compete with friends, and multiply your points by guessing first.",
    badgeMultiplier: "Up to x3.5 Multiplier",
    badgeCatalog: "1,000 Real Brands",
    badgeController: "Phone as Controller",
    badgePlayers: "1 to 16+ Players",

    // Player Card (Jackbox.tv style)
    playerCardTitle: "Join the game",
    playerCardDesc: "Did your friends launch the room on TV? Enter the 5-letter room code and your nickname to jump straight in:",
    roomCodeLabel: "Room code",
    roomCodePlaceholder: "CODE (e.g. 7KX9P)",
    aliasLabel: "Your nickname",
    aliasPlaceholder: "Your nickname (e.g. Alex)",
    joinBtn: "Play Now!",
    joiningBtn: "Connecting...",
    joinTip: "No app download needed · Any smartphone browser connects instantly",

    // Host Card
    hostCardTitle: "Host on the big screen",
    hostCardDesc: "Launch the main game board on this screen (TV, PC or projector). Your friends will watch logos here and use their phones as controllers.",
    createRoomBtn: "Create party room",
    playSoloBtn: "Play solo (Arcade mode)",
    creatingRoom: "Creating room...",

    // How to Play
    howToPlayBadge: "Game Guide",
    howToPlayTitle: "How to Play PeekRush?",
    howToPlaySubtitle: "Inspired by living room party games: instant fun, zero friction, and high-stakes excitement every single second.",
    steps: [
      {
        num: "01",
        title: "Cast on the big screen",
        desc: "Click 'Create party room' on your TV, computer, or projector. The display shows the 5-letter room code and a giant QR code.",
        icon: Tv,
        highlight: "TV / PC / Projector",
      },
      {
        num: "02",
        title: "Your phone is the controller",
        desc: "Every player opens peekrush.inmerzion.io on their mobile device or scans the QR with their camera. No apps or accounts required!",
        icon: Smartphone,
        highlight: "Zero downloads",
      },
      {
        num: "03",
        title: "Reveal in 4 stages",
        desc: "The brand logo starts heavily pixelated on the TV and gradually sharpens through 4 stages over 20 seconds of intense action.",
        icon: Eye,
        highlight: "Pixel to clarity",
      },
      {
        num: "04",
        title: "Speed multiplier",
        desc: "Every remaining second adds +0.10x to your multiplier! Guess in the first seconds to multiply your score up to x3.5.",
        icon: Zap,
        highlight: "Up to 3.5x points",
      },
      {
        num: "05",
        title: "Podium & world records",
        desc: "After 5 rapid rounds, the TV crowns the podium winners and top scores are recorded on the worldwide global leaderboard.",
        icon: Trophy,
        highlight: "Live leaderboard",
      },
    ],

    // Simulator
    simBadge: "Interactive Preview",
    simTitle: "Live Round Simulator",
    simSubtitle: "Experience the mechanics right here: see how logos unpixelate and how speed multipliers reward lightning-fast answers.",
    simStageLabel: "Reveal stage",
    simSelectBrand: "Pick a sample brand:",
    simBasePoints: "Base points",
    simMultiplierBadge: "Live multiplier",
    simEstimatedScore: "Estimated score on guess",
    simTestButton: "Simulate correct guess",
    simCelebration: "Guess registered! Extra points awarded with speed multiplier.",

    // Host
    hostAudioSectionTitle: "Official Game Announcer",
    hostAudioSectionDesc: "Listen to the host explain the rules with neural voice and live audio frequency visualizer.",

    // Leaderboard
    leaderboardBadge: "World Records",
    leaderboardTitle: "Global Hall of Fame",
    leaderboardSubtitle: "The all-time greatest champions and records across PeekRush matches.",
    colRank: "Rank",
    colPlayer: "Player",
    colBestScore: "Score",
    colCorrect: "Correct",
    colWins: "Wins",
    colLastPlayed: "Last match",
    leaderboardEmpty: "No games recorded yet. Be the first to enter the Hall of Fame!",
    leaderboardCta: "Think you can beat the world record? Create a room and test your reflexes!",

    // Demo & Footer
    demoPrompt: "Want to explore the synchronized TV and phone split-screen preview?",
    demoAction: "Open split-screen demo",
    footerNote: "PeekRush · The multiplayer logo party game designed for friends and family.",
  },
};

const SAMPLE_LOGOS = [
  { id: "apple", name: "Apple", src: "/logos/brand-apple.png" },
  { id: "nike", name: "Nike", src: "/logos/brand-nike.png" },
  { id: "spotify", name: "Spotify", src: "/logos/brand-spotify.png" },
  { id: "adidas", name: "Adidas", src: "/logos/brand-adidas.png" },
];

const STAGES = [
  { stage: 1, nameEs: "Etapa 1 · Silueta", nameEn: "Stage 1 · Silhouette", remainingSec: 18, basePoints: 1000, blockSize: 12 },
  { stage: 2, nameEs: "Etapa 2 · Forma", nameEn: "Stage 2 · Outline", remainingSec: 13, basePoints: 600, blockSize: 24 },
  { stage: 3, nameEs: "Etapa 3 · Rasgos", nameEn: "Stage 3 · Features", remainingSec: 8, basePoints: 300, blockSize: 56 },
  { stage: 4, nameEs: "Etapa 4 · Nítido", nameEn: "Stage 4 · Clear", remainingSec: 3, basePoints: 100, blockSize: 512 },
];

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { room?: string } => {
    const raw = search.room;
    if (raw === undefined || raw === null || raw === "") return {};
    const clean = String(raw).replace(/['"]/g, "").trim().toUpperCase();
    return clean ? { room: clean } : {};
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

const INITIAL_LEADERBOARD: GlobalLeaderboardEntry[] = [
  { alias: "Cuquito", bestScore: 6400, totalCorrect: 8, gamesPlayed: 1, gamesWon: 1, lastPlayed: "2026-09-24T19:52:26.429Z" },
  { alias: "Bebita", bestScore: 5800, totalCorrect: 8, gamesPlayed: 1, gamesWon: 0, lastPlayed: "2026-09-24T19:52:26.429Z" },
  { alias: "Alan", bestScore: 4400, totalCorrect: 7, gamesPlayed: 1, gamesWon: 1, lastPlayed: "2026-09-24T18:12:30.297Z" },
  { alias: "Pochi", bestScore: 2400, totalCorrect: 5, gamesPlayed: 1, gamesWon: 1, lastPlayed: "2026-09-24T22:20:10.507Z" },
  { alias: "Vieja jugadora", bestScore: 1800, totalCorrect: 3, gamesPlayed: 1, gamesWon: 0, lastPlayed: "2026-09-24T22:20:10.507Z" },
];

function Home() {
  const search = Route.useSearch();
  const initialRoom = search.room ? String(search.room).toUpperCase() : "";
  const navigate = useNavigate();
  const [lang, setLang] = useState<Language>("es");
  const [code, setCode] = useState(initialRoom);
  const [alias, setAlias] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<GlobalLeaderboardEntry[]>(INITIAL_LEADERBOARD);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

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
        if (active && Array.isArray(data)) setLeaderboard(data.slice(0, 5));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingLeaderboard(false);
      });
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

  const t = I18N[lang];

  // Crear sala y lanzar pantalla TV
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

  // Flujo Jackbox.tv: Entrar con código + alias directo
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
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[#000000] text-foreground selection:bg-white selection:text-black">
      {/* Luces de ambiente sutiles estilo show/fiesta */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 h-[550px] w-full max-w-5xl apple-glow opacity-80" />
      <div className="pointer-events-none fixed top-[600px] left-1/4 -translate-x-1/2 h-[400px] w-[500px] bg-indigo-900/10 blur-[140px]" />
      <div className="pointer-events-none fixed top-[900px] right-1/4 translate-x-1/2 h-[400px] w-[500px] bg-amber-500/5 blur-[140px]" />

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-6 sm:py-12 space-y-12 sm:space-y-16">
        {/* Cabecera Principal */}
        <header className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black tracking-tight text-white flex items-center gap-1">
              PeekRush<span className="text-amber-400">.</span>
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-zinc-300 border border-white/[0.06]">
              <Sparkles className="h-3 w-3 text-amber-400" />
              Party Game
            </span>
          </div>

          <div className="flex items-center gap-3">
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
          </div>
        </header>

        {/* Hero Section con Insignias de Juego */}
        <section className="text-center space-y-5 pt-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/10 border border-amber-400/20 px-4 py-1.5 text-xs font-semibold text-amber-300">
            <Flame className="h-3.5 w-3.5" />
            <span>{t.heroBadge}</span>
          </div>

          <h1 className="text-4xl sm:text-7xl font-black tracking-tight text-white whitespace-pre-line leading-[1.05]">
            {t.heroTitle}
          </h1>

          <p className="mx-auto max-w-xl text-base sm:text-xl text-zinc-400 font-normal leading-relaxed">
            {t.heroSubtitle}
          </p>

          {/* Badges de juego */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] px-3.5 py-1 text-xs font-medium text-zinc-300">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              {t.badgeMultiplier}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] px-3.5 py-1 text-xs font-medium text-zinc-300">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              {t.badgeCatalog}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] px-3.5 py-1 text-xs font-medium text-zinc-300">
              <Smartphone className="h-3.5 w-3.5 text-indigo-400" />
              {t.badgeController}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] px-3.5 py-1 text-xs font-medium text-zinc-300">
              <Crown className="h-3.5 w-3.5 text-yellow-400" />
              {t.badgePlayers}
            </span>
          </div>
        </section>

        <ErrorBox>{error}</ErrorBox>

        {/* Zona de Acción Dual: 1) Mando Móvil / Jugador  2) Pantalla TV / Anfitrión */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          {/* Tarjeta 1: Entrar a la partida (Estilo Jackbox.tv en 1 paso) */}
          <div className="md:col-span-7 rounded-3xl apple-glass p-6 sm:p-8 space-y-5 border border-white/[0.12] shadow-2xl relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
                  <Smartphone className="h-3.5 w-3.5" />
                  Mando Móvil
                </span>
                <span className="text-[11px] text-zinc-500 font-mono">jackbox.tv style</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white">
                {t.playerCardTitle}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                {t.playerCardDesc}
              </p>
            </div>

            <form onSubmit={handleJoin} className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    {t.roomCodeLabel}
                  </label>
                  <div className="relative">
                    <input
                      aria-label={t.roomCodeLabel}
                      placeholder={t.roomCodePlaceholder}
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      maxLength={5}
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck="false"
                      className="w-full rounded-2xl bg-white/[0.06] border border-white/[0.12] px-4 py-3.5 font-mono text-lg uppercase tracking-widest text-white placeholder:text-zinc-600 placeholder:font-sans placeholder:tracking-normal placeholder:text-xs outline-none transition focus:border-amber-400/60 focus:bg-white/[0.09] focus:ring-4 focus:ring-amber-400/10 text-center font-bold"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-zinc-500">
                      {code.length}/5
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    {t.aliasLabel}
                  </label>
                  <input
                    aria-label={t.aliasLabel}
                    placeholder={t.aliasPlaceholder}
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    maxLength={16}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                    className="w-full rounded-2xl bg-white/[0.06] border border-white/[0.12] px-4 py-3.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-amber-400/60 focus:bg-white/[0.09] focus:ring-4 focus:ring-amber-400/10 font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!code.trim() || joinBusy}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 font-bold text-black text-base transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-white/10"
              >
                {joinBusy ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    <span>{t.joiningBtn}</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 fill-black" />
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
          </div>

          {/* Tarjeta 2: Anfitrión / Pantalla de Televisión */}
          <div className="md:col-span-5 rounded-3xl apple-glass p-6 sm:p-8 space-y-5 border border-white/[0.08] flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-400">
                  <Tv className="h-3.5 w-3.5" />
                  Pantalla Grande
                </span>
                <span className="text-[11px] text-zinc-500">Living Room / PC</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white">
                {t.hostCardTitle}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                {t.hostCardDesc}
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => create(false)}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.14] px-6 py-4 font-bold text-white text-sm transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm"
              >
                {busy ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <span>{t.creatingRoom}</span>
                  </>
                ) : (
                  <>
                    <Tv className="h-4 w-4 text-amber-400" />
                    <span>{t.createRoomBtn}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => create(true)}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-transparent hover:bg-white/[0.04] border border-white/[0.08] px-5 py-3 text-xs font-semibold text-zinc-300 transition-all active:scale-[0.98] disabled:opacity-40"
              >
                <User className="h-3.5 w-3.5 text-zinc-400" />
                <span>{t.playSoloBtn}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Sección: ¿Cómo se juega? (Inspirado en Jackbox Games) */}
        <section aria-labelledby="how-to-play" className="space-y-8 pt-4">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <Sparkles className="h-3 w-3" />
              {t.howToPlayBadge}
            </span>
            <h2 id="how-to-play" className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              {t.howToPlayTitle}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              {t.howToPlaySubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {t.steps.map((st, i) => {
              const Icon = st.icon;
              return (
                <div
                  key={i}
                  className="rounded-3xl apple-glass p-5 sm:p-6 border border-white/[0.08] space-y-3 relative group hover:border-white/20 transition-all duration-300"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-2xl font-black text-white/30 group-hover:text-amber-400 transition-colors">
                      {st.num}
                    </span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06] border border-white/[0.08] text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-white tracking-tight">
                    {st.title}
                  </h3>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {st.desc}
                  </p>

                  <div className="pt-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] border border-white/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-zinc-300">
                      {st.highlight}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Sección: Simulador de Ronda en Vivo (Experiencia Interactiva de Revelado y Multiplicador) */}
        <section aria-labelledby="live-simulator" className="space-y-6 pt-4">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-300">
              <Zap className="h-3 w-3" />
              {t.simBadge}
            </span>
            <h2 id="live-simulator" className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              {t.simTitle}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              {t.simSubtitle}
            </p>
          </div>

          <InteractiveSimulator lang={lang} t={t} />
        </section>

        {/* Sección: Guía de la Anfitriona con Audio Neuronal */}
        <section aria-labelledby="host-audio" className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
            <div>
              <h2 id="host-audio" className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <Radio className="h-4 w-4 text-indigo-400" />
                {t.hostAudioSectionTitle}
              </h2>
              <p className="text-xs text-zinc-400">
                {t.hostAudioSectionDesc}
              </p>
            </div>
          </div>

          <PresenterAudio lang={lang} />
        </section>

        {/* Sección: Salón de la Fama / Global Leaderboard */}
        <section aria-labelledby="leaderboard" className="space-y-6 pt-4">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-yellow-400">
              <Trophy className="h-3 w-3" />
              {t.leaderboardBadge}
            </span>
            <h2 id="leaderboard" className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              {t.leaderboardTitle}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              {t.leaderboardSubtitle}
            </p>
          </div>

          <div className="rounded-3xl apple-glass p-5 sm:p-7 border border-white/[0.08] shadow-2xl space-y-4">
            {loadingLeaderboard ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-white mr-2 align-middle" />
                Cargando clasificaciones...
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400">
                {t.leaderboardEmpty}
              </div>
            ) : (
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
                        <span className="font-mono text-base font-bold w-7 text-center">
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
            )}

            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 text-center">
              <p className="text-xs text-zinc-300 font-medium">
                {t.leaderboardCta}
              </p>
            </div>
          </div>
        </section>

        {/* Footer y Enlace a la Demostración */}
        <footer className="pt-6 pb-12 text-center space-y-4 border-t border-white/[0.06]">
          <p className="text-xs text-zinc-500">
            {t.demoPrompt}{" "}
            <button
              type="button"
              onClick={() => navigate({ to: "/demo", search: { view: "split", phase: "ROUND_ACTIVE" } })}
              className="text-amber-400 underline underline-offset-4 hover:text-amber-300 transition font-medium inline-flex items-center gap-1"
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

/** Componente del Simulador Interactivo de Ronda */
function InteractiveSimulator({ lang, t }: { lang: Language; t: (typeof I18N)["es"] }) {
  const [logoIdx, setLogoIdx] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pixelatedSrc, setPixelatedSrc] = useState(SAMPLE_LOGOS[0].src);

  const logo = SAMPLE_LOGOS[logoIdx];
  const st = STAGES[stageIdx];
  const multiplier = Number((1.0 + st.remainingSec * 0.1).toFixed(2));
  const estimatedPoints = Math.round(st.basePoints * multiplier);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = logo.src;
    img.onload = () => {
      const size = 320;
      const smallSize = st.blockSize;
      const offCanvas = document.createElement("canvas");
      offCanvas.width = smallSize;
      offCanvas.height = smallSize;
      const offCtx = offCanvas.getContext("2d");
      if (!offCtx) return;
      offCtx.fillStyle = "#000000";
      offCtx.fillRect(0, 0, smallSize, smallSize);
      offCtx.drawImage(img, 0, 0, smallSize, smallSize);

      const mainCanvas = document.createElement("canvas");
      mainCanvas.width = size;
      mainCanvas.height = size;
      const mainCtx = mainCanvas.getContext("2d");
      if (!mainCtx) return;
      mainCtx.imageSmoothingEnabled = false;
      mainCtx.drawImage(offCanvas, 0, 0, size, size);

      setPixelatedSrc(mainCanvas.toDataURL("image/png"));
    };
  }, [logo.src, st.blockSize]);

  const handleTestGuess = () => {
    setFeedback(`+${estimatedPoints.toLocaleString()} pts ⚡ ${multiplier.toFixed(1)}x`);
    const timer = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(timer);
  };

  return (
    <div className="rounded-3xl apple-glass p-6 sm:p-8 border border-white/[0.1] shadow-2xl space-y-6">
      {/* Selector de marca */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-semibold text-zinc-400">
          {t.simSelectBrand}
        </span>
        <div className="flex items-center gap-1.5">
          {SAMPLE_LOGOS.map((l, i) => (
            <button
              key={l.id}
              type="button"
              onClick={() => {
                setLogoIdx(i);
                setFeedback(null);
              }}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all",
                logoIdx === i
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "bg-white/[0.06] text-zinc-400 hover:text-white border border-white/[0.06]",
              )}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>

      {/* Pantalla simulada del tablero */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Mockup de la TV */}
        <div className="md:col-span-6 relative flex flex-col items-center justify-center rounded-2xl bg-black border border-white/[0.12] p-6 shadow-inner min-h-[280px]">
          {/* Barra superior de la TV simulada */}
          <div className="w-full flex items-center justify-between pb-4 border-b border-white/[0.08] text-xs">
            <span className="font-mono text-zinc-400 font-semibold tracking-wider">
              RONDA 1/5 · {lang === "es" ? st.nameEs : st.nameEn}
            </span>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-0.5 font-mono text-xs font-bold text-amber-300 border border-amber-400/30">
                ⚡ {multiplier.toFixed(1)}x
              </span>
              <span className="font-mono font-bold text-white bg-white/[0.08] px-2 py-0.5 rounded-md">
                {st.remainingSec}s
              </span>
            </div>
          </div>

          {/* Logo pixelado */}
          <div className="relative my-4 flex items-center justify-center">
            <img
              src={pixelatedSrc}
              alt="Simulación de logo"
              className="h-36 w-36 sm:h-44 sm:w-44 object-contain rounded-xl border border-white/[0.04]"
            />
            {feedback && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-xl backdrop-blur-sm animate-in fade-in zoom-in-95">
                <span className="font-mono text-lg font-black text-emerald-400 bg-emerald-950/80 border border-emerald-400/40 px-3.5 py-1.5 rounded-xl shadow-lg">
                  {feedback}
                </span>
              </div>
            )}
          </div>

          <p className="text-[11px] text-zinc-500 font-mono">
            {lang === "es" ? "Logo en tiempo real en la pantalla de TV" : "Live logo on the TV screen"}
          </p>
        </div>

        {/* Controles de etapa y desglose de puntos */}
        <div className="md:col-span-6 space-y-4">
          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {t.simStageLabel}
            </span>
            <div className="grid grid-cols-2 gap-2">
              {STAGES.map((s, idx) => {
                const isSelected = stageIdx === idx;
                const m = Number((1.0 + s.remainingSec * 0.1).toFixed(2));
                return (
                  <button
                    key={s.stage}
                    type="button"
                    onClick={() => {
                      setStageIdx(idx);
                      setFeedback(null);
                    }}
                    className={cn(
                      "flex flex-col items-start p-3 rounded-2xl border text-left transition-all",
                      isSelected
                        ? "bg-white/[0.1] border-amber-400/60 shadow-md shadow-amber-400/5 ring-1 ring-amber-400/40"
                        : "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] text-zinc-400",
                    )}
                  >
                    <span className="text-xs font-bold text-white">
                      {lang === "es" ? s.nameEs : s.nameEn}
                    </span>
                    <span className="font-mono text-[11px] text-amber-300">
                      ⚡ {m.toFixed(1)}x · {s.basePoints} pts
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desglose de puntuación dinámica */}
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>{t.simBasePoints}:</span>
              <span className="font-mono text-white font-semibold">{st.basePoints} pts</span>
            </div>
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>{t.simMultiplierBadge}:</span>
              <span className="font-mono text-amber-400 font-bold">⚡ {multiplier.toFixed(1)}x ({st.remainingSec}s)</span>
            </div>
            <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between">
              <span className="text-xs font-bold text-white">{t.simEstimatedScore}:</span>
              <span className="font-mono text-lg font-black text-emerald-400">
                {estimatedPoints.toLocaleString()} pts
              </span>
            </div>
          </div>

          {/* Botón de prueba */}
          <button
            type="button"
            onClick={handleTestGuess}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] px-5 py-3 font-bold text-white text-xs transition-all active:scale-[0.98]"
          >
            <Play className="h-3.5 w-3.5 fill-white text-white" />
            <span>{t.simTestButton}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
