import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createTestApp, type Client } from "./app.ts";
import type { TestDb } from "./db.ts";
import { buildReading, loginAdmin } from "./fixtures.ts";

let db: TestDb;
let client: () => Client;
let readingA: { id: number; title: string };
let readingB: { id: number; title: string };

// Lectura A: 3 palabras (maximo 300). Lectura B: 2 palabras (maximo 200). Total 500.
beforeAll(async () => {
  ({ db, client } = await createTestApp());
  const admin = await loginAdmin(client(), db.sql);
  readingA = await buildReading(admin, {
    title: "A",
    content: "El Banco abrió. El magma sube y la ceniza cae. Fui al banco otra vez.",
    words: [{ word: "ceniza" }, { word: "banco" }, { word: "magma" }],
  });
  readingB = await buildReading(admin, {
    title: "B",
    content: "Un río caudaloso cruza el valle fértil.",
    words: [{ word: "fértil" }, { word: "caudaloso" }],
  });
});
afterAll(() => db.drop());

let docCounter = 0;
async function participant() {
  const c = client();
  const res = await c.post("/api/participants/session", { documentNumber: `DOC-${++docCounter}`, fullName: "Lector" });
  expect(res.status).toBe(200);
  return c;
}

async function correctOption(optionIds: number[]) {
  const [row] = await db.sql`SELECT id FROM answer_options WHERE id IN ${db.sql(optionIds)} AND is_correct`;
  return row.id as number;
}

/** Responde la palabra actual tras pedir `hints` ayudas. */
async function play(c: Client, hints: number, correct: boolean) {
  const current = await c.get("/api/assessment/current");
  expect(current.status).toBe(200);
  for (let level = 1; level <= hints; level++) {
    expect((await c.post("/api/assessment/hint", { level })).status).toBe(200);
  }
  const ids = current.body.word.options.map((o: { id: number }) => o.id);
  const right = await correctOption(ids);
  const optionId = correct ? right : ids.find((id: number) => id !== right);
  const res = await c.post("/api/assessment/answer", { optionId });
  expect(res.status).toBe(200);
  return res.body;
}

/** Juega una ronda completa: A con [hints, correcto] por palabra, luego B. */
async function playRound(c: Client, a: [number, boolean][], b: [number, boolean][]) {
  const results = [];
  for (const [h, ok] of [...a, ...b]) results.push(await play(c, h, ok));
  return results;
}

describe("presentacion de preguntas", () => {
  test("una pregunta a la vez, en orden de aparicion, solo la primera aparicion", async () => {
    const c = await participant();
    const first = await c.get("/api/assessment/current");
    expect(first.body).toMatchObject({ status: "in_progress", reading: { title: "A", number: 1, total: 2 } });
    expect(first.body.word).toMatchObject({ word: "banco", number: 1, total: 3, hintLevel: 0, hints: [] });
    const content: string = first.body.reading.content;
    expect(content.slice(first.body.word.start, first.body.word.end)).toBe("Banco");
    expect(first.body.word.start).toBe(content.indexOf("Banco"));

    await play(c, 0, true);
    const second = await c.get("/api/assessment/current");
    expect(second.body.word).toMatchObject({ word: "magma", number: 2 });
  });

  test("recargar no cambia presented_at", async () => {
    const c = await participant();
    await c.get("/api/assessment/current");
    const [before] = await db.sql`
      SELECT wr.id, wr.presented_at FROM word_responses wr
        JOIN reading_attempts a ON a.id = wr.reading_attempt_id
        JOIN participants p ON p.id = a.participant_id WHERE p.document_number = ${`DOC-${docCounter}`}`;
    await Bun.sleep(20);
    await c.get("/api/assessment/current");
    const [after] = await db.sql`SELECT presented_at FROM word_responses WHERE id = ${before.id}`;
    expect(after.presented_at.getTime()).toBe(before.presented_at.getTime());
  });

  test("la respuesta no expone la opcion correcta ni ayudas no pedidas", async () => {
    const c = await participant();
    const res = await c.get("/api/assessment/current");
    expect(res.raw).not.toMatch(/is_?correct/i);
    expect(res.raw).not.toContain("radicación de banco");
    expect(res.raw).not.toContain("léxico de banco");
    expect(Object.keys(res.body.word.options[0]).sort()).toEqual(["id", "text"]);

    await c.post("/api/assessment/hint", { level: 1 });
    const withHint = await c.get("/api/assessment/current");
    expect(withHint.raw).toContain("radicación de banco");
    expect(withHint.raw).not.toContain("contexto de banco");
  });
});

describe("ayudas", () => {
  test("orden Radicacion, Contexto, Sinonimia, Lexico y 409 despues del Lexico", async () => {
    const c = await participant();
    await c.get("/api/assessment/current");
    const contents = [];
    for (let level = 1; level <= 4; level++) {
      const res = await c.post("/api/assessment/hint", { level });
      expect(res.status).toBe(200);
      expect(res.body.level).toBe(level);
      contents.push(res.body.content);
    }
    expect(contents).toEqual(["radicación de banco", "contexto de banco", "sinonimia de banco", "léxico de banco"]);
    const extra = await c.post("/api/assessment/hint", { level: 5 });
    expect(extra.status).toBe(409);
    const state = await c.get("/api/assessment/current");
    expect(state.body.word.hintLevel).toBe(4);
    expect(state.body.word.nextHint).toBeNull();
  });

  test("al participante no se le dice el tipo ni el costo de la ayuda", async () => {
    const c = await participant();
    await c.get("/api/assessment/current");
    const hint = await c.post("/api/assessment/hint", { level: 1 });
    const state = await c.get("/api/assessment/current");
    expect(Object.keys(hint.body).sort()).toEqual(["content", "hintLevel", "level", "nextHint"]);
    expect(hint.body.nextHint).toEqual({ level: 2 });
    expect(state.body.word.hints).toEqual([{ level: 1, content: "radicación de banco" }]);
    expect(state.body.word.nextHint).toEqual({ level: 2 });
    for (const raw of [hint.raw, state.raw]) expect(raw).not.toMatch(/Radicación|Contexto|Sinonimia|Léxico|"cost"/);
  });

  test("no se puede saltar una ayuda", async () => {
    const c = await participant();
    await c.get("/api/assessment/current");
    expect((await c.post("/api/assessment/hint", { level: 3 })).status).toBe(409);
  });

  test("dos solicitudes concurrentes solo avanzan un nivel", async () => {
    const c = await participant();
    await c.get("/api/assessment/current");
    const [r1, r2] = await Promise.all([
      c.post("/api/assessment/hint", { level: 1 }),
      c.post("/api/assessment/hint", { level: 1 }),
    ]);
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect(r1.body.content).toBe(r2.body.content);
    const rows = await db.sql`
      SELECT wr.hint_level, (SELECT count(*)::int FROM hint_requests hr WHERE hr.word_response_id = wr.id) AS requests
        FROM word_responses wr JOIN reading_attempts a ON a.id = wr.reading_attempt_id
        JOIN participants p ON p.id = a.participant_id WHERE p.document_number = ${`DOC-${docCounter}`}`;
    expect([...rows]).toEqual([{ hint_level: 1, requests: 1 }]);
  });

  test("tiempos registrados por el servidor en orden", async () => {
    const c = await participant();
    await c.get("/api/assessment/current");
    await c.post("/api/assessment/hint", { level: 1 });
    await play(c, 0, true);
    const [row] = await db.sql`
      SELECT wr.presented_at, hr.delivered_at, wr.answered_at
        FROM word_responses wr JOIN hint_requests hr ON hr.word_response_id = wr.id
        JOIN reading_attempts a ON a.id = wr.reading_attempt_id
        JOIN participants p ON p.id = a.participant_id WHERE p.document_number = ${`DOC-${docCounter}`}`;
    expect(row.presented_at.getTime()).toBeLessThanOrEqual(row.delivered_at.getTime());
    expect(row.delivered_at.getTime()).toBeLessThanOrEqual(row.answered_at.getTime());
  });
});

describe("respuestas y puntaje", () => {
  test("puntaje segun ayudas: 100, 70 y 20", async () => {
    const c = await participant();
    expect((await play(c, 0, true)).points).toBe(100);
    expect((await play(c, 2, true)).points).toBe(70);
    expect((await play(c, 4, true)).points).toBe(20);
  });

  test("respuesta incorrecta: 0 puntos, Lexico y opcion correcta; el Lexico no se registra como ayuda", async () => {
    const c = await participant();
    const current = await c.get("/api/assessment/current");
    const result = await play(c, 0, false);
    expect(result).toMatchObject({ isCorrect: false, points: 0, lexico: "léxico de banco", next: "word" });
    expect(result.correctOptionId).toBe(await correctOption(current.body.word.options.map((o: { id: number }) => o.id)));
    const [{ count }] = await db.sql`
      SELECT count(*)::int AS count FROM hint_requests hr
        JOIN word_responses wr ON wr.id = hr.word_response_id
        JOIN reading_attempts a ON a.id = wr.reading_attempt_id
        JOIN participants p ON p.id = a.participant_id WHERE p.document_number = ${`DOC-${docCounter}`}`;
    expect(count).toBe(0);
  });

  test("acierto no devuelve Lexico", async () => {
    const c = await participant();
    expect(await play(c, 0, true)).toMatchObject({ isCorrect: true, lexico: null });
  });

  test("se ignoran score y hintLevel enviados por el cliente", async () => {
    const c = await participant();
    const current = await c.get("/api/assessment/current");
    await c.post("/api/assessment/hint", { level: 1 });
    const right = await correctOption(current.body.word.options.map((o: { id: number }) => o.id));
    const res = await c.post("/api/assessment/answer", { optionId: right, score: 100, points: 100, hintLevel: 0 });
    expect(res.body.points).toBe(85);
  });

  test("una palabra cerrada no acepta otra respuesta", async () => {
    const c = await participant();
    const current = await c.get("/api/assessment/current");
    const ids = current.body.word.options.map((o: { id: number }) => o.id);
    const right = await correctOption(ids);
    const wrong = ids.find((id: number) => id !== right);
    await c.post("/api/assessment/answer", { optionId: wrong });
    // Antes de presentar la siguiente palabra no hay pregunta abierta
    expect((await c.post("/api/assessment/answer", { optionId: right })).status).toBe(409);
    // Con la siguiente ya presentada, la opcion de la palabra anterior no vale
    await c.get("/api/assessment/current");
    expect((await c.post("/api/assessment/answer", { optionId: right })).status).toBe(400);
    const [row] = await db.sql`SELECT points FROM word_responses WHERE selected_option_id = ${wrong}`;
    expect(row.points).toBe(0);
  });

  test("al terminar la lectura el intento se cierra con score y max_score", async () => {
    const c = await participant();
    const results = await playRound(c, [[0, true], [1, true], [0, false]], []);
    expect(results.map((r) => r.next)).toEqual(["word", "word", "reading"]);
    const [attempt] = await db.sql`
      SELECT a.status, a.score, a.max_score FROM reading_attempts a
        JOIN participants p ON p.id = a.participant_id
       WHERE p.document_number = ${`DOC-${docCounter}`} AND a.reading_id = ${readingA.id}`;
    expect(attempt).toEqual({ status: "completed", score: 185, max_score: 300 });
  });

  test("el intento se retoma con las ayudas ya reveladas al volver a ingresar", async () => {
    const c = await participant();
    await c.get("/api/assessment/current");
    await c.post("/api/assessment/hint", { level: 1 });
    await c.post("/api/assessment/hint", { level: 2 });

    const again = client();
    await again.post("/api/participants/session", { documentNumber: `DOC-${docCounter}`, fullName: "Otro nombre" });
    const state = await again.get("/api/assessment/current");
    expect(state.body.participant.fullName).toBe("Lector");
    expect(state.body.word).toMatchObject({ word: "banco", hintLevel: 2 });
    expect(state.body.word.hints.map((h: { level: number }) => h.level)).toEqual([1, 2]);
    expect((await play(again, 0, true)).points).toBe(70);
  });
});

describe("rondas y resumen", () => {
  test("lectura 1 -> lectura 2 -> resumen -> repetir", async () => {
    const c = await participant();
    expect((await c.get("/api/assessment/summary")).status).toBe(409);

    const results = await playRound(c, [[0, true], [0, true], [0, true]], [[0, true], [0, true]]);
    expect(results.at(2)!.next).toBe("reading");
    expect(results.at(-1)!.next).toBe("summary");
    expect((await c.get("/api/assessment/current")).body.status).toBe("completed");

    // Al volver a ingresar va directo al resumen
    const again = client();
    const login = await again.post("/api/participants/session", { documentNumber: `DOC-${docCounter}`, fullName: "x" });
    expect(login.body.next).toBe("summary");

    expect((await c.post("/api/assessment/repeat")).status).toBe(200);
    const repeat = await c.get("/api/assessment/current");
    expect(repeat.body).toMatchObject({ status: "in_progress", round: 2, reading: { title: "A" } });
    // Repetir con lecturas pendientes no se permite
    expect((await c.post("/api/assessment/repeat")).status).toBe(409);

    const attempts = await db.sql`
      SELECT a.reading_id, a.round, a.attempt_number FROM reading_attempts a
        JOIN participants p ON p.id = a.participant_id
       WHERE p.document_number = ${`DOC-${docCounter}`} ORDER BY a.id`;
    expect(attempts.map((a) => [a.round, a.attempt_number])).toEqual([[1, 1], [1, 1], [2, 2]]);
  });

  test("resumen oficial y resumen de repeticion (340 frente a 410)", async () => {
    const c = await participant();
    // Ronda 1: A = 100 + 70 + 0 = 170; B = 100 + 70 = 170 -> 340 / 500
    await playRound(c, [[0, true], [2, true], [1, false]], [[0, true], [2, true]]);
    const official = await c.get("/api/assessment/summary");
    expect(official.status).toBe(200);
    expect(official.body).toMatchObject({
      isRepeat: false,
      score: 340,
      maxScore: 500,
      percent: 68,
      official: { score: 340, maxScore: 500, percent: 68 },
    });
    const usage = Object.fromEntries(official.body.hintUsage.map((u: { name: string; count: number }) => [u.name, u.count]));
    expect(usage).toEqual({ Radicación: 3, Contexto: 2, Sinonimia: 0, Léxico: 0 });
    const eff = Object.fromEntries(
      official.body.effectiveness.map((e: { name: string; correct: number; answered: number }) => [e.name, [e.correct, e.answered]]),
    );
    expect(eff).toEqual({ Radicación: [0, 1], Contexto: [2, 2], Sinonimia: [0, 0], Léxico: [0, 0] });
    expect(official.body.effectiveness.find((e: { name: string }) => e.name === "Sinonimia").effectiveness).toBeNull();

    // Ronda 2: A = 100 + 100 + 40 = 240; B = 100 + 70 = 170 -> 410 / 500
    await c.post("/api/assessment/repeat");
    expect((await c.get("/api/assessment/summary")).status).toBe(409);
    await playRound(c, [[0, true], [0, true], [3, true]], [[0, true], [2, true]]);
    const repeat = await c.get("/api/assessment/summary");
    expect(repeat.body).toMatchObject({
      isRepeat: true,
      round: 2,
      score: 410,
      maxScore: 500,
      official: { score: 340, maxScore: 500 },
    });

    const official1 = await db.sql`
      SELECT sum(a.score)::int AS score FROM reading_attempts a JOIN participants p ON p.id = a.participant_id
       WHERE p.document_number = ${`DOC-${docCounter}`} AND a.attempt_number = 1`;
    expect(official1[0].score).toBe(340);
  });

  test("sin pregunta abierta, pedir ayuda o responder devuelve 409", async () => {
    const c = await participant();
    await playRound(c, [[0, true], [0, true], [0, true]], [[0, true], [0, true]]);
    expect((await c.post("/api/assessment/hint", { level: 1 })).status).toBe(409);
    expect((await c.post("/api/assessment/answer", { optionId: 1 })).status).toBe(409);
  });
});
