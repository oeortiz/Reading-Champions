import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { RETIRED_TITLES, SEED_READINGS } from "../seed/readings.ts";
import { seed } from "../seed/seed.ts";
import { detectImageType } from "../src/domain/image-type.ts";
import { runMigrations } from "../src/db/migrate.ts";
import { createReading, getReading, normalizeContent } from "../src/services/readings.ts";
import { createTestApp, type Client } from "./app.ts";
import { createEmptyDb, createTestDb, type TestDb } from "./db.ts";
import { buildReading, loginAdmin } from "./fixtures.ts";

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(values.flatMap((v) => (typeof v === "string" ? [...v].map((ch) => ch.charCodeAt(0)) : [v])));
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, "IHDR");
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16, "JFIF");
const WEBP = bytes("RIFF", 0x24, 0, 0, 0, "WEBPVP8 ");
const SVG = bytes('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
const GIF = bytes("GIF89a", 1, 0, 1, 0);

let db: TestDb;
let client: () => Client;
let admin: Client;
beforeAll(async () => {
  ({ db, client } = await createTestApp());
  admin = await loginAdmin(client(), db.sql);
});
afterAll(() => db.drop());

describe("varios parrafos", () => {
  test("normaliza saltos de linea, espacios finales y lineas en blanco extra", () => {
    expect(normalizeContent("  Uno.  \r\n\r\n\r\n\r\nDos.\t\r\nsigue\r\n\r\nTres.  ")).toBe("Uno.\n\nDos.\nsigue\n\nTres.");
  });

  test("un texto de tres parrafos se guarda con lineas en blanco y los offsets apuntan a la palabra", async () => {
    const reading = await buildReading(admin, {
      title: "Párrafos",
      content: "Primer párrafo.\r\n\r\n\r\nEl segundo tiene la palabra ataraxia.\r\n\r\nTercero.",
      words: [{ word: "ataraxia" }],
      activate: false,
    });
    expect(reading.content).toBe("Primer párrafo.\n\nEl segundo tiene la palabra ataraxia.\n\nTercero.");
    const word = reading.words[0];
    expect(reading.content.slice(word.start, word.end)).toBe("ataraxia");
    expect(reading.content.split("\n\n")[1]).toContain("ataraxia");
  });
});

describe("tipo de imagen por bytes magicos", () => {
  test("reconoce PNG, JPEG y WebP", () => {
    expect(detectImageType(PNG)).toBe("image/png");
    expect(detectImageType(JPEG)).toBe("image/jpeg");
    expect(detectImageType(WEBP)).toBe("image/webp");
  });

  test("rechaza SVG, GIF, texto renombrado y archivos vacios", () => {
    expect(detectImageType(SVG)).toBeNull();
    expect(detectImageType(GIF)).toBeNull();
    expect(detectImageType(bytes("esto no es un png"))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
});

describe("migracion 002", () => {
  test("se aplica sobre una base con 001 y borrar la lectura borra su imagen", async () => {
    const fresh = await createEmptyDb();
    try {
      expect(await runMigrations(fresh.sql)).toEqual(["001_init.sql", "002_reading_images.sql"]);
      const r = await createReading(fresh.sql, { title: "x", content: "y" });
      await fresh.sql`
        INSERT INTO reading_images (reading_id, mime_type, data, alt_text) VALUES (${r.id}, 'image/png', ${PNG}, 'alt')`;
      await fresh.sql`DELETE FROM readings WHERE id = ${r.id}`;
      const [{ count }] = await fresh.sql`SELECT count(*)::int AS count FROM reading_images`;
      expect(count).toBe(0);
    } finally {
      await fresh.drop();
    }
  });
});

describe("imagen de la lectura (admin)", () => {
  let readingId: number;
  beforeAll(async () => {
    const r = await buildReading(admin, { title: "Con imagen", content: "Un espejo sereno.", words: [{ word: "sereno" }] });
    readingId = r.id;
  });

  const form = (file: Uint8Array<ArrayBuffer> | null, altText: string | null, name = "imagen.png") => {
    const f = new FormData();
    if (file) f.append("file", new File([file], name));
    if (altText !== null) f.append("altText", altText);
    return f;
  };
  const upload = (f: FormData, c = admin) => c.upload(`/api/admin/readings/${readingId}/image`, f);

  test("subir una imagen valida guarda imagen y texto alternativo", async () => {
    const res = await upload(form(JPEG, "Un espejo antiguo", "foto.jpg"));
    expect(res.status).toBe(200);
    expect(res.body.image).toMatchObject({ alt: "Un espejo antiguo" });
    expect(res.body.image.url).toMatch(new RegExp(`^/api/readings/${readingId}/image\\?v=\\d+$`));
  });

  test("formato no permitido: SVG, GIF y texto con extension .png", async () => {
    for (const [file, name] of [
      [SVG, "a.svg"],
      [GIF, "a.gif"],
      [bytes("hola"), "falso.png"],
    ] as const) {
      const res = await upload(form(file, "alt", name));
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("PNG, JPEG o WebP");
    }
  });

  test("mas de 1 MB se rechaza indicando el tamano maximo", async () => {
    const big = new Uint8Array(1024 * 1024 + 10);
    big.set(PNG);
    const res = await upload(form(big, "alt"));
    expect(res.status).toBeOneOf([400, 413]);
    expect(res.body.error).toContain("1 MB");
  });

  test("sin texto alternativo se rechaza", async () => {
    const res = await upload(form(PNG, "  "));
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("texto alternativo");
  });

  test("sin sesion de admin se rechaza", async () => {
    expect((await upload(form(PNG, "alt"), client())).status).toBe(401);
  });

  test("se puede reemplazar en una lectura activa con intentos y la URL cambia", async () => {
    const p = client();
    await p.post("/api/participants/session", { documentNumber: "IMG-1", fullName: "Iris" });
    const before = await p.get("/api/assessment/current");
    expect(before.body.reading.image.alt).toBe("Un espejo antiguo");

    await Bun.sleep(5);
    const res = await upload(form(PNG, "Un espejo nuevo"));
    expect(res.status).toBe(200);
    const after = await p.get("/api/assessment/current");
    expect(after.body.reading.image.alt).toBe("Un espejo nuevo");
    expect(after.body.reading.image.url).not.toBe(before.body.reading.image.url);
  });

  test("solo cambiar el texto alternativo sin archivo", async () => {
    const res = await upload(form(null, "Solo alt"));
    expect(res.status).toBe(200);
    expect(res.body.image.alt).toBe("Solo alt");
  });

  test("la imagen se sirve con cabeceras seguras y cache inmutable", async () => {
    const { body } = await admin.get(`/api/admin/readings/${readingId}`);
    const raw = await createTestAppFetch(body.image.url);
    expect(raw.status).toBe(200);
    expect(raw.headers.get("content-type")).toBe("image/png");
    expect(raw.headers.get("x-content-type-options")).toBe("nosniff");
    expect(raw.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(raw.headers.get("cache-control")).toContain("immutable");
    expect(new Uint8Array(await raw.arrayBuffer())).toEqual(PNG);
  });

  test("quitar la imagen deja la lectura sin imagen y el GET responde 404", async () => {
    const res = await admin.delete(`/api/admin/readings/${readingId}/image`);
    expect(res.status).toBe(200);
    expect(res.body.image).toBeNull();
    expect((await createTestAppFetch(`/api/readings/${readingId}/image`)).status).toBe(404);
  });

  test("sin archivo y sin imagen previa pide seleccionar una imagen", async () => {
    const res = await upload(form(null, "alt"));
    expect(res.status).toBe(400);
  });
});

describe("activacion sin imagen", () => {
  test("una lectura completa sin imagen se puede activar", async () => {
    const r = await buildReading(admin, { title: "Sin imagen", content: "Un día fértil.", words: [{ word: "fértil" }], activate: false });
    expect(r.image).toBeNull();
    const res = await admin.post(`/api/admin/readings/${r.id}/activate`);
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(true);
  });
});

describe("lecturas iniciales", () => {
  const ADMIN = { username: "a", password: "b" };

  test("actualiza su ilustracion SVG si cambio, pero nunca una imagen subida por el admin", async () => {
    const fresh = await createTestDb();
    try {
      await seed(fresh.sql, ADMIN);
      const [espejo] = await fresh.sql`SELECT id FROM readings WHERE title = 'El espejo de la integridad'`;
      const [bib] = await fresh.sql`SELECT id FROM readings WHERE title = 'La biblioteca del barrio'`;
      await fresh.sql`UPDATE reading_images SET data = ${bytes("<svg>vieja</svg>")} WHERE reading_id = ${espejo.id}`;
      await fresh.sql`UPDATE reading_images SET mime_type = 'image/png', data = ${PNG} WHERE reading_id = ${bib.id}`;
      const result = await seed(fresh.sql, ADMIN);
      expect(result.imagesUpdated).toEqual(["El espejo de la integridad"]);
      const [kept] = await fresh.sql`SELECT mime_type FROM reading_images WHERE reading_id = ${bib.id}`;
      expect(kept.mime_type).toBe("image/png");
    } finally {
      await fresh.drop();
    }
  });

  test("base vacia: el espejo primero y la biblioteca, activas, completas y con imagen", async () => {
    const fresh = await createTestDb();
    try {
      await seed(fresh.sql, ADMIN);
      const rows = await fresh.sql`SELECT id, title FROM readings WHERE is_active ORDER BY position, id`;
      expect(rows.map((r) => r.title)).toEqual(["El espejo de la integridad", "La biblioteca del barrio"]);
      for (const r of rows) {
        const detail = await getReading(fresh.sql, r.id);
        expect(detail.issues).toEqual([]);
        expect(detail.image?.alt).toBeTruthy();
      }
      const espejo = await getReading(fresh.sql, rows[0].id);
      expect(espejo.words.map((w) => w.word)).toEqual(["acendrado", "inmarcesible", "ataraxia", "inexorable", "aquiescencia"]);
      expect(espejo.content.split("\n\n")).toHaveLength(3);
      for (const w of espejo.words) expect(espejo.content.slice(w.start, w.end)).toBe(w.word);
    } finally {
      await fresh.drop();
    }
  });

  async function legacyDb(withAttempt: boolean) {
    const fresh = await createTestDb();
    // Base del MVP: la lectura del volcan y la biblioteca sin imagen
    const volcan = await createReading(fresh.sql, { title: RETIRED_TITLES[0], content: "El volcán permaneció inactivo.", position: 1 });
    await fresh.sql`UPDATE readings SET is_active = true WHERE id = ${volcan.id}`;
    const bib = SEED_READINGS[1];
    await createReading(fresh.sql, { title: bib.title, content: bib.content, position: 2 });
    if (withAttempt) {
      const [p] = await fresh.sql`INSERT INTO participants (document_number, full_name) VALUES ('V-1', 'Vale') RETURNING id`;
      await fresh.sql`
        INSERT INTO reading_attempts (participant_id, reading_id, round, attempt_number) VALUES (${p.id}, ${volcan.id}, 1, 1)`;
    }
    return { fresh, volcanId: volcan.id };
  }

  test("base existente: el volcan sin intentos se elimina y se agrega el espejo", async () => {
    const { fresh, volcanId } = await legacyDb(false);
    try {
      const result = await seed(fresh.sql, ADMIN);
      expect(result).toMatchObject({ removed: [RETIRED_TITLES[0]], created: ["El espejo de la integridad"], imagesAdded: ["La biblioteca del barrio"] });
      expect(await fresh.sql`SELECT 1 FROM readings WHERE id = ${volcanId}`).toHaveLength(0);
      const [espejo] = await fresh.sql`SELECT position, is_active FROM readings WHERE title = 'El espejo de la integridad'`;
      expect(espejo).toEqual({ position: 1, is_active: true });
    } finally {
      await fresh.drop();
    }
  });

  test("base existente: el volcan con intentos se desactiva conservando resultados", async () => {
    const { fresh, volcanId } = await legacyDb(true);
    try {
      const result = await seed(fresh.sql, ADMIN);
      expect(result.deactivated).toEqual([RETIRED_TITLES[0]]);
      const [volcan] = await fresh.sql`SELECT is_active FROM readings WHERE id = ${volcanId}`;
      expect(volcan.is_active).toBe(false);
      const [{ count }] = await fresh.sql`SELECT count(*)::int AS count FROM reading_attempts WHERE reading_id = ${volcanId}`;
      expect(count).toBe(1);

      const again = await seed(fresh.sql, ADMIN);
      expect(again).toEqual({ created: [], removed: [], deactivated: [], imagesAdded: [], imagesUpdated: [] });
    } finally {
      await fresh.drop();
    }
  });
});

// Peticion cruda a la app (para leer cabeceras y bytes de la imagen)
let rawApp: { request: (path: string) => Response | Promise<Response> };
async function createTestAppFetch(path: string) {
  if (!rawApp) {
    const { createApp } = await import("../src/app.ts");
    rawApp = createApp({ sql: db.sql, sessionSecret: "x" });
  }
  return rawApp.request(path);
}
