import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api, apiForm } from "../../api/client.ts";
import { HINT_NAMES, type HintLevel, type ReadingDetail, type WordDetail } from "../../api/types.ts";
import { Button, Card, Chip, ErrorBox, Field } from "../../components/ui.tsx";

const LEVELS: HintLevel[] = [1, 2, 3, 4];
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

/** Mutacion que devuelve la lectura actualizada y refresca la cache. */
function useReadingMutation<V>(id: string, fn: (vars: V) => Promise<ReadingDetail>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (detail) => {
      queryClient.setQueryData(["admin", "reading", id], detail);
      queryClient.invalidateQueries({ queryKey: ["admin", "readings"] });
    },
  });
}

export function ReadingEditor() {
  const { id = "" } = useParams();
  const reading = useQuery({
    queryKey: ["admin", "reading", id],
    queryFn: () => api<ReadingDetail>(`/admin/readings/${id}`),
  });

  if (reading.isPending) return <p className="muted">Cargando…</p>;
  if (reading.isError) return <ErrorBox error={reading.error} />;
  return <Editor reading={reading.data} id={id} />;
}

function Editor({ reading, id }: { reading: ReadingDetail; id: string }) {
  const structureLocked = reading.hasAttempts || reading.isActive;

  const toggle = useReadingMutation(id, () =>
    api<ReadingDetail>(`/admin/readings/${id}/${reading.isActive ? "deactivate" : "activate"}`, { body: {} }),
  );

  return (
    <>
      <div className="editor-head">
        <h1>{reading.title}</h1>
        <Chip tone={reading.isActive ? "ok" : "neutral"}>{reading.isActive ? "Activa" : "Inactiva"}</Chip>
        <Button variant={reading.isActive ? "outline" : "primary"} onClick={() => toggle.mutate(undefined)} disabled={toggle.isPending}>
          {reading.isActive ? "Desactivar" : "Activar"}
        </Button>
      </div>
      <ErrorBox error={toggle.error} />

      {reading.hasAttempts ? (
        <p className="alert alert-info">
          Esta lectura ya tiene resultados registrados: no se puede cambiar su texto, palabras ni opciones. Puedes editar
          el título, el orden, la imagen y el texto de las ayudas.
        </p>
      ) : reading.isActive ? (
        <p className="alert alert-info">Desactiva la lectura para cambiar su texto, palabras u opciones.</p>
      ) : null}

      {!reading.isActive && reading.issues.length > 0 && (
        <div className="alert alert-warn">
          <p>Falta completar antes de activar:</p>
          <ul>
            {reading.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      )}

      <ReadingForm reading={reading} id={id} contentLocked={structureLocked} />
      <ImageSection reading={reading} id={id} />

      <h2 className="section-title">Palabras objetivo</h2>
      {reading.words.length === 0 && <p className="muted">Agrega al menos una palabra del texto.</p>}
      {reading.words.map((w) => (
        <WordCard key={w.id} word={w} readingId={id} structureLocked={structureLocked} canClearHints={!reading.isActive} />
      ))}
      {!structureLocked && <AddWord id={id} />}
    </>
  );
}

function ReadingForm({ reading, id, contentLocked }: { reading: ReadingDetail; id: string; contentLocked: boolean }) {
  const [title, setTitle] = useState(reading.title);
  const [content, setContent] = useState(reading.content);
  const [position, setPosition] = useState(String(reading.position));
  useEffect(() => {
    setTitle(reading.title);
    setContent(reading.content);
    setPosition(String(reading.position));
  }, [reading.title, reading.content, reading.position]);

  const save = useReadingMutation(id, () =>
    api<ReadingDetail>(`/admin/readings/${id}`, {
      method: "PUT",
      body: { title, content, position: Number(position) || 0 },
    }),
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(undefined);
  };

  return (
    <Card as="div">
      <form className="stack stack-lg" onSubmit={submit}>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <Field label="Título" className="grow">
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Orden" className="narrow-field">
            <input type="number" value={position} onChange={(e) => setPosition(e.target.value)} style={{ width: 96 }} />
          </Field>
        </div>
        <Field label="Texto (separa los párrafos con una línea en blanco)">
          <textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} readOnly={contentLocked} />
        </Field>
        <ErrorBox error={save.error} />
        <div className="actions">
          <Button type="submit" variant="primary" disabled={save.isPending}>
            Guardar lectura
          </Button>
          {save.isSuccess && <span className="muted small">Guardado</span>}
        </div>
      </form>
    </Card>
  );
}

function ImageSection({ reading, id }: { reading: ReadingDetail; id: string }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState(reading.image?.alt ?? "");
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => setAlt(reading.image?.alt ?? ""), [reading.image?.alt]);
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const save = useReadingMutation(id, () => {
    const form = new FormData();
    if (file) form.append("file", file);
    form.append("altText", alt);
    return apiForm<ReadingDetail>(`/admin/readings/${id}/image`, form);
  });
  const remove = useReadingMutation(id, () => api<ReadingDetail>(`/admin/readings/${id}/image`, { method: "DELETE" }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(undefined, {
      onSuccess: () => {
        setFile(null);
        if (fileInput.current) fileInput.current.value = "";
      },
    });
  };

  const shown = preview ?? reading.image?.url ?? null;

  return (
    <Card as="div">
      <form className="stack stack-lg" onSubmit={submit}>
        <h2>Imagen</h2>
        <div className="image-editor">
          <div className="image-preview">
            {shown ? <img src={shown} alt={alt || "Vista previa"} /> : <ImagePlus size={32} aria-label="Sin imagen" />}
          </div>
          <div className="stack">
            <Field label="Archivo" hint="PNG, JPEG o WebP, hasta 1 MB.">
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Field>
            <Field label="Texto alternativo" hint="Describe la imagen para quien no puede verla.">
              <input value={alt} onChange={(e) => setAlt(e.target.value)} />
            </Field>
          </div>
        </div>
        <ErrorBox error={save.error ?? remove.error} />
        <div className="actions">
          <Button type="submit" variant="primary" disabled={save.isPending || (!file && !reading.image)} icon={<ImagePlus size={18} aria-hidden />}>
            {reading.image ? (file ? "Reemplazar imagen" : "Guardar texto alternativo") : "Subir imagen"}
          </Button>
          {reading.image && (
            <Button variant="danger" onClick={() => remove.mutate(undefined)} disabled={remove.isPending} icon={<Trash2 size={18} aria-hidden />}>
              Quitar imagen
            </Button>
          )}
          {save.isSuccess && <span className="muted small">Guardado</span>}
        </div>
      </form>
    </Card>
  );
}

function AddWord({ id }: { id: string }) {
  const [word, setWord] = useState("");
  const add = useReadingMutation(id, () => api<ReadingDetail>(`/admin/readings/${id}/target-words`, { body: { word } }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate(undefined, { onSuccess: () => setWord("") });
  };

  return (
    <Card as="div">
      <form className="stack" onSubmit={submit}>
        <h3>Agregar palabra objetivo</h3>
        <div className="row">
          <input
            className="grow"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="Palabra tal como aparece en el texto"
            aria-label="Palabra objetivo nueva"
          />
          <Button type="submit" variant="primary" disabled={add.isPending} icon={<Plus size={18} aria-hidden />}>
            Agregar
          </Button>
        </div>
        <ErrorBox error={add.error} />
      </form>
    </Card>
  );
}

function WordCard({
  word,
  readingId,
  structureLocked,
  canClearHints,
}: {
  word: WordDetail;
  readingId: string;
  structureLocked: boolean;
  canClearHints: boolean;
}) {
  const [hints, setHints] = useState(() => Object.fromEntries(LEVELS.map((l) => [l, word.hints[l] ?? ""])) as Record<HintLevel, string>);
  const [options, setOptions] = useState(() =>
    word.options.length
      ? word.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect }))
      : [
          { text: "", isCorrect: false },
          { text: "", isCorrect: false },
        ],
  );

  const saveHints = useReadingMutation(readingId, () =>
    api<ReadingDetail>(`/admin/target-words/${word.id}/hints`, { method: "PUT", body: { hints } }),
  );
  const saveOptions = useReadingMutation(readingId, () =>
    api<ReadingDetail>(`/admin/target-words/${word.id}/options`, { method: "PUT", body: { options } }),
  );
  const remove = useReadingMutation(readingId, () => api<ReadingDetail>(`/admin/target-words/${word.id}`, { method: "DELETE" }));

  const setOption = (i: number, patch: Partial<{ text: string; isCorrect: boolean }>) =>
    setOptions((prev) => prev.map((o, j) => (j === i ? { ...o, ...patch } : patch.isCorrect ? { ...o, isCorrect: false } : o)));

  return (
    <Card className="stack stack-lg">
      <div className="editor-head" style={{ marginBottom: 0 }}>
        <h3>«{word.word}»</h3>
        {!structureLocked && (
          <Button variant="danger" size="sm" onClick={() => remove.mutate(undefined)} disabled={remove.isPending} icon={<Trash2 size={16} aria-hidden />}>
            Eliminar palabra
          </Button>
        )}
      </div>
      <ErrorBox error={remove.error} />

      <div className="stack">
        <h4>Ayudas (en este orden)</h4>
        {LEVELS.map((level) => (
          <Field key={level} label={`${level}. ${HINT_NAMES[level]}`}>
            <textarea rows={2} value={hints[level]} onChange={(e) => setHints((prev) => ({ ...prev, [level]: e.target.value }))} />
          </Field>
        ))}
        <ErrorBox error={saveHints.error} />
        <div className="actions">
          <Button onClick={() => saveHints.mutate(undefined)} disabled={saveHints.isPending || (!canClearHints && LEVELS.some((l) => !hints[l].trim()))}>
            Guardar ayudas
          </Button>
          {saveHints.isSuccess && <span className="muted small">Guardado</span>}
        </div>
      </div>

      <div className="stack">
        <h4>Opciones de respuesta (marca la correcta)</h4>
        {options.map((o, i) => (
          <div className="option-editor" key={i}>
            <label>
              <input
                type="radio"
                name={`correct-${word.id}`}
                checked={o.isCorrect}
                onChange={() => setOption(i, { isCorrect: true })}
                disabled={structureLocked}
                aria-label={`Marcar la opción ${i + 1} como correcta`}
              />
            </label>
            <input
              className="grow"
              value={o.text}
              onChange={(e) => setOption(i, { text: e.target.value })}
              readOnly={structureLocked}
              placeholder={`Opción ${i + 1}`}
              aria-label={`Texto de la opción ${i + 1}`}
            />
            {!structureLocked && options.length > MIN_OPTIONS && (
              <Button variant="ghost" size="sm" onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}>
                Quitar
              </Button>
            )}
          </div>
        ))}
        <ErrorBox error={saveOptions.error} />
        {!structureLocked && (
          <div className="actions">
            {options.length < MAX_OPTIONS && (
              <Button variant="ghost" onClick={() => setOptions((prev) => [...prev, { text: "", isCorrect: false }])} icon={<Plus size={18} aria-hidden />}>
                Agregar opción
              </Button>
            )}
            <Button onClick={() => saveOptions.mutate(undefined)} disabled={saveOptions.isPending}>
              Guardar opciones
            </Button>
            {saveOptions.isSuccess && <span className="muted small">Guardado</span>}
          </div>
        )}
      </div>
    </Card>
  );
}
