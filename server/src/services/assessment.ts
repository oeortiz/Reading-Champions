import type postgres from "postgres";
import { LEXICO, type HintLevel } from "../domain/hints.ts";
import { BASE_POINTS, pointsFor } from "../domain/scoring.ts";
import { computeSummary, type WordResult } from "../domain/stats.ts";
import { getImageRef } from "./images.ts";

export type Tx = postgres.TransactionSql;

type Attempt = { id: number; reading_id: number; round: number; attempt_number: number; status: string };
type WordResponse = {
  id: number;
  target_word_id: number;
  hint_level: number;
  presented_at: Date;
  answered_at: Date | null;
};

export class ConflictError extends Error {}
export class ValidationError extends Error {
  constructor(
    message: string,
    public issues?: string[],
  ) {
    super(message);
  }
}

/** Serializa las acciones de un participante dentro de la transaccion actual. */
export async function lockParticipant(tx: Tx, participantId: number) {
  await tx`SELECT pg_advisory_xact_lock(${participantId})`;
}

async function activeReadings(tx: Tx) {
  return tx<{ id: number; title: string; content: string }[]>`
    SELECT id, title, content FROM readings WHERE is_active ORDER BY position, id`;
}

async function currentRound(tx: Tx, participantId: number): Promise<number> {
  const [row] = await tx<{ round: number }[]>`
    SELECT coalesce(max(round), 1)::int AS round FROM reading_attempts WHERE participant_id = ${participantId}`;
  return row.round;
}

/** Lecturas activas sin intento completado en la ronda actual, en orden de presentacion. */
async function pendingReadingIds(tx: Tx, participantId: number, round: number): Promise<number[]> {
  const rows = await tx<{ id: number }[]>`
    SELECT r.id FROM readings r
     WHERE r.is_active
       AND NOT EXISTS (
         SELECT 1 FROM reading_attempts a
          WHERE a.reading_id = r.id AND a.participant_id = ${participantId}
            AND a.round = ${round} AND a.status = 'completed')
     ORDER BY r.position, r.id`;
  return rows.map((r) => r.id);
}

export async function roundStatus(tx: Tx, participantId: number) {
  const round = await currentRound(tx, participantId);
  const pending = await pendingReadingIds(tx, participantId, round);
  return { round, completed: pending.length === 0 };
}

async function createAttempt(tx: Tx, participantId: number, readingId: number, round: number) {
  const [{ next }] = await tx<{ next: number }[]>`
    SELECT coalesce(max(attempt_number), 0)::int + 1 AS next FROM reading_attempts
     WHERE participant_id = ${participantId} AND reading_id = ${readingId}`;
  const [attempt] = await tx<Attempt[]>`
    INSERT INTO reading_attempts (participant_id, reading_id, round, attempt_number)
    VALUES (${participantId}, ${readingId}, ${round}, ${next})
    RETURNING id, reading_id, round, attempt_number, status`;
  return attempt;
}

/** Intento en curso de la ronda actual; si no hay, lo crea para la siguiente lectura pendiente. */
export async function ensureCurrentAttempt(tx: Tx, participantId: number): Promise<Attempt | null> {
  const round = await currentRound(tx, participantId);
  const [existing] = await tx<Attempt[]>`
    SELECT a.id, a.reading_id, a.round, a.attempt_number, a.status
      FROM reading_attempts a JOIN readings r ON r.id = a.reading_id
     WHERE a.participant_id = ${participantId} AND a.round = ${round}
       AND a.status = 'in_progress' AND r.is_active
     ORDER BY r.position, r.id LIMIT 1`;
  if (existing) return existing;

  const [nextReading] = await pendingReadingIds(tx, participantId, round);
  return nextReading ? createAttempt(tx, participantId, nextReading, round) : null;
}

/** Empieza una nueva ronda con la primera lectura activa. Solo si la ronda actual esta completa. */
export async function startRepeat(tx: Tx, participantId: number) {
  const { round, completed } = await roundStatus(tx, participantId);
  if (!completed) throw new ConflictError("Aún tienes lecturas pendientes en esta ronda.");
  const [first] = await activeReadings(tx);
  if (!first) throw new ConflictError("No hay lecturas activas.");
  await createAttempt(tx, participantId, first.id, round + 1);
}

/**
 * Palabra actual del intento: la presentada y sin responder, o la siguiente por posicion en el texto.
 * Presentar es idempotente: una palabra ya presentada conserva su presented_at.
 */
async function ensureCurrentWord(tx: Tx, attempt: Attempt): Promise<WordResponse | null> {
  const [open] = await tx<WordResponse[]>`
    SELECT id, target_word_id, hint_level, presented_at, answered_at FROM word_responses
     WHERE reading_attempt_id = ${attempt.id} AND answered_at IS NULL`;
  if (open) return open;

  const [next] = await tx<{ id: number }[]>`
    SELECT tw.id FROM target_words tw
     WHERE tw.reading_id = ${attempt.reading_id}
       AND NOT EXISTS (
         SELECT 1 FROM word_responses wr WHERE wr.reading_attempt_id = ${attempt.id} AND wr.target_word_id = tw.id)
     ORDER BY tw.start_offset LIMIT 1`;
  if (!next) return null;
  const [created] = await tx<WordResponse[]>`
    INSERT INTO word_responses (reading_attempt_id, target_word_id) VALUES (${attempt.id}, ${next.id})
    RETURNING id, target_word_id, hint_level, presented_at, answered_at`;
  return created;
}

/** Palabra presentada y sin responder; sin ella no se puede pedir ayuda ni responder. */
async function openWord(tx: Tx, participantId: number) {
  const [row] = await tx<(WordResponse & { attempt_id: number; reading_id: number })[]>`
    SELECT wr.id, wr.target_word_id, wr.hint_level, wr.presented_at, wr.answered_at,
           a.id AS attempt_id, a.reading_id
      FROM word_responses wr
      JOIN reading_attempts a ON a.id = wr.reading_attempt_id
      JOIN readings r ON r.id = a.reading_id
     WHERE a.participant_id = ${participantId} AND a.status = 'in_progress' AND r.is_active
       AND wr.answered_at IS NULL
     ORDER BY a.round DESC LIMIT 1`;
  if (!row) throw new ConflictError("No hay una pregunta abierta.");
  return row;
}

// Al participante solo se le dice el numero de la ayuda: ni su tipo ni su costo
async function revealedHints(tx: Tx, targetWordId: number, upTo: number) {
  return tx<{ level: HintLevel; content: string }[]>`
    SELECT level, content FROM hints WHERE target_word_id = ${targetWordId} AND level <= ${upTo} ORDER BY level`;
}

function nextHint(hintLevel: number) {
  return hintLevel < LEXICO ? { level: (hintLevel + 1) as HintLevel } : null;
}

/**
 * Estado que ve el participante. Nunca incluye is_correct ni ayudas por encima del nivel alcanzado.
 */
export async function currentState(tx: Tx, participantId: number) {
  const attempt = await ensureCurrentAttempt(tx, participantId);
  if (!attempt) return { status: "completed" as const };

  const word = await ensureCurrentWord(tx, attempt);
  if (!word) throw new Error(`El intento ${attempt.id} no tiene palabras pendientes y sigue en curso`);

  const readings = await activeReadings(tx);
  const readingIndex = readings.findIndex((r) => r.id === attempt.reading_id);
  const reading = readings[readingIndex];

  const words = await tx<{ id: number; word: string; start_offset: number; end_offset: number }[]>`
    SELECT id, word, start_offset, end_offset FROM target_words WHERE reading_id = ${attempt.reading_id}
     ORDER BY start_offset`;
  const wordIndex = words.findIndex((w) => w.id === word.target_word_id);
  const target = words[wordIndex];

  const options = await tx<{ id: number; text: string }[]>`
    SELECT id, text FROM answer_options WHERE target_word_id = ${target.id} ORDER BY position, id`;

  return {
    status: "in_progress" as const,
    round: attempt.round,
    reading: {
      title: reading.title,
      content: reading.content,
      number: readingIndex + 1,
      total: readings.length,
      image: await getImageRef(tx, reading.id),
    },
    word: {
      word: target.word,
      start: target.start_offset,
      end: target.end_offset,
      number: wordIndex + 1,
      total: words.length,
      hintLevel: word.hint_level,
      hints: await revealedHints(tx, target.id, word.hint_level),
      nextHint: nextHint(word.hint_level),
      options,
    },
  };
}

/**
 * Revela la ayuda `level` de la palabra abierta. Si ya estaba revelada la devuelve sin avanzar
 * (doble clic, otra pestana); solo se puede avanzar al nivel siguiente.
 */
export async function requestHint(tx: Tx, participantId: number, level: number) {
  const word = await openWord(tx, participantId);
  if (level > word.hint_level + 1) throw new ConflictError("Las ayudas se piden en orden.");
  if (level > LEXICO) throw new ConflictError("Ya usaste todas las ayudas de esta palabra.");

  if (level === word.hint_level + 1) {
    const updated = await tx`
      UPDATE word_responses SET hint_level = hint_level + 1
       WHERE id = ${word.id} AND answered_at IS NULL AND hint_level = ${word.hint_level}
      RETURNING hint_level`;
    if (!updated.length) throw new ConflictError("La pregunta cambió. Recarga la página.");
    await tx`INSERT INTO hint_requests (word_response_id, level) VALUES (${word.id}, ${level})`;
  }

  const [hint] = await revealedHints(tx, word.target_word_id, level).then((hs) => hs.filter((h) => h.level === level));
  return { ...hint, hintLevel: Math.max(level, word.hint_level), nextHint: nextHint(Math.max(level, word.hint_level)) };
}

/** Responde la palabra abierta. El puntaje sale solo del registro del servidor. */
export async function answer(tx: Tx, participantId: number, optionId: number) {
  const word = await openWord(tx, participantId);

  const options = await tx<{ id: number; is_correct: boolean }[]>`
    SELECT id, is_correct FROM answer_options WHERE target_word_id = ${word.target_word_id}`;
  const chosen = options.find((o) => o.id === optionId);
  if (!chosen) throw new ValidationError("La opción no corresponde a la pregunta actual.");
  const correct = options.find((o) => o.is_correct)!;

  const points = pointsFor(word.hint_level, chosen.is_correct);
  const closed = await tx`
    UPDATE word_responses
       SET answered_at = clock_timestamp(), selected_option_id = ${optionId},
           is_correct = ${chosen.is_correct}, points = ${points}
     WHERE id = ${word.id} AND answered_at IS NULL
    RETURNING id`;
  if (!closed.length) throw new ConflictError("Esta pregunta ya fue respondida.");

  // El Lexico al fallar es retroalimentacion: se muestra pero no se registra como ayuda pedida
  let lexico: string | null = null;
  if (!chosen.is_correct) {
    const [hint] = await tx<{ content: string }[]>`
      SELECT content FROM hints WHERE target_word_id = ${word.target_word_id} AND level = ${LEXICO}`;
    lexico = hint?.content ?? null;
  }

  const readingDone = await completeAttemptIfDone(tx, word.attempt_id, word.reading_id);
  const next = !readingDone ? "word" : (await roundStatus(tx, participantId)).completed ? "summary" : "reading";

  return { isCorrect: chosen.is_correct, points, correctOptionId: correct.id, lexico, next };
}

async function completeAttemptIfDone(tx: Tx, attemptId: number, readingId: number): Promise<boolean> {
  const [{ total, answered, score }] = await tx<{ total: number; answered: number; score: number }[]>`
    SELECT (SELECT count(*)::int FROM target_words WHERE reading_id = ${readingId}) AS total,
           count(wr.answered_at)::int AS answered,
           coalesce(sum(wr.points), 0)::int AS score
      FROM word_responses wr WHERE wr.reading_attempt_id = ${attemptId}`;
  if (answered < total) return false;
  await tx`
    UPDATE reading_attempts
       SET status = 'completed', completed_at = clock_timestamp(), score = ${score}, max_score = ${total * BASE_POINTS}
     WHERE id = ${attemptId}`;
  return true;
}

async function wordResults(tx: Tx, attemptIds: number[]): Promise<WordResult[]> {
  if (!attemptIds.length) return [];
  const rows = await tx<
    { id: number; is_correct: boolean; points: number; hint_level: number; answered_at: Date; level: HintLevel | null; delivered_at: Date | null }[]
  >`
    SELECT wr.id, wr.is_correct, wr.points, wr.hint_level, wr.answered_at, hr.level, hr.delivered_at
      FROM word_responses wr LEFT JOIN hint_requests hr ON hr.word_response_id = wr.id
     WHERE wr.reading_attempt_id IN ${tx(attemptIds)} AND wr.answered_at IS NOT NULL
     ORDER BY wr.id`;
  const byWord = new Map<number, WordResult>();
  for (const r of rows) {
    const w = byWord.get(r.id) ?? {
      isCorrect: r.is_correct,
      points: r.points,
      hintLevel: r.hint_level,
      answeredAt: r.answered_at,
      hintsDelivered: {},
    };
    if (r.level && r.delivered_at) w.hintsDelivered[r.level] = r.delivered_at;
    byWord.set(r.id, w);
  }
  return [...byWord.values()];
}

async function completedAttempts(tx: Tx, participantId: number, filter: "official" | { round: number }) {
  return tx<{ id: number; score: number; max_score: number }[]>`
    SELECT a.id, a.score, a.max_score
      FROM reading_attempts a JOIN readings r ON r.id = a.reading_id
     WHERE a.participant_id = ${participantId} AND r.is_active AND a.status = 'completed'
       AND ${filter === "official" ? tx`a.attempt_number = 1` : tx`a.round = ${filter.round}`}`;
}

/** Resumen de la ronda actual; en una repeticion incluye la calificacion oficial (primer intento). */
export async function summary(tx: Tx, participantId: number) {
  const { round, completed } = await roundStatus(tx, participantId);
  if (!completed) throw new ConflictError("Termina las lecturas activas para ver el resumen.");

  const current = await completedAttempts(tx, participantId, { round });
  const maxScore = current.reduce((sum, a) => sum + a.max_score, 0);
  const result = computeSummary(await wordResults(tx, current.map((a) => a.id)), maxScore);

  const official = await completedAttempts(tx, participantId, "official");
  const officialScore = official.reduce((sum, a) => sum + a.score, 0);
  const officialMax = official.reduce((sum, a) => sum + a.max_score, 0);

  return {
    round,
    isRepeat: round > 1,
    ...result,
    official: {
      score: officialScore,
      maxScore: officialMax,
      percent: officialMax ? Math.round((officialScore / officialMax) * 100) : 0,
    },
  };
}
