import type { Sql } from "../db/client.ts";
import { detectImageType } from "../domain/image-type.ts";
import { ValidationError, type Tx } from "./assessment.ts";
import { NotFoundError } from "./readings.ts";

type Db = Sql | Tx;

export const MAX_IMAGE_BYTES = 1024 * 1024;

export type ImageRef = { url: string; alt: string } | null;

/** La URL cambia con cada reemplazo, asi el cache inmutable nunca muestra una imagen vieja. */
export const imageUrl = (readingId: number, updatedAt: Date) =>
  `/api/readings/${readingId}/image?v=${updatedAt.getTime()}`;

export async function getImageRef(db: Db, readingId: number): Promise<ImageRef> {
  const [row] = await db<{ alt_text: string; updated_at: Date }[]>`
    SELECT alt_text, updated_at FROM reading_images WHERE reading_id = ${readingId}`;
  return row ? { url: imageUrl(readingId, row.updated_at), alt: row.alt_text } : null;
}

export async function loadImage(db: Db, readingId: number) {
  const [row] = await db<{ mime_type: string; data: Uint8Array<ArrayBuffer> }[]>`
    SELECT mime_type, data FROM reading_images WHERE reading_id = ${readingId}`;
  return row ?? null;
}

async function assertReading(db: Db, readingId: number) {
  const [row] = await db`SELECT 1 FROM readings WHERE id = ${readingId}`;
  if (!row) throw new NotFoundError("Lectura no encontrada");
}

/**
 * Sube o reemplaza la imagen de una lectura. Sin archivo solo cambia el texto alternativo de la
 * imagen existente. La imagen no es contenido evaluado: se permite con intentos o lectura activa.
 */
export async function saveImage(db: Db, readingId: number, input: { file?: Uint8Array; altText: string }) {
  await assertReading(db, readingId);
  const alt = input.altText.trim();
  if (!alt) throw new ValidationError("Escribe el texto alternativo de la imagen.");

  if (!input.file) {
    const updated = await db`
      UPDATE reading_images SET alt_text = ${alt}, updated_at = clock_timestamp()
       WHERE reading_id = ${readingId} RETURNING reading_id`;
    if (!updated.length) throw new ValidationError("Selecciona una imagen.");
    return;
  }

  if (input.file.byteLength > MAX_IMAGE_BYTES) throw new ValidationError("La imagen supera el tamaño máximo de 1 MB.");
  const mime = detectImageType(input.file);
  if (!mime) throw new ValidationError("Formato no permitido. Usa una imagen PNG, JPEG o WebP.");
  await upsert(db, readingId, mime, input.file, alt);
}

/** Imagen de contenido propio (ilustraciones SVG del seed); no pasa por la validacion de subida. */
export async function setTrustedImage(db: Db, readingId: number, mime: string, data: Uint8Array, alt: string) {
  await upsert(db, readingId, mime, data, alt);
}

async function upsert(db: Db, readingId: number, mime: string, data: Uint8Array, alt: string) {
  await db`
    INSERT INTO reading_images (reading_id, mime_type, data, alt_text)
    VALUES (${readingId}, ${mime}, ${data}, ${alt})
    ON CONFLICT (reading_id) DO UPDATE
      SET mime_type = EXCLUDED.mime_type, data = EXCLUDED.data, alt_text = EXCLUDED.alt_text,
          updated_at = clock_timestamp()`;
}

export async function deleteImage(db: Db, readingId: number) {
  await assertReading(db, readingId);
  await db`DELETE FROM reading_images WHERE reading_id = ${readingId}`;
}
