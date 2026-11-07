import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, LogOut, RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client.ts";
import type { Summary } from "../api/types.ts";
import { Logo } from "../components/Logo.tsx";
import { Button, Card, Chip, ErrorBox } from "../components/ui.tsx";

const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);
const seconds = (value: number | null) => (value === null ? "—" : `${value.toFixed(1)} s`);

export function Resumen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const summary = useQuery({ queryKey: ["summary"], queryFn: () => api<Summary>("/assessment/summary") });

  useEffect(() => {
    if (!(summary.error instanceof ApiError)) return;
    if (summary.error.status === 401) navigate("/", { replace: true });
    if (summary.error.status === 409) navigate("/lectura", { replace: true });
  }, [summary.error, navigate]);

  const repeat = useMutation({
    mutationFn: () => api("/assessment/repeat", { body: {} }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      navigate("/lectura");
    },
  });

  if (summary.isPending) {
    return (
      <main className="page">
        <p className="muted">Cargando…</p>
      </main>
    );
  }
  if (summary.isError) {
    return (
      <main className="page">
        <ErrorBox error={summary.error} />
      </main>
    );
  }

  const s = summary.data;
  const used = s.hintUsage.filter((u) => u.count > 0);

  return (
    <main className="page">
      <header className="topbar">
        <Logo size={40} />
        <div className="topbar-meta">
          <span className="small muted">{s.participant.fullName}</span>
          <Chip tone={s.isRepeat ? "warn" : "ok"}>{s.isRepeat ? `Intento #${s.round} (práctica)` : "Resultado oficial"}</Chip>
        </div>
      </header>

      <h1 style={{ marginBottom: "var(--space-4)" }}>Resumen</h1>

      {s.isRepeat && (
        <div className="alert alert-info row" role="note">
          <Info size={20} aria-hidden style={{ flex: "none" }} />
          <p>
            Tu calificación oficial es la del primer intento:{" "}
            <strong>
              {s.official.score} / {s.official.maxScore}
            </strong>{" "}
            ({s.official.percent}%). Este resumen corresponde a tu último intento.
          </p>
        </div>
      )}

      <Card className="score-card">
        <div className="stack" style={{ gap: 6 }}>
          <span className="muted">{s.isRepeat ? "Este intento" : "Calificación total"}</span>
          <span className="score-value">
            {s.score} <span className="score-max">/ {s.maxScore}</span>
          </span>
        </div>
        <Chip tone="accent">{s.percent}%</Chip>
      </Card>

      <Card className="stack">
        <h2>Ayudas más usadas</h2>
        {used.length === 0 ? (
          <p className="muted">No usaste ayudas.</p>
        ) : (
          <ol className="chips" style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label="Ayudas más usadas">
            {used.map((u) => (
              <li key={u.level}>
                <Chip>
                  {u.name} <span className="muted">({u.count})</span>
                </Chip>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card className="stack stack-lg">
        <div className="stack" style={{ gap: 4 }}>
          <h2>Efectividad por tipo de ayuda</h2>
          <p className="small muted">
            Cada respuesta cuenta para la última ayuda que pediste antes de responder. Las respuestas sin ayuda no cuentan.
          </p>
        </div>
        <ul className="eff-list">
          {s.effectiveness.map((e, i) => (
            <li key={e.level} className="eff-row" data-level={e.level}>
              <span className="eff-name">{e.name}</span>
              <span className="eff-numbers">
                <strong className="eff-percent">{percent(e.effectiveness)}</strong>{" "}
                <span className="muted small">
                  <span className="eff-count">{e.answered ? `${e.correct} / ${e.answered}` : "—"}</span> ·{" "}
                  <span className="eff-time">{seconds(e.avgSecondsAfterHint)}</span>
                </span>
              </span>
              <span className="bar" style={{ animationDelay: `${i * 50}ms` }} aria-hidden>
                <span className="bar-fill" style={{ transform: `scaleX(${e.effectiveness ?? 0})` }} />
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <ErrorBox error={repeat.error} />
      <div className="actions">
        <Button variant="primary" onClick={() => repeat.mutate()} disabled={repeat.isPending} icon={<RotateCcw size={18} aria-hidden />}>
          Repetir las lecturas
        </Button>
        <Button variant="ghost" onClick={() => navigate("/")} icon={<LogOut size={18} aria-hidden />}>
          Salir
        </Button>
      </div>
    </main>
  );
}
