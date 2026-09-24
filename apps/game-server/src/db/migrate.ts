import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tx, type Db } from "./pool";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../migrations");

/** Aplica en orden las migraciones pendientes, cada una en su transacción, con bloqueo exclusivo. */
export async function migrate(db: Db, log = console.log): Promise<string[]> {
  const files = (await readdir(DIR)).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
  return tx(db, async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(727201)");
    await c.query("CREATE TABLE IF NOT EXISTS public.schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    const done = new Set((await c.query("SELECT version FROM public.schema_migrations")).rows.map((r) => r.version as string));
    const applied: string[] = [];
    for (const f of files) {
      if (done.has(f)) continue;
      await c.query(await readFile(path.join(DIR, f), "utf8"));
      await c.query("INSERT INTO public.schema_migrations(version) VALUES ($1)", [f]);
      applied.push(f);
      log(`[db] migración aplicada: ${f}`);
    }
    return applied;
  });
}
