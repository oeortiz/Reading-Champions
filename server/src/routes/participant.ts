import { Hono } from "hono";
import { z } from "zod";
import type { AppDeps, AppEnv } from "../app.ts";
import { PARTICIPANT_COOKIE, setSessionCookie } from "../auth/session.ts";
import { roundStatus } from "../services/assessment.ts";

const sessionBody = z.object({
  documentNumber: z.string().trim().min(1, "Ingresa tu número de documento").max(40),
  fullName: z.string().trim().min(1, "Ingresa tu nombre completo").max(120),
});

export function participantRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();

  app.post("/session", async (c) => {
    const parsed = sessionBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
    const { documentNumber, fullName } = parsed.data;

    const result = await deps.sql.begin(async (tx) => {
      // El documento es la llave; si ya existe se conserva el primer nombre registrado
      const [participant] = await tx<{ id: number; full_name: string }[]>`
        INSERT INTO participants (document_number, full_name) VALUES (${documentNumber}, ${fullName})
        ON CONFLICT (document_number) DO UPDATE SET document_number = EXCLUDED.document_number
        RETURNING id, full_name`;
      const status = await roundStatus(tx, participant.id);
      return { participant, status };
    });

    await setSessionCookie(c, PARTICIPANT_COOKIE, result.participant.id, {
      secret: deps.sessionSecret,
      secure: !!deps.secureCookies,
    });
    return c.json({
      participant: { fullName: result.participant.full_name },
      next: result.status.completed ? "summary" : "reading",
    });
  });

  return app;
}
