export type HintLevel = 1 | 2 | 3 | 4;

export type ImageRef = { url: string; alt: string } | null;

export type SessionResponse = { participant: { fullName: string }; next: "reading" | "summary" };

export type RevealedHint = { level: HintLevel; content: string };
export type NextHint = { level: HintLevel } | null;

export type CurrentState =
  | { participant: { fullName: string }; status: "completed" }
  | {
      participant: { fullName: string };
      status: "in_progress";
      round: number;
      reading: { title: string; content: string; number: number; total: number; image: ImageRef };
      word: {
        word: string;
        start: number;
        end: number;
        number: number;
        total: number;
        hintLevel: number;
        hints: RevealedHint[];
        nextHint: NextHint;
        options: { id: number; text: string }[];
      };
    };

export type AnswerResult = {
  isCorrect: boolean;
  points: number;
  correctOptionId: number;
  lexico: string | null;
  next: "word" | "reading" | "summary";
};

export type Summary = {
  participant: { fullName: string };
  round: number;
  isRepeat: boolean;
  score: number;
  maxScore: number;
  percent: number;
  hintUsage: { level: HintLevel; name: string; count: number }[];
  effectiveness: {
    level: HintLevel;
    name: string;
    answered: number;
    correct: number;
    effectiveness: number | null;
    avgSecondsAfterHint: number | null;
  }[];
  official: { score: number; maxScore: number; percent: number };
};

export type ReadingListItem = {
  id: number;
  title: string;
  position: number;
  isActive: boolean;
  hasAttempts: boolean;
  wordCount: number;
  issues: string[];
};

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

export const HINT_NAMES: Record<HintLevel, string> = {
  1: "Radicación",
  2: "Contexto",
  3: "Sinonimia",
  4: "Léxico",
};
