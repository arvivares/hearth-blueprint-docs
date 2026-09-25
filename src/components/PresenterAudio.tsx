import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Radio,
} from "lucide-react";
import { HandDrawnExplainer } from "./HandDrawnExplainer";
import { cn } from "@/lib/utils";

export type Language = "es" | "en";

interface SceneInfo {
  id: string;
  startTime: number;
  endTime: number;
  number: string;
  badge: string;
  fullTitle: string;
  desc: string;
  handNote: string;
}

const SCENE_CONFIG: Record<Language, SceneInfo[]> = {
  es: [
    {
      id: "tv",
      startTime: 0,
      endTime: 12,
      number: "01",
      badge: "La Tele",
      fullTitle: "01 · La pantalla principal",
      desc: "Pulsa en 'Crear sala' para mostrar el código QR gigante en tu televisor o monitor.",
      handNote: "Código QR · Sin cables",
    },
    {
      id: "mobile",
      startTime: 12,
      endTime: 26,
      number: "02",
      badge: "Tu Móvil",
      fullTitle: "02 · Tu móvil como mando",
      desc: "Tus amigos escanean el QR con su cámara para unirse y responder al instante. ¡Sin instalar apps!",
      handNote: "Cámara · Escribe tu nombre",
    },
    {
      id: "multiplier",
      startTime: 26,
      endTime: 45,
      number: "03",
      badge: "Multiplicador",
      fullTitle: "03 · Logotipos y multiplicador",
      desc: "El logotipo se revela por bloques. Cuanto antes adivines la marca, mayor multiplicador de velocidad consigues.",
      handNote: "⚡ 2.8x · Adivina antes",
    },
    {
      id: "podium",
      startTime: 45,
      endTime: 57,
      number: "04",
      badge: "Podio",
      fullTitle: "04 · Podio y récords",
      desc: "Al terminar cada ronda, vemos el podio de campeones de la sala y la tabla de récords mundiales.",
      handNote: "Trofeo · Récord global",
    },
  ],
  en: [
    {
      id: "tv",
      startTime: 0,
      endTime: 11,
      number: "01",
      badge: "The TV",
      fullTitle: "01 · The Big Screen",
      desc: "Click 'Create room' to display a giant QR code on your TV or main screen.",
      handNote: "Giant QR · Instant setup",
    },
    {
      id: "mobile",
      startTime: 11,
      endTime: 24,
      number: "02",
      badge: "Your Phone",
      fullTitle: "02 · Phone as controller",
      desc: "Friends scan the QR code with their camera to join and type answers. No app download needed!",
      handNote: "Scan to join · Zero install",
    },
    {
      id: "multiplier",
      startTime: 24,
      endTime: 41,
      number: "03",
      badge: "Multiplier",
      fullTitle: "03 · Brand logos & speed",
      desc: "Logos reveal piece by piece. The quicker you guess correctly, the bigger your speed multiplier.",
      handNote: "⚡ 2.8x · Fast guess bonus",
    },
    {
      id: "podium",
      startTime: 41,
      endTime: 51,
      number: "04",
      badge: "Podium",
      fullTitle: "04 · Podium & leaderboard",
      desc: "At the end of each round, discover the match champions and all-time global leaderboard.",
      handNote: "Trophy · Global records",
    },
  ],
};

const CONTENT = {
  es: {
    audioSrc: "/audio/presentadora-es.mp3",
    badge: "Voz Neuronal + Animación",
    title: "Cómo se juega",
    subtitleIdle: "Pulsa reproducir para ver y escuchar la guía de la presentadora",
    listenBtn: "Reproducir",
    pauseBtn: "Pausar",
    restartAria: "Reiniciar guía",
    muteAria: "Silenciar audio",
    unmuteAria: "Activar sonido",
    progressAria: "Progreso de la guía",
    showTranscript: "Leer transcripción",
    hideTranscript: "Ocultar transcripción",
    fullTranscript: `¡Hola! Te doy la bienvenida a PeekRush. Jugar es facilísimo y muy emocionante. Te cuento cómo funciona: Puedes jugar en grupo con tus amigos o tú solo directamente desde el navegador. Para jugar en grupo, pulsa en "Crear sala". Tu pantalla se convertirá en la pantalla principal del juego y mostrará un código QR gigante. Tus amigos solo tienen que escanear el código QR con la cámara de su móvil y escribir su nombre para unirse al instante. Si estás solo, simplemente pulsa en "Jugar solo" para empezar una partida individual y responder directamente con tu teclado. Cuando empiece la partida, aparecerá un logotipo que se irá revelando poco a poco. ¡Tu objetivo es adivinar la marca antes que nadie! Cuanto más rápido aciertes, más puntos conseguirás. Al final veremos el podio de la partida y la tabla de récords globales. ¡Mucha suerte y a jugar!`,
  },
  en: {
    audioSrc: "/audio/presentadora-en.mp3",
    badge: "Neural Voice + Animation",
    title: "How to Play",
    subtitleIdle: "Press play to watch and listen to the host interactive guide",
    listenBtn: "Play Guide",
    pauseBtn: "Pause",
    restartAria: "Restart guide",
    muteAria: "Mute audio",
    unmuteAria: "Unmute audio",
    progressAria: "Guide progress",
    showTranscript: "Read transcript",
    hideTranscript: "Hide transcript",
    fullTranscript: `Hello and welcome to PeekRush! Playing is super easy and lots of fun. Here is how it works: You can play in a group with friends or by yourself directly from your browser. To play with friends, click on "Create room". Your screen will turn into the main game screen, displaying a giant QR code. Your friends simply scan the QR code with their phone cameras and enter their nickname to join instantly. If you are playing alone, just click on "Play solo" to start a single-player game and type your answers right on your keyboard. Once the game starts, a brand logo will gradually reveal itself in stages. Your goal is to guess the brand before anyone else! The faster you guess correctly, the more points you score. At the end, we will reveal the podium and the global leaderboard. Good luck and have fun!`,
  },
};

export function PresenterAudio({
  lang = "es",
  className,
}: {
  lang?: Language;
  onLanguageChange?: (newLang: Language) => void;
  showLanguageSwitcher?: boolean;
  className?: string;
}) {
  const t = CONTENT[lang] || CONTENT.es;
  const scenes = SCENE_CONFIG[lang] || SCENE_CONFIG.es;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(56.8);
  const [isMuted, setIsMuted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [blobSrc, setBlobSrc] = useState<string>(t.audioSrc);

  // Preload audio as Blob for instant, accurate seeking across all browsers
  useEffect(() => {
    let active = true;
    let urlToRevoke: string | null = null;
    setBlobSrc(t.audioSrc);

    fetch(t.audioSrc)
      .then((res) => res.blob())
      .then((blob) => {
        if (!active) return;
        const objectUrl = URL.createObjectURL(blob);
        urlToRevoke = objectUrl;
        setBlobSrc(objectUrl);
      })
      .catch(() => {});

    return () => {
      active = false;
      if (urlToRevoke) {
        URL.revokeObjectURL(urlToRevoke);
      }
    };
  }, [t.audioSrc]);

  // Sync mute state with DOM audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Synchronized Master Play/Pause
  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setAudioError(null);

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setAudioError(
          lang === "es"
            ? "Haz clic de nuevo para autorizar el audio en tu navegador."
            : "Click again to start audio playback in your browser."
        );
        setIsPlaying(false);
      }
    }
  }, [isPlaying, lang]);

  // Restart to beginning
  const handleRestart = useCallback(() => {
    const audio = audioRef.current;
    setCurrentTime(0);
    if (audio) {
      audio.currentTime = 0;
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, []);

  // Mute / Unmute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  // Scrubber seeking
  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = time;
    }
  }, []);

  // Jump to specific scene chapter
  const jumpToScene = useCallback((sceneIdx: number) => {
    const targetScene = scenes[sceneIdx];
    if (!targetScene) return;

    const targetTime = targetScene.startTime;
    setCurrentTime(targetTime);

    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = targetTime;
      audio.play().then(() => setIsPlaying(true)).catch(() => {
        setIsPlaying(false);
      });
    }
  }, [scenes]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Find active scene info
  let currentSceneIndex = 0;
  for (let i = scenes.length - 1; i >= 0; i--) {
    if (currentTime >= scenes[i].startTime) {
      currentSceneIndex = i;
      break;
    }
  }
  const currentScene = scenes[currentSceneIndex] || scenes[0];
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl apple-glass border border-white/[0.08] p-5 sm:p-7 space-y-5 transition-all duration-300",
        isPlaying ? "border-white/20 shadow-2xl" : "hover:border-white/12",
        className
      )}
    >
      {/* Declarative DOM Audio Element */}
      <audio
        ref={audioRef}
        src={blobSrc}
        preload="auto"
        onLoadedMetadata={(e) => {
          const a = e.currentTarget;
          if (a.duration && !isNaN(a.duration)) {
            setDuration(a.duration);
          }
        }}
        onTimeUpdate={(e) => {
          setCurrentTime(e.currentTarget.currentTime);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
          if (audioRef.current) audioRef.current.currentTime = 0;
        }}
        onError={() => {
          setAudioError(lang === "es" ? "No se pudo cargar el audio." : "Unable to load audio.");
          setIsPlaying(false);
        }}
        className="hidden"
      />

      {/* Header Row: Title, Badge, and Quick Scene Navigation Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] border border-white/[0.08] text-white">
            <Radio className={cn("h-4 w-4 transition-transform", isPlaying && "animate-pulse text-amber-300")} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-semibold tracking-tight text-white whitespace-nowrap">
                {t.title}
              </h3>
              <span className="rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[11px] font-medium text-zinc-300 whitespace-nowrap">
                {t.badge}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              {isPlaying ? (
                <span className="text-zinc-200">
                  {currentScene.fullTitle}
                </span>
              ) : (
                t.subtitleIdle
              )}
            </p>
          </div>
        </div>

        {/* Scene Navigation Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-1 text-xs scrollbar-none">
          {scenes.map((sc, idx) => {
            const active = currentSceneIndex === idx;
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => jumpToScene(idx)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all text-xs font-medium shrink-0",
                  active
                    ? "bg-white text-black font-semibold shadow-md shadow-white/10"
                    : "bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.06]"
                )}
              >
                <span>{sc.number} · {sc.badge}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Hand-Drawn Canvas Stage (Flat, Single Container) */}
      <HandDrawnExplainer
        lang={lang}
        currentTime={currentTime}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
      />

      {/* Active Scene Caption */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-zinc-400 px-0.5">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-200 whitespace-nowrap">{currentScene.fullTitle}:</span>
          <span className="text-zinc-400">{currentScene.desc}</span>
        </div>
        <span className="hidden sm:inline-block text-[11px] font-mono text-amber-300/90 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20 whitespace-nowrap shrink-0">
          {currentScene.handNote}
        </span>
      </div>

      {/* Unified Timeline Scrubber */}
      <div className="space-y-1.5 pt-1">
        <div className="relative flex items-center">
          <input
            type="range"
            min="0"
            max={duration || 56.8}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            aria-label={t.progressAria}
            className="w-full h-1.5 cursor-pointer appearance-none rounded-full bg-white/[0.08] accent-white focus:outline-none"
          />
          <div
            className="pointer-events-none absolute left-0 h-1.5 rounded-full bg-white/80"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration || 56.8)}</span>
        </div>
      </div>

      {/* Unified Player Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? t.pauseBtn : t.listenBtn}
            className="flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black transition-all hover:bg-zinc-200 active:scale-95 shadow-md shadow-white/10"
          >
            {isPlaying ? <Pause className="h-4 w-4 fill-black" /> : <Play className="h-4 w-4 fill-black translate-x-0.5" />}
            <span>{isPlaying ? t.pauseBtn : t.listenBtn}</span>
          </button>

          <button
            type="button"
            onClick={handleRestart}
            aria-label={t.restartAria}
            title={lang === "es" ? "Reiniciar desde el principio" : "Restart from beginning"}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] border border-white/[0.08] text-zinc-300 hover:bg-white/[0.12] hover:text-white transition active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? t.unmuteAria : t.muteAria}
            title={isMuted ? (lang === "es" ? "Activar sonido" : "Unmute") : (lang === "es" ? "Silenciar" : "Mute")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] border border-white/[0.08] text-zinc-300 hover:bg-white/[0.12] hover:text-white transition active:scale-95"
          >
            {isMuted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>

        {/* Collapsible Transcript Toggle */}
        <button
          type="button"
          onClick={() => setShowTranscript(!showTranscript)}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition py-1"
          aria-expanded={showTranscript}
        >
          <span>{showTranscript ? t.hideTranscript : t.showTranscript}</span>
          {showTranscript ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {audioError && (
        <p className="text-xs text-red-400" role="alert">
          {audioError}
        </p>
      )}

      {/* Transcript Block */}
      {showTranscript && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4 text-xs leading-relaxed text-zinc-300 shadow-inner">
          <p className="italic text-zinc-400">
            "{t.fullTranscript}"
          </p>
        </div>
      )}
    </div>
  );
}
