import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  Play,
  Pause,
  RotateCcw,
  Smartphone,
  Tv,
  Gamepad2,
  Columns2,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_PHASES, type DemoPhase } from "@/game/demo/fixtures";
import { HostView } from "@/game/views/HostView";
import { PlayerView } from "@/game/views/PlayerView";
import { TvView } from "@/game/views/TvView";
import type { RoomSnapshot } from "@/game/useGameRoom";

import { ALL_100_BRANDS } from "@/game/brands100";

export const Route = createFileRoute("/demo")({
  validateSearch: z.object({
    view: z.enum(["split", "tv", "player", "host"]).catch("split"),
    phase: z.enum(DEMO_PHASES).catch("ROUND_ACTIVE"),
  }),
  head: () => ({
    meta: [
      { title: "Simulación en Vivo — PeekRush" },
      { name: "description", content: "Simulación interactiva de PeekRush con TV y móvil sincronizados en tiempo real." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DemoPage,
});

/** Hook que genera en canvas el pixelado progresivo según la etapa (1 a 5) */
function usePixelatedLogo(logoUrl: string, stage: number, isRevealed: boolean) {
  const [dataUrl, setDataUrl] = useState<string>(logoUrl);

  useEffect(() => {
    if (isRevealed || stage >= 5) {
      setDataUrl(logoUrl);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = logoUrl;
    img.onload = () => {
      const size = 512;
      // Tamaños de bloque según etapa (reproduce el algoritmo de Sharp del servidor)
      const blockSizes = [12, 24, 48, 96, 512];
      const smallSize = blockSizes[Math.min(Math.max(stage - 1, 0), 4)] || 12;

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

      setDataUrl(mainCanvas.toDataURL("image/png"));
    };
  }, [logoUrl, stage, isRevealed]);

  return dataUrl;
}

function DemoPage() {
  const { view, phase: urlPhase } = Route.useSearch();
  const navigate = useNavigate();

  // Barajar las 100 marcas aleatoriamente para cada sesión de demo
  const [brands] = useState(() => {
    const list = [...ALL_100_BRANDS];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  });

  const [brandIndex, setBrandIndex] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<DemoPhase>(urlPhase);
  const [stage, setStage] = useState(2);
  const [remainingMs, setRemainingMs] = useState(18000);
  const [isPlayingAuto, setIsPlayingAuto] = useState(true);
  const [userScore, setUserScore] = useState(1600);
  const [userAnswered, setUserAnswered] = useState(false);
  const [userFeedback, setUserFeedback] = useState<{ status: "correct" | "incorrect"; points?: number } | null>(null);

  const activeBrand = brands[brandIndex % brands.length]!;
  const pixelatedSrc = usePixelatedLogo(activeBrand.image, stage, currentPhase === "ROUND_RESULTS");

  // Motor de simulación en vivo (cuenta atrás, avance de etapas y transición automática)
  useEffect(() => {
    if (!isPlayingAuto) return;

    const interval = setInterval(() => {
      if (currentPhase === "ROUND_ACTIVE") {
        setRemainingMs((prev) => {
          if (prev <= 1000) {
            // Fin de ronda -> pasar a resultados
            setCurrentPhase("ROUND_RESULTS");
            return 5000;
          }
          const next = prev - 1000;
          // Reducir pixelado conforme avanza el tiempo (etapa 1 a 5)
          if (next <= 5000) setStage(5);
          else if (next <= 10000) setStage(4);
          else if (next <= 15000) setStage(3);
          else if (next <= 20000) setStage(2);
          else setStage(1);
          return next;
        });
      } else if (currentPhase === "ROUND_RESULTS") {
        setRemainingMs((prev) => {
          if (prev <= 1000) {
            // Siguiente marca y nueva ronda
            setBrandIndex((b) => (b + 1) % brands.length);
            setCurrentPhase("ROUND_ACTIVE");
            setStage(1);
            setUserAnswered(false);
            setUserFeedback(null);
            return 25000;
          }
          return prev - 1000;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlayingAuto, currentPhase]);

  // Manejador de respuestas enviadas desde el móvil simulado
  const handlePlayerSubmit = (guess: string) => {
    const cleanGuess = guess.trim().toLowerCase();
    const correctName = activeBrand.name.toLowerCase();

    if (cleanGuess === correctName || correctName.includes(cleanGuess)) {
      const earned = Math.max(200, 1000 - (stage - 1) * 180);
      setUserScore((s) => s + earned);
      setUserAnswered(true);
      setUserFeedback({ status: "correct", points: earned });
    } else {
      setUserFeedback({ status: "incorrect" });
      setTimeout(() => setUserFeedback(null), 2500);
    }
  };

  const handleRestartDemo = () => {
    setCurrentPhase("ROUND_ACTIVE");
    setStage(1);
    setRemainingMs(25000);
    setUserAnswered(false);
    setUserFeedback(null);
    setIsPlayingAuto(true);
  };

  // Instantánea de estado de la sala simulada
  const snapshot: RoomSnapshot = {
    previousPhase: "",
    phase: currentPhase,
    roomCode: "LIVE1",
    maxPlayers: 20,
    roundIndex: (brandIndex % 5),
    totalRounds: 5,
    roundSeconds: 25,
    roundId: `round-${activeBrand.id}`,
    revealStage: stage,
    totalStages: 5,
    phaseEndsAt: Date.now() + remainingMs,
    hostConnected: true,
    screenConnected: true,
    players: {
      "demo-me": { alias: "Tú (Móvil)", score: userScore, correctCount: 2, connected: true, answeredThisRound: userAnswered, waiting: false },
      "demo-1": { alias: "Ana", score: 2400, correctCount: 3, connected: true, answeredThisRound: true, waiting: false },
      "demo-2": { alias: "Carlos", score: 1900, correctCount: 2, connected: true, answeredThisRound: false, waiting: false },
      "demo-3": { alias: "Marta", score: 1400, correctCount: 1, connected: true, answeredThisRound: false, waiting: false },
      "demo-4": { alias: "Lucas", score: 900, correctCount: 1, connected: true, answeredThisRound: false, waiting: false },
    },
    ranking: [
      { playerId: "demo-1", rank: 1 },
      { playerId: "demo-me", rank: 2 },
      { playerId: "demo-2", rank: 3 },
      { playerId: "demo-3", rank: 4 },
      { playerId: "demo-4", rank: 5 },
    ],
  };

  const currentView = view || "split";

  return (
    <div className="flex h-[100dvh] flex-col bg-[#000000] text-foreground overflow-hidden">
      {/* Barra Superior de Control Apple Minimalista */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-black/60 px-4 py-2.5 backdrop-blur-xl shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white transition"
            title="Volver a la portada"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white tracking-tight">PeekRush</span>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              Simulación en vivo
            </span>
          </div>

          {/* Selector de Marcas Reales (100 marcas mundiales) */}
          <div className="flex items-center gap-1.5 pl-3 border-l border-white/[0.08] max-w-[220px] sm:max-w-[360px] md:max-w-[480px] xl:max-w-[620px] overflow-x-auto py-0.5 scrollbar-none">
            <span className="text-[11px] text-zinc-500 mr-1 shrink-0">Marca:</span>
            {brands.map((b, idx) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setBrandIndex(idx);
                  setStage(2);
                  setCurrentPhase("ROUND_ACTIVE");
                  setRemainingMs(20000);
                  setUserAnswered(false);
                }}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition shrink-0 whitespace-nowrap",
                  brandIndex === idx
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-white bg-white/[0.04] border border-white/[0.06]",
                )}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>

        {/* Fases y Reproducción Automática */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPlayingAuto(!isPlayingAuto)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition active:scale-95",
              isPlayingAuto
                ? "bg-white text-black shadow-sm"
                : "bg-white/[0.08] text-zinc-300 hover:bg-white/[0.14]",
            )}
          >
            {isPlayingAuto ? <Pause className="h-3.5 w-3.5 fill-black" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            <span>{isPlayingAuto ? "Pausar" : "Auto-Play"}</span>
          </button>

          <button
            type="button"
            onClick={handleRestartDemo}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white transition"
            title="Reiniciar ronda"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          {/* Selector de Fase Manual */}
          <div className="hidden sm:inline-flex rounded-full bg-white/[0.05] p-0.5 border border-white/[0.08] text-xs">
            {DEMO_PHASES.filter((p) => p !== "PAUSED").map((ph) => (
              <button
                key={ph}
                type="button"
                onClick={() => {
                  setCurrentPhase(ph);
                  if (ph === "ROUND_ACTIVE") {
                    setStage(2);
                    setRemainingMs(20000);
                  }
                }}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                  currentPhase === ph
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-white",
                )}
              >
                {ph === "LOBBY" ? "Lobby" : ph === "ROUND_ACTIVE" ? "Ronda" : ph === "ROUND_RESULTS" ? "Resultados" : "Podio"}
              </button>
            ))}
          </div>
        </div>

        {/* Selector de Modo de Pantalla (Apple Segmented Control) */}
        <div className="inline-flex rounded-full bg-white/[0.06] p-1 border border-white/[0.08] text-xs font-medium">
          <button
            type="button"
            onClick={() => navigate({ search: { view: "split", phase: currentPhase } })}
            className={cn(
              "flex items-center gap-1 rounded-full px-3 py-1 transition",
              currentView === "split"
                ? "bg-white text-black font-semibold shadow-sm"
                : "text-zinc-400 hover:text-white",
            )}
          >
            <Columns2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">TV + Móvil</span>
          </button>

          <button
            type="button"
            onClick={() => navigate({ search: { view: "tv", phase: currentPhase } })}
            className={cn(
              "flex items-center gap-1 rounded-full px-3 py-1 transition",
              currentView === "tv"
                ? "bg-white text-black font-semibold shadow-sm"
                : "text-zinc-400 hover:text-white",
            )}
          >
            <Tv className="h-3.5 w-3.5" />
            <span>TV</span>
          </button>

          <button
            type="button"
            onClick={() => navigate({ search: { view: "player", phase: currentPhase } })}
            className={cn(
              "flex items-center gap-1 rounded-full px-3 py-1 transition",
              currentView === "player"
                ? "bg-white text-black font-semibold shadow-sm"
                : "text-zinc-400 hover:text-white",
            )}
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>Móvil</span>
          </button>

          <button
            type="button"
            onClick={() => navigate({ search: { view: "host", phase: currentPhase } })}
            className={cn(
              "flex items-center gap-1 rounded-full px-3 py-1 transition",
              currentView === "host"
                ? "bg-white text-black font-semibold shadow-sm"
                : "text-zinc-400 hover:text-white",
            )}
          >
            <Gamepad2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Anfitrión</span>
          </button>
        </div>
      </header>

      {/* Área Principal de Simulación */}
      <main className="min-h-0 flex-1 overflow-auto bg-[#000000]">
        {/* VISTA SPLIT: PANTALLA DIVIDIDA (TV + MÓVIL EN DIRECTO) */}
        {currentView === "split" && (
          <div className="flex h-full flex-col lg:flex-row gap-4 p-3 sm:p-5">
            {/* Lado Izquierdo: Pantalla de Televisión 16:9 */}
            <div className="flex-1 flex flex-col min-h-0 rounded-3xl border border-white/[0.08] bg-[#08080a] shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2 bg-black/40 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5 font-medium text-white">
                  <Tv className="h-3.5 w-3.5 text-zinc-400" /> Pantalla TV Principal (Salón / Sala de Juegos)
                </span>
                <span className="font-mono text-[11px] text-zinc-500">
                  MARCA {brandIndex + 1}/{brands.length} · {activeBrand.category.toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-h-0 relative">
                <TvView
                  s={snapshot}
                  code={snapshot.roomCode}
                  joinUrl="https://peekrush.inmerzion.io/play?room=LIVE1"
                  joinHost="peekrush.inmerzion.io"
                  remainingMs={currentPhase === "ROUND_ACTIVE" ? remainingMs : null}
                  mediaSrc={pixelatedSrc}
                  revealAnswer={currentPhase === "ROUND_RESULTS" ? activeBrand.name : null}
                  connection="demo"
                  fill
                  host={{
                    canStart: true,
                    playerCount: 5,
                    onStart: () => {
                      setCurrentPhase("ROUND_ACTIVE");
                      setRemainingMs(25000);
                      setStage(1);
                    },
                    onPause: () => setIsPlayingAuto(false),
                    onResume: () => setIsPlayingAuto(true),
                    onNext: () => {
                      if (currentPhase === "ROUND_ACTIVE") {
                        setCurrentPhase("ROUND_RESULTS");
                      } else {
                        setBrandIndex((b) => (b + 1) % brands.length);
                        setCurrentPhase("ROUND_ACTIVE");
                        setStage(1);
                        setUserAnswered(false);
                        setUserFeedback(null);
                        setRemainingMs(25000);
                      }
                    },
                    onAbort: handleRestartDemo,
                    onReset: handleRestartDemo,
                  }}
                />
              </div>
            </div>

            {/* Lado Derecho: Marco de Teléfono Smartphone Simulado */}
            <div className="w-full lg:w-[380px] shrink-0 flex flex-col items-center justify-center p-1 sm:p-2">
              <div className="w-full max-w-[360px] h-[640px] rounded-[44px] border-[5px] border-zinc-800 bg-black shadow-2xl overflow-hidden flex flex-col relative ring-1 ring-white/10">
                {/* Dynamic Island / Notch */}
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 h-5 w-24 rounded-full bg-zinc-900 z-50 flex items-center justify-center">
                  <div className="h-2.5 w-2.5 rounded-full bg-black/60 mr-2" />
                  <div className="h-2 w-2 rounded-full bg-blue-950/80" />
                </div>

                <div className="flex-1 pt-6 overflow-hidden flex flex-col">
                  <PlayerView
                    s={snapshot}
                    playerId="demo-me"
                    alias="Tú (Móvil)"
                    connection="demo"
                    connectionError={null}
                    remainingMs={currentPhase === "ROUND_ACTIVE" ? remainingMs : null}
                    lastResult={userFeedback ? { attemptId: "demo", roundId: snapshot.roundId, status: userFeedback.status, points: userFeedback.points } : null}
                    pending={false}
                    errorCode={null}
                    onSubmit={handlePlayerSubmit}
                    fill
                  />
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 mt-2 text-center">
                Escribe <strong className="text-zinc-300 font-semibold">{activeBrand.name}</strong> en el móvil para acertar
              </p>
            </div>
          </div>
        )}

        {/* VISTA COMPLETA: SOLO TV */}
        {currentView === "tv" && (
          <div className="h-full">
            <TvView
              s={snapshot}
              code={snapshot.roomCode}
              joinUrl="https://peekrush.inmerzion.io/play?room=LIVE1"
              joinHost="peekrush.inmerzion.io"
              remainingMs={currentPhase === "ROUND_ACTIVE" ? remainingMs : null}
              mediaSrc={pixelatedSrc}
              revealAnswer={currentPhase === "ROUND_RESULTS" ? activeBrand.name : null}
              connection="demo"
              fill
              host={{
                canStart: true,
                playerCount: 5,
                onStart: () => {
                  setCurrentPhase("ROUND_ACTIVE");
                  setRemainingMs(25000);
                  setStage(1);
                },
                onPause: () => setIsPlayingAuto(false),
                onResume: () => setIsPlayingAuto(true),
                onNext: () => {
                  if (currentPhase === "ROUND_ACTIVE") {
                    setCurrentPhase("ROUND_RESULTS");
                  } else {
                    setBrandIndex((b) => (b + 1) % brands.length);
                    setCurrentPhase("ROUND_ACTIVE");
                    setStage(1);
                    setUserAnswered(false);
                    setUserFeedback(null);
                    setRemainingMs(25000);
                  }
                },
                onAbort: handleRestartDemo,
                onReset: handleRestartDemo,
              }}
            />
          </div>
        )}

        {/* VISTA COMPLETA: SOLO MÓVIL */}
        {currentView === "player" && (
          <div className="mx-auto h-full max-w-sm border-x border-white/[0.08] shadow-2xl">
            <PlayerView
              s={snapshot}
              playerId="demo-me"
              alias="Tú (Móvil)"
              connection="demo"
              connectionError={null}
              remainingMs={currentPhase === "ROUND_ACTIVE" ? remainingMs : null}
              lastResult={userFeedback ? { attemptId: "demo", roundId: snapshot.roundId, status: userFeedback.status, points: userFeedback.points } : null}
              pending={false}
              errorCode={null}
              onSubmit={handlePlayerSubmit}
              fill
            />
          </div>
        )}

        {/* VISTA COMPLETA: SOLO ANFITRIÓN */}
        {currentView === "host" && (
          <div className="h-full p-4 overflow-auto">
            <HostView
              s={snapshot}
              code={snapshot.roomCode}
              joinUrl="https://peekrush.inmerzion.io/play?room=LIVE1"
              connection="demo"
              connectionError={null}
              serverError={null}
              pairing={{ code: "749201", expiresAt: 0 }}
              pairingError={null}
              onPair={() => {}}
              onConfigure={() => {}}
              onCommand={() => {}}
              onKick={() => {}}
            />
          </div>
        )}
      </main>
    </div>
  );
}
