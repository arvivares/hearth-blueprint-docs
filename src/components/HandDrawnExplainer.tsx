import { useEffect, useRef } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

export type ExplainerLanguage = "es" | "en";

export interface HandDrawnExplainerProps {
  lang?: ExplainerLanguage;
  currentTime?: number;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  className?: string;
}

// -------------------------------------------------------------
// CORE HAND-DRAWN MATH & RENDERING ENGINE
// Based on hand-drawn canvas animation skill
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

// Organic hand-drawn line wandering with tapering
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

// -------------------------------------------------------------
// AUTHENTIC VECTOR ASSETS
// -------------------------------------------------------------

// Authentic Apple Logo silhouette vector (exact path data, viewBox 24x24)
const APPLE_SVG_PATH =
  "M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 1.01-2.85-.92.04-2.04.62-2.7 1.39-.58.67-1.09 1.74-1.02 2.78 1.03.08 2.09-.57 2.71-1.32z";

export function getSceneForTime(t: number, lang: ExplainerLanguage = "es") {
  const boundaries =
    lang === "es" ? [0, 22.0, 30.5, 38.5, 50.5] : [0, 18.5, 25.0, 32.5, 44.5];
  let sceneIdx = 0;
  if (t >= boundaries[4]) sceneIdx = 4;
  else if (t >= boundaries[3]) sceneIdx = 3;
  else if (t >= boundaries[2]) sceneIdx = 2;
  else if (t >= boundaries[1]) sceneIdx = 1;
  else sceneIdx = 0;

  const sceneStart = boundaries[sceneIdx];
  const sceneT = Math.max(0, t - sceneStart);
  return { sceneIdx, sceneT };
}

// -------------------------------------------------------------
// CANVAS FRAME RENDERING ENGINE
// -------------------------------------------------------------

function drawExplainerFrame(canvas: HTMLCanvasElement, t: number, lang: ExplainerLanguage = "es") {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

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
  grain(ctx, [0, 0, W, H], 340, "#ffffff", 0.04, 42);

  // Background sketchbook border
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1.2;
  wob(ctx, [[14, 14], [W - 14, 14], [W - 14, H - 14], [14, H - 14]], 1.5, 99, true);

  const { sceneIdx, sceneT } = getSceneForTime(t, lang);

  // -----------------------------------------------------------------
  // SCENE 0: LA TELE Y MODOS DE JUEGO (TV Screen & Lobby)
  // Audio ES (0.0s - 22.0s):
  // 0-12s: Bienvenida a PeekRush, en grupo o solo en el navegador
  // 12-22s: Crear sala -> Pantalla principal con QR gigante
  // -----------------------------------------------------------------
  if (sceneIdx === 0) {
    const isLobbyPhase = (lang === "es" ? sceneT < 12.0 : sceneT < 10.5);
    const tvW = 440;
    const tvH = 265;
    const tvX = (W - tvW) / 2;
    const tvY = 85;

    const tvBreath = drift(sceneT, 11, { amp: 1.5, freq: 0.6 });

    ctx.save();
    ctx.translate(W / 2, tvY + tvH / 2);
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
      [tvX + 55, tvY + tvH],
      [tvX + 28, tvY + tvH + 34],
    ];
    const legR: [number, number][] = [
      [tvX + tvW - 55, tvY + tvH],
      [tvX + tvW - 28, tvY + tvH + 34],
    ];
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3.2;
    wob(ctx, legL, 1.5, 102);
    wob(ctx, legR, 1.5, 103);

    // TV Screen Glass
    const scrX = tvX + 18;
    const scrY = tvY + 18;
    const scrW = tvW - 36;
    const scrH = tvH - 36;
    ctx.fillStyle = "#0c0d14";
    ctx.fillRect(scrX, scrY, scrW, scrH);

    // Glass sheen
    ctx.save();
    ctx.beginPath();
    ctx.rect(scrX, scrY, scrW, scrH);
    ctx.clip();
    const grad = ctx.createLinearGradient(scrX, scrY, scrX + scrW, scrY + scrH);
    grad.addColorStop(0, "rgba(255, 255, 255, 0.08)");
    grad.addColorStop(0.4, "transparent");
    grad.addColorStop(1, "rgba(56, 189, 248, 0.05)");
    ctx.fillStyle = grad;
    ctx.fillRect(scrX, scrY, scrW, scrH);
    ctx.restore();

    // -------------------------------------------------------------
    // PHASE A: BIENVENIDA Y MODOS DE JUEGO (0s - 12s)
    // -------------------------------------------------------------
    if (isLobbyPhase) {
      // Game Title on TV
      ctx.fillStyle = "#38bdf8";
      ctx.font = "900 24px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PEEKRUSH", scrX + scrW / 2, scrY + 38);
      aster(ctx, scrX + scrW / 2 + 82, scrY + 30, 8, "#fbbf24", 4, sceneT * 2);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText(lang === "es" ? "JUEGA EN GRUPO O TÚ SOLO DIRECTAMENTE" : "PLAY WITH FRIENDS OR SOLO IN YOUR BROWSER", scrX + scrW / 2, scrY + 58);

      // Two Mode Cards on Screen
      const cardW = 175;
      const cardH = 120;
      const cardY = scrY + 74;

      // Card 1: En Grupo (Highlighted)
      const c1X = scrX + 18;
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(c1X, cardY, cardW, cardH);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2.0;
      wob(ctx, [[c1X, cardY], [c1X + cardW, cardY], [c1X + cardW, cardY + cardH], [c1X, cardY + cardH]], 1.4, 111, true);

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillText(lang === "es" ? "👥 EN GRUPO" : "👥 WITH FRIENDS", c1X + cardW / 2, cardY + 28);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText(lang === "es" ? "Crear Sala" : "Create Room", c1X + cardW / 2, cardY + 52);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText(lang === "es" ? "TV + Móviles" : "TV + Mobiles", c1X + cardW / 2, cardY + 70);
      ctx.fillText(lang === "es" ? "Código QR gigante" : "Giant QR Code", c1X + cardW / 2, cardY + 86);

      // Card 2: Modo Solo
      const c2X = scrX + scrW - cardW - 18;
      ctx.fillStyle = "#151722";
      ctx.fillRect(c2X, cardY, cardW, cardH);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1.4;
      wob(ctx, [[c2X, cardY], [c2X + cardW, cardY], [c2X + cardW, cardY + cardH], [c2X, cardY + cardH]], 1.2, 112, true);

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillText(lang === "es" ? "👤 MODO SOLO" : "👤 PLAY SOLO", c2X + cardW / 2, cardY + 28);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText(lang === "es" ? "Jugar Solo" : "Single Player", c2X + cardW / 2, cardY + 52);

      ctx.fillStyle = "#64748b";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText(lang === "es" ? "Con tu teclado" : "Use your keyboard", c2X + cardW / 2, cardY + 70);
      ctx.fillText(lang === "es" ? "Récords globales" : "Global records", c2X + cardW / 2, cardY + 86);

      // Hand-drawn mouse cursor hovering and preparing to click "Crear sala"
      const curX = c1X + cardW / 2 + 10 + Math.sin(sceneT * 2) * 8;
      const curY = cardY + 50 + Math.cos(sceneT * 2) * 5;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(curX, curY);
      ctx.lineTo(curX, curY + 16);
      ctx.lineTo(curX + 5, curY + 12);
      ctx.lineTo(curX + 11, curY + 18);
      ctx.lineTo(curX + 14, curY + 15);
      ctx.lineTo(curX + 8, curY + 10);
      ctx.lineTo(curX + 13, curY + 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Top banner
      ctx.restore();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 15px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(lang === "es" ? "¡Juega en grupo frente a la tele o tú solo en el navegador!" : "Play with friends on the TV or solo in your browser!", W / 2, 45);
    }
    // -------------------------------------------------------------
    // PHASE B: CREAR SALA Y QR GIGANTE (12s - 22s)
    // -------------------------------------------------------------
    else {
      const qrSize = 136;
      const qrX = scrX + 24;
      const qrY = scrY + (scrH - qrSize) / 2;

      // Giant QR Code on the TV
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(qrX, qrY, qrSize, qrSize);
      wob(ctx, [
        [qrX, qrY],
        [qrX + qrSize, qrY],
        [qrX + qrSize, qrY + qrSize],
        [qrX, qrY + qrSize],
      ], 1.4, 201, true);

      // QR finder patterns
      const drawFinder = (fx: number, fy: number) => {
        ctx.fillStyle = "#000000";
        ctx.fillRect(fx, fy, 32, 32);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(fx + 6, fy + 6, 20, 20);
        ctx.fillStyle = "#000000";
        ctx.fillRect(fx + 10, fy + 10, 12, 12);
      };
      drawFinder(qrX + 6, qrY + 6);
      drawFinder(qrX + qrSize - 38, qrY + 6);
      drawFinder(qrX + 6, qrY + qrSize - 38);

      // Hand-drawn QR pixel grid
      ctx.fillStyle = "#000000";
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if ((r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3)) continue;
          if (hash(r * 9 + c, 5) > 0.45) {
            ctx.fillRect(qrX + 16 + c * 11, qrY + 16 + r * 11, 9, 9);
          }
        }
      }

      // Scanning sweep line over the QR code
      const scanProgress = (Math.sin(sceneT * 2.5) * 0.5 + 0.5);
      const scanY = qrY + scanProgress * qrSize;
      ctx.strokeStyle = "rgba(56, 189, 248, 0.95)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(qrX - 4, scanY);
      ctx.lineTo(qrX + qrSize + 4, scanY);
      ctx.stroke();

      // Right Column: Room Code & Instructions
      const textX = scrX + qrSize + 48;
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("PEEKRUSH TV", textX, scrY + 45);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 32px monospace";
      ctx.fillText("7 K X 9 P", textX, scrY + 86);

      // Hand-drawn box around room code
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.6;
      wob(ctx, [
        [textX - 8, scrY + 54],
        [textX + 165, scrY + 54],
        [textX + 165, scrY + 98],
        [textX - 8, scrY + 98],
      ], 1.6, 203, true);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText(lang === "es" ? "ESCANEA CON TU MÓVIL" : "SCAN WITH YOUR PHONE", textX, scrY + 125);
      ctx.fillText("peekrush.inmerzion.io", textX, scrY + 144);

      ctx.fillStyle = "#22c55e";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText(lang === "es" ? "● EN ESPERA DE JUGADORES" : "● WAITING FOR PLAYERS", textX, scrY + 172);

      ctx.restore();

      // Floating arrow pointing to QR
      const arrowX = tvX - 60 + drift(sceneT, 20, { amp: 4, freq: 1.0 });
      const arrowY = tvY + 130;
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2.4;
      wob(ctx, [[arrowX - 40, arrowY], [arrowX, arrowY]], 1.5, 301);
      wob(ctx, [[arrowX - 10, arrowY - 8], [arrowX, arrowY], [arrowX - 10, arrowY + 8]], 1.2, 302);

      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(lang === "es" ? "¡Tus amigos escanean aquí!" : "Friends scan here!", arrowX - 46, arrowY + 4);

      // Top banner
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 15px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(lang === "es" ? "¡Pulsa 'Crear sala' para mostrar el código QR gigante!" : "Click 'Create room' to display the giant QR code!", W / 2, 45);
    }
  }

  // -----------------------------------------------------------------
  // SCENE 1: TU MÓVIL ES EL MANDO (Phone Controller + Realistic Hand)
  // Audio ES (22.0s - 30.5s):
  // "Tus amigos solo tienen que escanear el código QR con la cámara de su móvil
  //  y escribir su nombre para unirse al instante."
  // -----------------------------------------------------------------
  else if (sceneIdx === 1) {
    const phoneW = 196;
    const phoneH = 330;
    const phoneX = (W - phoneW) / 2;
    const phoneY = 52;

    const isTapPhase = sceneT >= 5.5;
    const isCameraPhase = sceneT < 3.2;
    const phoneBreath = drift(sceneT, 33, { amp: 1.6, freq: 0.8 });

    // Warm, editorial hand & skin palette
    const skin = "#fed7aa";
    const skinShade = "#f4a27e";
    const skinLight = "#fef3c7";
    const ink = "#1e293b";

    ctx.save();
    ctx.translate(0, phoneBreath);

    // ============================================================
    // LAYER 1: HAND BEHIND PHONE (Four Finger Cylinders on left)
    // ============================================================
    const fingers = [
      { y: 84, len: 26, h: 25 },
      { y: 132, len: 30, h: 27 },
      { y: 180, len: 28, h: 26 },
      { y: 228, len: 22, h: 24 },
    ];

    fingers.forEach((f) => {
      const fy = phoneY + f.y;

      // Finger body extending left behind phone
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.roundRect(phoneX - f.len, fy, f.len + 20, f.h, [f.h / 2, 0, 0, f.h / 2]);
      ctx.fill();

      // Finger lower shadow
      ctx.fillStyle = "rgba(229, 152, 116, 0.35)";
      ctx.beginPath();
      ctx.roundRect(phoneX - f.len, fy + f.h * 0.5, f.len + 20, f.h * 0.5, [0, 0, 0, f.h / 2]);
      ctx.fill();

      // Outer finger contour
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(phoneX + 2, fy);
      ctx.lineTo(phoneX - f.len + f.h / 2, fy);
      ctx.arc(phoneX - f.len + f.h / 2, fy + f.h / 2, f.h / 2, -Math.PI / 2, Math.PI / 2, true);
      ctx.lineTo(phoneX + 2, fy + f.h);
      ctx.stroke();
    });

    // ============================================================
    // LAYER 2: THE SMARTPHONE CHASSIS & SCREEN
    // ============================================================
    // Phone Chassis Body
    ctx.fillStyle = "#181a26";
    ctx.beginPath();
    ctx.roundRect(phoneX, phoneY, phoneW, phoneH, 28);
    ctx.fill();

    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(phoneX, phoneY, phoneW, phoneH, 28);
    ctx.stroke();

    // Dynamic Island / Camera Pill
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.roundRect(phoneX + phoneW / 2 - 24, phoneY + 12, 48, 14, 7);
    ctx.fill();
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(phoneX + phoneW / 2 + 10, phoneY + 19, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Phone Screen Glass
    const pScrX = phoneX + 10;
    const pScrY = phoneY + 34;
    const pScrW = phoneW - 20;
    const pScrH = phoneH - 46;

    ctx.fillStyle = "#07080e";
    ctx.beginPath();
    ctx.roundRect(pScrX, pScrY, pScrW, pScrH, 20);
    ctx.fill();

    // -------------------------------------------------------------
    // SCREEN PHASE 1: SCANNING QR WITH CAMERA (22s - 25.2s)
    // -------------------------------------------------------------
    if (isCameraPhase) {
      // Camera top bar
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(pScrX, pScrY, pScrW, 26);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("0.5x    1x    2x", pScrX + pScrW / 2, pScrY + 16);

      // Camera viewfinder center
      const vfSize = 84;
      const vfX = pScrX + (pScrW - vfSize) / 2;
      const vfY = pScrY + 50;

      // Viewfinder brackets in cyan
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2.4;
      const bLen = 14;
      // Top-left
      ctx.beginPath(); ctx.moveTo(vfX, vfY + bLen); ctx.lineTo(vfX, vfY); ctx.lineTo(vfX + bLen, vfY); ctx.stroke();
      // Top-right
      ctx.beginPath(); ctx.moveTo(vfX + vfSize - bLen, vfY); ctx.lineTo(vfX + vfSize, vfY); ctx.lineTo(vfX + vfSize, vfY + bLen); ctx.stroke();
      // Bottom-left
      ctx.beginPath(); ctx.moveTo(vfX, vfY + vfSize - bLen); ctx.lineTo(vfX, vfY + vfSize); ctx.lineTo(vfX + bLen, vfY + vfSize); ctx.stroke();
      // Bottom-right
      ctx.beginPath(); ctx.moveTo(vfX + vfSize - bLen, vfY + vfSize); ctx.lineTo(vfX + vfSize, vfY + vfSize); ctx.lineTo(vfX + vfSize, vfY + vfSize - bLen); ctx.stroke();

      // Mini QR target inside camera
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(vfX + 20, vfY + 20, 44, 44);
      ctx.fillStyle = "#000000";
      ctx.fillRect(vfX + 24, vfY + 24, 12, 12);
      ctx.fillRect(vfX + 48, vfY + 24, 12, 12);
      ctx.fillRect(vfX + 24, vfY + 48, 12, 12);

      // Notification banner / QR detect pill
      const notifY = pScrY + 155;
      ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
      ctx.beginPath();
      ctx.roundRect(pScrX + 8, notifY, pScrW - 16, 40, 10);
      ctx.fill();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.fillStyle = "#22c55e";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText(lang === "es" ? "✓ QR DETECTADO" : "✓ QR DETECTED", pScrX + pScrW / 2, notifY + 16);
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText("peekrush.inmerzion.io", pScrX + pScrW / 2, notifY + 31);
    }
    // -------------------------------------------------------------
    // SCREEN PHASE 2: NAME INPUT & TAP JOIN (25.2s - 30.5s)
    // -------------------------------------------------------------
    else {
      // URL Bar
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.roundRect(pScrX + 8, pScrY + 10, pScrW - 16, 22, 6);
      ctx.fill();
      ctx.fillStyle = "#94a3b8";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("peekrush.inmerzion.io", pScrX + pScrW / 2, pScrY + 24);

      // Title
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 15px system-ui, sans-serif";
      ctx.fillText("PeekRush", pScrX + pScrW / 2, pScrY + 54);

      // Room code pill
      const inp1Y = pScrY + 70;
      ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
      ctx.beginPath();
      ctx.roundRect(pScrX + 12, inp1Y, pScrW - 24, 34, 8);
      ctx.fill();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 16px monospace";
      ctx.fillText("7 K X 9 P", pScrX + pScrW / 2, inp1Y + 23);

      // Alias Input field: "Alex ✨"
      const inp2Y = pScrY + 114;
      ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
      ctx.beginPath();
      ctx.roundRect(pScrX + 12, inp2Y, pScrW - 24, 34, 8);
      ctx.fill();
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.fillText("Alex ✨", pScrX + pScrW / 2, inp2Y + 22);

      // Big Join Button: "¡ENTRAR!" / "¡CONECTADO!"
      const btnY = pScrY + 160;
      ctx.fillStyle = isTapPhase ? "#22c55e" : "#ffffff";
      ctx.beginPath();
      ctx.roundRect(pScrX + 12, btnY, pScrW - 24, 42, 10);
      ctx.fill();
      ctx.fillStyle = isTapPhase ? "#ffffff" : "#000000";
      ctx.font = "900 13px system-ui, sans-serif";
      ctx.fillText(isTapPhase ? (lang === "es" ? "¡CONECTADO!" : "CONNECTED!") : (lang === "es" ? "¡ENTRAR!" : "JOIN!"), pScrX + pScrW / 2, btnY + 26);

      // Tap shockwave ripple
      if (isTapPhase) {
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 2.4;
        const ripR = (sceneT - 5.5) * 35;
        ctx.beginPath();
        ctx.arc(pScrX + pScrW / 2, btnY + 21, ripR % 45, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // ============================================================
    // LAYER 3: FINGER PADS, PALM CRADLE & THUMB OVER GLASS
    // ============================================================

    // 1. Four Fingertip Pads curling over the left bezel
    fingers.forEach((f, idx) => {
      const fy = phoneY + f.y;
      const wrapW = idx === 3 ? 14 : idx === 1 ? 19 : 17;

      ctx.save();
      // Drop shadow on glass
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.beginPath();
      ctx.ellipse(phoneX + wrapW * 0.45, fy + f.h / 2 + 2, wrapW * 0.5, f.h * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();

      // Finger pad lobe: starts from phoneX - 4 and wraps onto the screen
      const padGrad = ctx.createLinearGradient(phoneX - 4, fy, phoneX + wrapW, fy + f.h);
      padGrad.addColorStop(0, skinShade);
      padGrad.addColorStop(0.35, skin);
      padGrad.addColorStop(1, skinLight);

      ctx.fillStyle = padGrad;
      ctx.beginPath();
      ctx.moveTo(phoneX - 3, fy);
      ctx.lineTo(phoneX + wrapW - f.h / 2, fy);
      ctx.arc(phoneX + wrapW - f.h / 2, fy + f.h / 2, f.h / 2, -Math.PI / 2, Math.PI / 2, false);
      ctx.lineTo(phoneX - 3, fy + f.h);
      ctx.closePath();
      ctx.fill();

      // Stroke only the curled lobe on the glass
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(phoneX - 3, fy);
      ctx.lineTo(phoneX + wrapW - f.h / 2, fy);
      ctx.arc(phoneX + wrapW - f.h / 2, fy + f.h / 2, f.h / 2, -Math.PI / 2, Math.PI / 2, false);
      ctx.lineTo(phoneX - 3, fy + f.h);
      ctx.stroke();

      // Rosy capillary blush
      ctx.fillStyle = "rgba(244, 63, 94, 0.22)";
      ctx.beginPath();
      ctx.ellipse(phoneX + wrapW - 6, fy + f.h / 2, 4.5, f.h * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Fingerprint ridge highlight
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(phoneX + wrapW - 5, fy + f.h / 2, 3, -1.0, 1.0);
      ctx.stroke();

      ctx.restore();
    });

    // 2. Hand Foundation (Forearm, Wrist, Palm Cradle under Phone)
    const armGrad = ctx.createLinearGradient(phoneX + 90, 420, phoneX + phoneW + 30, phoneY + 280);
    armGrad.addColorStop(0, "#ee9068");
    armGrad.addColorStop(0.4, skinShade);
    armGrad.addColorStop(0.7, skin);
    armGrad.addColorStop(1, skinLight);

    ctx.fillStyle = armGrad;
    ctx.beginPath();
    // Inner forearm bottom
    ctx.moveTo(phoneX + 90, 420);
    // Up along inner wrist to palm cradle under phone
    ctx.bezierCurveTo(phoneX + 105, phoneY + phoneH + 18, phoneX + 115, phoneY + phoneH + 4, phoneX + 135, phoneY + phoneH + 2);
    // Across bottom edge of phone (cradling phone bottom)
    ctx.lineTo(phoneX + phoneW - 20, phoneY + phoneH + 2);
    // Around bottom-right corner to heel of palm
    ctx.bezierCurveTo(phoneX + phoneW + 15, phoneY + phoneH + 2, phoneX + phoneW + 28, phoneY + phoneH - 10, phoneX + phoneW + 30, phoneY + 330);
    // Down through hypothenar & styloid wrist bump to outer forearm
    ctx.bezierCurveTo(phoneX + phoneW + 32, 375, phoneX + phoneW + 46, 395, phoneX + phoneW + 55, 420);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // Wrist creases
    ctx.strokeStyle = "rgba(194, 65, 12, 0.4)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(phoneX + 130, phoneY + phoneH + 20, 24, 0.3, 1.2);
    ctx.stroke();

    // 3. The Natural Thumb (Resting vs Tapping Animation)
    const btnY = pScrY + 160;

    // Thumb anchor base at thenar muscle
    const baseX = phoneX + phoneW - 4;
    const baseY = phoneY + 300;

    // Resting Thumb: naturally curved at height 230 along lower-right bezel
    const restKnuckleX = phoneX + phoneW + 4;
    const restKnuckleY = phoneY + 255;
    const restTipX = phoneX + phoneW - 22;
    const restTipY = phoneY + 230;

    // Tapping Thumb: reaches over button
    const tapKnuckleX = phoneX + phoneW - 22;
    const tapKnuckleY = phoneY + 265;
    const tapTipX = pScrX + pScrW / 2 + 10;
    const tapTipY = btnY + 22;

    let knuckleX = restKnuckleX;
    let knuckleY = restKnuckleY;
    let tipX = restTipX;
    let tipY = restTipY;

    if (sceneT >= 5.0) {
      const tapProg = Math.min(1, Math.max(0, (sceneT - 5.0) / 0.5));
      const easeProg = tapProg * tapProg * (3 - 2 * tapProg);
      knuckleX = restKnuckleX + (tapKnuckleX - restKnuckleX) * easeProg;
      knuckleY = restKnuckleY + (tapKnuckleY - restKnuckleY) * easeProg;
      tipX = restTipX + (tapTipX - restTipX) * easeProg;
      tipY = restTipY + (tapTipY - restTipY) * easeProg;
    }

    ctx.save();

    // Contact shadow on glass
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(tipX + 2, tipY + 4, 16, 12, 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Thumb Solid Shape
    const thumbGrad = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
    thumbGrad.addColorStop(0, skinShade);
    thumbGrad.addColorStop(0.45, skin);
    thumbGrad.addColorStop(0.85, skinLight);

    ctx.fillStyle = thumbGrad;
    ctx.beginPath();
    // Start at outer thenar base
    ctx.moveTo(baseX + 16, baseY);
    // Outer contour to knuckle
    ctx.bezierCurveTo(baseX + 20, knuckleY + 20, knuckleX + 16, knuckleY + 6, knuckleX + 6, knuckleY - 4);
    // Outer knuckle to distal thumb tip
    ctx.bezierCurveTo(knuckleX - 4, knuckleY - 14, tipX + 16, tipY - 14, tipX + 6, tipY - 8);
    // Rounded distal thumb pad (fleshy tip)
    ctx.bezierCurveTo(tipX - 12, tipY - 4, tipX - 12, tipY + 12, tipX + 4, tipY + 14);
    // Inner contour back to thenar fold
    ctx.bezierCurveTo(tipX + 16, tipY + 14, knuckleX - 10, knuckleY + 16, baseX - 8, baseY - 12);
    // Down to thenar base
    ctx.bezierCurveTo(baseX - 4, baseY, baseX + 6, baseY + 6, baseX + 16, baseY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Rosy capillary blush on thumb pad
    ctx.fillStyle = "rgba(244, 63, 94, 0.22)";
    ctx.beginPath();
    ctx.ellipse(tipX - 2, tipY + 2, 7.5, 6.5, 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Oval Thumbnail on dorsal upper surface
    ctx.fillStyle = "#fff5f0";
    ctx.strokeStyle = "#d97757";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.ellipse(tipX + 4, tipY - 4, 7.5, 5, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Specular shine on nail
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(tipX + 4, tipY - 5, 3.5, 0.3, 2.2);
    ctx.stroke();

    // Knuckle skin fold lines (subtle, soft)
    ctx.strokeStyle = "rgba(194, 65, 12, 0.4)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(knuckleX + 2, knuckleY + 4, 7, -1.0, 0.6);
    ctx.stroke();

    ctx.restore();

    // Wi-Fi signal radiating
    if (isTapPhase) {
      const waveAlpha = Math.sin(sceneT * 6) * 0.5 + 0.5;
      ctx.save();
      ctx.strokeStyle = "#22c55e";
      ctx.globalAlpha = waveAlpha;
      ctx.lineWidth = 2.4;
      [40, 75, 110].forEach((r) => {
        ctx.beginPath();
        ctx.arc(phoneX - 30, phoneY + 120, r, -0.6, 0.6);
        ctx.stroke();
      });
      ctx.restore();
    }

    // Side callouts
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(lang === "es" ? "⚡ ¡Sin instalar Apps!" : "⚡ No App Downloads!", phoneX + phoneW + 48, phoneY + 120);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(lang === "es" ? "Escanea el QR con la cámara del móvil." : "Scan the QR code with phone camera.", phoneX + phoneW + 48, phoneY + 145);
    ctx.fillText(lang === "es" ? "Escribe tu nombre y únete al instante." : "Type your nickname and join instantly.", phoneX + phoneW + 48, phoneY + 165);
    ctx.fillText(lang === "es" ? "Tu móvil es tu mando para responder." : "Your phone becomes your buzzer controller.", phoneX + phoneW + 48, phoneY + 185);

    ctx.restore();

    // Top banner
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(lang === "es" ? "¡Tus amigos solo escanean el QR y escriben su nombre!" : "Friends simply scan the QR code and type their nickname!", W / 2, 40);
  }

  // -----------------------------------------------------------------
  // SCENE 2: MODO SOLO (Workstation & Direct Keyboard Typing)
  // Audio ES (30.5s - 38.5s):
  // "Si estás solo, simplemente pulsa en 'Jugar solo' para empezar una
  //  partida individual y responder directamente con tu teclado."
  // -----------------------------------------------------------------
  else if (sceneIdx === 2) {
    const lapW = 400;
    const lapH = 220;
    const lapX = (W - lapW) / 2;
    const lapY = 75;

    // Laptop Display Frame
    ctx.fillStyle = "#161822";
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.roundRect?.(lapX, lapY, lapW, lapH, 18) || ctx.rect(lapX, lapY, lapW, lapH);
    ctx.fill();
    wob(ctx, [
      [lapX, lapY],
      [lapX + lapW, lapY],
      [lapX + lapW, lapY + lapH],
      [lapX, lapY + lapH],
    ], 1.8, 441, true);

    // Screen Glass
    const lScrX = lapX + 14;
    const lScrY = lapY + 14;
    const lScrW = lapW - 28;
    const lScrH = lapH - 28;
    ctx.fillStyle = "#0c0d14";
    ctx.fillRect(lScrX, lScrY, lScrW, lScrH);

    // App header inside screen
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(lScrX, lScrY, lScrW, 28);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(lang === "es" ? "PEEKRUSH SOLO · 1 JUGADOR" : "PEEKRUSH SOLO · 1 PLAYER", lScrX + 12, lScrY + 18);

    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "right";
    ctx.fillText("● DIRECT PLAY", lScrX + lScrW - 12, lScrY + 18);

    // Challenge Box on Screen
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(lang === "es" ? "ADIVINA LA MARCA CON TU TECLADO:" : "GUESS THE BRAND ON YOUR KEYBOARD:", lScrX + lScrW / 2, lScrY + 54);

    // Mystery brand icon box
    const iconBoxW = 80;
    const iconBoxH = 45;
    const iconBoxX = lScrX + (lScrW - iconBoxW) / 2;
    const iconBoxY = lScrY + 65;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(iconBoxX, iconBoxY, iconBoxW, iconBoxH);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.6;
    wob(ctx, [
      [iconBoxX, iconBoxY],
      [iconBoxX + iconBoxW, iconBoxY],
      [iconBoxX + iconBoxW, iconBoxY + iconBoxH],
      [iconBoxX, iconBoxY + iconBoxH],
    ], 1.2, 442, true);

    ctx.fillStyle = "#fbbf24";
    ctx.font = "900 24px monospace";
    ctx.fillText("?", iconBoxX + iconBoxW / 2, iconBoxY + 31);

    // Typing letters sequence: N -> I -> K -> E
    const typeLetters = ["N", "I", "K", "E"];
    const typeCount = clamp(Math.floor(sceneT * 1.5), 1, 4);
    const typedText = typeLetters.slice(0, typeCount).join(" ");
    const isAnswered = sceneT >= 3.2;

    // Input Field
    const inpY = lScrY + 124;
    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    ctx.fillRect(lScrX + 45, inpY, lScrW - 90, 36);
    ctx.strokeStyle = isAnswered ? "#22c55e" : "#38bdf8";
    ctx.lineWidth = 1.8;
    wob(ctx, [
      [lScrX + 45, inpY],
      [lScrX + lScrW - 45, inpY],
      [lScrX + lScrW - 45, inpY + 36],
      [lScrX + 45, inpY + 36],
    ], 1.2, 443, true);

    ctx.fillStyle = isAnswered ? "#22c55e" : "#ffffff";
    ctx.font = "900 16px monospace";
    ctx.fillText(isAnswered ? "✓ N I K E  (+720 PTS)" : `${typedText} _`, lScrX + lScrW / 2, inpY + 23);

    // Laptop Base & Keyboard Chassis
    const kbW = 460;
    const kbH = 65;
    const kbX = (W - kbW) / 2;
    const kbY = lapY + lapH - 2;

    ctx.fillStyle = "#1e2230";
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect?.(kbX, kbY, kbW, kbH, [4, 4, 16, 16]) || ctx.rect(kbX, kbY, kbW, kbH);
    ctx.fill();
    wob(ctx, [
      [kbX, kbY],
      [kbX + kbW, kbY],
      [kbX + kbW - 12, kbY + kbH],
      [kbX + 12, kbY + kbH],
    ], 1.6, 445, true);

    // Hand-drawn Keyboard Key Grid
    const keyChars = ["N", "I", "K", "E", "↵"];
    keyChars.forEach((kc, i) => {
      const kx = kbX + 145 + i * 36;
      const ky = kbY + 12;
      const isLit = i < typeCount || (i === 4 && isAnswered);
      ctx.fillStyle = isLit ? "#38bdf8" : "#2a3144";
      ctx.fillRect(kx, ky, 28, 22);
      ctx.strokeStyle = isLit ? "#ffffff" : "#475569";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(kx, ky, 28, 22);

      ctx.fillStyle = isLit ? "#000000" : "#cbd5e1";
      ctx.font = "bold 11px monospace";
      ctx.fillText(kc, kx + 14, ky + 15);
    });

    // Spacebar
    ctx.fillStyle = "#2a3144";
    ctx.fillRect(kbX + 160, kbY + 38, 140, 16);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(kbX + 160, kbY + 38, 140, 16);

    // Side callouts
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(lang === "es" ? "👤 ¡Modo Solo instantáneo!" : "👤 Instant Solo Play!", lapX + lapW + 28, lapY + 50);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(lang === "es" ? "Responde con tu teclado." : "Answer with your keyboard.", lapX + lapW + 28, lapY + 75);
    ctx.fillText(lang === "es" ? "Sin esperar a otros jugadores." : "No waiting for others.", lapX + lapW + 28, lapY + 95);
    ctx.fillText(lang === "es" ? "Récords globales en juego." : "Compete for global records.", lapX + lapW + 28, lapY + 115);

    // Top banner
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(lang === "es" ? "¡Si estás solo, pulsa 'Jugar solo' y responde directamente con tu teclado!" : "Playing alone? Click 'Play solo' and answer right on your keyboard!", W / 2, 40);
  }

  // -----------------------------------------------------------------
  // SCENE 3: REVELADO Y MULTIPLICADOR (Authentic Apple Logo Reveal)
  // Audio ES (38.5s - 50.5s):
  // "Cuando empiece la partida, aparecerá un logotipo que se irá revelando
  //  poco a poco. ¡Tu objetivo es adivinar la marca antes que nadie!
  //  Cuanto más rápido aciertes, más puntos conseguirás."
  // -----------------------------------------------------------------
  else if (sceneIdx === 3) {
    const boardW = 440;
    const boardH = 280;
    const boardX = (W - boardW) / 2;
    const boardY = 70;

    // Background chalkboard frame
    ctx.fillStyle = "#0c0d14";
    ctx.fillRect(boardX, boardY, boardW, boardH);

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.8;
    wob(ctx, [
      [boardX, boardY],
      [boardX + boardW, boardY],
      [boardX + boardW, boardY + boardH],
      [boardX, boardY + boardH],
    ], 1.8, 901, true);

    // Multiplier loop
    const cycleT = sceneT % 6.0;
    const revealProgress = clamp(cycleT / 3.8, 0.15, 1.0);
    const multVal = Math.max(1.5, 3.0 - cycleT * 0.4).toFixed(1);
    const isFast = Number(multVal) > 1.8;
    const isAnswered = cycleT >= 3.6;

    ctx.fillStyle = isFast ? "#f59e0b" : "#ef4444";
    ctx.font = "900 28px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`⚡ ${multVal}x`, boardX + boardW / 2, boardY + 45);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(lang === "es" ? "MULTIPLICADOR DE VELOCIDAD" : "SPEED MULTIPLIER", boardX + boardW / 2, boardY + 62);

    // The Brand Logo revealing progressively: Authentic Apple Logo
    const logoCx = boardX + boardW / 2;
    const logoCy = boardY + 155;
    const applePath = new Path2D(APPLE_SVG_PATH);
    const s = 110 / 19.3;

    ctx.save();
    ctx.translate(logoCx - 12.0 * s, logoCy - 13.15 * s);
    ctx.scale(s, s);
    ctx.fillStyle = "#ffffff";
    ctx.fill(applePath);
    ctx.restore();

    // Obscuring puzzle blocks that vanish
    if (!isAnswered && revealProgress < 0.95) {
      ctx.fillStyle = "#0c0d14";
      const bSize = 18;
      for (let bx = -4; bx <= 4; bx++) {
        for (let by = -4; by <= 4; by++) {
          const h = hash(bx + by * 13, 88);
          if (h > revealProgress) {
            const blkX = logoCx + bx * bSize - bSize / 2;
            const blkY = logoCy + by * bSize - bSize / 2;
            ctx.fillRect(blkX, blkY, bSize + 1, bSize + 1);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
            ctx.lineWidth = 1;
            ctx.strokeRect(blkX, blkY, bSize + 1, bSize + 1);
          }
        }
      }
    }

    // Answer buzzer reaction
    if (isAnswered) {
      const popT = cycleT - 3.6;
      const popScale = spring(popT * 2.5, { freq: 3.0, damp: 0.5 });

      ctx.save();
      ctx.translate(boardX + boardW / 2, boardY + boardH - 35);
      ctx.scale(popScale, popScale);

      // Success banner: "¡CORRECTO! APPLE (+850 PTS · ⚡ 2.8x)"
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(-175, -20, 350, 40);
      wob(ctx, [[-175, -20], [175, -20], [175, 20], [-175, 20]], 1.4, 999, true);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 15px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(lang === "es" ? "¡CORRECTO! APPLE (+850 PTS · ⚡ 2.8x)" : "CORRECT! APPLE (+850 PTS · ⚡ 2.8x)", 0, 6);
      ctx.restore();

      // Golden Celebration stars
      for (let k = 0; k < 6; k++) {
        const starAngle = (k / 6) * Math.PI * 2 + popT * 2;
        const starDist = 70 + popT * 40;
        const sx = logoCx + Math.cos(starAngle) * starDist;
        const sy = logoCy + Math.sin(starAngle) * starDist * 0.7;
        aster(ctx, sx, sy, 7, "#fbbf24", 4, starAngle);
      }
    }

    // Top banner
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(lang === "es" ? "¡Adivina la marca antes que nadie y multiplica tus puntos!" : "Guess before anyone else and score maximum multiplier points!", W / 2, 40);
  }

  // -----------------------------------------------------------------
  // SCENE 4: PODIO Y RÉCORDS (Fixed 3rd Place & Baseline Podium)
  // Audio ES (50.5s - 56.8s):
  // "Al final veremos el podio de la partida y la tabla de récords globales.
  //  ¡Mucha suerte y a jugar!"
  // -----------------------------------------------------------------
  else if (sceneIdx === 4) {
    const groundY = 380;
    const stepW = 120;
    const centerPodX = (W - stepW) / 2; // 340
    const gap = 8;

    // Ground Floor Line across podium
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 2.4;
    wob(ctx, [[120, groundY], [680, groundY]], 1.5, 401);

    // Floor drop shadow hatch
    for (let x = 140; x < 660; x += 14) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, groundY + 2);
      ctx.lineTo(x - 8, groundY + 12);
      ctx.stroke();
    }

    // Step heights:
    // 1st Place (Center, Gold): Highest
    // 2nd Place (Left, Silver): Middle height
    // 3rd Place (Right, Bronze): Lowest height, resting on floor!
    const podH1 = 150; // 1st Place (top at 380 - 150 = 230)
    const podH2 = 95;  // 2nd Place (top at 380 - 95 = 285)
    const podH3 = 55;  // 3rd Place (top at 380 - 55 = 325)

    // ============================================================
    // STEP 2: 2nd Place (Left, Silver)
    // ============================================================
    const x2 = centerPodX - stepW - gap; // 212
    const y2 = groundY - podH2;         // 285
    ctx.fillStyle = "#181e2e";
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2.4;
    ctx.fillRect(x2, y2, stepW, podH2);
    wob(ctx, [[x2, y2], [x2 + stepW, y2], [x2 + stepW, groundY], [x2, groundY]], 1.5, 601, true);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "900 36px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("2", x2 + stepW / 2, y2 + 58);
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText("🥈 Hugo (1,920)", x2 + stepW / 2, y2 - 14);

    // ============================================================
    // STEP 3: 3rd Place (Right, Bronze - Fully Fixed Lower Height)
    // ============================================================
    const x3 = centerPodX + stepW + gap; // 468
    const y3 = groundY - podH3;         // 325 (clearly lower than 285!)
    ctx.fillStyle = "#1c1815";
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 2.4;
    ctx.fillRect(x3, y3, stepW, podH3);
    wob(ctx, [[x3, y3], [x3 + stepW, y3], [x3 + stepW, groundY], [x3, groundY]], 1.5, 602, true);

    ctx.fillStyle = "#f59e0b";
    ctx.font = "900 32px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("3", x3 + stepW / 2, y3 + 40);
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText("🥉 Dani (1,480)", x3 + stepW / 2, y3 - 14);

    // ============================================================
    // STEP 1: 1st Place (Center, Gold - Highest Step)
    // ============================================================
    const x1 = centerPodX;              // 340
    const y1 = groundY - podH1;         // 230
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3.2;
    ctx.fillRect(x1, y1, stepW, podH1);
    wob(ctx, [[x1, y1], [x1 + stepW, y1], [x1 + stepW, groundY], [x1, groundY]], 2.0, 603, true);

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

    // Top banner
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(lang === "es" ? "🏆 ¡PODIO FINAL Y TABLA DE RÉCORDS GLOBALES!" : "🏆 FINAL PODIUM & GLOBAL LEADERBOARD!", W / 2, 40);

    // Final "¡A JUGAR!" celebration bounce at end of audio
    if (sceneT >= 3.8) {
      const popT = sceneT - 3.8;
      const bounce = spring(popT * 2.5, { freq: 3.2, damp: 0.55 });
      ctx.save();
      ctx.translate(W / 2, groundY + 38);
      ctx.scale(bounce, bounce);
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(-110, -18, 220, 36);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.0;
      wob(ctx, [[-110, -18], [110, -18], [110, 18], [-110, 18]], 1.2, 777, true);
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 16px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(lang === "es" ? "¡A JUGAR! 🚀" : "PLAY NOW! 🚀", 0, 6);
      ctx.restore();
    }
  }

  ctx.restore();
}

// -------------------------------------------------------------
// COMPONENT
// -------------------------------------------------------------

export function HandDrawnExplainer({
  lang = "es",
  currentTime = 0,
  isPlaying = false,
  onTogglePlay,
  className,
}: HandDrawnExplainerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentTimeRef = useRef(currentTime);
  const lastSyncStampRef = useRef(performance.now());

  // Synchronize master clock whenever currentTime prop changes
  useEffect(() => {
    currentTimeRef.current = currentTime;
    lastSyncStampRef.current = performance.now();
  }, [currentTime]);

  // High-performance 60fps render loop
  useEffect(() => {
    let animId: number;
    let running = true;

    const render = () => {
      if (!running) return;
      const canvas = canvasRef.current;
      if (canvas) {
        const now = performance.now();
        let t = currentTimeRef.current;
        if (isPlaying) {
          const dt = (now - lastSyncStampRef.current) / 1000;
          t += dt;
        }
        drawExplainerFrame(canvas, t, lang);
      }
      if (isPlaying) {
        animId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      running = false;
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isPlaying, lang]);

  // When paused and currentTime changes (e.g. seeking scrubber or chapter jump), render immediately
  useEffect(() => {
    if (!isPlaying && canvasRef.current) {
      drawExplainerFrame(canvasRef.current, currentTime, lang);
    }
  }, [currentTime, isPlaying, lang]);

  return (
    <div
      className={cn(
        "relative aspect-video w-full rounded-2xl overflow-hidden bg-[#0c0d14] border border-white/[0.08] cursor-pointer group shadow-2xl select-none",
        className
      )}
      onClick={onTogglePlay}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTogglePlay?.();
        }
      }}
      aria-label={
        isPlaying
          ? lang === "es"
            ? "Pausar guía interactiva"
            : "Pause interactive guide"
          : lang === "es"
            ? "Reproducir guía con audio y animación"
            : "Play guide with audio and animation"
      }
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Overlay Play Indicator when paused */}
      {!isPlaying && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 backdrop-blur-[2px] transition-all group-hover:bg-black/35">
          <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-white text-black shadow-2xl transition-transform group-hover:scale-110 active:scale-95">
            <Play className="h-7 w-7 sm:h-8 sm:w-8 fill-black translate-x-0.5" />
          </div>
          <span className="mt-3 rounded-full bg-black/70 border border-white/10 px-3.5 py-1 text-xs font-medium text-white shadow-lg backdrop-blur-md">
            {lang === "es" ? "Reproducir guía con audio" : "Play guide with audio"}
          </span>
        </div>
      )}

      {/* Subtle Live Badge when playing */}
      {isPlaying && (
        <div className="pointer-events-none absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 border border-white/10 px-2.5 py-1 backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span className="text-[10px] font-mono font-medium tracking-wider text-zinc-300">
            {lang === "es" ? "EN DIRECTO" : "LIVE"}
          </span>
        </div>
      )}
    </div>
  );
}
