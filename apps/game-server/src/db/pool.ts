import pg from "pg";

export type Db = pg.Pool;

export function createDb(url: string): Db {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  pool.on("error", (e) => console.error("[db] error inesperado en conexión inactiva", e));
  return pool;
}

export async function tx<T>(db: Db, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
