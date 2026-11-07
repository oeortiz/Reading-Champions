import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { seed } from "../seed/seed.ts";
import { completenessIssues } from "../src/services/readings.ts";
import { createTestApp, type Client } from "./app.ts";
import { createTestDb, type TestDb } from "./db.ts";
import { ADMIN, buildReading, ensureAdmin, loginAdmin } from "./fixtures.ts";

let db: TestDb;
let client: () => Client;
let admin: Client;
beforeAll(async () => {
  ({ db, client } = await createTestApp());
  admin = await loginAdmin(client(), db.sql);
});
afterAll(() => db.drop());

describe("POST /api/admin/session", () => {
  test("credenciales validas abren sesion de admin", async () => {
    const c = client();
    await ensureAdmin(db.sql);
    expect((await c.post("/api/admin/session", ADMIN)).status).toBe(200);
    expect((await c.get("/api/admin/me")).status).toBe(200);
  });

  test("credenciales invalidas: mismo mensaje generico para usuario o contrasena", async () => {
    const badPassword = await client().post("/api/admin/session", { username: ADMIN.username, password: "x" });
    const badUser = await client().post("/api/admin/session", { username: "nadie", password: ADMIN.password });
    expect(badPassword.status).toBe(401);
    expect(badUser.status).toBe(401);
    expect(badPassword.body.error).toBe(badUser.body.error);
  });

  test("con sesion de participante las rutas de admin responden 401", async () => {
    const c = client();
    await c.post("/api/participants/session", { documentNumber: "P-1", fullName: "Pepa" });
    expect((await c.get("/api/admin/readings")).status).toBe(401);
  });

  test("la contrasena se guarda como hash", async () => {
    const [row] = await db.sql`SELECT password_hash FROM admins WHERE username = ${ADMIN.username}`;
    expect(row.password_hash).not.toBe(ADMIN.password);
    expect(row.password_hash).toStartWith("$argon2");
  });
});

describe("lecturas", () => {
  test("crear, editar y listar; se crean inactivas", async () => {
    const created = await admin.post("/api/admin/readings", { title: "Mar", content: "El mar es azul." });
    expect(created.status).toBe(201);
    expect(created.body.isActive).toBe(false);

    const edited = await admin.put(`/api/admin/readings/${created.body.id}`, {
      title: "El mar",
      content: "El mar es muy azul.",
      position: 50,
    });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ title: "El mar", content: "El mar es muy azul.", position: 50 });

    const list = await admin.get("/api/admin/readings");
    expect(list.body.find((r: { id: number }) => r.id === created.body.id)).toMatchObject({
      title: "El mar",
      isActive: false,
      position: 50,
    });
  });

  test("titulo o texto vacio se rechaza", async () => {
    expect((await admin.post("/api/admin/readings", { title: " ", content: "x" })).status).toBe(400);
  });
});

describe("palabras objetivo", () => {
  let readingId: number;
  beforeAll(async () => {
    const res = await admin.post("/api/admin/readings", {
      title: "Banco",
      content: "Quiso desbancar al Banco. Fui al banco del parque y vi magma.",
    });
    readingId = res.body.id;
  });

  test("se guardan los offsets de la primera aparicion de palabra completa", async () => {
    const res = await admin.post(`/api/admin/readings/${readingId}/target-words`, { word: "banco" });
    expect(res.status).toBe(201);
    const word = res.body.words.find((w: { word: string }) => w.word === "banco");
    const content: string = res.body.content;
    expect(content.slice(word.start, word.end)).toBe("Banco");
    expect(word.start).toBe(content.indexOf("Banco"));
  });

  test("palabra ausente se rechaza", async () => {
    const res = await admin.post(`/api/admin/readings/${readingId}/target-words`, { word: "volcán" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("volcán");
  });

  test("palabra duplicada (sin distinguir mayusculas) se rechaza", async () => {
    await admin.post(`/api/admin/readings/${readingId}/target-words`, { word: "magma" });
    const res = await admin.post(`/api/admin/readings/${readingId}/target-words`, { word: "Magma" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("ya es una palabra objetivo");
  });

  test("al cambiar el texto se recalculan los offsets", async () => {
    const res = await admin.put(`/api/admin/readings/${readingId}`, {
      title: "Banco",
      content: "Hay magma. Fui al banco del parque.",
    });
    expect(res.status).toBe(200);
    for (const w of res.body.words) expect(res.body.content.slice(w.start, w.end).toLowerCase()).toBe(w.word);
  });

  test("un texto nuevo sin alguna palabra objetivo se rechaza", async () => {
    const res = await admin.put(`/api/admin/readings/${readingId}`, { title: "Banco", content: "Fui al banco." });
    expect(res.status).toBe(400);
    expect(res.body.issues).toEqual(['"magma" ya no aparece en el texto.']);
  });
});

describe("ayudas y opciones", () => {
  let wordId: number;
  beforeAll(async () => {
    const r = await admin.post("/api/admin/readings", { title: "Opciones", content: "Una erupción enorme." });
    const w = await admin.post(`/api/admin/readings/${r.body.id}/target-words`, { word: "erupción" });
    wordId = w.body.words[0].id;
  });

  const put = (options: { text: string; isCorrect: boolean }[]) =>
    admin.put(`/api/admin/target-words/${wordId}/options`, { options });

  test("sin opcion correcta se rechaza", async () => {
    expect((await put([{ text: "a", isCorrect: false }, { text: "b", isCorrect: false }])).status).toBe(400);
  });

  test("dos opciones correctas se rechaza", async () => {
    expect((await put([{ text: "a", isCorrect: true }, { text: "b", isCorrect: true }])).status).toBe(400);
  });

  test("menos de 2 o mas de 6 opciones se rechaza", async () => {
    expect((await put([{ text: "a", isCorrect: true }])).status).toBe(400);
    const seven = Array.from({ length: 7 }, (_, i) => ({ text: `o${i}`, isCorrect: i === 0 }));
    expect((await put(seven)).status).toBe(400);
  });

  test("opciones validas se guardan", async () => {
    const res = await put([{ text: "Salida de lava", isCorrect: true }, { text: "Lluvia", isCorrect: false }]);
    expect(res.status).toBe(200);
    expect(res.body.words[0].options.map((o: { text: string }) => o.text)).toEqual(["Salida de lava", "Lluvia"]);
  });

  test("las cuatro ayudas se guardan y un texto vacio deja la palabra incompleta", async () => {
    const res = await admin.put(`/api/admin/target-words/${wordId}/hints`, {
      hints: { 1: "ex- + rumpere", 2: "contexto", 3: "estallido", 4: "" },
    });
    expect(res.status).toBe(200);
    expect(res.body.words[0].hints).toEqual({ 1: "ex- + rumpere", 2: "contexto", 3: "estallido", 4: null });
    expect(res.body.issues).toEqual(['"erupción": falta la ayuda de Léxico.']);
  });
});

describe("activar y desactivar", () => {
  test("activar una lectura con una palabra sin Lexico se rechaza e indica la palabra", async () => {
    const reading = await buildReading(admin, { content: "El magma sube.", words: [{ word: "magma" }], activate: false });
    await admin.put(`/api/admin/target-words/${reading.words[0].id}/hints`, { hints: { 4: "" } });
    const res = await admin.post(`/api/admin/readings/${reading.id}/activate`);
    expect(res.status).toBe(400);
    expect(res.body.issues).toEqual(['"magma": falta la ayuda de Léxico.']);
  });

  test("activar una lectura sin palabras se rechaza", async () => {
    const r = await admin.post("/api/admin/readings", { title: "Vacía", content: "Nada aquí." });
    const res = await admin.post(`/api/admin/readings/${r.body.id}/activate`);
    expect(res.status).toBe(400);
    expect(res.body.issues).toEqual(["La lectura no tiene palabras objetivo."]);
  });

  test("desactivar deja de ofrecerla y conserva los intentos", async () => {
    const reading = await buildReading(admin, { content: "Un lago sereno.", words: [{ word: "sereno" }] });
    const p = client();
    await p.post("/api/participants/session", { documentNumber: "D-1", fullName: "Dora" });
    const current = await p.get("/api/assessment/current");
    expect(current.body.status).toBe("in_progress");

    const res = await admin.post(`/api/admin/readings/${reading.id}/deactivate`);
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
    const [{ count }] = await db.sql`SELECT count(*)::int AS count FROM reading_attempts WHERE reading_id = ${reading.id}`;
    expect(count).toBe(1);
    const after = await p.get("/api/assessment/current");
    expect(after.body.reading?.title).not.toBe(reading.title);
  });
});

describe("contenido evaluado protegido", () => {
  test("con intentos registrados no se puede cambiar texto, palabras ni opciones", async () => {
    const reading = await buildReading(admin, { title: "Protegida", content: "Un río caudaloso.", words: [{ word: "caudaloso" }] });
    // Un participante ve la lectura: queda registrado un intento
    await db.sql`
      INSERT INTO participants (document_number, full_name) VALUES ('X-9', 'Xavi') ON CONFLICT DO NOTHING`;
    const [p] = await db.sql`SELECT id FROM participants WHERE document_number = 'X-9'`;
    await db.sql`
      INSERT INTO reading_attempts (participant_id, reading_id, round, attempt_number) VALUES (${p.id}, ${reading.id}, 1, 1)`;
    await admin.post(`/api/admin/readings/${reading.id}/deactivate`);

    const text = await admin.put(`/api/admin/readings/${reading.id}`, { title: "Protegida", content: "Un río muy caudaloso." });
    expect(text.status).toBe(409);
    expect(text.body.error).toContain("ya tiene resultados");

    const word = await admin.post(`/api/admin/readings/${reading.id}/target-words`, { word: "río" });
    expect(word.status).toBe(409);
    const options = await admin.put(`/api/admin/target-words/${reading.words[0].id}/options`, {
      options: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: false }],
    });
    expect(options.status).toBe(409);

    const title = await admin.put(`/api/admin/readings/${reading.id}`, { title: "Nuevo título", content: "Un río caudaloso." });
    expect(title.status).toBe(200);
  });
});

describe("seed", () => {
  test("sobre una base vacia deja dos lecturas activas y completas, y se puede repetir", async () => {
    const fresh = await createTestDb();
    try {
      expect((await seed(fresh.sql, { username: "a", password: "b" })).created).toHaveLength(2);
      expect((await seed(fresh.sql, { username: "a", password: "b" })).created).toHaveLength(0);
      const active = await fresh.sql`SELECT id FROM readings WHERE is_active`;
      expect(active).toHaveLength(2);
      const { getReading } = await import("../src/services/readings.ts");
      for (const r of active) {
        const detail = await getReading(fresh.sql, r.id);
        expect(detail.words.length).toBeGreaterThan(0);
        expect(completenessIssues(detail)).toEqual([]);
      }
    } finally {
      await fresh.drop();
    }
  });
});
