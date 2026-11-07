import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createSql, type Sql } from "../src/db/client.ts";
import { setTrustedImage } from "../src/services/images.ts";
import * as readings from "../src/services/readings.ts";
import { RETIRED_TITLES, SEED_READINGS } from "./readings.ts";

const IMAGES_DIR = join(import.meta.dir, "images");

export type SeedResult = {
  created: string[];
  removed: string[];
  deactivated: string[];
  imagesAdded: string[];
  imagesUpdated: string[];
};

/**
 * Crea o actualiza el admin, retira las lecturas que dejaron de ser iniciales y agrega las que falten
 * (con su imagen). Se puede ejecutar varias veces: una segunda ejecucion no cambia nada.
 */
export async function seed(sql: Sql, admin: { username: string; password: string }): Promise<SeedResult> {
  const result: SeedResult = { created: [], removed: [], deactivated: [], imagesAdded: [], imagesUpdated: [] };
  const hash = await Bun.password.hash(admin.password);
  await sql`
    INSERT INTO admins (username, password_hash) VALUES (${admin.username}, ${hash})
    ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`;

  // Sin intentos se elimina; con intentos se desactiva para conservar los resultados
  for (const title of RETIRED_TITLES) {
    const rows = await sql<{ id: number; is_active: boolean; has_attempts: boolean }[]>`
      SELECT r.id, r.is_active, EXISTS (SELECT 1 FROM reading_attempts a WHERE a.reading_id = r.id) AS has_attempts
        FROM readings r WHERE r.title = ${title}`;
    for (const r of rows) {
      if (!r.has_attempts) {
        await sql`DELETE FROM readings WHERE id = ${r.id}`;
        result.removed.push(title);
      } else if (r.is_active) {
        await sql`UPDATE readings SET is_active = false WHERE id = ${r.id}`;
        result.deactivated.push(title);
      }
    }
  }

  for (const [i, r] of SEED_READINGS.entries()) {
    const image = readFileSync(join(IMAGES_DIR, r.image.file));
    const [existing] = await sql<{ id: number; mime_type: string | null; data: Uint8Array | null }[]>`
      SELECT r.id, im.mime_type, im.data
        FROM readings r LEFT JOIN reading_images im ON im.reading_id = r.id
       WHERE r.title = ${r.title}`;
    if (existing) {
      if (!existing.mime_type) {
        await setTrustedImage(sql, existing.id, "image/svg+xml", image, r.image.alt);
        result.imagesAdded.push(r.title);
      } else if (existing.mime_type === "image/svg+xml" && !Buffer.from(existing.data!).equals(image)) {
        // Solo el seed guarda SVG (la subida no lo acepta): es su ilustracion y se actualiza.
        // Una imagen subida por el administrador nunca se reemplaza.
        await setTrustedImage(sql, existing.id, "image/svg+xml", image, r.image.alt);
        result.imagesUpdated.push(r.title);
      }
      continue;
    }
    await sql.begin(async (tx) => {
      const reading = await readings.createReading(tx, { title: r.title, content: r.content, position: i + 1 });
      for (const w of r.words) {
        const wordId = await readings.addTargetWord(tx, reading.id, w.word);
        await readings.setHints(tx, wordId, w.hints);
        await readings.setOptions(
          tx,
          wordId,
          w.order.map((index) => ({ text: w.options[index], isCorrect: index === 0 })),
        );
      }
      await setTrustedImage(tx, reading.id, "image/svg+xml", image, r.image.alt);
      await readings.setActive(tx, reading.id, true);
    });
    result.created.push(r.title);
  }
  return result;
}

if (import.meta.main) {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) throw new Error("Define ADMIN_USERNAME y ADMIN_PASSWORD");
  const sql = createSql(process.env.DATABASE_URL!);
  const { created, removed, deactivated, imagesAdded, imagesUpdated } = await seed(sql, { username, password });
  console.log(`Admin "${username}" listo.`);
  if (removed.length) console.log(`Lecturas retiradas (eliminadas): ${removed.join(", ")}`);
  if (deactivated.length) console.log(`Lecturas retiradas (desactivadas, con resultados): ${deactivated.join(", ")}`);
  if (imagesAdded.length) console.log(`Imágenes agregadas: ${imagesAdded.join(", ")}`);
  if (imagesUpdated.length) console.log(`Ilustraciones actualizadas: ${imagesUpdated.join(", ")}`);
  console.log(created.length ? `Lecturas creadas: ${created.join(", ")}` : "Las lecturas iniciales ya existían.");
  await sql.end();
}
