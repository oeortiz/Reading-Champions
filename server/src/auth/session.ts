import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import type { AppEnv } from "../app.ts";

export const PARTICIPANT_COOKIE = "rc_participant";
export const ADMIN_COOKIE = "rc_admin";

// El rol va dentro del valor firmado: la firma no cubre el nombre de la cookie, y sin esto
// una cookie de participante copiada a rc_admin pasaria la verificacion.
const ROLE: Record<string, string> = { [PARTICIPANT_COOKIE]: "participant", [ADMIN_COOKIE]: "admin" };

const MAX_AGE = 60 * 60 * 12;

export type CookieOptions = { secret: string; secure: boolean };

/** Cookie HttpOnly firmada con HMAC-SHA256: el cliente no puede cambiar el id sin invalidar la firma. */
export function setSessionCookie(c: Context, name: string, id: number, opts: CookieOptions) {
  return setSignedCookie(c, name, `${ROLE[name]}:${id}`, opts.secret, {
    httpOnly: true,
    sameSite: "Lax",
    secure: opts.secure,
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearSessionCookie(c: Context, name: string) {
  deleteCookie(c, name, { path: "/" });
}

async function readSessionId(c: Context, name: string, secret: string): Promise<number | null> {
  const value = await getSignedCookie(c, secret, name);
  if (!value) return null;
  const [role, raw] = value.split(":");
  if (role !== ROLE[name]) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function requireParticipant(secret: string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const id = await readSessionId(c, PARTICIPANT_COOKIE, secret);
    if (!id) return c.json({ error: "Sesión no válida. Ingresa de nuevo." }, 401);
    c.set("participantId", id);
    await next();
  };
}

export function requireAdmin(secret: string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const id = await readSessionId(c, ADMIN_COOKIE, secret);
    if (!id) return c.json({ error: "No autorizado" }, 401);
    c.set("adminId", id);
    await next();
  };
}
