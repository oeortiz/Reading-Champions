import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import type { AppDeps, AppEnv } from "../app.ts";
import { ADMIN_COOKIE, clearSessionCookie, requireAdmin, setSessionCookie } from "../auth/session.ts";
import { ValidationError } from "../services/assessment.ts";
import * as images from "../services/images.ts";
import * as readings from "../services/readings.ts";

const sessionBody = z.object({ username: z.string().trim().min(1), password: z.string().min(1) });
const readingBody = z.object({
  title: z.string().trim().min(1, "El título es obligatorio").max(200),
  content: z.string().trim().min(1, "El texto es obligatorio").max(5000),
  position: z.number().int().optional(),
});
const wordBody = z.object({ word: z.string().trim().min(1, "Escribe la palabra objetivo").max(80) });
const hintsBody = z.object({
  hints: z.object({ 1: z.string(), 2: z.string(), 3: z.string(), 4: z.string() }).partial(),
});
const optionsBody = z.object({
  options: z.array(z.object({ text: z.string().max(300), isCorrect: z.boolean() })),
});

const INVALID_LOGIN = "Usuario o contraseña incorrectos";

async function parse<T extends z.ZodTypeAny>(schema: T, req: { json: () => Promise<unknown> }) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);
  return parsed.data as z.infer<T>;
}

const idParam = (value: string) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new readings.NotFoundError("No encontrado");
  return id;
};

export function adminRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  const { sql } = deps;

  app.post("/session", async (c) => {
    const parsed = sessionBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: INVALID_LOGIN }, 401);
    const [admin] = await sql<{ id: number; password_hash: string }[]>`
      SELECT id, password_hash FROM admins WHERE username = ${parsed.data.username}`;
    // Mensaje unico: no revela si fallo el usuario o la contrasena
    const valid = admin ? await Bun.password.verify(parsed.data.password, admin.password_hash) : false;
    if (!admin || !valid) return c.json({ error: INVALID_LOGIN }, 401);
    await setSessionCookie(c, ADMIN_COOKIE, admin.id, { secret: deps.sessionSecret, secure: !!deps.secureCookies });
    return c.json({ ok: true });
  });

  app.post("/logout", (c) => {
    clearSessionCookie(c, ADMIN_COOKIE);
    return c.json({ ok: true });
  });

  app.use("*", requireAdmin(deps.sessionSecret));

  app.get("/me", (c) => c.json({ ok: true }));

  app.get("/readings", async (c) => c.json(await readings.listReadings(sql)));

  app.post("/readings", async (c) => {
    const body = await parse(readingBody, c.req);
    return c.json(await readings.createReading(sql, body), 201);
  });

  app.get("/readings/:id", async (c) => c.json(await readings.getReading(sql, idParam(c.req.param("id")))));

  app.put("/readings/:id", async (c) => {
    const body = await parse(readingBody, c.req);
    const id = idParam(c.req.param("id"));
    return c.json(await sql.begin((tx) => readings.updateReading(tx, id, body)));
  });

  app.post("/readings/:id/target-words", async (c) => {
    const { word } = await parse(wordBody, c.req);
    const id = idParam(c.req.param("id"));
    await sql.begin((tx) => readings.addTargetWord(tx, id, word));
    return c.json(await readings.getReading(sql, id), 201);
  });

  app.put("/target-words/:wordId", async (c) => {
    const { word } = await parse(wordBody, c.req);
    const readingId = await sql.begin((tx) => readings.updateTargetWord(tx, idParam(c.req.param("wordId")), word));
    return c.json(await readings.getReading(sql, readingId));
  });

  app.delete("/target-words/:wordId", async (c) => {
    const readingId = await sql.begin((tx) => readings.deleteTargetWord(tx, idParam(c.req.param("wordId"))));
    return c.json(await readings.getReading(sql, readingId));
  });

  app.put("/target-words/:wordId/hints", async (c) => {
    const { hints } = await parse(hintsBody, c.req);
    const readingId = await sql.begin((tx) => readings.setHints(tx, idParam(c.req.param("wordId")), hints));
    return c.json(await readings.getReading(sql, readingId));
  });

  app.put("/target-words/:wordId/options", async (c) => {
    const { options } = await parse(optionsBody, c.req);
    const readingId = await sql.begin((tx) => readings.setOptions(tx, idParam(c.req.param("wordId")), options));
    return c.json(await readings.getReading(sql, readingId));
  });

  // La imagen no es contenido evaluado: no pasa por el bloqueo de lecturas con intentos
  app.put(
    "/readings/:id/image",
    bodyLimit({
      maxSize: images.MAX_IMAGE_BYTES + 64 * 1024,
      onError: (c) => c.json({ error: "La imagen supera el tamaño máximo de 1 MB." }, 413),
    }),
    async (c) => {
      const id = idParam(c.req.param("id"));
      const body = await c.req.parseBody().catch(() => {
        throw new ValidationError("Envía la imagen como formulario multipart.");
      });
      const file = body.file instanceof File && body.file.size > 0 ? new Uint8Array(await body.file.arrayBuffer()) : undefined;
      const altText = typeof body.altText === "string" ? body.altText : "";
      await images.saveImage(sql, id, { file, altText });
      return c.json(await readings.getReading(sql, id));
    },
  );

  app.delete("/readings/:id/image", async (c) => {
    const id = idParam(c.req.param("id"));
    await images.deleteImage(sql, id);
    return c.json(await readings.getReading(sql, id));
  });

  app.post("/readings/:id/activate", async (c) =>
    c.json(await readings.setActive(sql, idParam(c.req.param("id")), true)),
  );

  app.post("/readings/:id/deactivate", async (c) =>
    c.json(await readings.setActive(sql, idParam(c.req.param("id")), false)),
  );

  return app;
}
