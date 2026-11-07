import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { runMigrations } from "../src/db/migrate.ts";
import { createEmptyDb, createTestDb, errorOf, type TestDb } from "./db.ts";

describe("runMigrations", () => {
  let db: TestDb;
  beforeAll(async () => (db = await createEmptyDb()));
  afterAll(() => db.drop());

  test("aplicar dos veces no repite migraciones", async () => {
    const first = await runMigrations(db.sql);
    expect(first).toContain("001_init.sql");
    const second = await runMigrations(db.sql);
    expect(second).toEqual([]);
    const [{ count }] = await db.sql`SELECT count(*)::int AS count FROM schema_migrations`;
    expect(count).toBe(first.length);
  });
});

describe("restricciones del esquema", () => {
  let db: TestDb;
  let wordId: number;
  beforeAll(async () => {
    db = await createTestDb();
    const [r] = await db.sql`INSERT INTO readings (title, content) VALUES ('t', 'el magma') RETURNING id`;
    const [w] = await db.sql`
      INSERT INTO target_words (reading_id, word, start_offset, end_offset)
      VALUES (${r.id}, 'magma', 3, 8) RETURNING id`;
    wordId = w.id;
  });
  afterAll(() => db.drop());

  test("rechaza dos opciones correctas en la misma palabra", async () => {
    await db.sql`INSERT INTO answer_options (target_word_id, text, is_correct) VALUES (${wordId}, 'a', true)`;
    expect(await errorOf(db.sql`INSERT INTO answer_options (target_word_id, text, is_correct) VALUES (${wordId}, 'b', true)`)).toMatch(/answer_options_one_correct/);
  });

  test("rechaza una ayuda de nivel 5", async () => {
    expect(await errorOf(db.sql`INSERT INTO hints (target_word_id, level, content) VALUES (${wordId}, 5, 'x')`)).toMatch(/check/i);
  });

  test("rechaza un hint_level fuera de 0..4", async () => {
    const [p] = await db.sql`INSERT INTO participants (document_number, full_name) VALUES ('h1', 'H') RETURNING id`;
    const [r] = await db.sql`SELECT reading_id FROM target_words WHERE id = ${wordId}`;
    const [a] = await db.sql`
      INSERT INTO reading_attempts (participant_id, reading_id, round, attempt_number)
      VALUES (${p.id}, ${r.reading_id}, 1, 1) RETURNING id`;
    expect(await errorOf(db.sql`INSERT INTO word_responses (reading_attempt_id, target_word_id, hint_level) VALUES (${a.id}, ${wordId}, 5)`)).toMatch(/check/i);
  });

  test("rechaza un documento duplicado", async () => {
    await db.sql`INSERT INTO participants (document_number, full_name) VALUES ('123', 'Ana')`;
    expect(await errorOf(db.sql`INSERT INTO participants (document_number, full_name) VALUES ('123', 'Otra')`)).toMatch(/participants_document_number_key/);
  });
});
