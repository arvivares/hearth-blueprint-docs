import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Radio,
} from "lucide-react";
import { Button, Card } from "@/game/ui";
import { cn } from "@/lib/utils";

export type Language = "es" | "en";

interface Chapter {
  time: number;
  title: string;
  desc: string;
}

const CONTENT = {
  es: {
    audioSrc: "/audio/presentadora-es.mp3",
    badge: "Voz ElevenLabs",
    title: "Presentadora de PeekRush",
    subtitleIdle: "¿Cómo se juega? Escucha la explicación en audio",
    subtitlePlaying: "Explicando",
    listenBtn: "Escuchar presentadora",
    pauseBtn: "Pausar",
    restartAria: "Reiniciar audio",
    muteAria: "Silenciar",
    unmuteAria: "Activar sonido",
    progressAria: "Progreso de la explicación",
    showTranscript: "Ver texto paso a paso de la explicación",
    hideTranscript: "Ocultar texto de la explicación",
    chapters: [
      { time: 0, title: "1. Bienvenida y concepto", desc: "Juego en grupo con TV común y móviles como mando." },
      { time: 13, title: "2. Rol de Anfitrión", desc: "Crea la sala y genera el código para la pantalla." },
      { time: 22, title: "3. Vincular Pantalla (TV)", desc: "Muestra el código QR gigante y el estado de la sala." },
      { time: 31, title: "4. Entrada de Jugadores", desc: "Escanear el QR con la cámara o entrar con el código y alias." },
      { time: 42, title: "5. Mecánica de Rondas y Logos", desc: "El logo se devela en etapas; el más rápido suma más puntos." },
    ] as Chapter[],
    fullTranscript: `¡Hola! Te doy la bienvenida a PeekRush. Jugar es facilísimo y muy divertido. Te cuento cómo funciona:
PeekRush se juega en grupo frente a una pantalla principal compartida mientras cada jugador responde desde su propio teléfono móvil. Si vas a organizar la partida, pulsa en "Crear sala". En la televisión abre "Vincular pantalla" e introduce el código para ver el QR. Los jugadores solo tienen que escanear el QR con su móvil y elegir su alias. ¡El objetivo es adivinar la marca antes que nadie conforme se va revelando el logotipo!`,
  },
  en: {
    audioSrc: "/audio/presentadora-en.mp3",
    badge: "ElevenLabs Voice",
    title: "PeekRush Presenter",
    subtitleIdle: "How to play? Listen to the voice explanation",
    subtitlePlaying: "Explaining",
    listenBtn: "Listen to presenter",
    pauseBtn: "Pause",
    restartAria: "Restart audio",
    muteAria: "Mute",
    unmuteAria: "Unmute",
    progressAria: "Explanation progress",
    showTranscript: "View step-by-step transcript",
    hideTranscript: "Hide transcript",
    chapters: [
      { time: 0, title: "1. Welcome & concept", desc: "Group party game with a common TV and phones as controllers." },
      { time: 12, title: "2. Host role", desc: "Create the room and get the pairing code for the TV." },
      { time: 20, title: "3. Link TV screen", desc: "Displays the giant QR code and real-time room status." },
      { time: 28, title: "4. Players join", desc: "Scan the QR code with phone camera or enter room code and nickname." },
      { time: 38, title: "5. Logo stages & scoring", desc: "The logo reveals gradually; faster correct guesses earn more points." },
    ] as Chapter[],
    fullTranscript: `Hello and welcome to PeekRush! Playing is super easy and lots of fun. Let me explain how it works:
PeekRush is played in a group in front of a shared main screen, such as a TV or projector, while every player submits their answers directly from their own mobile phone. If you are hosting the game, click on "Create room". On the TV screen, open "Link screen" and enter that code to display the giant QR code. Players simply scan the QR code with their phones and choose a nickname. The faster you guess the brand, the more points you score!`,
  },
};

export function PresenterAudio({
  lang = "es",
  onLanguageChange,
  className,
}: {
  lang?: Language;
  onLanguageChange?: (newLang: Language) => void;
  className?: string;
}) {
  const t = CONTENT[lang] || CONTENT.es;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(60);
  const [isMuted, setIsMuted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Inicializar o recargar audio al cambiar de idioma
  useEffect(() => {
    const audio = new Audio(t.audioSrc);
    audioRef.current = audio;
    audio.muted = isMuted;

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onError = () => {
      setAudioError(lang === "es" ? "No se pudo cargar el audio de la presentadora." : "Could not load presenter audio.");
      setIsPlaying(false);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    setCurrentTime(0);
    setIsPlaying(false);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audioRef.current = null;
    };
  }, [lang, t.audioSrc]);

  const togglePlay = async () => {
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
      } catch (err) {
        setAudioError(
          lang === "es"
            ? "Haz clic de nuevo para permitir la reproducción de audio."
            : "Click again to allow audio playback.",
        );
        setIsPlaying(false);
      }
    }
  };

  const handleRestart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
    if (!isPlaying) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    const time = Number(e.target.value);
    if (audio) {
      audio.currentTime = time;
    }
    setCurrentTime(time);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const currentChapter = [...t.chapters].reverse().find((ch) => currentTime >= ch.time) ?? t.chapters[0];

  return (
    <Card className={cn("overflow-hidden border-primary/40 bg-gradient-to-b from-card to-card/70 shadow-lg", className)}>
      <div className="flex flex-col gap-4">
        {/* Encabezado con estado, badge y selector de idioma */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
              <Sparkles className="h-5 w-5" />
              {isPlaying && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-primary" />
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-foreground">{t.title}</h3>
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-primary">
                  <Radio className="h-3 w-3 animate-pulse" /> {t.badge}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {isPlaying ? `${t.subtitlePlaying}: ${currentChapter?.title}` : t.subtitleIdle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Selector de idioma integrado */}
            {onLanguageChange && (
              <div className="inline-flex rounded-xl border border-border bg-background/80 p-0.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => onLanguageChange("es")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 transition",
                    lang === "es" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-pressed={lang === "es"}
                >
                  ES
                </button>
                <button
                  type="button"
                  onClick={() => onLanguageChange("en")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 transition",
                    lang === "en" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-pressed={lang === "en"}
                >
                  EN
                </button>
              </div>
            )}

            {/* Ondas ecualizador cuando habla */}
            <div className="hidden sm:flex items-center gap-1 h-6 px-1" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "w-1 rounded-full bg-primary transition-all duration-300",
                    isPlaying ? "animate-pulse" : "h-1.5 opacity-30",
                  )}
                  style={
                    isPlaying
                      ? {
                          height: `${12 + ((i * 7) % 14)}px`,
                          animationDuration: `${0.4 + i * 0.15}s`,
                        }
                      : {}
                  }
                />
              ))}
            </div>
          </div>
        </div>

        {/* Controles de reproducción y barra de tiempo */}
        <div className="space-y-2 rounded-xl bg-background/60 p-3 border border-border/50">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? t.pauseBtn : t.listenBtn}
              className="gap-2"
              size="md"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span>{isPlaying ? t.pauseBtn : t.listenBtn}</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={handleRestart}
              aria-label={t.restartAria}
              className="p-2.5"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={toggleMute}
              aria-label={isMuted ? t.unmuteAria : t.muteAria}
              className="p-2.5"
            >
              {isMuted ? <VolumeX className="h-4 w-4 text-destructive" /> : <Volume2 className="h-4 w-4" />}
            </Button>

            <div className="ml-auto font-mono text-xs font-semibold text-muted-foreground tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          {/* Barra de progreso interactiva */}
          <div className="relative pt-1">
            <input
              type="range"
              min="0"
              max={duration || 60}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              aria-label={t.progressAria}
              className="w-full h-2 cursor-pointer appearance-none rounded-lg bg-secondary accent-primary focus:outline-none"
            />
            <div
              className="absolute left-0 top-1.5 h-2 rounded-lg bg-primary pointer-events-none opacity-60"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {audioError && (
          <p className="text-xs text-destructive font-medium" role="alert">
            {audioError}
          </p>
        )}

        {/* Botón y sección de transcripción para accesibilidad */}
        <div className="border-t border-border/40 pt-2">
          <button
            type="button"
            onClick={() => setShowTranscript(!showTranscript)}
            className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition py-1"
            aria-expanded={showTranscript}
          >
            <span>{showTranscript ? t.hideTranscript : t.showTranscript}</span>
            {showTranscript ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showTranscript && (
            <div className="mt-3 space-y-2.5 rounded-xl bg-background/50 p-4 text-xs leading-relaxed text-card-foreground border border-border/40">
              <div className="grid gap-3 sm:grid-cols-2">
                {t.chapters.map((ch, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      const audio = audioRef.current;
                      if (audio) audio.currentTime = ch.time;
                      setCurrentTime(ch.time);
                    }}
                    className={cn(
                      "cursor-pointer rounded-lg p-2.5 transition border",
                      currentTime >= ch.time && (idx === t.chapters.length - 1 || currentTime < t.chapters[idx + 1].time)
                        ? "border-primary/50 bg-primary/10 text-foreground font-semibold"
                        : "border-border/30 bg-card/40 text-muted-foreground hover:bg-card/80 hover:text-foreground",
                    )}
                  >
                    <div className="text-[11px] font-bold text-primary">{ch.title}</div>
                    <div className="mt-0.5">{ch.desc}</div>
                  </div>
                ))}
              </div>

              <blockquote className="mt-3 border-l-2 border-primary/50 pl-3 italic text-muted-foreground">
                "{t.fullTranscript}"
              </blockquote>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
