/**
 * Importa y valida un paquete de contenido en PostgreSQL.
 *   npm run content:import -- content/demo            importa
 *   npm run content:import -- content/demo --check    solo valida (no requiere BD)
 *   ... --deactivate-missing                          desactiva lo que no esté en el paquete
 */
import path from "node:path";
import { createDb } from "../src/db/pool";
import { migrate } from "../src/db/migrate";
import { importPack } from "../src/content/import";

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
if (!dir) { console.error("Uso: content:import -- <carpeta> [--check] [--deactivate-missing]"); process.exit(2); }
const check = args.includes("--check");
const url = process.env.DATABASE_URL;
if (!check && !url) { console.error("DATABASE_URL es obligatorio para importar"); process.exit(2); }
const db = check ? null : createDb(url!);
if (db) await migrate(db);
const r = await importPack(db, path.resolve(dir), { dryRun: check, deactivateMissing: args.includes("--deactivate-missing") });
if (r.errors.length) {
  console.error(`✗ ${r.errors.length} errores en el paquete "${r.pack}":`);
  for (const e of r.errors) console.error("  - " + e);
  process.exitCode = 1;
} else if (check) console.log(`✓ Paquete "${r.pack}" válido`);
else console.log(`✓ "${r.pack}": ${r.created.length} versiones nuevas, ${r.unchanged.length} sin cambios, ${r.deactivated.length} desactivados`);
await db?.end();
