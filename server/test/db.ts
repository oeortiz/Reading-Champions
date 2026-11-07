import { createSql, type Sql } from "../src/db/client.ts";
import { runMigrations } from "../src/db/migrate.ts";

export type TestDb = { sql: Sql; url: string; drop: () => Promise<void> };

/** Crea una base temporal vacia en el mismo Postgres de DATABASE_URL. */
export async function createEmptyDb(): Promise<TestDb> {
  const baseUrl = process.env.DATABASE_URL!;
  const name = `rc_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = createSql(baseUrl, { max: 1 });
  await admin.unsafe(`CREATE DATABASE ${name}`);
  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  const sql = createSql(url.toString());
  return {
    sql,
    url: url.toString(),
    drop: async () => {
      await sql.end();
      await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await admin.end();
    },
  };
}

/** Base temporal con todas las migraciones aplicadas. */
export async function createTestDb(): Promise<TestDb> {
  const db = await createEmptyDb();
  await runMigrations(db.sql);
  return db;
}

/** Ejecuta una consulta que debe fallar y devuelve el mensaje del error. */
export async function errorOf(query: PromiseLike<unknown>): Promise<string> {
  try {
    await query;
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("Se esperaba que la consulta fallara");
}
