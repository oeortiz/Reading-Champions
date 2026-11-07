import type { HintLevel } from "./hints.ts";

export const BASE_POINTS = 100;

/** Penalizacion de cada ayuda, en el orden fijo en que se revelan. */
export const PENALTIES: Record<HintLevel, number> = { 1: 15, 2: 15, 3: 30, 4: 20 };

/** Puntos de una palabra segun el nivel de ayuda alcanzado (0..4) y si la respuesta fue correcta. */
export function pointsFor(hintLevel: number, isCorrect: boolean): number {
  if (!isCorrect) return 0;
  let points = BASE_POINTS;
  for (let level = 1; level <= hintLevel; level++) points -= PENALTIES[level as HintLevel];
  return points;
}

/** Costo de la siguiente ayuda, o null si ya se revelaron todas. */
export function nextHintCost(hintLevel: number): number | null {
  return hintLevel < 4 ? PENALTIES[(hintLevel + 1) as HintLevel] : null;
}
