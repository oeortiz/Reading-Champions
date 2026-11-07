import { expect } from "bun:test";
import type { Sql } from "../src/db/client.ts";
import type { Client } from "./app.ts";

export const ADMIN = { username: "admin", password: "clave-de-pruebas" };

export async function ensureAdmin(sql: Sql) {
  const hash = await Bun.password.hash(ADMIN.password);
  await sql`
    INSERT INTO admins (username, password_hash) VALUES (${ADMIN.username}, ${hash})
    ON CONFLICT (username) DO NOTHING`;
}

export async function loginAdmin(client: Client, sql: Sql) {
  await ensureAdmin(sql);
  const res = await client.post("/api/admin/session", ADMIN);
  expect(res.status).toBe(200);
  return client;
}

export type WordSpec = { word: string; options?: string[]; correct?: number };

/** Crea por la API una lectura completa (4 ayudas y opciones por palabra) y opcionalmente la activa. */
export async function buildReading(
  admin: Client,
  spec: { title?: string; content: string; words: WordSpec[]; activate?: boolean },
) {
  const created = await admin.post("/api/admin/readings", { title: spec.title ?? "Lectura", content: spec.content });
  expect(created.status).toBe(201);
  const readingId: number = created.body.id;

  for (const w of spec.words) {
    const added = await admin.post(`/api/admin/readings/${readingId}/target-words`, { word: w.word });
    expect(added.status).toBe(201);
    const wordId = added.body.words.find((x: { word: string }) => x.word === w.word).id;
    const hints = await admin.put(`/api/admin/target-words/${wordId}/hints`, {
      hints: { 1: `radicación de ${w.word}`, 2: `contexto de ${w.word}`, 3: `sinonimia de ${w.word}`, 4: `léxico de ${w.word}` },
    });
    expect(hints.status).toBe(200);
    const texts = w.options ?? [`${w.word} correcta`, `${w.word} incorrecta 1`, `${w.word} incorrecta 2`];
    const options = await admin.put(`/api/admin/target-words/${wordId}/options`, {
      options: texts.map((text, i) => ({ text, isCorrect: i === (w.correct ?? 0) })),
    });
    expect(options.status).toBe(200);
  }

  if (spec.activate !== false) {
    const res = await admin.post(`/api/admin/readings/${readingId}/activate`);
    expect(res.status).toBe(200);
  }
  return (await admin.get(`/api/admin/readings/${readingId}`)).body;
}
