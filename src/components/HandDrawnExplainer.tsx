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
// UNIFIED SAFE TOP BANNER (Never overflows, leaves space for live badge)
// -------------------------------------------------------------
function drawTopBanner(
  ctx: CanvasRenderingContext2D,
  W: number,
  chapterTag: string,
  title: string
) {
  ctx.save();
  const bannerY = 30;

  // Chapter pill badge
  ctx.font = "900 11px system-ui, sans-serif";
  const tagW = ctx.measureText(chapterTag).width + 16;
  ctx.font = "bold 13px system-ui, sans-serif";
  const totalW = tagW + 12 + ctx.measureText(title).width;
  const startX = Math.max(28, (W - 145 - totalW) / 2);

  // Pill
  ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
  ctx.strokeStyle = "rgba(56, 189, 248, 0.5)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(startX, bannerY - 13, tagW, 20, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#38bdf8";
  ctx.textAlign = "center";
  ctx.fillText(chapterTag, startX + tagW / 2, bannerY + 1);

  // Main title text
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(title, startX + tagW + 10, bannerY + 1);

  ctx.restore();
}

// -------------------------------------------------------------
// REFINED HAND-HELD SMARTPHONE RENDERING
// Natural anatomical flow, elegant silhouette, clean stylized fingers
// -------------------------------------------------------------
interface HandPhoneOptions {
  sceneT: number;
  thumbPose: "tap" | "buzzer" | "resting";
  tapProgress?: number; // 0..1
  isPressed?: boolean;
  hapticWaves?: boolean;
  targetPos?: { x: number; y: number };
  renderScreen: (scrX: number, scrY: number, scrW: number, scrH: number) => void;
}

function drawHandHoldingPhone(
  ctx: CanvasRenderingContext2D,
  phoneX: number,
  phoneY: number,
  phoneW: number,
  phoneH: number,
  opt: HandPhoneOptions
) {
  const { sceneT, thumbPose, tapProgress = 0, isPressed = false, hapticWaves = false, targetPos, renderScreen } = opt;

  const skin = "#fed7aa";
  const ink = "#18181b";

  ctx.save();

  // ============================================================
  // LAYER 1: 4 COMPACT FINGERS BEHIND PHONE (Left bezel)
  // ============================================================
  const fingerDefs = [
    { y: 86, reach: 24, h: 25, wrap: 13 },
    { y: 118, reach: 28, h: 25, wrap: 15 },
    { y: 150, reach: 26, h: 24, wrap: 14 },
    { y: 182, reach: 21, h: 23, wrap: 11 },
  ];

  fingerDefs.forEach((f) => {
    const fy = phoneY + f.y;
    const r = f.h / 2;

    ctx.fillStyle = skin;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.0;

    ctx.beginPath();
    ctx.roundRect(phoneX - f.reach, fy, f.reach + 20, f.h, [r, 0, 0, r]);
    ctx.fill();
    ctx.stroke();
  });

  // ============================================================
  // LAYER 2: PHONE CHASSIS & SCREEN GLASS
  // ============================================================
  ctx.fillStyle = "#161928";
  ctx.beginPath();
  ctx.roundRect(phoneX, phoneY, phoneW, phoneH, 26);
  ctx.fill();

  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 2.4;
  ctx.stroke();

  // Dynamic Island
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.roundRect(phoneX + phoneW / 2 - 22, phoneY + 10, 44, 12, 6);
  ctx.fill();
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.arc(phoneX + phoneW / 2 + 10, phoneY + 16, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Screen Glass
  const scrX = phoneX + 8;
  const scrY = phoneY + 28;
  const scrW = phoneW - 16;
  const scrH = phoneH - 38;

  ctx.fillStyle = "#090a12";
  ctx.beginPath();
  ctx.roundRect(scrX, scrY, scrW, scrH, 18);
  ctx.fill();

  // Screen Content via Callback
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(scrX, scrY, scrW, scrH, 18);
  ctx.clip();
  renderScreen(scrX, scrY, scrW, scrH);
  ctx.restore();

  // ============================================================
  // LAYER 3: FINGERTIPS CURLING ONTO FRONT BEZEL
  // ============================================================
  fingerDefs.forEach((f) => {
    const fy = phoneY + f.y;
    const r = f.h / 2;

    // Contact shadow on glass
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.ellipse(phoneX + f.wrap * 0.45, fy + r + 1, f.wrap * 0.55, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Curled lobe on front
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.moveTo(phoneX, fy);
    ctx.lineTo(phoneX + f.wrap - r, fy);
    ctx.arc(phoneX + f.wrap - r, fy + r, r, -Math.PI / 2, Math.PI / 2, false);
    ctx.lineTo(phoneX, fy + f.h);
    ctx.closePath();
    ctx.fill();

    // Stroke only the curved front contour
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(phoneX + 1, fy);
    ctx.lineTo(phoneX + f.wrap - r, fy);
    ctx.arc(phoneX + f.wrap - r, fy + r, r, -Math.PI / 2, Math.PI / 2, false);
    ctx.lineTo(phoneX + 1, fy + f.h);
    ctx.stroke();
  });

  // ============================================================
  // LAYER 4: UNIFIED ORGANIC HAND, PALM & THUMB
  // Smooth kinematic reach across the smartphone interface
  // ============================================================
  const wristL = phoneX + 80;
  const wristR = phoneX + 185;
  const phoneBottom = phoneY + phoneH;

  const targetX = targetPos?.x ?? (scrX + scrW / 2);
  const targetY = targetPos?.y ?? (scrY + scrH - 46);

  let p = 0;
  let pressed = false;

  if (thumbPose === "tap") {
    p = clamp(tapProgress, 0, 1);
    pressed = p >= 0.85;
  } else if (thumbPose === "buzzer") {
    p = isPressed ? 1.0 : (opt.tapProgress ? clamp(opt.tapProgress, 0, 1) : 0);
    pressed = isPressed || p >= 0.85;
  }

  const ease = p * p * (3 - 2 * p);

  // Resting coordinates along right bezel
  const restKx = phoneX + phoneW + 6;
  const restKy = phoneBottom - 65;
  const restTx = phoneX + phoneW - 8;
  const restTy = phoneBottom - 90;

  // Pressing coordinates reaching to the button
  const pressKx = phoneX + phoneW - 30;
  const pressKy = targetY + 36;
  const pressTx = targetX + 2;
  const pressTy = targetY + (pressed ? 2 : -3);

  const kx = restKx + (pressKx - restKx) * ease;
  const ky = restKy + (pressKy - restKy) * ease;
  const tx = restTx + (pressTx - restTx) * ease;
  const ty = restTy + (pressTy - restTy) * ease;

  // Touch ripple when pressed
  if (pressed) {
    ctx.save();
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(targetX, targetY, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(34, 197, 94, 0.4)";
    ctx.beginPath();
    ctx.arc(targetX, targetY, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Soft drop shadow under the pressing thumb (only on screen)
  if (p > 0.15) {
    const shadowAlpha = Math.min(0.35, (p - 0.15) * 0.5);
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(tx + 2, ty + 5, pressed ? 17 : 14, pressed ? 11 : 12, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw unified forearm + palm + thumb as ONE solid organic shape
  ctx.fillStyle = skin;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.2;
  ctx.beginPath();

  // 1. Start at bottom-left wrist
  ctx.moveTo(wristL, 450);

  // 2. Up left wrist edge, curving under the phone
  ctx.lineTo(wristL + 6, phoneBottom - 5);
  ctx.quadraticCurveTo(phoneX + 115, phoneBottom + 8, phoneX + 140, phoneBottom - 6);

  // 3. Across inner palm to inner web of thumb
  const webX = phoneX + phoneW - 32;
  const webY = phoneBottom - 14;
  ctx.quadraticCurveTo(phoneX + 160, phoneBottom - 12, webX, webY);

  // 4. Inner thumb edge leading up to tip
  const innerKnuckleX = kx - 12;
  const innerKnuckleY = ky + 12;
  ctx.quadraticCurveTo(innerKnuckleX, innerKnuckleY, tx - 8, ty + 6);

  // 5. Rounded thumb tip
  const tipRadius = pressed ? 13.5 : 12;
  ctx.arc(tx, ty, tipRadius, Math.PI * 0.75, -Math.PI * 0.35, false);

  // 6. Outer thumb edge down through outer knuckle
  ctx.quadraticCurveTo(kx + 8, ky + 2, phoneX + phoneW + 2, phoneBottom - 30);

  // 7. Fleshy thenar eminence / outer palm
  ctx.quadraticCurveTo(phoneX + phoneW + 4, phoneBottom - 10, wristR - 4, phoneBottom + 10);

  // 8. Down right wrist edge to bottom
  ctx.lineTo(wristR, 450);

  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Thumb knuckle crease (only when flexed inward)
  if (p > 0.3) {
    ctx.strokeStyle = "rgba(217, 119, 87, 0.6)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(kx, ky, 7, -1.0, 0.6);
    ctx.stroke();
  }

  // Cute fingernail (oriented along thumb direction)
  const thumbAngle = Math.atan2(ty - ky, tx - kx);
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(thumbAngle);
  ctx.fillStyle = "#fff7ed";
  ctx.strokeStyle = "#d97757";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, -3.5, 6, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Specular nail shine
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.arc(0, -4, 2.5, 0.5, 2.0);
  ctx.stroke();
  ctx.restore();

  // Haptic / Vibration waves
  if (hapticWaves) {
    const waveAlpha = Math.sin(sceneT * 8) * 0.4 + 0.6;
    ctx.save();
    ctx.strokeStyle = "#38bdf8";
    ctx.globalAlpha = waveAlpha;
    ctx.lineWidth = 2.0;
    // Left haptic arcs
    [-24, -48].forEach((off) => {
      ctx.beginPath();
      ctx.arc(phoneX + off, phoneY + phoneH * 0.4, 36, -0.6, 0.6);
      ctx.stroke();
    });
    // Right haptic arcs
    [phoneW + 24, phoneW + 48].forEach((off) => {
      ctx.beginPath();
      ctx.arc(phoneX + off, phoneY + phoneH * 0.4, 36, Math.PI - 0.6, Math.PI + 0.6);
      ctx.stroke();
    });
    ctx.restore();
  }

  ctx.restore();
}

// -------------------------------------------------------------
// MAIN CANVAS FRAME RENDERING ENGINE
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

  // Clear frame with pure OLED black matching site background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);

  // Subtle paper grain & framing vignette
  grain(ctx, [0, 0, W, H], 260, "#ffffff", 0.025, 42);

  // Background sketchbook border - subtle whisper
  ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
  ctx.lineWidth = 1.0;
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
    const tvH = 246;
    const tvX = (W - tvW) / 2;
    const tvY = 94;

    const tvBreath = drift(sceneT, 11, { amp: 1.4, freq: 0.6 });

    ctx.save();
    ctx.translate(W / 2, tvY + tvH / 2);
    ctx.translate(-W / 2, -(tvY + tvH / 2) + tvBreath);

    // Antennas atop TV (angled outward and safely below banner at y=32)
    const antLeft: [number, number][] = [
      [tvX + tvW / 2 - 35, tvY],
      [tvX + tvW / 2 - 95, tvY - 26 + drift(sceneT, 1, { amp: 1.8, freq: 1.2 })],
    ];
    const antRight: [number, number][] = [
      [tvX + tvW / 2 + 35, tvY],
      [tvX + tvW / 2 + 95, tvY - 28 + drift(sceneT, 2, { amp: 1.8, freq: 1.1 })],
    ];
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2.4;
    wob(ctx, antLeft, 1.8, 12);
    wob(ctx, antRight, 1.8, 15);

    // Antenna tip knobs
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(antLeft[1][0], antLeft[1][1], 5, 0, Math.PI * 2);
    ctx.arc(antRight[1][0], antRight[1][1], 5, 0, Math.PI * 2);
    ctx.fill();

    // TV Chassis
    ctx.fillStyle = "#151722";
    ctx.beginPath();
    ctx.roundRect?.(tvX, tvY, tvW, tvH, 22) || ctx.rect(tvX, tvY, tvW, tvH);
    ctx.fill();
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 3.0;
    wob(ctx, [[tvX, tvY], [tvX + tvW, tvY], [tvX + tvW, tvY + tvH], [tvX, tvY + tvH]], 1.8, 101, true, { corner: 0.6 });

    // TV Legs
    const legL: [number, number][] = [[tvX + 55, tvY + tvH], [tvX + 28, tvY + tvH + 32]];
    const legR: [number, number][] = [[tvX + tvW - 55, tvY + tvH], [tvX + tvW - 28, tvY + tvH + 32]];
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3.0;
    wob(ctx, legL, 1.5, 102);
    wob(ctx, legR, 1.5, 103);

    // Screen Glass
    const scrX = tvX + 16;
    const scrY = tvY + 16;
    const scrW = tvW - 32;
    const scrH = tvH - 32;
    ctx.fillStyle = "#0c0d14";
    ctx.fillRect(scrX, scrY, scrW, scrH);

    // -------------------------------------------------------------
    // PHASE A: BIENVENIDA Y MODOS (0s - 12s)
    // -------------------------------------------------------------
    if (isLobbyPhase) {
      drawTopBanner(
        ctx,
        W,
        lang === "es" ? "01 · LA TELE" : "01 · THE SCREEN",
        lang === "es" ? "Juega en grupo o tú solo en el navegador" : "Play with friends or solo in your browser"
      );

      ctx.fillStyle = "#38bdf8";
      ctx.font = "900 23px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PEEKRUSH", scrX + scrW / 2, scrY + 36);
      aster(ctx, scrX + scrW / 2 + 80, scrY + 28, 7, "#fbbf24", 4, sceneT * 2);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText(lang === "es" ? "ELIGE CÓMO QUIERES JUGAR HOY" : "CHOOSE HOW YOU WANT TO PLAY TODAY", scrX + scrW / 2, scrY + 54);

      // Two Mode Cards
      const cardW = 172;
      const cardH = 114;
      const cardY = scrY + 68;

      // Card 1: En Grupo
      const c1X = scrX + 18;
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(c1X, cardY, cardW, cardH);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2.0;
      wob(ctx, [[c1X, cardY], [c1X + cardW, cardY], [c1X + cardW, cardY + cardH], [c1X, cardY + cardH]], 1.4, 111, true);

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillText(lang === "es" ? "👥 EN GRUPO" : "👥 WITH FRIENDS", c1X + cardW / 2, cardY + 26);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText(lang === "es" ? "Crear Sala" : "Create Room", c1X + cardW / 2, cardY + 48);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText(lang === "es" ? "TV + Móviles con QR" : "TV + Mobiles with QR", c1X + cardW / 2, cardY + 68);
      ctx.fillText(lang === "es" ? "Sin instalar nada" : "Zero app downloads", c1X + cardW / 2, cardY + 84);

      // Card 2: Modo Solo
      const c2X = scrX + scrW - cardW - 18;
      ctx.fillStyle = "#151722";
      ctx.fillRect(c2X, cardY, cardW, cardH);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1.4;
      wob(ctx, [[c2X, cardY], [c2X + cardW, cardY], [c2X + cardW, cardY + cardH], [c2X, cardY + cardH]], 1.2, 112, true);

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillText(lang === "es" ? "👤 MODO SOLO" : "👤 PLAY SOLO", c2X + cardW / 2, cardY + 26);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText(lang === "es" ? "Jugar Solo" : "Single Player", c2X + cardW / 2, cardY + 48);

      ctx.fillStyle = "#64748b";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText(lang === "es" ? "Con tu teclado" : "With your keyboard", c2X + cardW / 2, cardY + 68);
      ctx.fillText(lang === "es" ? "Récords globales" : "Global records", c2X + cardW / 2, cardY + 84);

      // Hand-drawn mouse cursor hovering "Crear sala"
      const curX = c1X + cardW / 2 + 10 + Math.sin(sceneT * 2) * 8;
      const curY = cardY + 46 + Math.cos(sceneT * 2) * 4;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(curX, curY);
      ctx.lineTo(curX, curY + 15);
      ctx.lineTo(curX + 5, curY + 11);
      ctx.lineTo(curX + 10, curY + 17);
      ctx.lineTo(curX + 13, curY + 14);
      ctx.lineTo(curX + 8, curY + 9);
      ctx.lineTo(curX + 12, curY + 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }
    // -------------------------------------------------------------
    // PHASE B: CREAR SALA Y QR GIGANTE (12s - 22s)
    // -------------------------------------------------------------
    else {
      drawTopBanner(
        ctx,
        W,
        lang === "es" ? "01 · LA TELE" : "01 · THE SCREEN",
        lang === "es" ? "Crea tu sala y proyecta el código QR gigante" : "Create room to display the giant QR code"
      );

      const qrSize = 132;
      const qrX = scrX + 24;
      const qrY = scrY + (scrH - qrSize) / 2;

      // QR Code Box
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(qrX, qrY, qrSize, qrSize);
      wob(ctx, [[qrX, qrY], [qrX + qrSize, qrY], [qrX + qrSize, qrY + qrSize], [qrX, qrY + qrSize]], 1.4, 201, true);

      // Finder patterns
      const drawFinder = (fx: number, fy: number) => {
        ctx.fillStyle = "#000000";
        ctx.fillRect(fx, fy, 30, 30);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(fx + 5, fy + 5, 20, 20);
        ctx.fillStyle = "#000000";
        ctx.fillRect(fx + 9, fy + 9, 12, 12);
      };
      drawFinder(qrX + 6, qrY + 6);
      drawFinder(qrX + qrSize - 36, qrY + 6);
      drawFinder(qrX + 6, qrY + qrSize - 36);

      // QR pixel grid
      ctx.fillStyle = "#000000";
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if ((r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3)) continue;
          if (hash(r * 9 + c, 5) > 0.45) {
            ctx.fillRect(qrX + 15 + c * 11, qrY + 15 + r * 11, 9, 9);
          }
        }
      }

      // Scanning sweep line
      const scanProgress = (Math.sin(sceneT * 2.5) * 0.5 + 0.5);
      const scanY = qrY + scanProgress * qrSize;
      ctx.strokeStyle = "rgba(56, 189, 248, 0.95)";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(qrX - 4, scanY);
      ctx.lineTo(qrX + qrSize + 4, scanY);
      ctx.stroke();

      // Right Side Info inside screen
      const textX = scrX + qrSize + 46;
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("PEEKRUSH TV", textX, scrY + 40);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 30px monospace";
      ctx.fillText("7 K X 9 P", textX, scrY + 80);

      // Room code frame
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.6;
      wob(ctx, [[textX - 8, scrY + 50], [textX + 155, scrY + 50], [textX + 155, scrY + 92], [textX - 8, scrY + 92]], 1.5, 203, true);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText(lang === "es" ? "ESCANEA CON LA CÁMARA" : "SCAN WITH YOUR CAMERA", textX, scrY + 118);
      ctx.fillText("peekrush.inmerzion.io", textX, scrY + 136);

      ctx.fillStyle = "#22c55e";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText(lang === "es" ? "● EN ESPERA DE JUGADORES" : "● WAITING FOR PLAYERS", textX, scrY + 164);

      ctx.restore();

      // Left Safe Callout Badge (Safely placed inside x=25 to x=155)
      const calloutX = 92;
      const calloutY = tvY + 110;
      ctx.save();
      ctx.translate(calloutX, calloutY + drift(sceneT, 20, { amp: 3, freq: 1.0 }));

      // Speech card
      ctx.fillStyle = "#1e293b";
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(-58, -32, 116, 64, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(lang === "es" ? "¡Tus amigos" : "Friends scan", 0, -10);
      ctx.fillText(lang === "es" ? "escanean aquí!" : "the QR code!", 0, 6);

      // Arrow pointing right to the TV
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(18, 18);
      ctx.lineTo(44, 18);
      ctx.lineTo(38, 12);
      ctx.moveTo(44, 18);
      ctx.lineTo(38, 24);
      ctx.stroke();

      ctx.restore();
    }
  }

  // -----------------------------------------------------------------
  // SCENE 1: TU MÓVIL ES EL MANDO (Phone Controller + Refined Hand)
  // Audio ES (22.0s - 30.5s):
  // "Tus amigos solo tienen que escanear el código QR con la cámara de su móvil
  //  y escribir su nombre para unirse al instante."
  // -----------------------------------------------------------------
  else if (sceneIdx === 1) {
    drawTopBanner(
      ctx,
      W,
      lang === "es" ? "02 · TU MÓVIL" : "02 · YOUR PHONE",
      lang === "es" ? "Tus amigos escanean el QR y juegan desde su móvil" : "Friends scan the QR code to play on their phone"
    );

    const phoneW = 184;
    const phoneH = 320;
    const phoneX = 215;
    const phoneY = 64;

    const isCameraPhase = sceneT < 3.2;
    // Kinematic reach: thumb reaches between 4.4s and 5.0s, presses at 5.0s
    const reachProg = clamp((sceneT - 4.4) / 0.6, 0, 1);
    const isTapPhase = sceneT >= 5.0;

    drawHandHoldingPhone(ctx, phoneX, phoneY, phoneW, phoneH, {
      sceneT,
      thumbPose: "tap",
      tapProgress: reachProg,
      isPressed: isTapPhase,
      targetPos: { x: phoneX + phoneW / 2, y: phoneY + 28 + 152 + 20 },
      renderScreen: (pScrX, pScrY, pScrW, pScrH) => {
        // SCREEN PHASE A: SCANNING QR WITH CAMERA
        if (isCameraPhase) {
          ctx.fillStyle = "#1e293b";
          ctx.fillRect(pScrX, pScrY, pScrW, 24);
          ctx.fillStyle = "#94a3b8";
          ctx.font = "bold 9px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("0.5x    1x    2x", pScrX + pScrW / 2, pScrY + 15);

          // Viewfinder
          const vfSize = 78;
          const vfX = pScrX + (pScrW - vfSize) / 2;
          const vfY = pScrY + 46;
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 2.2;
          const bLen = 12;
          ctx.beginPath();
          ctx.moveTo(vfX, vfY + bLen); ctx.lineTo(vfX, vfY); ctx.lineTo(vfX + bLen, vfY);
          ctx.moveTo(vfX + vfSize - bLen, vfY); ctx.lineTo(vfX + vfSize, vfY); ctx.lineTo(vfX + vfSize, vfY + bLen);
          ctx.moveTo(vfX, vfY + vfSize - bLen); ctx.lineTo(vfX, vfY + vfSize); ctx.lineTo(vfX + bLen, vfY + vfSize);
          ctx.moveTo(vfX + vfSize - bLen, vfY + vfSize); ctx.lineTo(vfX + vfSize, vfY + vfSize); ctx.lineTo(vfX + vfSize, vfY + vfSize - bLen);
          ctx.stroke();

          // QR Target
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(vfX + 18, vfY + 18, 42, 42);
          ctx.fillStyle = "#000000";
          ctx.fillRect(vfX + 22, vfY + 22, 11, 11);
          ctx.fillRect(vfX + 45, vfY + 22, 11, 11);
          ctx.fillRect(vfX + 22, vfY + 45, 11, 11);

          // QR detect card
          const notifY = pScrY + 148;
          ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
          ctx.beginPath();
          ctx.roundRect(pScrX + 8, notifY, pScrW - 16, 38, 10);
          ctx.fill();
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 1.3;
          ctx.stroke();

          ctx.fillStyle = "#22c55e";
          ctx.font = "bold 11px system-ui, sans-serif";
          ctx.fillText(lang === "es" ? "✓ QR DETECTADO" : "✓ QR DETECTED", pScrX + pScrW / 2, notifY + 15);
          ctx.fillStyle = "#ffffff";
          ctx.font = "10px system-ui, sans-serif";
          ctx.fillText("peekrush.inmerzion.io", pScrX + pScrW / 2, notifY + 30);
        }
        // SCREEN PHASE B: NAME INPUT & TAP JOIN
        else {
          // Address bar
          ctx.fillStyle = "#1e293b";
          ctx.beginPath();
          ctx.roundRect(pScrX + 8, pScrY + 8, pScrW - 16, 20, 5);
          ctx.fill();
          ctx.fillStyle = "#94a3b8";
          ctx.font = "9px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("peekrush.inmerzion.io", pScrX + pScrW / 2, pScrY + 21);

          // Brand Title
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 14px system-ui, sans-serif";
          ctx.fillText("PeekRush", pScrX + pScrW / 2, pScrY + 50);

          // Room code pill
          const inp1Y = pScrY + 66;
          ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
          ctx.beginPath();
          ctx.roundRect(pScrX + 12, inp1Y, pScrW - 24, 32, 8);
          ctx.fill();
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ctx.fillStyle = "#38bdf8";
          ctx.font = "bold 15px monospace";
          ctx.fillText("7 K X 9 P", pScrX + pScrW / 2, inp1Y + 21);

          // Alias Input field: "Alex ✨"
          const inp2Y = pScrY + 108;
          ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
          ctx.beginPath();
          ctx.roundRect(pScrX + 12, inp2Y, pScrW - 24, 32, 8);
          ctx.fill();
          ctx.strokeStyle = "#94a3b8";
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 13px system-ui, sans-serif";
          ctx.fillText("Alex ✨", pScrX + pScrW / 2, inp2Y + 21);

          // Big Join Button
          const btnY = pScrY + 152;
          ctx.fillStyle = isTapPhase ? "#22c55e" : "#ffffff";
          ctx.beginPath();
          ctx.roundRect(pScrX + 12, btnY, pScrW - 24, 40, 10);
          ctx.fill();
          ctx.fillStyle = isTapPhase ? "#ffffff" : "#000000";
          ctx.font = "900 13px system-ui, sans-serif";
          ctx.fillText(isTapPhase ? (lang === "es" ? "¡CONECTADO!" : "CONNECTED!") : (lang === "es" ? "¡ENTRAR!" : "JOIN!"), pScrX + pScrW / 2, btnY + 25);

          // Tap shockwave ripple
          if (isTapPhase) {
            ctx.strokeStyle = "#22c55e";
            ctx.lineWidth = 2.0;
            const ripR = (sceneT - 5.0) * 35;
            ctx.beginPath();
            ctx.arc(pScrX + pScrW / 2, btnY + 20, ripR % 40, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      },
    });

    // Right Side Clean Editorial Callouts (Safely placed in x=455 to x=760)
    const calloutX = 455;
    ctx.save();
    ctx.textAlign = "left";

    // Heading
    ctx.fillStyle = "#38bdf8";
    ctx.font = "900 16px system-ui, sans-serif";
    ctx.fillText(lang === "es" ? "⚡ ¡Sin instalar Apps!" : "⚡ Zero App Downloads!", calloutX, phoneY + 50);

    // Bullets
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText(lang === "es" ? "1. Abre la cámara del móvil" : "1. Open your phone camera", calloutX, phoneY + 84);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(lang === "es" ? "Enfoca al código QR gigante de la tele." : "Point it at the giant QR on the TV.", calloutX + 16, phoneY + 104);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText(lang === "es" ? "2. Escribe tu alias o nombre" : "2. Type your nickname", calloutX, phoneY + 138);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(lang === "es" ? "El código de sala se rellena solo." : "The room code auto-fills instantly.", calloutX + 16, phoneY + 158);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText(lang === "es" ? "3. ¡Tu móvil es tu mando!" : "3. Your phone is your buzzer!", calloutX, phoneY + 192);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(lang === "es" ? "Responde a toda velocidad en cada ronda." : "Answer at maximum speed every round.", calloutX + 16, phoneY + 212);

    // Status Pill
    ctx.fillStyle = "rgba(34, 197, 94, 0.15)";
    ctx.strokeStyle = "rgba(34, 197, 94, 0.4)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(calloutX, phoneY + 242, 270, 32, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText(lang === "es" ? "✓ Conexión en 2 segundos por WebSocket" : "✓ Connected in 2 seconds via WebSocket", calloutX + 12, phoneY + 262);

    ctx.restore();
  }

  // -----------------------------------------------------------------
  // SCENE 2: MODO SOLO (Workstation & Direct Keyboard Typing)
  // Audio ES (30.5s - 38.5s):
  // "Si estás solo, simplemente pulsa en 'Jugar solo' para empezar una
  //  partida individual y responder directamente con tu teclado."
  // -----------------------------------------------------------------
  else if (sceneIdx === 2) {
    drawTopBanner(
      ctx,
      W,
      lang === "es" ? "03 · MODO SOLO" : "03 · PLAY SOLO",
      lang === "es" ? "Modo individual: responde directamente con tu teclado" : "Single player: answer directly with your keyboard"
    );

    const lapW = 380;
    const lapH = 205;
    const lapX = 180;
    const lapY = 82;

    // Laptop Frame
    ctx.fillStyle = "#161822";
    ctx.beginPath();
    ctx.roundRect?.(lapX, lapY, lapW, lapH, 16) || ctx.rect(lapX, lapY, lapW, lapH);
    ctx.fill();
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 2.8;
    wob(ctx, [[lapX, lapY], [lapX + lapW, lapY], [lapX + lapW, lapY + lapH], [lapX, lapY + lapH]], 1.6, 441, true);

    // Screen Glass
    const lScrX = lapX + 12;
    const lScrY = lapY + 12;
    const lScrW = lapW - 24;
    const lScrH = lapH - 24;
    ctx.fillStyle = "#0c0d14";
    ctx.fillRect(lScrX, lScrY, lScrW, lScrH);

    // Header inside screen
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(lScrX, lScrY, lScrW, 26);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(lang === "es" ? "PEEKRUSH SOLO · 1 JUGADOR" : "PEEKRUSH SOLO · 1 PLAYER", lScrX + 12, lScrY + 17);

    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "right";
    ctx.fillText("● DIRECT PLAY", lScrX + lScrW - 12, lScrY + 17);

    // Prompt
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(lang === "es" ? "ADIVINA LA MARCA CON TU TECLADO:" : "GUESS THE BRAND ON YOUR KEYBOARD:", lScrX + lScrW / 2, lScrY + 50);

    // Mystery brand box
    const iconBoxW = 76;
    const iconBoxH = 42;
    const iconBoxX = lScrX + (lScrW - iconBoxW) / 2;
    const iconBoxY = lScrY + 62;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(iconBoxX, iconBoxY, iconBoxW, iconBoxH);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.5;
    wob(ctx, [[iconBoxX, iconBoxY], [iconBoxX + iconBoxW, iconBoxY], [iconBoxX + iconBoxW, iconBoxY + iconBoxH], [iconBoxX, iconBoxY + iconBoxH]], 1.2, 442, true);

    ctx.fillStyle = "#fbbf24";
    ctx.font = "900 22px monospace";
    ctx.fillText("?", iconBoxX + iconBoxW / 2, iconBoxY + 29);

    // Typing letters: N -> I -> K -> E
    const typeLetters = ["N", "I", "K", "E"];
    const typeCount = clamp(Math.floor(sceneT * 1.5), 1, 4);
    const typedText = typeLetters.slice(0, typeCount).join(" ");
    const isAnswered = sceneT >= 3.2;

    // Input Field
    const inpY = lScrY + 118;
    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    ctx.fillRect(lScrX + 40, inpY, lScrW - 80, 34);
    ctx.strokeStyle = isAnswered ? "#22c55e" : "#38bdf8";
    ctx.lineWidth = 1.6;
    wob(ctx, [[lScrX + 40, inpY], [lScrX + lScrW - 40, inpY], [lScrX + lScrW - 40, inpY + 34], [lScrX + 40, inpY + 34]], 1.2, 443, true);

    ctx.fillStyle = isAnswered ? "#22c55e" : "#ffffff";
    ctx.font = "900 15px monospace";
    ctx.fillText(isAnswered ? "✓ N I K E  (+720 PTS)" : `${typedText} _`, lScrX + lScrW / 2, inpY + 22);

    // Laptop Base & Keyboard Chassis
    const kbW = 430;
    const kbH = 60;
    const kbX = (W - kbW) / 2;
    const kbY = lapY + lapH - 2;

    ctx.fillStyle = "#1e2230";
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect?.(kbX, kbY, kbW, kbH, [4, 4, 14, 14]) || ctx.rect(kbX, kbY, kbW, kbH);
    ctx.fill();
    wob(ctx, [[kbX, kbY], [kbX + kbW, kbY], [kbX + kbW - 10, kbY + kbH], [kbX + 10, kbY + kbH]], 1.5, 445, true);

    // Keyboard keys
    const keyChars = ["N", "I", "K", "E", "↵"];
    keyChars.forEach((kc, i) => {
      const kx = kbX + 135 + i * 34;
      const ky = kbY + 10;
      const isLit = i < typeCount || (i === 4 && isAnswered);
      ctx.fillStyle = isLit ? "#38bdf8" : "#2a3144";
      ctx.fillRect(kx, ky, 26, 20);
      ctx.strokeStyle = isLit ? "#ffffff" : "#475569";
      ctx.lineWidth = 1.1;
      ctx.strokeRect(kx, ky, 26, 20);

      ctx.fillStyle = isLit ? "#000000" : "#cbd5e1";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(kc, kx + 13, ky + 14);
    });

    // Spacebar
    ctx.fillStyle = "#2a3144";
    ctx.fillRect(kbX + 150, kbY + 35, 130, 14);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(kbX + 150, kbY + 35, 130, 14);

    // Right Side Clean Editorial Callouts (Safely placed in x=590 to x=770)
    const calloutX = 590;
    ctx.save();
    ctx.textAlign = "left";
    ctx.fillStyle = "#38bdf8";
    ctx.font = "900 15px system-ui, sans-serif";
    ctx.fillText(lang === "es" ? "👤 ¡Modo Solo!" : "👤 Solo Play!", calloutX, lapY + 36);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText(lang === "es" ? "• Juega al instante" : "• Instant Play", calloutX, lapY + 68);
    ctx.fillText(lang === "es" ? "• Con tu teclado físico" : "• Physical keyboard", calloutX, lapY + 92);
    ctx.fillText(lang === "es" ? "• Bate récords globales" : "• Global records", calloutX, lapY + 116);
    ctx.fillText(lang === "es" ? "• Sin esperar a nadie" : "• No waiting", calloutX, lapY + 140);
    ctx.restore();
  }

  // -----------------------------------------------------------------
  // SCENE 3: MULTIPLICADOR Y REVELADO (SMARTPHONE INTERFACE + Refined Hand)
  // Audio ES (38.5s - 50.5s):
  // "Cuando empiece la partida, aparecerá un logotipo que se irá revelando
  //  poco a poco. ¡Tu objetivo es adivinar la marca antes que nadie!
  //  Cuanto más rápido aciertes, más puntos conseguirás."
  // -----------------------------------------------------------------
  else if (sceneIdx === 3) {
    drawTopBanner(
      ctx,
      W,
      lang === "es" ? "04 · MULTIPLICADOR" : "04 · MULTIPLIER",
      lang === "es" ? "Adivina la marca en tu móvil y gana puntos" : "Guess on your phone and score multiplier points"
    );

    const phoneW = 184;
    const phoneH = 320;
    const phoneX = 215;
    const phoneY = 64;

    const cycleT = sceneT % 6.0;
    const revealProgress = clamp(cycleT / 3.6, 0.18, 1.0);
    const multVal = Math.max(1.5, 3.0 - cycleT * 0.4).toFixed(1);
    const isAnswered = cycleT >= 3.6;

    // Kinematic reach: thumb glides to buzzer button at 3.0s, presses at 3.6s, releases at 4.8s
    const reachProg = clamp((cycleT - 3.0) / 0.6, 0, 1);
    const releaseProg = clamp((cycleT - 4.8) / 0.5, 0, 1);
    const tapProg = reachProg * (1 - releaseProg);
    const isPressed = cycleT >= 3.6 && cycleT < 4.8;

    drawHandHoldingPhone(ctx, phoneX, phoneY, phoneW, phoneH, {
      sceneT,
      thumbPose: "buzzer",
      tapProgress: tapProg,
      isPressed,
      hapticWaves: isPressed,
      targetPos: { x: phoneX + phoneW / 2, y: phoneY + 28 + 178 + 40 + 15 },
      renderScreen: (pScrX, pScrY, pScrW, pScrH) => {
        // iOS Header inside phone screen
        ctx.fillStyle = "#131625";
        ctx.fillRect(pScrX, pScrY, pScrW, 26);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("Alex ✨", pScrX + 10, pScrY + 17);

        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "right";
        ctx.fillText(isAnswered ? "850 PTS" : "0 PTS", pScrX + pScrW - 10, pScrY + 17);

        // Speed Multiplier Pill at top of game area
        const multY = pScrY + 34;
        const isFast = Number(multVal) > 1.8;
        ctx.fillStyle = isFast ? "rgba(245, 158, 11, 0.2)" : "rgba(239, 68, 68, 0.2)";
        ctx.strokeStyle = isFast ? "#f59e0b" : "#ef4444";
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.roundRect(pScrX + 14, multY, pScrW - 28, 26, 13);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isFast ? "#fbbf24" : "#f87171";
        ctx.font = "900 13px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`⚡ ${multVal}x MULTIPLICADOR`, pScrX + pScrW / 2, multY + 17);

        // Brand Reveal Canvas on Phone Screen: Authentic Apple Logo
        const logoBoxY = pScrY + 68;
        const logoBoxH = 100;
        ctx.fillStyle = "#0c0d14";
        ctx.fillRect(pScrX + 10, logoBoxY, pScrW - 20, logoBoxH);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = 1;
        ctx.strokeRect(pScrX + 10, logoBoxY, pScrW - 20, logoBoxH);

        const logoCx = pScrX + pScrW / 2;
        const logoCy = logoBoxY + logoBoxH / 2;

        // Authentic Apple vector scaled for phone screen
        const applePath = new Path2D(APPLE_SVG_PATH);
        const s = 58 / 19.3;
        ctx.save();
        ctx.translate(logoCx - 12.0 * s, logoCy - 13.15 * s);
        ctx.scale(s, s);
        ctx.fillStyle = "#ffffff";
        ctx.fill(applePath);
        ctx.restore();

        // Progressive obscuring puzzle tiles
        if (!isAnswered && revealProgress < 0.95) {
          ctx.fillStyle = "#0c0d14";
          const bSize = 13;
          for (let bx = -3; bx <= 3; bx++) {
            for (let by = -3; by <= 3; by++) {
              const h = hash(bx + by * 13, 88);
              if (h > revealProgress) {
                const blkX = logoCx + bx * bSize - bSize / 2;
                const blkY = logoCy + by * bSize - bSize / 2;
                ctx.fillRect(blkX, blkY, bSize + 1, bSize + 1);
                ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
                ctx.lineWidth = 0.8;
                ctx.strokeRect(blkX, blkY, bSize + 1, bSize + 1);
              }
            }
          }
        }

        // Bottom Action Area: Guess Input / Buzzer Feedback
        const bottomY = pScrY + 178;

        if (isAnswered) {
          // Success Feedback Banner
          ctx.fillStyle = "rgba(34, 197, 94, 0.25)";
          ctx.strokeStyle = "#22c55e";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.roundRect(pScrX + 10, bottomY, pScrW - 20, 68, 10);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#22c55e";
          ctx.font = "900 13px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("✓ ¡CORRECTO!", pScrX + pScrW / 2, bottomY + 22);

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 12px system-ui, sans-serif";
          ctx.fillText("APPLE · +850 PTS", pScrX + pScrW / 2, bottomY + 40);

          ctx.fillStyle = "#fbbf24";
          ctx.font = "900 11px system-ui, sans-serif";
          ctx.fillText("⚡ 2.8x VELOCIDAD", pScrX + pScrW / 2, bottomY + 56);

          // Mini Celebration Stars
          aster(ctx, pScrX + 26, bottomY + 20, 5, "#fbbf24", 4, cycleT * 3);
          aster(ctx, pScrX + pScrW - 26, bottomY + 20, 5, "#fbbf24", 4, -cycleT * 3);
        } else {
          // Answer typing input
          ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
          ctx.beginPath();
          ctx.roundRect(pScrX + 10, bottomY, pScrW - 20, 32, 6);
          ctx.fill();
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 1.2;
          ctx.stroke();

          const typed = ["A", "P", "P", "L", "E"].slice(0, clamp(Math.floor(cycleT * 2), 1, 5)).join(" ");
          ctx.fillStyle = "#ffffff";
          ctx.font = "900 13px monospace";
          ctx.textAlign = "center";
          ctx.fillText(`${typed} _`, pScrX + pScrW / 2, bottomY + 21);

          // Buzzer Button
          const btnY = bottomY + 40;
          ctx.fillStyle = "#38bdf8";
          ctx.beginPath();
          ctx.roundRect(pScrX + 10, btnY, pScrW - 20, 30, 8);
          ctx.fill();

          ctx.fillStyle = "#000000";
          ctx.font = "900 11px system-ui, sans-serif";
          ctx.fillText(lang === "es" ? "¡ENVIAR!" : "SUBMIT!", pScrX + pScrW / 2, btnY + 19);
        }
      },
    });

    // Right Side Clean Editorial Callouts (Safely placed in x=455 to x=760)
    const calloutX = 455;
    ctx.save();
    ctx.textAlign = "left";

    // Heading
    ctx.fillStyle = "#38bdf8";
    ctx.font = "900 16px system-ui, sans-serif";
    ctx.fillText(lang === "es" ? "⚡ Multiplicador de velocidad" : "⚡ Speed Multiplier", calloutX, phoneY + 40);

    // Bullets
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText(lang === "es" ? "• El logo se revela bloque a bloque" : "• Logo reveals block by block", calloutX, phoneY + 74);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(lang === "es" ? "Aparece progresivamente en tu pantalla." : "Progressively unveiled on your screen.", calloutX + 14, phoneY + 94);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText(lang === "es" ? "• Adivina antes que nadie en tu móvil" : "• Guess first on your phone", calloutX, phoneY + 128);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(lang === "es" ? "Escribe la marca y pulsa el botón." : "Type the brand name and tap submit.", calloutX + 14, phoneY + 148);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText(lang === "es" ? "• El multiplicador baja cada segundo" : "• Multiplier ticks down every second", calloutX, phoneY + 182);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(lang === "es" ? "Cuanto más rápido seas, más puntuación." : "The faster you answer, the higher your score.", calloutX + 14, phoneY + 202);

    // Multiplier Guide Box
    ctx.fillStyle = "rgba(245, 158, 11, 0.12)";
    ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(calloutX, phoneY + 226, 275, 48, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#fbbf24";
    ctx.font = "900 12px system-ui, sans-serif";
    ctx.fillText(lang === "es" ? "⚡ 3.0x  ➔  Acierto en los primeros segundos" : "⚡ 3.0x  ➔  Immediate lightning guess", calloutX + 12, phoneY + 246);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(lang === "es" ? "⚡ 1.5x  ➔  Multiplicador base al final" : "⚡ 1.5x  ➔  Base multiplier towards the end", calloutX + 12, phoneY + 264);

    ctx.restore();
  }

  // -----------------------------------------------------------------
  // SCENE 4: PODIO Y RÉCORDS (Fixed 3rd Place & Zero Overlapping Text)
  // Audio ES (50.5s - 56.8s):
  // "Al final veremos el podio de la partida y la tabla de récords globales.
  //  ¡Mucha suerte y a jugar!"
  // -----------------------------------------------------------------
  else if (sceneIdx === 4) {
    drawTopBanner(
      ctx,
      W,
      lang === "es" ? "05 · PODIO" : "05 · PODIUM",
      lang === "es" ? "Podio de ganadores y récord mundial" : "Winners podium and world records"
    );

    const groundY = 380;
    const stepW = 120;
    const centerPodX = (W - stepW) / 2; // 340
    const gap = 8;

    // Ground Floor Line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 2.4;
    wob(ctx, [[120, groundY], [680, groundY]], 1.5, 401);

    // Step heights:
    // 1st Place (Center, Gold): Highest (150px)
    // 2nd Place (Left, Silver): Mid (95px)
    // 3rd Place (Right, Bronze): Lowest (55px), grounded firmly on floor!
    const podH1 = 150; // top at 380 - 150 = 230
    const podH2 = 95;  // top at 380 - 95 = 285
    const podH3 = 55;  // top at 380 - 55 = 325

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

    // Clean Player Badge: No overlap!
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText("🥈 Hugo (1,920)", x2 + stepW / 2, y2 - 16);

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

    // Clean Player Badge: No overlap!
    ctx.fillStyle = "#d97706";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText("🥉 Dani (1,480)", x3 + stepW / 2, y3 - 16);

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

    // Golden Trophy atop Step 1 (y: 206)
    const trophyX = x1 + stepW / 2;
    const trophyY = y1 - 24; // 206
    const trophyWob = drift(sceneT, 9, { amp: 2.0, freq: 1.0 });

    ctx.save();
    ctx.translate(trophyX, trophyY + trophyWob);
    // Trophy cup
    ctx.fillStyle = "#fbbf24";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.0;
    const cupPts: [number, number][] = [
      [-18, -22],
      [18, -22],
      [14, -2],
      [0, 8],
      [-14, -2],
    ];
    ctx.beginPath();
    cupPts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.fill();
    wob(ctx, cupPts, 1.2, 501, true);

    // Trophy base
    ctx.fillRect(-12, 8, 24, 4);
    ctx.fillRect(-16, 12, 32, 5);

    // Sparkles
    aster(ctx, -20, -16, 7, "#ffffff", 4, sceneT * 3);
    aster(ctx, 20, -16, 7, "#fbbf24", 4, -sceneT * 3);
    ctx.restore();

    // 1st Place Player Name Badge: Positioned ABOVE the trophy with zero overlap!
    ctx.save();
    const badgeY = y1 - 66; // 164 (comfortably above the trophy top at 184!)
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(x1 - 10, badgeY - 14, stepW + 20, 26, 13);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#fbbf24";
    ctx.font = "900 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("👑 Sara (3,420)", x1 + stepW / 2, badgeY + 4);
    ctx.restore();

    // Confetti physics: Fluttering falling marks
    const confColors = ["#f43f5e", "#38bdf8", "#fbbf24", "#22c55e", "#a855f7"];
    for (let i = 0; i < 30; i++) {
      const cSeed = i * 17;
      const startX = (hash(i, 3) * W);
      const speed = 55 + hash(i, 5) * 75;
      const confY = ((sceneT * speed + hash(i, 7) * H) % (H + 40)) - 20;
      const confX = startX + drift(sceneT + i, cSeed, { amp: 25, freq: 1.2 });
      const confRot = sceneT * 3.5 + i;
      const col = confColors[i % confColors.length];

      ctx.save();
      ctx.translate(confX, confY);
      ctx.rotate(confRot);
      ctx.fillStyle = col;
      ctx.fillRect(-4.5, -2, 9, 4);
      ctx.restore();
    }

    // Final "¡A JUGAR!" celebration bounce at end of audio
    if (sceneT >= 3.8) {
      const popT = sceneT - 3.8;
      const bounce = spring(popT * 2.5, { freq: 3.2, damp: 0.55 });
      ctx.save();
      ctx.translate(W / 2, groundY + 34);
      ctx.scale(bounce, bounce);
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(-105, -16, 210, 32);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.8;
      wob(ctx, [[-105, -16], [105, -16], [105, 16], [-105, 16]], 1.2, 777, true);
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 15px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(lang === "es" ? "¡A JUGAR! 🚀" : "PLAY NOW! 🚀", 0, 5);
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
        "relative aspect-video w-full rounded-2xl overflow-hidden bg-[#000000] border border-white/[0.05] cursor-pointer group shadow-2xl select-none",
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
