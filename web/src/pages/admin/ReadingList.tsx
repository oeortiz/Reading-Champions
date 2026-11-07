import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client.ts";
import type { ReadingDetail, ReadingListItem } from "../../api/types.ts";
import { Button, Card, Chip, ErrorBox, Field } from "../../components/ui.tsx";

export function ReadingList() {
  const navigate = useNavigate();
  const readings = useQuery({
    queryKey: ["admin", "readings"],
    queryFn: () => api<ReadingListItem[]>("/admin/readings"),
  });
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const create = useMutation({
    mutationFn: () => api<ReadingDetail>("/admin/readings", { body: { title, content } }),
    onSuccess: (r) => navigate(`/admin/lecturas/${r.id}`),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  return (
    <>
      <h1 style={{ marginBottom: "var(--space-4)" }}>Lecturas</h1>
      <Card>
        {readings.isPending ? (
          <p className="muted">Cargando…</p>
        ) : readings.isError ? (
          <ErrorBox error={readings.error} />
        ) : readings.data.length === 0 ? (
          <p className="muted">Todavía no hay lecturas.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Título</th>
                  <th>Palabras</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {readings.data.map((r) => (
                  <tr key={r.id}>
                    <td>{r.position}</td>
                    <td>
                      <Link className="table-link" to={`/admin/lecturas/${r.id}`}>
                        {r.title}
                      </Link>
                    </td>
                    <td>{r.wordCount}</td>
                    <td>
                      <div className="chips">
                        <Chip tone={r.isActive ? "ok" : "neutral"}>{r.isActive ? "Activa" : "Inactiva"}</Chip>
                        {!r.isActive && r.issues.length > 0 && <Chip tone="warn">Incompleta</Chip>}
                        {r.hasAttempts && <Chip>Con resultados</Chip>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card as="div">
        <form className="stack stack-lg" onSubmit={submit}>
          <h2>Nueva lectura</h2>
          <Field label="Título">
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Texto (separa los párrafos con una línea en blanco)">
            <textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} />
          </Field>
          <ErrorBox error={create.error} />
          <div>
            <Button type="submit" variant="primary" disabled={create.isPending} icon={<Plus size={18} aria-hidden />}>
              Crear lectura
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
