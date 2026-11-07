import { Hono } from "hono";
import { z } from "zod";
import type { AppDeps, AppEnv } from "../app.ts";
import { requireParticipant } from "../auth/session.ts";
import * as assessment from "../services/assessment.ts";

// Solo se leen estos campos; cualquier otro (score, hintLevel...) se descarta
const answerBody = z.object({ optionId: z.number().int().positive() });
const hintBody = z.object({ level: z.number().int().min(1) });

export function assessmentRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  app.use("*", requireParticipant(deps.sessionSecret));

  /** Ejecuta la accion en una transaccion serializada por participante. */
  const run = <T>(participantId: number, fn: (tx: assessment.Tx) => Promise<T>) =>
    deps.sql.begin(async (tx) => {
      await assessment.lockParticipant(tx, participantId);
      return fn(tx);
    }) as Promise<T>;

  app.get("/current", async (c) => {
    const id = c.get("participantId");
    const [participant] = await deps.sql`SELECT full_name FROM participants WHERE id = ${id}`;
    if (!participant) return c.json({ error: "Sesión no válida. Ingresa de nuevo." }, 401);
    const state = await run(id, (tx) => assessment.currentState(tx, id));
    return c.json({ participant: { fullName: participant.full_name }, ...state });
  });

  app.post("/hint", async (c) => {
    const parsed = hintBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Solicitud no válida" }, 400);
    const id = c.get("participantId");
    return c.json(await run(id, (tx) => assessment.requestHint(tx, id, parsed.data.level)));
  });

  app.post("/answer", async (c) => {
    const parsed = answerBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Elige una opción" }, 400);
    const id = c.get("participantId");
    return c.json(await run(id, (tx) => assessment.answer(tx, id, parsed.data.optionId)));
  });

  app.get("/summary", async (c) => {
    const id = c.get("participantId");
    const [participant] = await deps.sql`SELECT full_name FROM participants WHERE id = ${id}`;
    if (!participant) return c.json({ error: "Sesión no válida. Ingresa de nuevo." }, 401);
    const result = await run(id, (tx) => assessment.summary(tx, id));
    return c.json({ participant: { fullName: participant.full_name }, ...result });
  });

  app.post("/repeat", async (c) => {
    const id = c.get("participantId");
    await run(id, (tx) => assessment.startRepeat(tx, id));
    return c.json({ next: "reading" });
  });

  return app;
}
