import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { serveStatic } from "hono/bun";
import { createApp } from "./app.ts";
import { config } from "./config.ts";
import { createSql } from "./db/client.ts";

const sql = createSql(config.databaseUrl());
const app = createApp({
  sql,
  sessionSecret: config.sessionSecret(),
  secureCookies: process.env.COOKIE_SECURE === "true",
});

// En produccion el mismo proceso sirve la SPA compilada
const webDist = join(import.meta.dir, "../../web/dist");
if (existsSync(webDist)) {
  const root = relative(process.cwd(), webDist);
  const assets = serveStatic({ root });
  const spa = serveStatic({ path: join(root, "index.html") });
  // Las rutas /api desconocidas deben llegar al 404 en JSON, no a la SPA
  const isApi = (path: string) => path === "/api" || path.startsWith("/api/");
  app.use("*", (c, next) => (isApi(c.req.path) ? next() : assets(c, next)));
  app.get("*", (c, next) => (isApi(c.req.path) ? next() : spa(c, next)));
}

export default { port: config.port, fetch: app.fetch };
console.log(`Servidor escuchando en http://localhost:${config.port}`);
