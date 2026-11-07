import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createSql, type Sql } from "./client.ts";

export const MIGRATIONS_DIR = join(import.meta.dir, "../../migrations");

/** Aplica en orden los .sql pendientes, cada uno en su propia transaccion. Devuelve los aplicados. */
export async function runMigrations(sql: Sql, dir = MIGRATIONS_DIR): Promise<string[]> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  const done = new Set((await sql<{ name: string }[]>`SELECT name FROM schema_migrations`).map((r) => r.name));
  const pending = readdirSync(dir)
    .filter((f) => f.endsWith(".sql") && !done.has(f))
    .sort();

  for (const name of pending) {
    const body = readFileSync(join(dir, name), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`INSERT INTO schema_migrations (name) VALUES (${name})`;
    });
  }
  return pending;
}

if (import.meta.main) {
  const sql = createSql(process.env.DATABASE_URL!);
  const applied = await runMigrations(sql);
  console.log(applied.length ? `Migraciones aplicadas: ${applied.join(", ")}` : "Sin migraciones pendientes");
  await sql.end();
}
