/**
 * Crea una base de datos PostgreSQL REAL y aislada para cada archivo de prueba,
 * aplica migraciones e importa el paquete ficticio. Requiere un servidor PostgreSQL:
 * TEST_DATABASE_URL (por defecto postgres://postgres@localhost:5433/postgres).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { createDb } from "../src/db/pool";
import { migrate } from "../src/db/migrate";
import { importPack } from "../src/content/import";

export const DEMO_PACK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../content/demo");

export async function createTestDb(seed = true) {
  const admin = process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5433/postgres";
  const name = `logos_test_${process.pid}_${Date.now()}`;
  const a = new pg.Client({ connectionString: admin });
  await a.connect();
  await a.query(`CREATE DATABASE ${name}`);
  await a.end();
  const u = new URL(admin);
  u.pathname = `/${name}`;
  const url = u.toString();
  const db = createDb(url);
  await migrate(db, () => {});
  if (seed) {
    const r = await importPack(db, DEMO_PACK);
    if (r.errors.length) throw new Error(r.errors.join("\n"));
  }
  return {
    url,
    db,
    async drop() {
      await db.end().catch(() => {});
      const c = new pg.Client({ connectionString: admin });
      await c.connect();
      await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await c.end();
    },
  };
}
