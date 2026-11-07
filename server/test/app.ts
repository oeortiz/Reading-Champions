import { createApp } from "../src/app.ts";
import { createTestDb, type TestDb } from "./db.ts";

export const TEST_SECRET = "secreto-de-pruebas";

/** Cliente HTTP en memoria que conserva las cookies, como un navegador. */
export class Client {
  cookies = new Map<string, string>();
  constructor(private app: ReturnType<typeof createApp>) {}

  async request(method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (this.cookies.size) headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await this.app.request(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const header of res.headers.getSetCookie()) {
      const [pair] = header.split(";");
      const [name, ...rest] = pair.split("=");
      this.cookies.set(name, rest.join("="));
    }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, raw: text };
  }
  /** Envia un formulario multipart (subida de archivos) con las cookies de la sesion. */
  async upload(path: string, form: FormData, method = "PUT") {
    const headers: Record<string, string> = {};
    if (this.cookies.size) headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await this.app.request(path, { method, headers, body: form });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, raw: text };
  }
  get = (path: string) => this.request("GET", path);
  post = (path: string, body: unknown = {}) => this.request("POST", path, body);
  put = (path: string, body: unknown) => this.request("PUT", path, body);
  delete = (path: string) => this.request("DELETE", path);
}

export async function createTestApp(): Promise<{ db: TestDb; app: ReturnType<typeof createApp>; client: () => Client }> {
  const db = await createTestDb();
  const app = createApp({ sql: db.sql, sessionSecret: TEST_SECRET });
  return { db, app, client: () => new Client(app) };
}
