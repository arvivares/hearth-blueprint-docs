/**
 * Genera el paquete de contenido FICTICIO reproducible (content/demo): manifiesto + SVG.
 * Empresas inventadas y logos generados por código. Ejecutar: npm run content:build-demo
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEMO_CATALOG, logoSvg } from "../src/content/catalog";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../content/demo");
const CATEGORY = ["tecnología", "alimentación", "hostelería", "industria", "energía", "telecomunicaciones", "transporte", "logística", "tecnología", "hogar", "tecnología", "turismo"];
await mkdir(path.join(dir, "images"), { recursive: true });
const items = [];
for (const [i, c] of DEMO_CATALOG.entries()) {
  // Nombre de archivo opaco: no revela la respuesta.
  const file = `img-${String(i + 1).padStart(3, "0")}.svg`;
  await writeFile(path.join(dir, "images", file), logoSvg(c));
  items.push({
    id: `demo-${c.id}`,
    answer: c.answer,
    aliases: c.aliases,
    category: CATEGORY[i],
    difficulty: (i % 5) + 1,
    image: file,
    source: { author: "Proyecto Logos (generado por código)", license: "MIT", notes: "Empresa y logo ficticios creados para pruebas." },
  });
}
await writeFile(path.join(dir, "manifest.json"), JSON.stringify({ pack: "demo-ficticio", items }, null, 2) + "\n");
console.log(`Paquete ficticio generado en ${dir} (${items.length} elementos)`);
