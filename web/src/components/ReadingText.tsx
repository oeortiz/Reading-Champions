export type TargetVariant = "a" | "b" | "c";

/** Variante de animacion por orden de aparicion: dos palabras consecutivas nunca comparten variante. */
export const variantFor = (wordNumber: number): TargetVariant => (["a", "b", "c"] as const)[(wordNumber - 1) % 3];

type Props = {
  content: string;
  start: number;
  end: number;
  variant: TargetVariant;
  answered: boolean;
};

/**
 * Texto de la lectura en parrafos (separados por linea en blanco). La palabra objetivo se marca en el
 * parrafo que contiene [start, end); los offsets son del texto completo, tal como los guarda el servidor.
 */
export function ReadingText({ content, start, end, variant, answered }: Props) {
  let offset = 0;
  const paragraphs = content.split("\n\n").map((text) => {
    const p = { text, offset };
    offset += text.length + 2;
    return p;
  });

  return (
    <div className="reading-text">
      {paragraphs.map((p) => {
        const s = start - p.offset;
        const e = end - p.offset;
        if (s < 0 || e > p.text.length) return <p key={p.offset}>{p.text}</p>;
        return (
          <p key={p.offset}>
            {p.text.slice(0, s)}
            <mark className="target" data-variant={variant} data-state={answered ? "answered" : "active"}>
              {p.text.slice(s, e)}
            </mark>
            {p.text.slice(e)}
          </p>
        );
      })}
    </div>
  );
}
