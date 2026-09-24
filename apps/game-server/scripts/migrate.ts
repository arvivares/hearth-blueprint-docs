import { createDb } from "../src/db/pool";
import { migrate } from "../src/db/migrate";
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL es obligatorio"); process.exit(2); }
const db = createDb(url);
const applied = await migrate(db);
console.log(applied.length ? `${applied.length} migraciones aplicadas` : "Base de datos al día");
await db.end();
