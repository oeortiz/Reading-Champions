export const HINT_LEVELS = [1, 2, 3, 4] as const;
export type HintLevel = (typeof HINT_LEVELS)[number];

export const HINT_NAMES: Record<HintLevel, string> = {
  1: "Radicación",
  2: "Contexto",
  3: "Sinonimia",
  4: "Léxico",
};

export const LEXICO: HintLevel = 4;
