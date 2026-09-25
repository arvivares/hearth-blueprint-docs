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
  const boundaries = lang === "es" ? [0, 12, 26, 45] : [0, 11, 24, 41];
  let sceneIdx = 0;
  if (t >= boundaries[3]) sceneIdx = 3;
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
  // SCENE 0: LA GRAN PANTALLA (TV Lobby)
  // -----------------------------------------------------------------
  if (sceneIdx === 0) {
    const tvW = 420;
    const tvH = 260;
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
      [tvX + 50, tvY + tvH],
      [tvX + 25, tvY + tvH + 35],
    ];
    const legR: [number, number][] = [
      [tvX + tvW - 50, tvY + tvH],
      [tvX + tvW - 25, tvY + tvH + 35],
    ];
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3.2;
    wob(ctx, legL, 1.5, 102);
    wob(ctx, legR, 1.5, 103);

    // TV Screen Glass
    const scrX = tvX + 20;
    const scrY = tvY + 20;
    const scrW = tvW - 40;
    const scrH = tvH - 40;
    ctx.fillStyle = "#0c0d14";
    ctx.fillRect(scrX, scrY, scrW, scrH);

    // Scanline & reflection sheen
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

    // Giant QR Code on the TV
    const qrSize = 130;
    const qrX = scrX + 28;
    const qrY = scrY + (scrH - qrSize) / 2;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(qrX, qrY, qrSize, qrSize);
    wob(ctx, [
      [qrX, qrY],
      [qrX + qrSize, qrY],
      [qrX + qrSize, qrY + qrSize],
      [qrX, qrY + qrSize],
    ], 1.4, 201, true);

    // QR finder patterns (corners)
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
        if (
          (r < 3 && c < 3) ||
          (r < 3 && c > 5) ||
          (r > 5 && c < 3)
        ) {
          continue;
        }
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
    const textX = scrX + qrSize + 52;
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("PEEKRUSH TV", textX, scrY + 45);

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 32px monospace";
    ctx.fillText("7 K X 9 P", textX, scrY + 85);

    // Hand-drawn outline box around room code
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
    ctx.fillText(lang === "es" ? "ESCANEA CON TU MÓVIL" : "SCAN WITH YOUR PHONE", textX, scrY + 124);
    ctx.fillText(lang === "es" ? "peekrush.inmerzion.io" : "peekrush.inmerzion.io", textX, scrY + 142);

    // TV Screen floating badge "SALA: PEEK"
    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText(lang === "es" ? "● EN ESPERA DE JUGADORES" : "● WAITING FOR PLAYERS", textX, scrY + 168);

    ctx.restore();

    // Floating annotation arrow pointing to the QR code
    const arrowX = tvX - 60 + drift(sceneT, 20, { amp: 4, freq: 1.0 });
    const arrowY = tvY + 130;
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2.4;
    wob(ctx, [
      [arrowX - 40, arrowY],
      [arrowX, arrowY],
    ], 1.5, 301);
    wob(ctx, [
      [arrowX - 10, arrowY - 8],
      [arrowX, arrowY],
      [arrowX - 10, arrowY + 8],
    ], 1.2, 302);

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(lang === "es" ? "¡Tus amigos escanean aquí!" : "Friends scan here!", arrowX - 46, arrowY + 4);
  }

  // -----------------------------------------------------------------
  // SCENE 1: TU MÓVIL ES EL MANDO (Phone Controller)
  // -----------------------------------------------------------------
  else if (sceneIdx === 1) {
    const phoneW = 210;
    const phoneH = 340;
    const phoneX = (W - phoneW) / 2;
    const phoneY = 55;

    const phoneBreath = drift(sceneT, 33, { amp: 2, freq: 0.8 });

    ctx.save();
    ctx.translate(0, phoneBreath);

    // Hand holding the phone (organic contour behind/around)
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2.4;

    // Fingers on the right edge
    [100, 160, 220].forEach((fy, idx) => {
      const fWidth = 42 + Math.sin(sceneT * 2 + idx) * 3;
      const fingerPts: [number, number][] = [
        [phoneX + phoneW - 8, phoneY + fy],
        [phoneX + phoneW + fWidth, phoneY + fy + 5],
        [phoneX + phoneW + fWidth, phoneY + fy + 32],
        [phoneX + phoneW - 8, phoneY + fy + 30],
      ];
      ctx.beginPath();
      fingerPts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.fill();
      wob(ctx, fingerPts, 1.6, 50 + idx * 7, true);
    });

    // Outer Phone Body
    ctx.fillStyle = "#181824";
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 3.2;
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

    // Input 1: Room code field
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

    // Input 2: Player alias field: "Alex ✨"
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

    // Big Join Button: "¡A JUGAR!" / "JOIN"
    const btnY = pScrY + 185;
    const cycleT = sceneT % 4.0;
    const isTap = cycleT > 2.0 && cycleT < 3.2;
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

    // Animated tap shockwave
    if (isTap) {
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      const ripR = (cycleT - 2.0) * 35;
      ctx.beginPath();
      ctx.arc(pScrX + pScrW / 2, btnY + 22, ripR, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    // Wi-Fi radio waves radiating from the phone
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

    // Side callout notes
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(lang === "es" ? "⚡ ¡Sin instalar Apps!" : "⚡ No App Downloads!", phoneX + phoneW + 45, phoneY + 140);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(lang === "es" ? "Directo en Safari o Chrome." : "Plays directly in any mobile browser.", phoneX + phoneW + 45, phoneY + 165);
    ctx.fillText(lang === "es" ? "Usa tu móvil como mando interactivo." : "Your phone becomes your controller.", phoneX + phoneW + 45, phoneY + 185);
  }

  // -----------------------------------------------------------------
  // SCENE 2: REVELADO Y MULTIPLICADOR (Authentic Apple Logo Reveal)
  // -----------------------------------------------------------------
  else if (sceneIdx === 2) {
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

    // Multiplier loop (loops nicely every ~4.5s)
    const cycleT = sceneT % 4.5;
    const revealProgress = clamp(cycleT / 3.0, 0.15, 1.0);
    const multVal = Math.max(1.2, 3.0 - cycleT * 0.55).toFixed(1);
    const isFast = Number(multVal) > 1.8;

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

    // Obscuring puzzle blocks / veil that peels away as revealProgress increases
    if (revealProgress < 0.95) {
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

    // Answer buzzer reaction at cycleT >= 2.8
    if (cycleT >= 2.8) {
      const popT = cycleT - 2.8;
      const popScale = spring(popT * 2.5, { freq: 3.0, damp: 0.5 });

      ctx.save();
      ctx.translate(boardX + boardW / 2, boardY + boardH - 35);
      ctx.scale(popScale, popScale);

      // Success banner: "¡CORRECTO! +840 PTS (⚡ 2.8x)"
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(-170, -20, 340, 40);
      wob(ctx, [[-170, -20], [170, -20], [170, 20], [-170, 20]], 1.4, 999, true);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 16px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(lang === "es" ? "¡CORRECTO! +840 PTS (⚡ 2.8x)" : "CORRECT! +840 PTS (⚡ 2.8x)", 0, 6);
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

    // Explanatory hint banner atop the board
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(lang === "es" ? "¡Cuanto antes adivines, más puntos multiplicas!" : "The faster you guess, the bigger your multiplier!", W / 2, 40);
  }

  // -----------------------------------------------------------------
  // SCENE 3: PODIO Y RÉCORDS (Podium & Champions)
  // -----------------------------------------------------------------
  else if (sceneIdx === 3) {
    const podY = 270;
    const stepW = 120;
    const centerPodX = W / 2 - stepW / 2;

    // 3 Podium Steps (2nd, 1st, 3rd)
    const podH1 = 150; // 1st Place
    const podH2 = 100; // 2nd Place
    const podH3 = 70;  // 3rd Place

    // Step 2 (Left)
    const x2 = centerPodX - stepW + 15;
    const y2 = podY;
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
    const y3 = podY;
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
    const y1 = podY - 50;
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
