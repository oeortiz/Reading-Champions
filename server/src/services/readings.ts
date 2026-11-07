import type { Sql } from "../db/client.ts";
import { HINT_LEVELS, HINT_NAMES, type HintLevel } from "../domain/hints.ts";
import { locateTargetWord } from "../domain/word-locator.ts";
import { ConflictError, ValidationError, type Tx } from "./assessment.ts";
import { getImageRef, type ImageRef } from "./images.ts";

type Db = Sql | Tx;

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;

export class NotFoundError extends Error {}

const LOCKED_MESSAGE = "La lectura ya tiene resultados registrados: no se puede cambiar su texto, palabras ni opciones.";
const ACTIVE_MESSAGE = "Desactiva la lectura antes de cambiar su texto, palabras u opciones.";

/**
 * Texto de una lectura: saltos de linea uniformes, sin espacios al final de linea,
 * parrafos separados por una sola linea en blanco y en NFC. Los offsets se calculan sobre este texto.
 */
export function normalizeContent(content: string): string {
  return content
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .normalize("NFC");
}

type ReadingRow = { id: number; title: string; content: string; position: number; is_active: boolean };

async function getReadingRow(db: Db, id: number): Promise<ReadingRow & { has_attempts: boolean }> {
  const [row] = await db<(ReadingRow & { has_attempts: boolean })[]>`
    SELECT r.id, r.title, r.content, r.position, r.is_active,
           EXISTS (SELECT 1 FROM reading_attempts a WHERE a.reading_id = r.id) AS has_attempts
      FROM readings r WHERE r.id = ${id}`;
  if (!row) throw new NotFoundError("Lectura no encontrada");
  return row;
}

/** Cambios de estructura (texto, palabras, opciones): no si hay intentos ni si esta activa. */
async function assertStructureEditable(db: Db, readingId: number) {
  const reading = await getReadingRow(db, readingId);
  if (reading.has_attempts) throw new ConflictError(LOCKED_MESSAGE);
  if (reading.is_active) throw new ConflictError(ACTIVE_MESSAGE);
  return reading;
}

async function readingIdOfWord(db: Db, wordId: number): Promise<number> {
  const [row] = await db<{ reading_id: number }[]>`SELECT reading_id FROM target_words WHERE id = ${wordId}`;
  if (!row) throw new NotFoundError("Palabra objetivo no encontrada");
  return row.reading_id;
}

export type WordDetail = {
  id: number;
  word: string;
  start: number;
  end: number;
  hints: Record<HintLevel, string | null>;
  options: { id: number; text: string; isCorrect: boolean }[];
};

export type ReadingDetail = {
  id: number;
  title: string;
  content: string;
  position: number;
  isActive: boolean;
  hasAttempts: boolean;
  image: ImageRef;
  words: WordDetail[];
  issues: string[];
};

export async function getReading(db: Db, id: number): Promise<ReadingDetail> {
  const reading = await getReadingRow(db, id);
  const words = await db<{ id: number; word: string; start_offset: number; end_offset: number }[]>`
    SELECT id, word, start_offset, end_offset FROM target_words WHERE reading_id = ${id} ORDER BY start_offset`;
  const wordIds = words.map((w) => w.id);
  const hints = wordIds.length
    ? await db<{ target_word_id: number; level: HintLevel; content: string }[]>`
        SELECT target_word_id, level, content FROM hints WHERE target_word_id IN ${db(wordIds)}`
    : [];
  const options = wordIds.length
    ? await db<{ id: number; target_word_id: number; text: string; is_correct: boolean }[]>`
        SELECT id, target_word_id, text, is_correct FROM answer_options
         WHERE target_word_id IN ${db(wordIds)} ORDER BY position, id`
    : [];

  const detail: Omit<ReadingDetail, "issues"> = {
    id: reading.id,
    title: reading.title,
    content: reading.content,
    position: reading.position,
    isActive: reading.is_active,
    hasAttempts: reading.has_attempts,
    image: await getImageRef(db, id),
    words: words.map((w) => ({
      id: w.id,
      word: w.word,
      start: w.start_offset,
      end: w.end_offset,
      hints: Object.fromEntries(
        HINT_LEVELS.map((level) => [level, hints.find((h) => h.target_word_id === w.id && h.level === level)?.content ?? null]),
      ) as Record<HintLevel, string | null>,
      options: options
        .filter((o) => o.target_word_id === w.id)
        .map((o) => ({ id: o.id, text: o.text, isCorrect: o.is_correct })),
    })),
  };
  return { ...detail, issues: completenessIssues(detail) };
}

/** Lo que impide activar la lectura, con la palabra afectada. Vacio = completa. */
export function completenessIssues(reading: Pick<ReadingDetail, "words">): string[] {
  if (!reading.words.length) return ["La lectura no tiene palabras objetivo."];
  const issues: string[] = [];
  for (const w of reading.words) {
    const missing = HINT_LEVELS.filter((level) => !w.hints[level]?.trim()).map((level) => HINT_NAMES[level]);
    if (missing.length) issues.push(`"${w.word}": falta la ayuda de ${missing.join(", ")}.`);
    const correct = w.options.filter((o) => o.isCorrect).length;
    if (w.options.length < MIN_OPTIONS || w.options.length > MAX_OPTIONS || correct !== 1) {
      issues.push(`"${w.word}": necesita entre ${MIN_OPTIONS} y ${MAX_OPTIONS} opciones con exactamente una correcta.`);
    }
  }
  return issues;
}

export async function listReadings(db: Db) {
  const rows = await db<(ReadingRow & { has_attempts: boolean })[]>`
    SELECT r.id, r.title, r.content, r.position, r.is_active,
           EXISTS (SELECT 1 FROM reading_attempts a WHERE a.reading_id = r.id) AS has_attempts
      FROM readings r ORDER BY r.position, r.id`;
  return Promise.all(
    rows.map(async (r) => {
      const detail = await getReading(db, r.id);
      return {
        id: r.id,
        title: r.title,
        position: r.position,
        isActive: r.is_active,
        hasAttempts: r.has_attempts,
        wordCount: detail.words.length,
        issues: detail.issues,
      };
    }),
  );
}

export type ReadingInput = { title: string; content: string; position?: number };

export async function createReading(db: Db, input: ReadingInput) {
  const [row] = await db<{ id: number }[]>`
    INSERT INTO readings (title, content, position)
    VALUES (${input.title}, ${normalizeContent(input.content)},
            ${input.position ?? db`(SELECT coalesce(max(position), 0) + 1 FROM readings)`})
    RETURNING id`;
  return getReading(db, row.id);
}

export async function updateReading(db: Db, id: number, input: ReadingInput) {
  const reading = await getReadingRow(db, id);
  const content = normalizeContent(input.content);
  if (content !== reading.content) {
    await assertStructureEditable(db, id);
    // Los offsets se recalculan; el texto nuevo debe seguir conteniendo cada palabra objetivo
    const words = await db<{ id: number; word: string }[]>`SELECT id, word FROM target_words WHERE reading_id = ${id}`;
    const located = words.map((w) => ({ ...w, at: locateTargetWord(content, w.word) }));
    const missing = located.filter((w) => !w.at).map((w) => `"${w.word}" ya no aparece en el texto.`);
    if (missing.length) throw new ValidationError("El texto nuevo no contiene todas las palabras objetivo.", missing);
    for (const w of located) {
      await db`UPDATE target_words SET start_offset = ${w.at!.start}, end_offset = ${w.at!.end} WHERE id = ${w.id}`;
    }
  }
  await db`
    UPDATE readings SET title = ${input.title}, content = ${content}, position = ${input.position ?? reading.position}
     WHERE id = ${id}`;
  return getReading(db, id);
}

async function locateUnique(db: Db, readingId: number, word: string, exceptWordId?: number) {
  const reading = await getReadingRow(db, readingId);
  const normalized = word.normalize("NFC").trim();
  const at = locateTargetWord(reading.content, normalized);
  if (!at) throw new ValidationError(`"${normalized}" no aparece como palabra completa en el texto.`);
  const [duplicate] = await db`
    SELECT 1 FROM target_words
     WHERE reading_id = ${readingId} AND lower(word) = lower(${normalized}) AND id <> ${exceptWordId ?? 0}`;
  if (duplicate) throw new ValidationError(`"${normalized}" ya es una palabra objetivo de esta lectura.`);
  return { word: normalized, at };
}

export async function addTargetWord(db: Db, readingId: number, word: string) {
  await assertStructureEditable(db, readingId);
  const { word: normalized, at } = await locateUnique(db, readingId, word);
  const [row] = await db<{ id: number }[]>`
    INSERT INTO target_words (reading_id, word, start_offset, end_offset)
    VALUES (${readingId}, ${normalized}, ${at.start}, ${at.end}) RETURNING id`;
  return row.id;
}

export async function updateTargetWord(db: Db, wordId: number, word: string) {
  const readingId = await readingIdOfWord(db, wordId);
  await assertStructureEditable(db, readingId);
  const { word: normalized, at } = await locateUnique(db, readingId, word, wordId);
  await db`
    UPDATE target_words SET word = ${normalized}, start_offset = ${at.start}, end_offset = ${at.end}
     WHERE id = ${wordId}`;
  return readingId;
}

export async function deleteTargetWord(db: Db, wordId: number) {
  const readingId = await readingIdOfWord(db, wordId);
  await assertStructureEditable(db, readingId);
  await db`DELETE FROM target_words WHERE id = ${wordId}`;
  return readingId;
}

/** Guarda las ayudas enviadas; un texto vacio borra esa ayuda (no permitido en lecturas activas). */
export async function setHints(db: Db, wordId: number, hints: Partial<Record<HintLevel, string>>) {
  const readingId = await readingIdOfWord(db, wordId);
  const reading = await getReadingRow(db, readingId);
  for (const level of HINT_LEVELS) {
    const content = hints[level];
    if (content === undefined) continue;
    if (content.trim()) {
      await db`
        INSERT INTO hints (target_word_id, level, content) VALUES (${wordId}, ${level}, ${content.trim()})
        ON CONFLICT (target_word_id, level) DO UPDATE SET content = EXCLUDED.content`;
    } else {
      if (reading.is_active) throw new ConflictError(`Una lectura activa no puede quedar sin la ayuda de ${HINT_NAMES[level]}.`);
      await db`DELETE FROM hints WHERE target_word_id = ${wordId} AND level = ${level}`;
    }
  }
  return readingId;
}

export type OptionInput = { text: string; isCorrect: boolean };

export async function setOptions(db: Db, wordId: number, options: OptionInput[]) {
  const readingId = await readingIdOfWord(db, wordId);
  await assertStructureEditable(db, readingId);
  const cleaned = options.map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect }));
  if (cleaned.some((o) => !o.text)) throw new ValidationError("Todas las opciones deben tener texto.");
  if (cleaned.length < MIN_OPTIONS || cleaned.length > MAX_OPTIONS) {
    throw new ValidationError(`Cada palabra necesita entre ${MIN_OPTIONS} y ${MAX_OPTIONS} opciones.`);
  }
  const correct = cleaned.filter((o) => o.isCorrect).length;
  if (correct !== 1) throw new ValidationError("Marca exactamente una opción como correcta.");

  await db`DELETE FROM answer_options WHERE target_word_id = ${wordId}`;
  for (const [position, o] of cleaned.entries()) {
    await db`
      INSERT INTO answer_options (target_word_id, text, is_correct, position)
      VALUES (${wordId}, ${o.text}, ${o.isCorrect}, ${position})`;
  }
  return readingId;
}

export async function setActive(db: Db, readingId: number, active: boolean) {
  const reading = await getReading(db, readingId);
  if (active && reading.issues.length) {
    throw new ValidationError("No se puede activar: la lectura está incompleta.", reading.issues);
  }
  await db`UPDATE readings SET is_active = ${active} WHERE id = ${readingId}`;
  return getReading(db, readingId);
}
