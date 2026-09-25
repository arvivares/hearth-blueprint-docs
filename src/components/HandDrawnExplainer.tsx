import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Sparkles, Tv, Smartphone, Zap, Trophy, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ExplainerLanguage = "es" | "en";

interface HandDrawnExplainerProps {
  lang?: ExplainerLanguage;
  externalTime?: number | null; // Optional external time from PresenterAudio
  onSceneChange?: (sceneIndex: number) => void;
  className?: string;
}

// -------------------------------------------------------------
// CORE HAND-DRAWN MATH & RENDERING ENGINE
// Based on https://github.com/alesha-pro/tools/tree/main/skills/hand-drawn-canvas-animation
// -------------------------------------------------------------

function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function rng(seed: number) {
  let a = (seed * 1000003) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(k: number, seed = 0): number {
  let a = (Math.imul(k | 0, 0x9e3779b1) + Math.imul((seed * 4096) | 0, 0x85ebca77)) | 0;
  a ^= a >>> 15;
  a = Math.imul(a, 0x2c1b3c6d);
  a ^= a >>> 12;
  a = Math.imul(a, 0x297a2d39);
  a ^= a >>> 15;
  return (a >>> 0) / 4294967296;
}

function noise1(x: number, seed = 1): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i, seed) * 2 - 1, hash(i + 1, seed) * 2 - 1, u);
}

function drift(t: number, seed = 1, o: { amp?: number; freq?: number } = {}): number {
  const { amp = 1, freq = 0.5 } = o;
  return amp * (0.7 * noise1(t * freq, seed) + 0.3 * noise1(t * freq * 2.7 + 11, seed + 3));
}

function spring(t: number, o: { freq?: number; damp?: number } = {}): number {
  const { freq = 2.4, damp = 0.55 } = o;
  if (t <= 0) return 0;
  const w = Math.PI * 2 * freq;
  if (damp >= 1) return 1 - (1 + w * t) * Math.exp(-w * t);
  const wd = w * Math.sqrt(1 - damp * damp);
  return 1 - Math.exp(-damp * w * t) * (Math.cos(wd * t) + ((damp * w) / wd) * Math.sin(wd * t));
}

// Catmull-Rom smoothing preserving sharp corners
function smoothPts(pts: [number, number][], close = false, step = 4, corner = 0.8): [number, number][] {
  const n = pts.length;
  if (n < 2) return pts.map((p) => [p[0], p[1]]);
  const P = (i: number) => (close ? pts[((i % n) + n) % n] : pts[clamp(i, 0, n - 1)]);
  const sharp: boolean[] = [];
  for (let i = 0; i < n; i++) {
    if (!close && (i === 0 || i === n - 1)) {
      sharp.push(true);
      continue;
    }
    const a = P(i - 1),
      b = P(i),
      d = P(i + 1);
    let t = Math.abs(Math.atan2(d[1] - b[1], d[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]));
    if (t > Math.PI) t = Math.PI * 2 - t;
    sharp.push(t > corner);
  }
  const out: [number, number][] = [];
  const segs = close ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p1 = P(i),
      p2 = P(i + 1),
      c1 = sharp[i % n],
      c2 = sharp[(i + 1) % n],
      p0 = c1 ? [2 * p1[0] - p2[0], 2 * p1[1] - p2[1]] : P(i - 1),
      p3 = c2 ? [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]] : P(i + 2);
    const m = Math.max(1, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < m; k++) {
      const t = k / m,
        t2 = t * t,
        t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (p2[0] - p0[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (3 * p1[0] - p0[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (p2[1] - p0[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (3 * p1[1] - p0[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  if (!close) out.push([pts[n - 1][0], pts[n - 1][1]]);
  return out;
}

// wob: Organic hand-drawn wander with line-width taper
function wob(
  c: CanvasRenderingContext2D,
  pts: [number, number][],
  amp: number,
  seed: number,
  close = false,
  o: { smooth?: boolean; step?: number; corner?: number; pressure?: number; freq?: number } = {}
) {
  const { smooth = true, step = 4, corner = 0.8, pressure = 0, freq = 1 } = o;
  if (pts.length < 2) return;
  const q = smooth ? smoothPts(pts, close, step, corner) : pts;
  const n = q.length;
  const s = [0];
  for (let i = 1; i < n; i++) s.push(s[i - 1] + Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]));
  const L = close ? s[n - 1] + Math.hypot(q[0][0] - q[n - 1][0], q[0][1] - q[n - 1][1]) : s[n - 1];
  const r = rng(seed);
  const ph = [r() * Math.PI * 2, r() * Math.PI * 2, r() * Math.PI * 2, r() * 100];
  let off: (i: number) => number;
  if (close) {
    const k1 = Math.max(2, Math.round((L / 140) * freq)),
      k2 = k1 * 2 + 1,
      k3 = k2 * 2 + 1;
    off = (i) =>
      amp *
      (0.42 * Math.sin((k1 * Math.PI * 2 * s[i]) / L + ph[0]) +
        0.26 * Math.sin((k2 * Math.PI * 2 * s[i]) / L + ph[1]) +
        0.14 * Math.sin((k3 * Math.PI * 2 * s[i]) / L + ph[2]));
  } else {
    const sc = freq / 90;
    off = (i) => amp * (0.55 * noise1(s[i] * sc + ph[3], seed) + 0.28 * noise1(s[i] * sc * 2.6 + ph[3] * 3, seed + 7));
  }
  const out: [number, number][] = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = q[i > 0 ? i - 1 : close ? n - 1 : 0];
    const b = q[i < n - 1 ? i + 1 : close ? 0 : n - 1];
    let nx = a[1] - b[1],
      ny = b[0] - a[0];
    const l = Math.hypot(nx, ny) || 1;
    const d = off(i);
    out[i] = [q[i][0] + (nx / l) * d, q[i][1] + (ny / l) * d];
  }
  if (!pressure) {
    c.beginPath();
    out.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    if (close) c.closePath();
    c.stroke();
    return;
  }
  const w = c.lineWidth;
  const tl = Math.max(1, Math.min(L * 0.3, w * 9));
  const cap = c.lineCap;
  c.lineCap = "round";
  const wid = (i: number) => {
    const e = close ? 1 : Math.min(1, s[i] / tl, (L - s[i]) / tl);
    return Math.max(
      0.5,
      w *
        (1 - pressure * 0.55 * (1 - Math.sin((e * Math.PI) / 2))) *
        (1 + pressure * 0.22 * Math.sin(s[i] / 55 + ph[1]) + pressure * 0.1 * Math.sin(s[i] / 17 + ph[2]))
    );
  };
  for (let i = 1; i < n + (close ? 1 : 0); i++) {
    const a = out[i - 1];
    const b = out[i % n];
    c.lineWidth = (wid(i - 1) + wid(i % n)) / 2;
    c.beginPath();
    c.moveTo(a[0], a[1]);
    c.lineTo(b[0], b[1]);
    c.stroke();
  }
  c.lineWidth = w;
  c.lineCap = cap;
}

// Crayon effect: 3 layered passes that wander apart
function crayon(c: CanvasRenderingContext2D, pts: [number, number][], color: string, width: number, seed: number, close = false) {
  c.save();
  c.strokeStyle = color;
  c.lineCap = "round";
  c.lineJoin = "round";
  for (let k = 0; k < 3; k++) {
    c.globalAlpha = k ? 0.35 : 0.85;
    c.lineWidth = width * (k ? 0.7 : 1);
    wob(c, pts, 2.0 + k * 1.2, seed + k * 7, close, { pressure: k ? 0 : 0.5, freq: 1.4 });
  }
  c.restore();
}

// Hand-drawn form hatch for shading
function hatch(
  c: CanvasRenderingContext2D,
  path: Path2D,
  box: [number, number, number, number],
  o: { angle?: number; gap?: number; len?: number; jitter?: number; color?: string; alpha?: number; width?: number; seed?: number } = {}
) {
  const { angle = 0.9, gap = 8, len = 16, jitter = 4, color = "#ffffff", alpha = 0.25, width = 1.2, seed = 1 } = o;
  const r = rng(seed);
  c.save();
  c.clip(path);
  c.strokeStyle = color;
  c.globalAlpha = alpha;
  c.lineWidth = width;
  c.lineCap = "round";
  const [bx, by, bw, bh] = box;
  const cx = bx + bw / 2,
    cy = by + bh / 2;
  const R = Math.hypot(bw, bh) / 2;
  const ca = Math.cos(angle),
    sa = Math.sin(angle);
  c.beginPath();
  for (let v = -R; v <= R; v += gap) {
    for (let u = -R; u <= R; u += len * 1.6) {
      const uu = u + (r() - 0.5) * jitter * 2;
      const L = len * (0.6 + r() * 0.8);
      const x0 = cx + ca * uu - sa * v + (r() - 0.5) * jitter;
      const y0 = cy + sa * uu + ca * v + (r() - 0.5) * jitter;
      c.moveTo(x0, y0);
      c.lineTo(x0 + ca * L, y0 + sa * L);
    }
  }
  c.stroke();
  c.restore();
}

// Paper grain speckles
function grain(c: CanvasRenderingContext2D, box: [number, number, number, number], n: number, color: string, alpha: number, seed: number) {
  const r = rng(seed);
  c.save();
  c.fillStyle = color;
  c.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    c.fillRect(box[0] + r() * box[2], box[1] + r() * box[3], 1.2 + r() * 0.8, 1.2 + r() * 0.8);
  }
  c.restore();
}

// Sparkle / aster ray
function aster(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, rays = 4, rot = 0) {
  c.save();
  c.strokeStyle = color;
  c.lineWidth = 1.8;
  c.lineCap = "round";
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI + rot;
    c.beginPath();
    c.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r);
    c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    c.stroke();
  }
  c.restore();
}

// Simple synthesizer sound effects using Web Audio API
class SfxPlayer {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private getContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  pop() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(780, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {}
  }

  chime() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = ctx.currentTime + idx * 0.06;
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.06, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.28);
      });
    } catch {}
  }

  buzzer() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  }
}

const sfx = new SfxPlayer();

// -------------------------------------------------------------
// TEXT & METADATA PER SCENE
// -------------------------------------------------------------

const SCENES_META = {
  es: [
    {
      id: "tv",
      title: "1. La Gran Pantalla",
      badge: "Lobby TV",
      icon: Tv,
      desc: "Abre PeekRush en la televisión del salón. Verás un código gigante de 5 letras (ej. 7KX9P) y un código QR.",
      handNote: "¡Tu tele es el tablero central!",
    },
    {
      id: "phone",
      title: "2. Tu Móvil es el Mando",
      badge: "Sin Apps",
      icon: Smartphone,
      desc: "Tus amigos escanean el código QR o entran a peekrush.inmerzion.io desde su navegador. Escriben su apodo y ¡listos!",
      handNote: "¡Cero descargas, entran al instante!",
    },
    {
      id: "reveal",
      title: "3. Revelado y Multiplicador",
      badge: "⚡ Velocidad",
      icon: Zap,
      desc: "El logo aparece en la tele y se revela gradualmente. Un rayo multiplicador cuenta hacia abajo: ¡más rápido = más puntos!",
      handNote: "¡Adivina antes de que termine el multiplicador!",
    },
    {
      id: "podium",
      title: "4. ¡Podio y Récords!",
      badge: "🏆 Victoria",
      icon: Trophy,
      desc: "Tras cada ronda y al final de la partida, los mejores suben al podio y graban su récord en la clasificación global.",
      handNote: "¡Conquista el podio de campeones!",
    },
  ],
  en: [
    {
      id: "tv",
      title: "1. The Big Screen",
      badge: "TV Lobby",
      icon: Tv,
      desc: "Open PeekRush on your living room TV. A giant 5-letter room code (e.g. 7KX9P) and QR code will appear.",
      handNote: "Your TV is the main gameboard!",
    },
    {
      id: "phone",
      title: "2. Phones as Controllers",
      badge: "No Apps",
      icon: Smartphone,
      desc: "Friends scan the QR code or go to peekrush.inmerzion.io on their phones. Enter a nickname and join instantly!",
      handNote: "Zero downloads, play right in browser!",
    },
    {
      id: "reveal",
      title: "3. Reveal & Speed Bonus",
      badge: "⚡ Multiplier",
      icon: Zap,
      desc: "The logo emerges gradually on TV. The speed multiplier counts down: faster answers unlock higher score multipliers!",
      handNote: "Guess fast for maximum points!",
    },
    {
      id: "podium",
      title: "4. Podium & Leaderboard",
      badge: "🏆 Victory",
      icon: Trophy,
      desc: "After each round, celebrate on the winner podium and secure your spot on the all-time global leaderboard.",
      handNote: "Climb to the top of the podium!",
    },
  ],
};

const SCENE_DURATION = 6.0; // 6 seconds per scene
const TOTAL_DURATION = 24.0; // 24 seconds total narrative

export function HandDrawnExplainer({
  lang = "es",
  externalTime = null,
  onSceneChange,
  className,
}: HandDrawnExplainerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastSceneRef = useRef(0);

  const scenes = SCENES_META[lang] || SCENES_META.es;
  const currentSceneIndex = Math.min(3, Math.floor((currentTime % TOTAL_DURATION) / SCENE_DURATION));

  // Sync sound setting
  useEffect(() => {
    sfx.enabled = soundEnabled;
  }, [soundEnabled]);

  // Notify parent on scene change
  useEffect(() => {
    if (lastSceneRef.current !== currentSceneIndex) {
      lastSceneRef.current = currentSceneIndex;
      onSceneChange?.(currentSceneIndex);
      if (soundEnabled) {
        if (currentSceneIndex === 3) sfx.chime();
        else sfx.pop();
      }
    }
  }, [currentSceneIndex, onSceneChange, soundEnabled]);

  // Sync with external time (from presenter audio if active)
  useEffect(() => {
    if (externalTime !== null && !isNaN(externalTime)) {
      // Map presenter audio chapters to scenes
      // 0..12 -> scene 0 (TV)
      // 12..28 -> scene 1 (Phone)
      // 28..45 -> scene 2 (Reveal)
      // 45+ -> scene 3 (Podium)
      let targetTime = 0;
      if (externalTime < 12) targetTime = (externalTime / 12) * 6;
      else if (externalTime < 28) targetTime = 6 + ((externalTime - 12) / 16) * 6;
      else if (externalTime < 45) targetTime = 12 + ((externalTime - 28) / 17) * 6;
      else targetTime = 18 + Math.min(6, ((externalTime - 45) / 15) * 6);

      setCurrentTime(targetTime);
      setIsPlaying(false); // External time drives playback
    }
  }, [externalTime]);

  // Animation timeline loop
  useEffect(() => {
    if (!isPlaying || externalTime !== null) return;
    let animId: number;
    let lastStamp = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastStamp) / 1000;
      lastStamp = now;
      setCurrentTime((prev) => (prev + dt) % TOTAL_DURATION);
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, externalTime]);

  // Jump to specific scene
  const selectScene = (idx: number) => {
    setCurrentTime(idx * SCENE_DURATION + 0.05);
    sfx.pop();
  };

  const togglePlay = () => {
    setIsPlaying((prev) => !prev);
    sfx.pop();
  };

  const restart = () => {
    setCurrentTime(0);
    setIsPlaying(true);
    sfx.pop();
  };

  // Main Canvas 2D Drawing Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Logical dimensions: 800 x 450 (16:9 Jackbox Cartoon Stage)
    const W = 800;
    const H = 450;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const rect = canvas.getBoundingClientRect();
    const displayW = rect.width > 0 ? rect.width : (canvas.parentElement?.clientWidth || 800);
    const displayH = rect.height > 0 ? rect.height : Math.round(displayW * 9 / 16);
    const targetW = Math.max(320, Math.round(displayW * dpr));
    const targetH = Math.max(180, Math.round(displayH * dpr));
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.save();
    ctx.scale(canvas.width / W, canvas.height / H);

    // Clear frame with deep chalkboard OLED dark background
    ctx.fillStyle = "#0c0d14";
    ctx.fillRect(0, 0, W, H);

    // Subtle paper grain & framing vignette
    grain(ctx, [0, 0, W, H], 380, "#ffffff", 0.05, 42);

    // Background sketchbook border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1.2;
    wob(ctx, [[14, 14], [W - 14, 14], [W - 14, H - 14], [14, H - 14]], 1.5, 99, true);

    const t = currentTime;
    const sceneIdx = Math.min(3, Math.floor((t % TOTAL_DURATION) / SCENE_DURATION));
    const sceneT = t % SCENE_DURATION;

    // -----------------------------------------------------------------
    // SCENE 1: LA GRAN PANTALLA (TV Lobby)
    // -----------------------------------------------------------------
    if (sceneIdx === 0) {
      const tvW = 420;
      const tvH = 260;
      const tvX = (W - tvW) / 2;
      const tvY = 85;

      const tvAppear = 1.0;
      const tvBreath = drift(sceneT, 11, { amp: 1.5, freq: 0.6 });

      ctx.save();
      ctx.translate(W / 2, tvY + tvH / 2);
      ctx.scale(tvAppear, tvAppear);
      ctx.translate(-W / 2, -(tvY + tvH / 2) + tvBreath);

      // Antennas atop TV
      const antLeft: [number, number][] = [
        [tvX + tvW / 2 - 30, tvY],
        [tvX + tvW / 2 - 80, tvY - 55 + drift(sceneT, 1, { amp: 3, freq: 1.2 })],
      ];
      const antRight: [number, number][] = [
        [tvX + tvW / 2 + 30, tvY],
        [tvX + tvW / 2 + 85, tvY - 60 + drift(sceneT, 2, { amp: 3, freq: 1.1 })],
      ];
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 2.4;
      wob(ctx, antLeft, 1.8, 12);
      wob(ctx, antRight, 1.8, 15);
      // Knobs at antenna tips
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(antLeft[1][0], antLeft[1][1], 5, 0, Math.PI * 2);
      ctx.arc(antRight[1][0], antRight[1][1], 5, 0, Math.PI * 2);
      ctx.fill();

      // Outer TV Chassis (Rounded Bezel)
      const chassisPts: [number, number][] = [
        [tvX, tvY],
        [tvX + tvW, tvY],
        [tvX + tvW, tvY + tvH],
        [tvX, tvY + tvH],
      ];
      ctx.fillStyle = "#161822";
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.roundRect?.(tvX, tvY, tvW, tvH, 24) || ctx.rect(tvX, tvY, tvW, tvH);
      ctx.fill();
      wob(ctx, chassisPts, 2.0, 101, true, { corner: 0.6, pressure: 0.4 });

      // TV Legs
      const legL: [number, number][] = [
        [tvX + 50, tvY + tvH],
        [tvX + 25, tvY + tvH + 35],
      ];
      const legR: [number, number][] = [
        [tvX + tvW - 50, tvY + tvH],
        [tvX + tvW - 25, tvY + tvH + 35],
      ];
      ctx.lineWidth = 3.5;
      wob(ctx, legL, 1.4, 202);
      wob(ctx, legR, 1.4, 203);

      // Inner Screen with cathode glow
      const scrX = tvX + 22;
      const scrY = tvY + 22;
      const scrW = tvW - 44;
      const scrH = tvH - 44;

      ctx.fillStyle = "#090a10";
      ctx.fillRect(scrX, scrY, scrW, scrH);

      // Form hatching on screen edges for depth
      const scrPath = new Path2D();
      scrPath.rect(scrX, scrY, scrW, scrH);
      hatch(ctx, scrPath, [scrX, scrY, scrW, scrH], { angle: 1.1, gap: 14, color: "#38bdf8", alpha: 0.12, seed: 7 });

      // Active Screen Content
      // Badge: PEEKRUSH TV
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PEEKRUSH · PANTALLA PRINCIPAL", scrX + scrW / 2, scrY + 34);

      // Subtitle prompt
      ctx.fillStyle = "#94a3b8";
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText(lang === "es" ? "Entra desde tu móvil en peekrush.inmerzion.io" : "Join from phone at peekrush.inmerzion.io", scrX + scrW / 2, scrY + 54);

      // Big Room Code Container: 7KX9P
      const codeBoxW = 240;
      const codeBoxH = 68;
      const codeBoxX = scrX + (scrW - codeBoxW) / 2;
      const codeBoxY = scrY + 70;

      ctx.fillStyle = "rgba(56, 189, 248, 0.08)";
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.8;
      ctx.fillRect(codeBoxX, codeBoxY, codeBoxW, codeBoxH);
      wob(ctx, [
        [codeBoxX, codeBoxY],
        [codeBoxX + codeBoxW, codeBoxY],
        [codeBoxX + codeBoxW, codeBoxY + codeBoxH],
        [codeBoxX, codeBoxY + codeBoxH],
      ], 1.6, 555, true);

      // Giant hand-drawn code letters
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 42px monospace";
      ctx.textAlign = "center";
      ctx.fillText("7 K X 9 P", scrX + scrW / 2, codeBoxY + 49);

      // QR Code Sketch Icon
      const qrSize = 44;
      const qrX = scrX + scrW / 2 - qrSize / 2;
      const qrY = codeBoxY + codeBoxH + 12;
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1.6;
      wob(ctx, [[qrX, qrY], [qrX + qrSize, qrY], [qrX + qrSize, qrY + qrSize], [qrX, qrY + qrSize]], 1.2, 606, true);
      ctx.strokeRect(qrX + 6, qrY + 6, 10, 10);
      ctx.strokeRect(qrX + qrSize - 16, qrY + 6, 10, 10);
      ctx.strokeRect(qrX + 6, qrY + qrSize - 16, 10, 10);
      ctx.fillRect(qrX + qrSize / 2 - 4, qrY + qrSize / 2 - 4, 8, 8);

      // Sparkles and stars around code
      const sparkPulse = Math.sin(sceneT * 6);
      aster(ctx, codeBoxX - 24, codeBoxY + 20, 10 + sparkPulse * 2, "#fbbf24", 4, sceneT * 2);
      aster(ctx, codeBoxX + codeBoxW + 24, codeBoxY + 45, 12 - sparkPulse * 2, "#38bdf8", 4, -sceneT * 2);

      // Cathode horizontal flash line overlay at start
      if (sceneT < 0.3) {
        const flashW = lerp(0, scrW, Math.min(1, sceneT * 3));
        ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
        ctx.fillRect(scrX + (scrW - flashW) / 2, scrY + scrH / 2 - 2, flashW, 4);
      }

      ctx.restore();

      // Hand-written Jackbox style annotation with arrow
      ctx.save();
      ctx.fillStyle = "#fbbf24";
      ctx.font = 'italic 16px "Comic Sans MS", cursive, sans-serif';
      ctx.textAlign = "left";
      const noteText = lang === "es" ? "¡Pulsa 'Crear sala' y proyéctalo en la TV!" : "Click 'Create room' & cast to your TV!";
      ctx.fillText(noteText, 70, 72);

      // Hand-drawn arrow pointing to TV
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2.0;
      const arrowPts: [number, number][] = [
        [160, 80],
        [210, 105],
        [tvX - 8, 125],
      ];
      wob(ctx, arrowPts, 1.8, 777);
      // Arrow head
      wob(ctx, [[tvX - 20, 114], [tvX - 8, 125], [tvX - 22, 134]], 1.4, 778);
      ctx.restore();
    }

    // -----------------------------------------------------------------
    // SCENE 2: LOS MÓVILES COMO MANDOS (Phone as Controller)
    // -----------------------------------------------------------------
    else if (sceneIdx === 1) {
      const phoneW = 200;
      const phoneH = 340;
      const phoneX = W / 2 - phoneW / 2;
      const phoneY = 60;

      // Phone enters with bouncy spring
      const phoneEnter = 1.0;
      const phoneSway = drift(sceneT, 44, { amp: 1.8, freq: 0.8 });

      ctx.save();
      ctx.translate(phoneX + phoneW / 2, phoneY + phoneH / 2);
      ctx.scale(phoneEnter, phoneEnter);
      ctx.translate(-(phoneX + phoneW / 2), -(phoneY + phoneH / 2) + phoneSway);

      // Cartoon hand silhouette holding phone from behind
      ctx.fillStyle = "#1e2130";
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 2.4;
      const handPts: [number, number][] = [
        [phoneX - 35, phoneY + 180],
        [phoneX - 10, phoneY + 160],
        [phoneX - 10, phoneY + 280],
        [phoneX - 45, phoneY + 310],
      ];
      wob(ctx, handPts, 2.0, 911, false, { pressure: 0.5 });

      // Phone chassis (Clean hand-drawn rounded smartphone)
      ctx.fillStyle = "#12131c";
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.roundRect?.(phoneX, phoneY, phoneW, phoneH, 30) || ctx.rect(phoneX, phoneY, phoneW, phoneH);
      ctx.fill();
      wob(ctx, [
        [phoneX, phoneY],
        [phoneX + phoneW, phoneY],
        [phoneX + phoneW, phoneY + phoneH],
        [phoneX, phoneY + phoneH],
      ], 1.8, 888, true, { corner: 0.5 });

      // Dynamic Island / Speaker notch
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(phoneX + phoneW / 2, phoneY + 18, 5, 0, Math.PI * 2);
      ctx.fill();

      // Phone Screen
      const pScrX = phoneX + 12;
      const pScrY = phoneY + 30;
      const pScrW = phoneW - 24;
      const pScrH = phoneH - 45;

      ctx.fillStyle = "#07080e";
      ctx.fillRect(pScrX, pScrY, pScrW, pScrH);

      // URL bar at top of screen
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(pScrX + 10, pScrY + 12, pScrW - 20, 22);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("peekrush.inmerzion.io", pScrX + pScrW / 2, pScrY + 26);

      // Game Title on phone
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 15px system-ui, sans-serif";
      ctx.fillText("PeekRush", pScrX + pScrW / 2, pScrY + 62);

      // Input 1: Room code field with 7KX9P typed
      const inp1Y = pScrY + 80;
      ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.6;
      ctx.fillRect(pScrX + 14, inp1Y, pScrW - 28, 38);
      wob(ctx, [
        [pScrX + 14, inp1Y],
        [pScrX + pScrW - 14, inp1Y],
        [pScrX + pScrW - 14, inp1Y + 38],
        [pScrX + 14, inp1Y + 38],
      ], 1.2, 701, true);
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 18px monospace";
      ctx.fillText("7 K X 9 P", pScrX + pScrW / 2, inp1Y + 25);

      // Input 2: Player alias field: "Alex"
      const inp2Y = pScrY + 130;
      ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1.4;
      ctx.fillRect(pScrX + 14, inp2Y, pScrW - 28, 38);
      wob(ctx, [
        [pScrX + 14, inp2Y],
        [pScrX + pScrW - 14, inp2Y],
        [pScrX + pScrW - 14, inp2Y + 38],
        [pScrX + 14, inp2Y + 38],
      ], 1.2, 702, true);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.fillText("Alex ✨", pScrX + pScrW / 2, inp2Y + 24);

      // Big Join Button: "¡A JUGAR!"
      const btnY = pScrY + 185;
      const isTap = sceneT > 2.2 && sceneT < 3.2;
      const btnScale = isTap ? 0.94 : 1.0;

      ctx.save();
      ctx.translate(pScrX + pScrW / 2, btnY + 22);
      ctx.scale(btnScale, btnScale);
      ctx.translate(-(pScrX + pScrW / 2), -(btnY + 22));

      ctx.fillStyle = isTap ? "#22c55e" : "#ffffff";
      ctx.fillRect(pScrX + 14, btnY, pScrW - 28, 44);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.2;
      wob(ctx, [
        [pScrX + 14, btnY],
        [pScrX + pScrW - 14, btnY],
        [pScrX + pScrW - 14, btnY + 44],
        [pScrX + 14, btnY + 44],
      ], 1.5, 703, true);

      ctx.fillStyle = isTap ? "#ffffff" : "#000000";
      ctx.font = "900 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(isTap ? "¡CONECTADO!" : (lang === "es" ? "¡ENTRAR!" : "JOIN!"), pScrX + pScrW / 2, btnY + 27);
      ctx.restore();

      // Animated thumb pressing the button
      if (isTap) {
        ctx.fillStyle = "#f8fafc";
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        // Ripple shockwave
        const ripR = (sceneT - 2.2) * 45;
        ctx.beginPath();
        ctx.arc(pScrX + pScrW / 2, btnY + 22, ripR, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();

      // Radio Wi-Fi waves between TV and Phone
      const waveAlpha = Math.sin(sceneT * 5) * 0.5 + 0.5;
      ctx.save();
      ctx.strokeStyle = "#38bdf8";
      ctx.globalAlpha = waveAlpha;
      ctx.lineWidth = 2.2;
      [40, 70, 100].forEach((r) => {
        ctx.beginPath();
        ctx.arc(phoneX - 30, phoneY + 120, r, -0.6, 0.6);
        ctx.stroke();
      });
      ctx.restore();

      // Handwritten annotations
      ctx.fillStyle = "#38bdf8";
      ctx.font = 'italic 16px "Comic Sans MS", cursive, sans-serif';
      ctx.textAlign = "right";
      ctx.fillText(lang === "es" ? "¡Cada amigo usa su propio móvil!" : "Each friend uses their own phone!", W - 60, 110);
      ctx.fillStyle = "#94a3b8";
      ctx.font = 'italic 13px "Comic Sans MS", cursive, sans-serif';
      ctx.fillText(lang === "es" ? "Sin apps ni registros." : "No apps or accounts needed.", W - 60, 134);
    }

    // -----------------------------------------------------------------
    // SCENE 3: REVELADO Y MULTIPLICADOR DE VELOCIDAD
    // -----------------------------------------------------------------
    else if (sceneIdx === 2) {
      // Background TV screen showing the logo reveal
      const boardW = 540;
      const boardH = 320;
      const boardX = (W - boardW) / 2;
      const boardY = 65;

      ctx.fillStyle = "#12141e";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.roundRect?.(boardX, boardY, boardW, boardH, 20) || ctx.rect(boardX, boardY, boardW, boardH);
      ctx.fill();
      wob(ctx, [
        [boardX, boardY],
        [boardX + boardW, boardY],
        [boardX + boardW, boardY + boardH],
        [boardX, boardY + boardH],
      ], 1.8, 303, true);

      // Speed Multiplier Header: ⚡ 3.0x -> 2.8x -> 1.5x
      const multVal = Math.max(1.0, 3.0 - (sceneT / SCENE_DURATION) * 2.0).toFixed(1);
      const isFast = Number(multVal) > 2.0;

      const boltPulse = Math.sin(sceneT * 8) * 3;
      ctx.fillStyle = isFast ? "#f59e0b" : "#ef4444";
      ctx.font = "900 28px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`⚡ ${multVal}x`, boardX + boardW / 2, boardY + 45);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText(lang === "es" ? "MULTIPLICADOR DE VELOCIDAD" : "SPEED MULTIPLIER", boardX + boardW / 2, boardY + 62);

      // The Brand Logo revealing progressively: Hand-drawn Apple or Adidas silhouette
      const logoCx = boardX + boardW / 2;
      const logoCy = boardY + 160;
      const revealProgress = clamp(sceneT / 4.0, 0.15, 1.0);

      // Apple logo drawn with Catmull-Rom & wob
      ctx.save();
      ctx.translate(logoCx, logoCy);

      // Leaf
      const leafPts: [number, number][] = [
        [0, -68],
        [18, -90],
        [0, -96],
        [-10, -82],
      ];
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      wob(ctx, leafPts, 1.4, 401, true);
      ctx.fill();

      // Apple Body Silhouette
      const appleBody: [number, number][] = [
        [0, -50],
        [28, -55],
        [54, -28],
        [58, 8],
        [42, 44],
        [22, 60],
        [0, 52],
        [-22, 60],
        [-42, 44],
        [-58, 8],
        [-54, -28],
        [-28, -55],
      ];

      // Form fill
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      appleBody.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.fill();
      wob(ctx, appleBody, 1.8, 402, true);

      // Bite cut-out
      ctx.fillStyle = "#12141e";
      ctx.beginPath();
      ctx.arc(50, 4, 22, 0, Math.PI * 2);
      ctx.fill();

      // Obscuring puzzle blocks / veil that peels away as revealProgress increases
      if (revealProgress < 0.9) {
        ctx.fillStyle = "#12141e";
        const blocks = 8;
        const bSize = 16;
        for (let bx = -4; bx <= 4; bx++) {
          for (let by = -4; by <= 4; by++) {
            const h = hash(bx + by * 10, 44);
            if (h > revealProgress) {
              ctx.fillRect(bx * bSize - bSize / 2, by * bSize - bSize / 2, bSize + 1, bSize + 1);
            }
          }
        }
      }

      ctx.restore();

      // Answer buzzer reaction at t > 2.8s
      if (sceneT > 2.8) {
        const popT = sceneT - 2.8;
        const popScale = spring(popT * 2.5, { freq: 3.0, damp: 0.5 });

        ctx.save();
        ctx.translate(boardX + boardW / 2, boardY + boardH - 42);
        ctx.scale(popScale, popScale);

        // Success banner: "¡CORRECTO! +840 PTS (⚡ 2.8x)"
        ctx.fillStyle = "#22c55e";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.4;
        ctx.fillRect(-170, -22, 340, 44);
        wob(ctx, [[-170, -22], [170, -22], [170, 22], [-170, 22]], 1.6, 999, true);

        ctx.fillStyle = "#ffffff";
        ctx.font = "900 16px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(lang === "es" ? "¡CORRECTO!  +840 PTS  (⚡ 2.8x)" : "CORRECT!  +840 PTS  (⚡ 2.8x)", 0, 6);

        // Radial burst rays
        aster(ctx, -190, 0, 14, "#fbbf24", 5, sceneT * 3);
        aster(ctx, 190, 0, 14, "#fbbf24", 5, -sceneT * 3);
        ctx.restore();
      }

      // Handwritten annotations
      ctx.fillStyle = "#fbbf24";
      ctx.font = 'italic 15px "Comic Sans MS", cursive, sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(lang === "es" ? "¡Adivina antes que tus amigos para llevarte la bonificación máxima!" : "Guess before your friends to grab the max multiplier!", W / 2, boardY + boardH + 32);
    }

    // -----------------------------------------------------------------
    // SCENE 4: EL PODIO DE CAMPEONES
    // -----------------------------------------------------------------
    else if (sceneIdx === 3) {
      const podY = 270;
      const stepW = 120;
      const centerPodX = W / 2 - stepW / 2;

      // 3 Podium Steps (2nd, 1st, 3rd)
      const podH1 = 150; // 1st Place
      const podH2 = 100; // 2nd Place
      const podH3 = 70;  // 3rd Place

      const enter1 = 1.0;
      const enter2 = 1.0;
      const enter3 = 1.0;

      // Step 2 (Left)
      const x2 = centerPodX - stepW + 15;
      const y2 = podY + (1 - enter2) * 200;
      ctx.fillStyle = "#1e2436";
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 2.4;
      ctx.fillRect(x2, y2, stepW, podH2);
      wob(ctx, [[x2, y2], [x2 + stepW, y2], [x2 + stepW, y2 + podH2], [x2, y2 + podH2]], 1.5, 601, true);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "900 36px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("2", x2 + stepW / 2, y2 + 65);
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillText("Hugo (1,920)", x2 + stepW / 2, y2 - 14);

      // Step 3 (Right)
      const x3 = centerPodX + stepW - 15;
      const y3 = podY + (1 - enter3) * 200;
      ctx.fillStyle = "#1e2436";
      ctx.strokeStyle = "#ca8a04";
      ctx.lineWidth = 2.4;
      ctx.fillRect(x3, y3, stepW, podH3);
      wob(ctx, [[x3, y3], [x3 + stepW, y3], [x3 + stepW, y3 + podH3], [x3, y3 + podH3]], 1.5, 602, true);
      ctx.fillStyle = "#ca8a04";
      ctx.font = "900 36px system-ui, sans-serif";
      ctx.fillText("3", x3 + stepW / 2, y3 + 52);
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillText("Dani (1,480)", x3 + stepW / 2, y3 - 14);

      // Step 1 (Center, Gold)
      const x1 = centerPodX;
      const y1 = podY - 50 + (1 - enter1) * 200;
      ctx.fillStyle = "#1e293b";
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 3.2;
      ctx.fillRect(x1, y1, stepW, podH1);
      wob(ctx, [[x1, y1], [x1 + stepW, y1], [x1 + stepW, y1 + podH1], [x1, y1 + podH1]], 2.0, 603, true);

      // Form hatching on step 1
      const path1 = new Path2D();
      path1.rect(x1, y1, stepW, podH1);
      hatch(ctx, path1, [x1, y1, stepW, podH1], { angle: 0.8, gap: 12, color: "#fbbf24", alpha: 0.15, seed: 12 });

      ctx.fillStyle = "#fbbf24";
      ctx.font = "900 52px system-ui, sans-serif";
      ctx.fillText("1", x1 + stepW / 2, y1 + 75);
      ctx.font = "900 15px system-ui, sans-serif";
      ctx.fillText("👑 Sara (3,420)", x1 + stepW / 2, y1 - 48);

      // Golden Trophy atop Step 1
      const trophyX = x1 + stepW / 2;
      const trophyY = y1 - 22;
      const trophyWob = drift(sceneT, 9, { amp: 2.2, freq: 1.0 });

      ctx.save();
      ctx.translate(trophyX, trophyY + trophyWob);
      // Trophy cup
      ctx.fillStyle = "#fbbf24";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.2;
      const cupPts: [number, number][] = [
        [-20, -25],
        [20, -25],
        [16, -2],
        [0, 10],
        [-16, -2],
      ];
      ctx.beginPath();
      cupPts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.fill();
      wob(ctx, cupPts, 1.2, 501, true);

      // Trophy base
      ctx.fillRect(-14, 10, 28, 5);
      ctx.fillRect(-18, 15, 36, 6);

      // Sparkles on trophy
      aster(ctx, -22, -18, 8, "#ffffff", 4, sceneT * 3);
      aster(ctx, 22, -18, 8, "#fbbf24", 4, -sceneT * 3);
      ctx.restore();

      // Confetti physics: Fluttering organic falling marks
      const confColors = ["#f43f5e", "#38bdf8", "#fbbf24", "#22c55e", "#a855f7"];
      for (let i = 0; i < 35; i++) {
        const cSeed = i * 17;
        const startX = (hash(i, 3) * W);
        const speed = 60 + hash(i, 5) * 80;
        const confY = ((sceneT * speed + hash(i, 7) * H) % (H + 40)) - 20;
        const confX = startX + drift(sceneT + i, cSeed, { amp: 30, freq: 1.2 });
        const confRot = sceneT * 4 + i;
        const col = confColors[i % confColors.length];

        ctx.save();
        ctx.translate(confX, confY);
        ctx.rotate(confRot);
        ctx.fillStyle = col;
        ctx.fillRect(-5, -2.5, 10, 5);
        ctx.restore();
      }

      // Title & Celebration note
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(lang === "es" ? "¡Gana la partida y entra al Salón de la Fama!" : "Win the match & enter the Hall of Fame!", W / 2, 42);
    }

    ctx.restore();
  }, [currentTime, lang]);

  const currentMeta = scenes[currentSceneIndex];

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative rounded-3xl apple-glass border border-white/[0.12] overflow-hidden transition-all duration-300",
        isFullscreen ? "fixed inset-4 z-50 bg-[#000000]/95 flex flex-col justify-between" : "",
        className
      )}
    >
      {/* Header bar with Scene Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 border-b border-white/[0.08] bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.08] border border-white/[0.1] text-amber-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              <span>{lang === "es" ? "Presentación Animada" : "Animated Explainer"}</span>
              <span className="rounded-full bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 text-[10px] font-semibold text-amber-300 uppercase tracking-wider">
                Jackbox Style
              </span>
            </h4>
          </div>
        </div>

        {/* Scene navigation tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-1 text-xs scrollbar-none">
          {scenes.map((sc, idx) => {
            const Icon = sc.icon;
            const active = idx === currentSceneIndex;
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => selectScene(idx)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all text-xs font-medium shrink-0",
                  active
                    ? "bg-white text-black font-semibold shadow-md shadow-white/10"
                    : "bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.06]"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", active ? "text-black" : "text-zinc-400")} />
                <span>{sc.badge}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Canvas Display Area */}
      <div className="relative aspect-video w-full bg-[#0c0d14] flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          className="w-full h-full object-contain cursor-pointer select-none"
          onClick={togglePlay}
          title={isPlaying ? (lang === "es" ? "Pausar" : "Pause") : (lang === "es" ? "Reproducir" : "Play")}
        />

        {/* Overlay Play Indicator when paused */}
        {!isPlaying && (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition hover:bg-black/30 group"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-black shadow-xl group-hover:scale-105 transition-transform">
              <Play className="h-7 w-7 fill-current translate-x-0.5" />
            </div>
          </button>
        )}
      </div>

      {/* Narrative Subtitle / Description bar */}
      <div className="p-4 sm:p-5 bg-white/[0.02] border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-white">{currentMeta.title}</span>
            <span className="text-zinc-500 text-xs">·</span>
            <span className="text-amber-300 text-xs italic font-mono">{currentMeta.handNote}</span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-normal">
            {currentMeta.desc}
          </p>
        </div>

        {/* Playback Controls & Toggles */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white transition active:scale-95"
            aria-label={isPlaying ? "Pausar" : "Reproducir"}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current translate-x-0.5" />}
          </button>

          <button
            type="button"
            onClick={restart}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 transition active:scale-95"
            aria-label="Reiniciar"
            title="Reiniciar"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition active:scale-95",
              soundEnabled
                ? "bg-amber-400/15 text-amber-300 border border-amber-400/30"
                : "bg-white/[0.06] text-zinc-500 hover:text-zinc-300"
            )}
            aria-label={soundEnabled ? "Silenciar efectos" : "Activar efectos de sonido"}
            title={soundEnabled ? "Efectos activados" : "Efectos silenciados"}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-white transition active:scale-95"
            title={isFullscreen ? "Minimizar" : "Pantalla completa"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Progress timeline rail */}
      <div className="h-1 w-full bg-white/[0.06] relative">
        <div
          className="h-full bg-gradient-to-r from-amber-400 via-sky-400 to-emerald-400 transition-all duration-100"
          style={{ width: `${((currentTime % TOTAL_DURATION) / TOTAL_DURATION) * 100}%` }}
        />
      </div>
    </div>
  );
}
