import { Hono } from "hono";
import type { Sql } from "./db/client.ts";
import { adminRoutes } from "./routes/admin.ts";
import { assessmentRoutes } from "./routes/assessment.ts";
import { participantRoutes } from "./routes/participant.ts";
import { ConflictError, ValidationError } from "./services/assessment.ts";
import { loadImage } from "./services/images.ts";
import { NotFoundError } from "./services/readings.ts";

export type AppDeps = {
  sql: Sql;
  sessionSecret: string;
  secureCookies?: boolean;
};

export type AppEnv = {
  Variables: {
    participantId: number;
    adminId: number;
  };
};

export function createApp(deps: AppDeps) {
  const app = new Hono<AppEnv>();

  app.onError((err, c) => {
    if (err instanceof ConflictError) return c.json({ error: err.message }, 409);
    if (err instanceof NotFoundError) return c.json({ error: err.message }, 404);
    if (err instanceof ValidationError) return c.json({ error: err.message, issues: err.issues }, 400);
    console.error(err);
    return c.json({ error: "Error interno del servidor" }, 500);
  });

  app.get("/api/health", async (c) => {
    await deps.sql`SELECT 1`;
    return c.json({ status: "ok" });
  });

  // Publica: las imagenes no son secretas y asi <img> no depende de la cookie
  app.get("/api/readings/:id/image", async (c) => {
    const id = Number(c.req.param("id"));
    const image = Number.isSafeInteger(id) && id > 0 ? await loadImage(deps.sql, id) : null;
    if (!image) return c.json({ error: "Imagen no encontrada" }, 404);
    return new Response(image.data, {
      headers: {
        "Content-Type": image.mime_type,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  });

  app.route("/api/participants", participantRoutes(deps));
  app.route("/api/assessment", assessmentRoutes(deps));
  app.route("/api/admin", adminRoutes(deps));

  app.notFound((c) => c.json({ error: "No encontrado" }, 404));

  return app;
}
