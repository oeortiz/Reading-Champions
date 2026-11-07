import { describe, expect, test } from "bun:test";
import { nextHintCost, pointsFor } from "../src/domain/scoring.ts";
import { computeSummary, type WordResult } from "../src/domain/stats.ts";
import { locateTargetWord } from "../src/domain/word-locator.ts";

describe("pointsFor", () => {
  test("acierto segun la ayuda alcanzada", () => {
    expect([0, 1, 2, 3, 4].map((l) => pointsFor(l, true))).toEqual([100, 85, 70, 40, 20]);
  });
  test("fallo vale 0 en cualquier nivel", () => {
    expect([0, 1, 2, 3, 4].map((l) => pointsFor(l, false))).toEqual([0, 0, 0, 0, 0]);
  });
  test("costo de la siguiente ayuda", () => {
    expect([0, 1, 2, 3, 4].map(nextHintCost)).toEqual([15, 15, 30, 20, null]);
  });
});

describe("locateTargetWord", () => {
  const text = "El Banco cerró temprano. Fui al banco del parque.";
  test("primera aparicion sin distinguir mayusculas", () => {
    expect(locateTargetWord(text, "banco")).toEqual({ start: 3, end: 8 });
  });
  test("ignora coincidencias dentro de otra palabra", () => {
    const t = "Quiso desbancar al banco.";
    expect(locateTargetWord(t, "banco")).toEqual({ start: t.lastIndexOf("banco"), end: t.lastIndexOf("banco") + 5 });
  });
  test("palabras con tilde y ñ", () => {
    expect(locateTargetWord("Pasó un camión.", "camión")).toEqual({ start: 8, end: 14 });
    expect(locateTargetWord("La caminata", "camin")).toBeNull();
    expect(locateTargetWord("Un niño y una niña", "NIÑO")).toEqual({ start: 3, end: 7 });
    expect(locateTargetWord("Un niñosaurio", "niño")).toBeNull();
  });
  test("tildes compuestas (NFD) coinciden con NFC", () => {
    expect(locateTargetWord("Pasó un camión.".normalize("NFD"), "camión")).toEqual({ start: 8, end: 14 });
  });
  test("caracteres especiales de regex se tratan literalmente", () => {
    expect(locateTargetWord("Cuesta (c++) mucho", "c++")).toEqual({ start: 8, end: 11 });
    expect(locateTargetWord("Cuesta cxx mucho", "c..")).toBeNull();
  });
  test("palabra ausente", () => {
    expect(locateTargetWord(text, "volcán")).toBeNull();
  });
});

describe("computeSummary", () => {
  const t0 = new Date("2026-01-01T10:00:00Z");
  const at = (s: number) => new Date(t0.getTime() + s * 1000);
  const word = (w: Partial<WordResult>): WordResult => ({
    isCorrect: true,
    points: 100,
    hintLevel: 0,
    answeredAt: at(60),
    hintsDelivered: {},
    ...w,
  });
  const find = (s: ReturnType<typeof computeSummary>, level: number) => s.effectiveness.find((e) => e.level === level)!;

  test("calificacion total", () => {
    const s = computeSummary([word({ points: 190 }), word({ points: 150 })], 500);
    expect([s.score, s.maxScore, s.percent]).toEqual([340, 500, 68]);
  });

  test("ayudas mas usadas ordenadas de mayor a menor", () => {
    const r = { 1: at(0) };
    const rc = { 1: at(0), 2: at(1) };
    const s = computeSummary(
      [word({ hintLevel: 1, hintsDelivered: r }), word({ hintLevel: 2, hintsDelivered: rc }), word({ hintLevel: 2, hintsDelivered: rc })],
      300,
    );
    expect(s.hintUsage.slice(0, 2)).toEqual([
      { level: 1, name: "Radicación", count: 3 },
      { level: 2, name: "Contexto", count: 2 },
    ]);
  });

  test("Lexico por fallo excluido", () => {
    const s = computeSummary([word({ isCorrect: false, points: 0, hintLevel: 0 })], 100);
    expect(s.hintUsage.find((u) => u.level === 4)!.count).toBe(0);
    expect(find(s, 4).answered).toBe(0);
  });

  test("efectividad: los fallos cuentan en contra", () => {
    const s = computeSummary(
      [
        word({ hintLevel: 1, points: 85, hintsDelivered: { 1: at(0) } }),
        word({ hintLevel: 1, isCorrect: false, points: 0, hintsDelivered: { 1: at(0) } }),
      ],
      200,
    );
    expect(find(s, 1)).toMatchObject({ answered: 2, correct: 1, effectiveness: 0.5 });
  });

  test("se atribuye a la ultima ayuda", () => {
    const s = computeSummary([word({ hintLevel: 2, points: 70, hintsDelivered: { 1: at(0), 2: at(5) } })], 100);
    expect(find(s, 1).answered).toBe(0);
    expect(find(s, 2)).toMatchObject({ answered: 1, correct: 1, effectiveness: 1 });
  });

  test("sin ayudas no se atribuye a ningun tipo", () => {
    const s = computeSummary([word({})], 100);
    expect(s.effectiveness.every((e) => e.answered === 0)).toBe(true);
  });

  test("tipo sin respuestas devuelve null, no 0", () => {
    const s = computeSummary([word({})], 100);
    expect(find(s, 3)).toMatchObject({ effectiveness: null, avgSecondsAfterHint: null });
  });

  test("tiempo promedio desde la entrega de la ayuda", () => {
    const s = computeSummary(
      [
        word({ hintLevel: 1, points: 85, hintsDelivered: { 1: at(0) }, answeredAt: at(6) }),
        word({ hintLevel: 1, points: 85, hintsDelivered: { 1: at(10) }, answeredAt: at(20) }),
      ],
      200,
    );
    expect(find(s, 1).avgSecondsAfterHint).toBe(8);
  });
});
