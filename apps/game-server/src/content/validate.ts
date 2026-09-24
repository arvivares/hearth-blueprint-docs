import { z } from "zod";
import { normalizeAnswer } from "../rules/normalize";

/** Formato del manifiesto de un paquete de contenido (content/<paquete>/manifest.json). */
export const ManifestItem = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/, "id: minúsculas, dígitos y guiones"),
  answer: z.string().trim().min(1).max(60),
  aliases: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  category: z.string().trim().min(1).max(40),
  difficulty: z.number().int().min(1).max(5),
  image: z.string().regex(/^[^/\\]+\.(png|webp|svg)$/i, "image: nombre de archivo png/webp/svg dentro de images/"),
  source: z.object({
    author: z.string().trim().min(1),
    license: z.string().trim().min(1),
    url: z.string().url().optional(),
    notes: z.string().max(500).optional(),
  }),
});
export type ManifestItem = z.infer<typeof ManifestItem>;

export const Manifest = z.object({
  pack: z.string().min(1),
  items: z.array(ManifestItem).min(1),
});
export type Manifest = z.infer<typeof Manifest>;

export const MIME: Record<string, string> = { png: "image/png", webp: "image/webp", svg: "image/svg+xml" };
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Comprobaciones entre elementos: ids únicos y respuestas/alias no ambiguos entre empresas. */
export function crossValidate(items: ManifestItem[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const owner = new Map<string, string>();
  for (const it of items) {
    if (ids.has(it.id)) errors.push(`${it.id}: id duplicado`);
    ids.add(it.id);
    const forms = [it.answer, ...it.aliases].map(normalizeAnswer);
    if (forms.some((f) => !f)) errors.push(`${it.id}: respuesta o alias vacío tras normalizar`);
    const own = new Set<string>();
    for (const f of forms) {
      if (own.has(f)) errors.push(`${it.id}: alias repetido tras normalizar ("${f}")`);
      own.add(f);
      const other = owner.get(f);
      if (other && other !== it.id) errors.push(`${it.id}: "${f}" también es respuesta de ${other}`);
      owner.set(f, it.id);
    }
  }
  return errors;
}

/** Comprobación mínima del contenido de la imagen según su tipo. */
export function checkImage(name: string, bytes: Buffer): string | null {
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return `${name}: tamaño fuera de límites`;
  const ext = name.split(".").pop()!.toLowerCase();
  if (ext === "png" && !bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return `${name}: no es PNG`;
  if (ext === "webp" && !(bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP")) return `${name}: no es WebP`;
  if (ext === "svg") {
    const t = bytes.toString("utf8");
    if (!/<svg[\s>]/i.test(t)) return `${name}: no es SVG`;
    if (/<script|\son\w+=|xlink:href\s*=\s*["']https?:|href\s*=\s*["']https?:/i.test(t)) return `${name}: SVG con scripts o recursos externos`;
  }
  return null;
}
