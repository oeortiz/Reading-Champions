import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createTestApp, type Client } from "./app.ts";
import type { TestDb } from "./db.ts";

let db: TestDb;
let client: () => Client;
beforeAll(async () => ({ db, client } = await createTestApp()));
afterAll(() => db.drop());

describe("sesion de participante (cookies firmadas)", () => {
  test("sin cookie devuelve 401", async () => {
    expect((await client().get("/api/assessment/current")).status).toBe(401);
  });

  test("cookie alterada devuelve 401", async () => {
    const c = client();
    await c.post("/api/participants/session", { documentNumber: "A-1", fullName: "Ana" });
    const signed = c.cookies.get("rc_participant")!;
    expect(decodeURIComponent(signed)).toStartWith("participant:");
    const [, signature] = decodeURIComponent(signed).split(".");
    c.cookies.set("rc_participant", encodeURIComponent(`participant:999.${signature}`));
    expect((await c.get("/api/assessment/current")).status).toBe(401);
  });

  test("cookie de participante copiada a rc_admin no da acceso de admin", async () => {
    const c = client();
    await c.post("/api/participants/session", { documentNumber: "A-2", fullName: "Beto" });
    c.cookies.set("rc_admin", c.cookies.get("rc_participant")!);
    expect((await c.get("/api/admin/readings")).status).toBe(401);
  });
});

describe("POST /api/participants/session", () => {
  test("ingreso valido registra al participante y recorta espacios", async () => {
    const c = client();
    const res = await c.post("/api/participants/session", { documentNumber: "  100  ", fullName: "  Ana Pérez " });
    expect(res.status).toBe(200);
    expect(res.body.participant.fullName).toBe("Ana Pérez");
    const rows = await db.sql`SELECT document_number, full_name FROM participants WHERE document_number = '100'`;
    expect(rows).toHaveLength(1);
    expect(c.cookies.has("rc_participant")).toBe(true);
  });

  test("campos vacios o solo espacios se rechazan sin crear sesion", async () => {
    for (const body of [
      { documentNumber: "", fullName: "Ana" },
      { documentNumber: "200", fullName: "   " },
      { documentNumber: "200" },
    ]) {
      const c = client();
      const res = await c.post("/api/participants/session", body);
      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
      expect(c.cookies.has("rc_participant")).toBe(false);
    }
    expect(await db.sql`SELECT 1 FROM participants WHERE document_number = '200'`).toHaveLength(0);
  });

  test("documento existente reutiliza el participante y conserva el primer nombre", async () => {
    await client().post("/api/participants/session", { documentNumber: "300", fullName: "Ana Pérez" });
    const res = await client().post("/api/participants/session", { documentNumber: "300", fullName: "Ana P." });
    expect(res.body.participant.fullName).toBe("Ana Pérez");
    const rows = await db.sql`SELECT full_name FROM participants WHERE document_number = '300'`;
    expect(rows.map((r) => r.full_name)).toEqual(["Ana Pérez"]);
  });

  test("documento distinto con el mismo nombre es un participante nuevo", async () => {
    await client().post("/api/participants/session", { documentNumber: "400", fullName: "Carla" });
    await client().post("/api/participants/session", { documentNumber: "401", fullName: "Carla" });
    const [{ count }] = await db.sql`SELECT count(*)::int AS count FROM participants WHERE full_name = 'Carla'`;
    expect(count).toBe(2);
  });

  test("sin lecturas activas el siguiente paso es el resumen", async () => {
    const res = await client().post("/api/participants/session", { documentNumber: "500", fullName: "Dani" });
    expect(res.body.next).toBe("summary");
  });
});
