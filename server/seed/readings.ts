import type { HintLevel } from "../src/domain/hints.ts";

export type SeedWord = {
  word: string;
  hints: Record<HintLevel, string>;
  /** La primera opción es la correcta. */
  options: string[];
  /** Orden en que se muestran las opciones (índices de `options`), para que la correcta no sea siempre la primera. */
  order: number[];
};

export type SeedReading = {
  title: string;
  content: string;
  /** Ilustración propia en `seed/images/`. */
  image: { file: string; alt: string };
  words: SeedWord[];
};

/** Lecturas que dejaron de ser iniciales: el seed las elimina, o las desactiva si ya tienen intentos. */
export const RETIRED_TITLES = ["El volcán despierta"];

// Contenido de ejemplo: el administrador puede reemplazarlo desde el panel.
export const SEED_READINGS: SeedReading[] = [
  {
    title: "El espejo de la integridad",
    content: [
      "Un carácter acendrado es la posesión más valiosa que puede construir un ser humano, una cualidad ética pura y sin manchas que no se vende por dinero ni se rinde ante las presiones del entorno. Cuando un individuo posee esta rectitud, sus acciones no buscan el aplauso del público ni el reconocimiento en las redes sociales, sino la paz de estar en armonía con su propia conciencia, conservando una integridad inmarcesible incluso cuando nadie observa.",
      "Su ataraxia no debe confundirse con la indiferencia, pues representa la capacidad de mantenerse fiel a sus principios frente a las adversidades, sin sucumbir ante la tentación de la aprobación ajena. En un mundo donde la corrupción moral parece avanzar de manera inexorable, la verdadera fortaleza reside en no conceder nuestra aquiescencia a aquello que contradice nuestros valores.",
      "El valor de una persona no se demuestra en los momentos de éxito visible, sino en la honestidad silenciosa de sus decisiones cotidianas.",
    ].join("\n\n"),
    image: { file: "espejo-integridad.svg", alt: "Un espejo antiguo que refleja una luz serena" },
    words: [
      {
        word: "acendrado",
        hints: {
          1: "Del verbo acendrar, del latín incendere («encender»): purificar los metales con fuego. La terminación -ado indica el resultado: «que ya fue purificado».",
          2: "El texto lo explica enseguida: «una cualidad ética pura y sin manchas que no se vende por dinero».",
          3: "Parecido a: puro, intachable, depurado, impecable.",
          4: "Puro y sin mancha ni defecto; dicho del carácter: limpio, sin tacha.",
        },
        options: ["Puro y sin mancha", "Rígido y difícil de tratar", "Antiguo y heredado", "Débil y fácil de convencer"],
        order: [1, 0, 3, 2],
      },
      {
        word: "inmarcesible",
        hints: {
          1: "in- (negación) + latín marcescere («marchitarse») + -ible («que puede»): «que no puede marchitarse».",
          2: "Es una integridad que se conserva «incluso cuando nadie observa»: ¿se debilita con el tiempo o permanece?",
          3: "Parecido a: imperecedero, inmarchitable, perdurable.",
          4: "Que no puede marchitarse; que no se debilita ni se pierde con el tiempo.",
        },
        options: [
          "Que no se marchita ni se pierde",
          "Que se nota a simple vista",
          "Que cambia según la situación",
          "Que es difícil de explicar",
        ],
        order: [2, 1, 0, 3],
      },
      {
        word: "ataraxia",
        hints: {
          1: "Del griego a- («sin») + tarachē («agitación, perturbación»): «estado sin perturbación».",
          2: "El texto aclara que «no debe confundirse con la indiferencia» y que permite mantenerse fiel «frente a las adversidades».",
          3: "Parecido a: serenidad, imperturbabilidad, calma interior.",
          4: "Tranquilidad y serenidad del ánimo que no se altera ante las dificultades.",
        },
        options: ["Serenidad que no se altera", "Falta de interés por los demás", "Tristeza profunda", "Miedo a equivocarse"],
        order: [3, 0, 2, 1],
      },
      {
        word: "inexorable",
        hints: {
          1: "in- (negación) + latín exorare («convencer con ruegos») + -able: «que no se deja convencer con ruegos».",
          2: "La corrupción «parece avanzar de manera inexorable»: ¿avanza con pausas o sin que nada la detenga?",
          3: "Parecido a: implacable, imparable, inevitable.",
          4: "Que no se puede evitar ni detener; que no cede ante ruegos.",
        },
        options: ["Que no se puede detener", "Que avanza muy despacio", "Que es fácil de evitar", "Que ocurre por casualidad"],
        order: [0, 2, 3, 1],
      },
      {
        word: "aquiescencia",
        hints: {
          1: "Del latín acquiescere: ad- («hacia») + quiescere («descansar, quedarse tranquilo»): «quedarse conforme con algo».",
          2: "La fortaleza está en «no conceder» esto a lo que contradice nuestros valores: ¿qué es lo que no debemos dar?",
          3: "Parecido a: consentimiento, aprobación, conformidad.",
          4: "Consentimiento o aprobación que se da a algo.",
        },
        options: ["Consentimiento o aprobación", "Rechazo firme", "Duda o indecisión", "Crítica pública"],
        order: [1, 3, 0, 2],
      },
    ],
  },
  {
    title: "La biblioteca del barrio",
    content:
      "La vieja biblioteca del barrio estuvo a punto de cerrar por falta de recursos. " +
      "Sin embargo, un grupo de vecinos tenaces organizó jornadas para recaudar fondos y restaurar los estantes deteriorados. " +
      "Gracias a su perseverancia, hoy la biblioteca es un lugar concurrido donde niños y adultos comparten historias cada tarde.",
    image: { file: "biblioteca-barrio.svg", alt: "Estantería con libros de colores en una biblioteca de barrio" },
    words: [
      {
        word: "tenaces",
        hints: {
          1: "Del latín tenere: «sostener, agarrar», como en tener o tenaza.",
          2: "Los vecinos no dejaron que la biblioteca cerrara y organizaron jornadas: ¿se rindieron fácilmente?",
          3: "Parecido a: firmes, persistentes, obstinados.",
          4: "Que se mantienen firmes y constantes en un propósito, sin rendirse.",
        },
        options: ["Que no se rinden fácilmente", "Que son muy ricos", "Que viven lejos", "Que están siempre cansados"],
        order: [1, 2, 0, 3],
      },
      {
        word: "deteriorados",
        hints: {
          1: "Del latín deterior: «peor». La terminación -ado indica el resultado de una acción.",
          2: "Había que «restaurar» los estantes: ¿en qué estado estaban?",
          3: "Parecido a: estropeados, gastados, dañados.",
          4: "Que han sufrido daño o desgaste y están en peor estado que antes.",
        },
        options: ["Dañados o desgastados", "Recién comprados", "Pintados de colores", "Muy pequeños"],
        order: [2, 0, 1, 3],
      },
      {
        word: "perseverancia",
        hints: {
          1: "per- (completamente) + severus (firme, serio) + -ancia (cualidad).",
          2: "Gracias a ella, la biblioteca que iba a cerrar sigue abierta: ¿qué tuvieron que hacer los vecinos durante mucho tiempo?",
          3: "Parecido a: constancia, tesón, persistencia.",
          4: "Firmeza y constancia para seguir haciendo algo y lograrlo a pesar de las dificultades.",
        },
        options: ["Constancia para seguir intentando algo", "Suerte inesperada", "Miedo a fracasar", "Prisa por terminar"],
        order: [3, 0, 2, 1],
      },
      {
        word: "concurrido",
        hints: {
          1: "con- (junto) + currere (correr): «correr juntos» hacia un mismo lugar.",
          2: "Niños y adultos llegan cada tarde a compartir historias: ¿hay mucha o poca gente?",
          3: "Parecido a: frecuentado, animado, lleno de gente.",
          4: "Dicho de un lugar: al que acude mucha gente.",
        },
        options: ["Visitado por mucha gente", "Abandonado y vacío", "Muy silencioso", "Lejano y difícil de llegar"],
        order: [1, 3, 0, 2],
      },
    ],
  },
];
