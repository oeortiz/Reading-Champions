import { HINT_LEVELS, HINT_NAMES, type HintLevel } from "./hints.ts";

export type WordResult = {
  isCorrect: boolean;
  points: number;
  /** Nivel de ayuda alcanzado antes de responder (0..4). El Lexico mostrado tras fallar no cuenta. */
  hintLevel: number;
  answeredAt: Date;
  /** Momento en que el servidor entrego cada ayuda pedida. */
  hintsDelivered: Partial<Record<HintLevel, Date>>;
};

export type HintUsage = { level: HintLevel; name: string; count: number };

export type HintEffectiveness = {
  level: HintLevel;
  name: string;
  answered: number;
  correct: number;
  /** Aciertos / respuestas atribuidas; null si ninguna respuesta se atribuye a este tipo. */
  effectiveness: number | null;
  /** Promedio de segundos entre la entrega de la ayuda y la respuesta; null sin datos. */
  avgSecondsAfterHint: number | null;
};

export type Summary = {
  score: number;
  maxScore: number;
  percent: number;
  hintUsage: HintUsage[];
  effectiveness: HintEffectiveness[];
};

export function computeSummary(words: WordResult[], maxScore: number): Summary {
  const score = words.reduce((sum, w) => sum + w.points, 0);

  const hintUsage = HINT_LEVELS.map((level) => ({
    level,
    name: HINT_NAMES[level],
    count: words.filter((w) => w.hintsDelivered[level] !== undefined).length,
  })).sort((a, b) => b.count - a.count || a.level - b.level);

  // Cada respuesta se atribuye a la ultima ayuda pedida, que por el orden fijo es su nivel alcanzado
  const effectiveness = HINT_LEVELS.map((level) => {
    const group = words.filter((w) => w.hintLevel === level);
    const correct = group.filter((w) => w.isCorrect).length;
    const waits = group
      .map((w) => w.hintsDelivered[level])
      .map((delivered, i) => (delivered ? (group[i].answeredAt.getTime() - delivered.getTime()) / 1000 : null))
      .filter((s): s is number => s !== null);
    return {
      level,
      name: HINT_NAMES[level],
      answered: group.length,
      correct,
      effectiveness: group.length ? correct / group.length : null,
      avgSecondsAfterHint: waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : null,
    };
  });

  return {
    score,
    maxScore,
    percent: maxScore ? Math.round((score / maxScore) * 100) : 0,
    hintUsage,
    effectiveness,
  };
}
