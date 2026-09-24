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
  Activity,
  Cpu,
  Wifi,
} from "lucide-react";
import { Button } from "@/game/ui";
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
    badge: "Voz Neuronal ElevenLabs",
    title: "Presentadora IA // PeekRush",
    subtitleIdle: "Voz en frecuencia de espera · Haz clic para iniciar transmisión",
    subtitlePlaying: "Transmisión en vivo activa",
    listenBtn: "Transmitir voz",
    pauseBtn: "Pausar",
    restartAria: "Reiniciar audio",
    muteAria: "Silenciar",
    unmuteAria: "Activar sonido",
    progressAria: "Progreso de la explicación",
    showTranscript: "Ver teleprompter / transcripción",
    hideTranscript: "Ocultar teleprompter",
    hudLabel: "ANALIZADOR DE ESPECTRO",
    chapters: [
      { time: 0, title: "01 // Concepto", desc: "TV compartida para el show y móviles para responder." },
      { time: 13, title: "02 // Anfitrión", desc: "Crea sala y genera vinculación de pantalla." },
      { time: 22, title: "03 // Pantalla TV", desc: "Muestra el QR gigante y logotipos por etapas." },
      { time: 31, title: "04 // Jugadores", desc: "Escanear QR o entrar con código y alias." },
      { time: 42, title: "05 // Puntos", desc: "El logo se devela en etapas; el más veloz gana." },
    ] as Chapter[],
    fullTranscript: `¡Hola! Te doy la bienvenida a PeekRush. Jugar es facilísimo y muy divertido. Te cuento cómo funciona:
PeekRush se juega en grupo frente a una pantalla principal compartida mientras cada jugador responde desde su propio teléfono móvil. Si vas a organizar la partida, pulsa en "Crear sala". En la televisión abre "Vincular pantalla" e introduce el código para ver el QR. Los jugadores solo tienen que escanear el QR con su móvil y elegir su alias. ¡El objetivo es adivinar la marca antes que nadie conforme se va revelando el logotipo!`,
  },
  en: {
    audioSrc: "/audio/presentadora-en.mp3",
    badge: "ElevenLabs Neural Voice",
    title: "AI Presenter // PeekRush",
    subtitleIdle: "Voice frequency on standby · Click to begin transmission",
    subtitlePlaying: "Live neural transmission active",
    listenBtn: "Transmit Voice",
    pauseBtn: "Pause",
    restartAria: "Restart audio",
    muteAria: "Mute",
    unmuteAria: "Unmute",
    progressAria: "Explanation progress",
    showTranscript: "View teleprompter / transcript",
    hideTranscript: "Hide teleprompter",
    hudLabel: "SPECTRUM ANALYZER",
    chapters: [
      { time: 0, title: "01 // Concept", desc: "Shared TV for the show and smartphones as gamepads." },
      { time: 12, title: "02 // Host Role", desc: "Create room and generate pairing code for TV." },
      { time: 20, title: "03 // TV Screen", desc: "Displays giant QR code and multi-stage logos." },
      { time: 28, title: "04 // Players Join", desc: "Scan QR with camera or enter code and alias." },
      { time: 38, title: "05 // Scoring", desc: "Logo reveals gradually; faster correct guesses win." },
    ] as Chapter[],
    fullTranscript: `Hello and welcome to PeekRush! Playing is super easy and lots of fun. Let me explain how it works:
PeekRush is played in a group in front of a shared main screen, such as a TV or projector, while every player submits their answers directly from their own mobile phone. If you are hosting the game, click on "Create room". On the TV screen, open "Link screen" and enter that code to display the giant QR code. Players simply scan the QR code with their phones and choose a nickname. The faster you guess the brand, the more points you score!`,
  },
};

export function PresenterAudio({
  lang = "es",
  onLanguageChange,
  showLanguageSwitcher = false,
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
  const [peakDb, setPeakDb] = useState("-18.4");

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
        setAudioError(lang === "es" ? "Fallo al conectar con el stream de audio." : "Audio stream connection failed.");
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
      analyser.smoothingTimeConstant = 0.82;

      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
    } catch {
      // Si el navegador restringe MediaElementSource, el audio sigue reproduciendo normalmente
    }
  };

  // Render loop del visualizador de frecuencia en canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;
    const numBars = 36;
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

      // Dibujar fondo de rejilla tecnológica en el canvas
      ctx.strokeStyle = "rgba(0, 240, 255, 0.05)";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // Línea base central
      ctx.strokeStyle = "rgba(0, 240, 255, 0.2)";
      ctx.beginPath();
      ctx.moveTo(0, height - 2);
      ctx.lineTo(width, height - 2);
      ctx.stroke();

      const barWidth = Math.floor(width / numBars) - 2;
      const now = Date.now() / 1000;
      let sumAmp = 0;

      for (let i = 0; i < numBars; i++) {
        let barHeight = 0;
        if (hasData) {
          const freqIndex = Math.floor((i / numBars) * 48);
          const raw = dataArray[freqIndex] || 0;
          barHeight = Math.max(3, (raw / 255) * (height - 8));
          sumAmp += raw;
        } else {
          // Animación idle holográfica pulsante cuando está en pausa
          const idleWave = Math.sin(now * 3 + i * 0.35) * 0.5 + 0.5;
          barHeight = 4 + idleWave * (isPlaying ? 12 : 8);
        }

        const x = i * (barWidth + 2);
        const y = height - barHeight - 2;

        // Gradiente futurista: Cyan -> Amarillo neón -> Coral
        const grad = ctx.createLinearGradient(0, height, 0, y);
        grad.addColorStop(0, "rgba(0, 240, 255, 0.85)");
        grad.addColorStop(0.65, "rgba(255, 230, 0, 0.95)");
        grad.addColorStop(1, "rgba(255, 42, 95, 1)");

        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barWidth, barHeight);

        // Capa de brillo superior de cada barra
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, Math.max(0, y - 2), barWidth, 2);
      }

      // Trazo de osciloscopio holográfico superior cuando hay audio activo
      if (hasData) {
        ctx.strokeStyle = "rgba(0, 240, 255, 0.5)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < numBars; i++) {
          const freqIndex = Math.floor((i / numBars) * 48);
          const raw = dataArray[freqIndex] || 0;
          const yWave = height - Math.max(5, (raw / 255) * (height - 12)) - 4;
          const xWave = i * (barWidth + 2) + barWidth / 2;
          if (i === 0) ctx.moveTo(xWave, yWave);
          else ctx.lineTo(xWave, yWave);
        }
        ctx.stroke();
      }

      // Marcas de frecuencias de audio militar / sci-fi
      ctx.fillStyle = "rgba(0, 240, 255, 0.4)";
      ctx.font = "8px 'JetBrains Mono', monospace";
      ctx.fillText("60Hz", 8, height - 4);
      ctx.fillText("250Hz", width * 0.25, height - 4);
      ctx.fillText("1kHz", width * 0.5 - 10, height - 4);
      ctx.fillText("4kHz", width * 0.75 - 10, height - 4);
      ctx.fillText("16kHz", width - 36, height - 4);

      if (hasData && numBars > 0) {
        const avg = sumAmp / numBars;
        const db = (-30 + (avg / 255) * 26).toFixed(1);
        setPeakDb(`${db} dB`);
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
        setAudioError(
          lang === "es"
            ? "Interacción requerida: haz clic de nuevo para autorizar el audio."
            : "Click again to authorize audio playback.",
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
        "relative overflow-hidden rounded-3xl border border-cyan-500/40 bg-gradient-to-b from-[#0b101d] via-[#090d18] to-[#060810] p-5 shadow-2xl backdrop-blur-xl transition-all duration-300",
        isPlaying ? "shadow-[0_0_35px_-5px_rgba(0,240,255,0.25)] border-cyan-400/60" : "hover:border-cyan-500/50",
        className,
      )}
    >
      {/* Líneas sutiles de escáner futurista decorativo */}
      <div className="pointer-events-none absolute inset-0 cyber-grid opacity-30" />
      <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 -bottom-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-4">
        {/* Cabecera HUD con Telemetría */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
          <div className="flex items-center gap-3">
            {/* Hologram Core Orb */}
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-950/60 border border-cyan-400/40 shadow-inner">
              <Activity className={cn("h-5 w-5 text-cyan-400 transition", isPlaying ? "animate-pulse" : "opacity-80")} />
              <div
                className={cn(
                  "absolute inset-0 rounded-2xl border border-cyan-400/40",
                  isPlaying ? "animate-ping opacity-40 duration-1000" : "hidden",
                )}
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display font-extrabold tracking-wide text-foreground text-base sm:text-lg">
                  {t.title}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                  <Wifi className="h-2.5 w-2.5 animate-pulse" /> {t.badge}
                </span>
              </div>
              <p className="font-mono text-xs text-cyan-200/70">
                {isPlaying ? (
                  <span className="flex items-center gap-1.5 text-primary font-bold">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                    {t.subtitlePlaying}: {currentChapter?.title}
                  </span>
                ) : (
                  t.subtitleIdle
                )}
              </p>
            </div>
          </div>

          {/* Telemetría de señal HUD */}
          <div className="flex items-center gap-3 ml-auto">
            <div className="flex flex-col text-right font-mono text-[10px] text-muted-foreground">
              <span className="text-cyan-400 font-bold">DSP 44.1 kHz // PEAK {isPlaying ? peakDb : "IDLE"}</span>
              <span className="hidden sm:inline">NEURAL ENGINE v2.4</span>
            </div>

            {showLanguageSwitcher && onLanguageChange && (
              <div className="inline-flex rounded-xl border border-cyan-500/30 bg-black/40 p-1 text-xs font-mono font-bold shadow-inner">
                <button
                  type="button"
                  onClick={() => onLanguageChange("es")}
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-2.5 py-1 transition",
                    lang === "es"
                      ? "bg-cyan-500 text-black font-extrabold shadow-[0_0_12px_rgba(0,240,255,0.6)]"
                      : "text-muted-foreground hover:text-cyan-300",
                  )}
                  aria-pressed={lang === "es"}
                >
                  <span>ES</span>
                </button>
                <button
                  type="button"
                  onClick={() => onLanguageChange("en")}
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-2.5 py-1 transition",
                    lang === "en"
                      ? "bg-cyan-500 text-black font-extrabold shadow-[0_0_12px_rgba(0,240,255,0.6)]"
                      : "text-muted-foreground hover:text-cyan-300",
                  )}
                  aria-pressed={lang === "en"}
                >
                  <span>EN</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Visualizador de Frecuencia Real (Canvas Web Audio API) */}
        <div className="relative rounded-2xl border border-cyan-500/30 bg-[#040711]/90 p-3 shadow-inner">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-cyan-400/80">
            <span className="flex items-center gap-1">
              <Cpu className="h-3 w-3" /> {t.hudLabel} // 64 BANDS
            </span>
            <span className="tabular-nums">
              {isPlaying ? `TRANSMITTING · ${peakDb}` : "SYNTHESIS READY · STANDBY"}
            </span>
          </div>

          <canvas
            ref={canvasRef}
            width={640}
            height={72}
            className="w-full h-16 sm:h-20 rounded-xl bg-black/60 border border-cyan-900/40 shadow-inner"
            aria-label="Visualizador espectral de frecuencia de voz de la presentadora"
          />
        </div>

        {/* Barra de progreso interactiva con tiempo militar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between font-mono text-xs font-bold text-muted-foreground">
            <span className="text-cyan-400">{formatTime(currentTime)}</span>
            <span className="text-muted-foreground/80">{formatTime(duration)}</span>
          </div>
          <div className="relative flex items-center">
            <input
              type="range"
              min="0"
              max={duration || 60}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              aria-label={t.progressAria}
              className="w-full h-2 cursor-pointer appearance-none rounded-lg bg-cyan-950/80 accent-cyan-400 focus:outline-none"
            />
            <div
              className="pointer-events-none absolute left-0 h-2 rounded-lg bg-gradient-to-r from-cyan-400 to-primary opacity-80"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Controles Principales */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? t.pauseBtn : t.listenBtn}
            className={cn(
              "flex-1 sm:flex-initial gap-2 px-6 font-mono font-extrabold uppercase tracking-wider text-sm transition-all duration-300",
              isPlaying
                ? "bg-amber-400 text-black hover:bg-amber-300 shadow-[0_0_20px_rgba(255,230,0,0.5)]"
                : "bg-cyan-400 text-black hover:bg-cyan-300 shadow-[0_0_25px_rgba(0,240,255,0.6)]",
            )}
            size="md"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-black" />}
            <span>{isPlaying ? t.pauseBtn : t.listenBtn}</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={handleRestart}
            aria-label={t.restartAria}
            className="border-cyan-500/30 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/60 p-2.5 rounded-xl"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={toggleMute}
            aria-label={isMuted ? t.unmuteAria : t.muteAria}
            className="border-cyan-500/30 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/60 p-2.5 rounded-xl"
          >
            {isMuted ? <VolumeX className="h-4 w-4 text-destructive" /> : <Volume2 className="h-4 w-4" />}
          </Button>

          {/* Indicador de capítulo actual rápido */}
          <div className="hidden lg:flex items-center gap-1.5 ml-auto font-mono text-xs text-cyan-300/80 bg-cyan-950/30 px-3 py-1.5 rounded-xl border border-cyan-500/20">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>{currentChapter?.title}</span>
          </div>
        </div>

        {audioError && (
          <p className="font-mono text-xs text-destructive font-semibold" role="alert">
            [ERROR] {audioError}
          </p>
        )}

        {/* Segmentos de capítulos interactivos HUD */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1">
          {t.chapters.map((ch, idx) => {
            const isCurrent =
              currentTime >= ch.time && (idx === t.chapters.length - 1 || currentTime < t.chapters[idx + 1].time);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => jumpToChapter(ch.time)}
                className={cn(
                  "flex flex-col text-left p-2 rounded-xl font-mono text-[11px] transition-all border",
                  isCurrent
                    ? "border-cyan-400 bg-cyan-500/20 text-cyan-200 shadow-[0_0_12px_rgba(0,240,255,0.3)]"
                    : "border-cyan-900/40 bg-black/40 text-muted-foreground hover:border-cyan-500/40 hover:text-foreground",
                )}
              >
                <span className={cn("font-bold", isCurrent ? "text-primary" : "text-cyan-400/80")}>
                  {ch.title.split("//")[0]?.trim()}
                </span>
                <span className="truncate text-[10px] opacity-80">{ch.desc}</span>
              </button>
            );
          })}
        </div>

        {/* Desplegable de teleprompter / transcripción */}
        <div className="border-t border-cyan-500/20 pt-2">
          <button
            type="button"
            onClick={() => setShowTranscript(!showTranscript)}
            className="flex w-full items-center justify-between font-mono text-xs text-cyan-400/80 hover:text-cyan-200 transition py-1"
            aria-expanded={showTranscript}
          >
            <span>{showTranscript ? t.hideTranscript : t.showTranscript}</span>
            {showTranscript ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showTranscript && (
            <div className="mt-2.5 rounded-xl border border-cyan-500/30 bg-black/70 p-4 font-mono text-xs leading-relaxed text-cyan-100 shadow-inner">
              <div className="mb-2 text-[10px] uppercase tracking-widest text-cyan-400 font-bold">
                TELEPROMPTER TRANSCRIPTION // SARAH AI VOICE
              </div>
              <p className="italic text-muted-foreground leading-normal">
                "{t.fullTranscript}"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
