import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Radio,
  Sparkles,
  Film,
  Activity,
} from "lucide-react";
import { HandDrawnExplainer } from "./HandDrawnExplainer";
import { cn } from "@/lib/utils";

export type Language = "es" | "en";

interface Chapter {
  time: number;
  title: string;
  shortTitle: string;
  desc: string;
}

const CONTENT = {
  es: {
    audioSrc: "/audio/presentadora-es.mp3",
    badge: "Voz Neuronal",
    title: "Cómo se juega",
    subtitleIdle: "Pulsa reproducir para escuchar la guía de la presentadora",
    subtitlePlaying: "Reproduciendo guía de audio",
    listenBtn: "Reproducir",
    pauseBtn: "Pausar",
    restartAria: "Reiniciar audio",
    muteAria: "Silenciar",
    unmuteAria: "Activar sonido",
    progressAria: "Progreso del audio",
    showTranscript: "Leer transcripción",
    hideTranscript: "Ocultar transcripción",
    chapters: [
      { time: 0, title: "01 · Bienvenida", shortTitle: "Bienvenida", desc: "En grupo o tú solo desde el navegador." },
      { time: 12, title: "02 · Crear sala", shortTitle: "Crear sala", desc: "Pantalla principal con QR gigante para tus amigos." },
      { time: 26, title: "03 · Jugar solo", shortTitle: "Jugar solo", desc: "Modo individual respondiendo con el teclado." },
      { time: 35, title: "04 · Logotipos", shortTitle: "Logotipos", desc: "Adivina la marca mientras se revela." },
      { time: 45, title: "05 · Podio y récords", shortTitle: "Récords", desc: "Clasificación de partida y tabla global." },
    ] as Chapter[],
    fullTranscript: `¡Hola! Te doy la bienvenida a PeekRush. Jugar es facilísimo y muy emocionante. Te cuento cómo funciona: Puedes jugar en grupo con tus amigos o tú solo directamente desde el navegador. Para jugar en grupo, pulsa en "Crear sala". Tu pantalla se convertirá en la pantalla principal del juego y mostrará un código QR gigante. Tus amigos solo tienen que escanear el código QR con la cámara de su móvil y escribir su nombre para unirse al instante. Si estás solo, simplemente pulsa en "Jugar solo" para empezar una partida individual y responder directamente con tu teclado. Cuando empiece la partida, aparecerá un logotipo que se irá revelando poco a poco. ¡Tu objetivo es adivinar la marca antes que nadie! Cuanto más rápido aciertes, más puntos conseguirás. Al final veremos el podio de la partida y la tabla de récords globales. ¡Mucha suerte y a jugar!`,
  },
  en: {
    audioSrc: "/audio/presentadora-en.mp3",
    badge: "Neural Voice",
    title: "How to Play",
    subtitleIdle: "Press play to listen to the host audio guide",
    subtitlePlaying: "Playing audio guide",
    listenBtn: "Play Guide",
    pauseBtn: "Pause",
    restartAria: "Restart audio",
    muteAria: "Mute",
    unmuteAria: "Unmute",
    progressAria: "Audio progress",
    showTranscript: "Read transcript",
    hideTranscript: "Hide transcript",
    chapters: [
      { time: 0, title: "01 · Welcome", shortTitle: "Welcome", desc: "Play with friends or solo in your browser." },
      { time: 11, title: "02 · Create room", shortTitle: "Create room", desc: "Main screen with giant QR for your friends." },
      { time: 24, title: "03 · Play solo", shortTitle: "Play solo", desc: "Single-player mode using your keyboard." },
      { time: 32, title: "04 · Brand logos", shortTitle: "Brand logos", desc: "Guess the brand as it reveals in stages." },
      { time: 41, title: "05 · Podium & records", shortTitle: "Leaderboard", desc: "Match podium and all-time global records." },
    ] as Chapter[],
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(60);
  const [isMuted, setIsMuted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"animation" | "waveform">("animation");

  // Configurar elemento de audio único y persistente
  useEffect(() => {
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio();
      audio.crossOrigin = "anonymous";
      audioRef.current = audio;

      const onLoadedMetadata = () => {
        if (audio && audio.duration && !isNaN(audio.duration)) {
          setDuration(audio.duration);
        }
      };
      const onTimeUpdate = () => {
        if (audio) setCurrentTime(audio.currentTime);
      };
      const onEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };
      const onError = () => {
        setAudioError(lang === "es" ? "No se pudo cargar el audio." : "Unable to load audio.");
        setIsPlaying(false);
      };

      audio.addEventListener("loadedmetadata", onLoadedMetadata);
      audio.addEventListener("timeupdate", onTimeUpdate);
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onError);
    }

    const wasPlaying = isPlaying;
    audio.src = t.audioSrc;
    audio.load();
    setCurrentTime(0);

    if (wasPlaying) {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [lang, t.audioSrc]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Inicializar Web Audio API para el analizador de frecuencia
  const initAudioContext = () => {
    if (audioCtxRef.current || !audioRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.85;

      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
    } catch {
      // Audio continúa normalmente si Web Audio API no está disponible
    }
  };

  // Render loop del visualizador estilo Apple Voice Memos / Siri
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;
    const numBars = 44;
    const dataArray = new Uint8Array(64);

    const render = () => {
      if (!running) return;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const analyser = analyserRef.current;
      let hasData = false;

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
        hasData = true;
      }

      const barWidth = 4;
      const totalWidth = numBars * barWidth;
      const gap = Math.max(2, Math.floor((width - totalWidth) / (numBars - 1)));
      const startX = Math.max(0, Math.floor((width - (numBars * barWidth + (numBars - 1) * gap)) / 2));
      const now = Date.now() / 1000;

      for (let i = 0; i < numBars; i++) {
        let barHeight = 0;

        if (hasData) {
          const freqIndex = Math.floor((i / numBars) * 44);
          const raw = dataArray[freqIndex] || 0;
          barHeight = Math.max(4, (raw / 255) * (height - 10));
        } else {
          // Onda sutil de respiración armónica estilo Siri / Apple
          const distFromCenter = Math.abs(i - numBars / 2) / (numBars / 2);
          const centerWeight = 1 - distFromCenter * 0.6;
          const idleWave = (Math.sin(now * 2.5 + i * 0.22) * 0.5 + 0.5) * centerWeight;
          barHeight = 4 + idleWave * (isPlaying ? 14 : 10);
        }

        const x = startX + i * (barWidth + gap);
        // Centrado vertical simétrico estilo Apple Voice Memos
        const y = Math.floor((height - barHeight) / 2);

        // Gradiente refinado Apple: azul hielo -> violeta sutil -> blanco perlado
        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (isPlaying) {
          grad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
          grad.addColorStop(0.5, "rgba(165, 180, 252, 0.9)");
          grad.addColorStop(1, "rgba(129, 140, 248, 0.75)");
        } else {
          grad.addColorStop(0, "rgba(255, 255, 255, 0.6)");
          grad.addColorStop(1, "rgba(255, 255, 255, 0.2)");
        }

        ctx.fillStyle = grad;

        // Dibujar cápsula redondeada
        if (typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, barWidth, barHeight);
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    initAudioContext();
    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      await audioCtxRef.current.resume();
    }
    setAudioError(null);

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setAudioError(lang === "es" ? "Haz clic de nuevo para autorizar el audio." : "Click again to start audio.");
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
      initAudioContext();
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

  const jumpToChapter = (chapterTime: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    initAudioContext();
    audio.currentTime = chapterTime;
    setCurrentTime(chapterTime);
    if (!isPlaying) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const currentChapter = [...t.chapters].reverse().find((ch) => currentTime >= ch.time) ?? t.chapters[0];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl apple-glass p-5 sm:p-7 transition-all duration-300",
        isPlaying ? "border-white/20 shadow-2xl" : "hover:border-white/12",
        className,
      )}
    >
      <div className="relative z-10 flex flex-col gap-5">
        {/* Cabecera Minimalista */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] border border-white/[0.08] text-white">
              <Radio className={cn("h-4 w-4 transition-transform", isPlaying && "animate-pulse text-indigo-300")} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold tracking-tight text-white whitespace-nowrap">
                  {t.title}
                </h3>
                <span className="rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[11px] font-medium text-zinc-300 whitespace-nowrap">
                  {t.badge}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                {isPlaying ? (
                  <span className="text-zinc-200">
                    {currentChapter?.title}
                  </span>
                ) : (
                  t.subtitleIdle
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
            {/* Selector de Modo: Animación Hand-Drawn Cartoon vs Onda de Voz */}
            <div className="inline-flex rounded-full bg-white/[0.06] border border-white/[0.08] p-0.5 text-xs font-medium shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("animation")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-all text-xs",
                  viewMode === "animation"
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                <Film className="h-3 w-3" />
                <span>{lang === "es" ? "Animación" : "Cartoon"}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("waveform")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-all text-xs",
                  viewMode === "waveform"
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                <Activity className="h-3 w-3" />
                <span>{lang === "es" ? "Onda" : "Wave"}</span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400">
              <span
                className={cn(
                  "h-2 w-2 rounded-full transition-colors",
                  isPlaying ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-zinc-600",
                )}
              />
              <span className="font-mono text-[11px] tracking-wide text-zinc-400">
                {isPlaying ? "LIVE" : "STANDBY"}
              </span>
            </div>
          </div>
        </div>

        {/* Visualizador Principal: Animación Hand-Drawn (Jackbox Style) u Onda de Voz */}
        {viewMode === "animation" ? (
          <HandDrawnExplainer
            lang={lang}
            externalTime={isPlaying ? currentTime : null}
            onSceneChange={(sceneIdx) => {
              const sceneChapterTimes = [0, 26, 35, 45];
              if (isPlaying && sceneChapterTimes[sceneIdx] !== undefined) {
                jumpToChapter(sceneChapterTimes[sceneIdx]);
              }
            }}
          />
        ) : (
          <div className="relative flex items-center justify-center rounded-2xl bg-black/40 border border-white/[0.06] p-3 sm:p-4">
            <canvas
              ref={canvasRef}
              width={580}
              height={60}
              className="w-full h-14 sm:h-16"
              aria-label="Visualizador de frecuencia de audio"
            />
          </div>
        )}

        {/* Barra de progreso minimalista */}
        <div className="space-y-1.5">
          <div className="relative flex items-center">
            <input
              type="range"
              min="0"
              max={duration || 60}
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
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controles estilo Apple */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? t.pauseBtn : t.listenBtn}
              className="flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black transition-all hover:bg-zinc-200 active:scale-95 shadow-md shadow-white/10"
            >
              {isPlaying ? <Pause className="h-4 w-4 fill-black" /> : <Play className="h-4 w-4 fill-black" />}
              <span>{isPlaying ? t.pauseBtn : t.listenBtn}</span>
            </button>

            <button
              type="button"
              onClick={handleRestart}
              aria-label={t.restartAria}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] border border-white/[0.08] text-zinc-300 hover:bg-white/[0.12] hover:text-white transition active:scale-95"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? t.unmuteAria : t.muteAria}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] border border-white/[0.08] text-zinc-300 hover:bg-white/[0.12] hover:text-white transition active:scale-95"
            >
              {isMuted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>

          {/* Botón de transcripción minimalista */}
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

        {/* Chips de capítulos estilo Apple */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {t.chapters.map((ch, idx) => {
            const isCurrent =
              currentTime >= ch.time && (idx === t.chapters.length - 1 || currentTime < t.chapters[idx + 1].time);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => jumpToChapter(ch.time)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-all",
                  isCurrent
                    ? "bg-white text-black shadow-sm"
                    : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-white border border-white/[0.06]",
                )}
              >
                <span>{ch.shortTitle}</span>
              </button>
            );
          })}
        </div>

        {/* Transcripción en lámina translúcida */}
        {showTranscript && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4 text-xs leading-relaxed text-zinc-300 shadow-inner">
            <p className="italic text-zinc-400">
              "{t.fullTranscript}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
