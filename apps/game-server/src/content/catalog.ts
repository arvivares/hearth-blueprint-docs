/**
 * Catálogo FICTICIO propio para pruebas iniciales. Empresas inventadas; los
 * logos se generan por código (formas + texto), sin recursos de terceros.
 * Procedencia: creado para este proyecto, licencia MIT.
 *
 * Solo servidor: nunca importar desde la app web.
 */
export interface CatalogItem {
  id: string;
  version: number;
  answer: string;
  aliases: string[];
  logo: { bg: string; fg: string; shape: "circle" | "square" | "triangle" | "hex" | "diamond"; mark: string };
}

export const DEMO_CATALOG: CatalogItem[] = [
  { id: "c01", version: 1, answer: "Zentrova", aliases: ["Zentrova Labs"], logo: { bg: "#0f766e", fg: "#f0fdfa", shape: "hex", mark: "Z" } },
  { id: "c02", version: 1, answer: "Pulmar", aliases: [], logo: { bg: "#1e3a8a", fg: "#fde047", shape: "circle", mark: "P" } },
  { id: "c03", version: 1, answer: "Ondalia Café", aliases: ["Ondalia", "Café Ondalia"], logo: { bg: "#7c2d12", fg: "#fed7aa", shape: "circle", mark: "O" } },
  { id: "c04", version: 1, answer: "Kravik & Sons", aliases: ["Kravik and Sons", "Kravik y Sons", "Kravik"], logo: { bg: "#111827", fg: "#f87171", shape: "square", mark: "K" } },
  { id: "c05", version: 1, answer: "Lumbre", aliases: [], logo: { bg: "#b45309", fg: "#fffbeb", shape: "triangle", mark: "L" } },
  { id: "c06", version: 1, answer: "Nébula Móvil", aliases: ["Nebula"], logo: { bg: "#312e81", fg: "#a5f3fc", shape: "diamond", mark: "N" } },
  { id: "c07", version: 1, answer: "Tramuntana Bikes", aliases: ["Tramuntana"], logo: { bg: "#166534", fg: "#dcfce7", shape: "circle", mark: "T" } },
  { id: "c08", version: 1, answer: "Gorrión", aliases: ["Gorrion Express"], logo: { bg: "#9f1239", fg: "#ffe4e6", shape: "hex", mark: "G" } },
  { id: "c09", version: 1, answer: "Arkeon", aliases: [], logo: { bg: "#0c4a6e", fg: "#e0f2fe", shape: "triangle", mark: "A" } },
  { id: "c10", version: 1, answer: "Vélez Hogar", aliases: ["Velez"], logo: { bg: "#4d7c0f", fg: "#ecfccb", shape: "square", mark: "V" } },
  { id: "c11", version: 1, answer: "Quasmo", aliases: [], logo: { bg: "#581c87", fg: "#fae8ff", shape: "diamond", mark: "Q" } },
  { id: "c12", version: 1, answer: "Brisamar", aliases: ["Brisa Mar"], logo: { bg: "#155e75", fg: "#cffafe", shape: "circle", mark: "B" } },
];

function shapePath(shape: CatalogItem["logo"]["shape"]): string {
  switch (shape) {
    case "circle": return `<circle cx="256" cy="200" r="120"/>`;
    case "square": return `<rect x="146" y="90" width="220" height="220" rx="36"/>`;
    case "triangle": return `<polygon points="256,70 386,320 126,320"/>`;
    case "hex": return `<polygon points="256,80 360,140 360,260 256,320 152,260 152,140"/>`;
    case "diamond": return `<polygon points="256,70 390,200 256,330 122,200"/>`;
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** SVG del logo original. Solo se rasteriza en el servidor. */
export function logoSvg(item: CatalogItem): string {
  const { bg, fg, shape, mark } = item.logo;
  const size = item.answer.length > 12 ? 44 : 58;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#f8fafc"/>
  <g fill="${bg}">${shapePath(shape)}</g>
  <text x="256" y="${shape === "triangle" ? 280 : 236}" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" font-size="110" fill="${fg}">${esc(mark)}</text>
  <text x="256" y="430" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" font-size="${size}" fill="${bg}">${esc(item.answer)}</text>
</svg>`;
}
