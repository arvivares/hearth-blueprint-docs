import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { tx, type Db } from "../db/pool";
import { checkImage, crossValidate, Manifest, MIME, type ManifestItem } from "./validate";

export interface ImportReport {
  pack: string;
  errors: string[];
  created: string[]; // ids con versión nueva
  unchanged: string[];
  deactivated: string[];
}

const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

function contentHash(it: ManifestItem, imageSha: string) {
  return sha(
    JSON.stringify([it.answer, [...it.aliases].sort(), it.category, it.difficulty, imageSha, it.source.author, it.source.license, it.source.url ?? null, it.source.notes ?? null]),
  );
}

/**
 * Valida e importa un paquete. Idempotente: si un elemento no cambia no crea versión.
 * Si cambia, crea la versión N+1 y desactiva la anterior (las partidas pasadas siguen
 * apuntando a su versión, que es inmutable). Todo o nada: cualquier error cancela.
 */
export async function importPack(
  db: Db | null,
  dir: string,
  opts: { dryRun?: boolean; deactivateMissing?: boolean } = {},
): Promise<ImportReport> {
  const report: ImportReport = { pack: "", errors: [], created: [], unchanged: [], deactivated: [] };
  let manifest: Manifest;
  try {
    const parsed = Manifest.safeParse(JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8")));
    if (!parsed.success) {
      report.errors = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      return report;
    }
    manifest = parsed.data;
  } catch (e) {
    report.errors.push(`manifest.json ilegible: ${(e as Error).message}`);
    return report;
  }
  report.pack = manifest.pack;
  report.errors.push(...crossValidate(manifest.items));

  const images = new Map<string, { bytes: Buffer; sha: string; mime: string }>();
  for (const it of manifest.items) {
    try {
      const bytes = await readFile(path.join(dir, "images", it.image));
      const problem = checkImage(it.image, bytes);
      if (problem) report.errors.push(`${it.id}: ${problem}`);
      else {
        await sharp(bytes).metadata(); // debe poder decodificarse
        images.set(it.id, { bytes, sha: sha(bytes), mime: MIME[it.image.split(".").pop()!.toLowerCase()]! });
      }
    } catch (e) {
      report.errors.push(`${it.id}: imagen ${it.image} no disponible o inválida (${(e as Error).message})`);
    }
  }
  if (report.errors.length || opts.dryRun || !db) return report;

  await tx(db, async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(727202)");
    // Ambigüedad con elementos activos de otros paquetes.
    const active = await c.query<{ item_id: string; answer: string; aliases: string[] }>(
      "SELECT item_id, answer, aliases FROM content.catalog_version WHERE active",
    );
    const incoming = new Set(manifest.items.map((i) => i.id));
    const others = active.rows.filter((r) => !incoming.has(r.item_id)).map((r) => ({ id: r.item_id, answer: r.answer, aliases: r.aliases }));
    const clash = crossValidate([...others, ...manifest.items].map((x) => ({ ...(x as ManifestItem), category: "x", difficulty: 1, image: "x.png", source: { author: "x", license: "x" } })));
    if (clash.length) throw Object.assign(new Error("ambiguo"), { report: clash });

    for (const it of manifest.items) {
      const img = images.get(it.id)!;
      const hash = contentHash(it, img.sha);
      await c.query("INSERT INTO content.catalog_image(sha256, mime, bytes) VALUES ($1,$2,$3) ON CONFLICT (sha256) DO NOTHING", [img.sha, img.mime, img.bytes]);
      await c.query("INSERT INTO content.catalog_item(id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [it.id]);
      const cur = await c.query<{ id: string; version: number; content_hash: string; active: boolean }>(
        "SELECT id, version, content_hash, active FROM content.catalog_version WHERE item_id = $1 ORDER BY version DESC LIMIT 1",
        [it.id],
      );
      const last = cur.rows[0];
      if (last && last.content_hash === hash) {
        if (!last.active) await c.query("UPDATE content.catalog_version SET active = true WHERE id = $1", [last.id]);
        report.unchanged.push(it.id);
        continue;
      }
      await c.query("UPDATE content.catalog_version SET active = false WHERE item_id = $1 AND active", [it.id]);
      await c.query(
        `INSERT INTO content.catalog_version
           (item_id, version, answer, aliases, category, difficulty, image_sha256, source_author, source_license, source_url, source_notes, content_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [it.id, (last?.version ?? 0) + 1, it.answer, it.aliases, it.category, it.difficulty, img.sha, it.source.author, it.source.license, it.source.url ?? null, it.source.notes ?? null, hash],
      );
      report.created.push(it.id);
    }
    if (opts.deactivateMissing) {
      const r = await c.query<{ item_id: string }>(
        "UPDATE content.catalog_version SET active = false WHERE active AND NOT (item_id = ANY($1)) RETURNING item_id",
        [[...incoming]],
      );
      report.deactivated = r.rows.map((x) => x.item_id);
    }
  }).catch((e) => {
    if (e.report) report.errors.push(...e.report);
    else throw e;
  });
  return report;
}
