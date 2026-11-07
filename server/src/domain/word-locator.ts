export type WordLocation = { start: number; end: number };

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Primera aparicion de `word` como palabra completa dentro de `content`, sin distinguir mayusculas.
 * Usa limites de letra Unicode en lugar de \b, que no reconoce letras acentuadas.
 * Ambos textos se comparan en NFC; los offsets son indices de `content` normalizado.
 */
export function locateTargetWord(content: string, word: string): WordLocation | null {
  const needle = word.normalize("NFC").trim();
  if (!needle) return null;
  const pattern = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escapeRegex(needle)}(?![\\p{L}\\p{M}\\p{N}])`, "iu");
  const match = pattern.exec(content.normalize("NFC"));
  return match ? { start: match.index, end: match.index + match[0].length } : null;
}
