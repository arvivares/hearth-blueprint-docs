import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { HandDrawnExplainer } from "./HandDrawnExplainer";

export type Language = "es" | "en";

interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

const SUBTITLES: Record<Language, SubtitleCue[]> = {
  es: [
    { start: 0.0, end: 2.7, text: "¡Hola! Te doy la bienvenida a PeekRush." },
    { start: 2.7, end: 5.7, text: "Jugar es facilísimo y muy emocionante." },
    { start: 5.7, end: 7.6, text: "Te cuento cómo funciona:" },
    { start: 7.6, end: 12.3, text: "Puedes jugar en grupo con tus amigos o tú solo directamente desde el navegador." },
    { start: 12.3, end: 15.5, text: "Para jugar en grupo, pulsa en «Crear sala»." },
    { start: 15.5, end: 19.1, text: "Tu pantalla se convertirá en la pantalla principal del juego..." },
    { start: 19.1, end: 22.4, text: "...y mostrará un código QR gigante." },
    { start: 22.4, end: 27.1, text: "Tus amigos solo tienen que escanear el código QR con la cámara de su móvil..." },
    { start: 27.1, end: 30.0, text: "...y escribir su nombre para unirse al instante." },
    { start: 30.0, end: 33.6, text: "Si estás solo, simplemente pulsa en «Jugar solo» para empezar una partida individual..." },
    { start: 33.6, end: 35.6, text: "...y responder directamente con tu teclado." },
    { start: 35.6, end: 38.6, text: "Cuando empiece la partida, aparecerá un logotipo que se irá revelando poco a poco." },
    { start: 38.6, end: 43.7, text: "¡Tu objetivo es adivinar la marca antes que nadie!" },
    { start: 43.7, end: 46.9, text: "Cuanto más rápido aciertes, más puntos conseguirás." },
    { start: 46.9, end: 50.6, text: "Al final veremos el podio de la partida y la tabla de récords globales." },
    { start: 50.6, end: 56.8, text: "¡Mucha suerte y a jugar!" },
  ],
  en: [
    { start: 0.0, end: 2.1, text: "Hello and welcome to PeekRush!" },
    { start: 2.1, end: 4.9, text: "Playing is super easy and lots of fun." },
    { start: 4.9, end: 6.2, text: "Here is how it works:" },
    { start: 6.2, end: 10.6, text: "You can play in a group with friends or by yourself directly from your browser." },
    { start: 10.6, end: 13.6, text: "To play with friends, click on \"Create room\"." },
    { start: 13.6, end: 16.5, text: "Your screen will turn into the main game screen..." },
    { start: 16.5, end: 18.7, text: "...displaying a giant QR code." },
    { start: 18.7, end: 24.8, text: "Your friends simply scan the QR code with their phone cameras..." },
    { start: 24.8, end: 26.4, text: "...and enter their nickname to join instantly." },
    { start: 26.4, end: 28.4, text: "If you are playing alone, just click on \"Play solo\"..." },
    { start: 28.4, end: 32.5, text: "...to start a single-player game and type your answers right on your keyboard." },
    { start: 32.5, end: 37.8, text: "Once the game starts, a brand logo will gradually reveal itself in stages." },
    { start: 37.8, end: 41.4, text: "Your goal is to guess the brand before anyone else!" },
    { start: 41.4, end: 44.7, text: "The faster you guess correctly, the more points you score." },
    { start: 44.7, end: 48.4, text: "At the end, we will reveal the podium and the global leaderboard." },
    { start: 48.4, end: 50.1, text: "Good luck and have fun!" },
  ],
};

const AUDIO_SOURCES: Record<Language, string> = {
  es: "/audio/presentadora-es.mp3",
  en: "/audio/presentadora-en.mp3",
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
  const audioSrc = AUDIO_SOURCES[lang] || AUDIO_SOURCES.es;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(56.8);
  const [isMuted, setIsMuted] = useState(false);
  const [blobSrc, setBlobSrc] = useState<string>(audioSrc);

  // Preload audio as Blob for instant seeking and caching
  useEffect(() => {
    let active = true;
    let urlToRevoke: string | null = null;
    setBlobSrc(audioSrc);

    fetch(audioSrc)
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
  }, [audioSrc]);

  // Sync mute state
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Toggle Play / Pause
  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    }
  }, [isPlaying]);

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

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Real-time subtitle resolution
  const cues = SUBTITLES[lang] || SUBTITLES.es;
  let currentSubtitle = "";
  if (currentTime === 0 && !isPlaying) {
    currentSubtitle =
      lang === "es"
        ? "Pulsa en el reproductor para ver la guía con audio"
        : "Click on the player to watch the guide with audio";
  } else {
    const matched = cues.find((c) => currentTime >= c.start && currentTime < c.end);
    currentSubtitle = matched ? matched.text : cues[cues.length - 1].text;
  }

  return (
    <div className={className ? `w-full ${className}` : "w-full space-y-3"}>
      {/* Declarative DOM Audio */}
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
        className="hidden"
      />

      {/* 1. Solo el Player (Canvas) */}
      <HandDrawnExplainer
        lang={lang}
        currentTime={currentTime}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
      />

      {/* 2. Controles de Reproducción y Barra de Progreso Minimalistas */}
      <div className="flex items-center gap-3 px-1 text-zinc-400">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? (lang === "es" ? "Pausar" : "Pause") : (lang === "es" ? "Reproducir" : "Play")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-black hover:bg-zinc-200 transition-transform active:scale-95 shadow-sm"
        >
          {isPlaying ? <Pause className="h-3.5 w-3.5 fill-black" /> : <Play className="h-3.5 w-3.5 fill-black translate-x-0.5" />}
        </button>

        <button
          type="button"
          onClick={handleRestart}
          aria-label={lang === "es" ? "Reiniciar guía" : "Restart guide"}
          title={lang === "es" ? "Reiniciar" : "Restart"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.08] transition active:scale-95"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        {/* Timeline Scrubber */}
        <div className="relative flex-1 flex items-center">
          <input
            type="range"
            min="0"
            max={duration || 56.8}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            aria-label={lang === "es" ? "Progreso de la guía" : "Guide progress"}
            className="w-full h-1 cursor-pointer appearance-none rounded-full bg-white/[0.12] accent-white focus:outline-none"
          />
          <div
            className="pointer-events-none absolute left-0 h-1 rounded-full bg-white"
            style={{ width: `${progress}%` }}
          />
        </div>

        <span className="font-mono text-xs text-zinc-400 shrink-0 tabular-nums">
          {formatTime(currentTime)} / {formatTime(duration || 56.8)}
        </span>

        <button
          type="button"
          onClick={toggleMute}
          aria-label={isMuted ? (lang === "es" ? "Activar sonido" : "Unmute") : (lang === "es" ? "Silenciar" : "Mute")}
          title={isMuted ? (lang === "es" ? "Activar sonido" : "Unmute") : (lang === "es" ? "Silenciar" : "Mute")}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.08] transition active:scale-95"
        >
          {isMuted ? <VolumeX className="h-3.5 w-3.5 text-red-400" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* 3. Subtítulos en Tiempo Real */}
      <div className="min-h-[2.75rem] flex items-center justify-center text-center px-2">
        <p className="text-sm sm:text-base text-zinc-300 font-medium leading-relaxed transition-opacity duration-150">
          {currentSubtitle}
        </p>
      </div>
    </div>
  );
}
