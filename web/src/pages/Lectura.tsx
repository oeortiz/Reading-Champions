import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleX, Lightbulb } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client.ts";
import type { AnswerResult, CurrentState } from "../api/types.ts";
import { Logo } from "../components/Logo.tsx";
import { ReadingText, variantFor } from "../components/ReadingText.tsx";
import { Button, Card, Chip, ErrorBox, ProgressBar } from "../components/ui.tsx";

// Solo para mostrar el valor actual; el puntaje real lo calcula el servidor
const PENALTIES = { 1: 15, 2: 15, 3: 30, 4: 20 } as const;

type Feedback = { result: AnswerResult; chosenId: number };

export function Lectura() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const current = useQuery({ queryKey: ["current"], queryFn: () => api<CurrentState>("/assessment/current") });

  useEffect(() => {
    if (current.error instanceof ApiError && current.error.status === 401) navigate("/", { replace: true });
    if (current.data?.status === "completed") navigate("/resumen", { replace: true });
  }, [current.error, current.data, navigate]);

  const hint = useMutation({
    mutationFn: (level: number) => api("/assessment/hint", { body: { level } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["current"] }),
  });

  const answer = useMutation({
    mutationFn: (optionId: number) => api<AnswerResult>("/assessment/answer", { body: { optionId } }),
    onSuccess: (result, optionId) => setFeedback({ result, chosenId: optionId }),
  });

  const next = () => {
    if (feedback?.result.next === "summary") return navigate("/resumen");
    setFeedback(null);
    setSelected(null);
    answer.reset();
    hint.reset();
    queryClient.invalidateQueries({ queryKey: ["current"] });
  };

  if (current.isPending) {
    return (
      <main className="page">
        <p className="muted">Cargando…</p>
      </main>
    );
  }
  if (current.isError) {
    return (
      <main className="page">
        <ErrorBox error={current.error} />
        <Button onClick={() => current.refetch()}>Reintentar</Button>
      </main>
    );
  }
  if (current.data.status !== "in_progress") return null;

  const { reading, word, participant } = current.data;
  const value = 100 - word.hints.reduce((sum, h) => sum + PENALTIES[h.level], 0);
  const answered = feedback !== null;
  const answeredWords = word.number - 1 + (answered ? 1 : 0);

  return (
    <main className="page">
      <header className="topbar">
        <Logo size={40} />
        <div className="topbar-meta">
          <span className="small muted">
            {participant.fullName} · Lectura {reading.number} de {reading.total}
          </span>
          <ProgressBar value={answeredWords} max={word.total} label={`Palabras respondidas de la lectura ${reading.number}`} />
        </div>
      </header>

      <Card as="article" className="reading-card">
        {reading.image && (
          <figure className="reading-figure">
            <img src={reading.image.url} alt={reading.image.alt} width={260} height={195} />
          </figure>
        )}
        <h1 className="reading-title">{reading.title}</h1>
        <ReadingText
          content={reading.content}
          start={word.start}
          end={word.end}
          variant={variantFor(word.number)}
          answered={answered}
        />
      </Card>

      <Card className="stack stack-lg" aria-live="polite">
        <div className="question-head">
          <div className="stack" style={{ gap: 4 }}>
            <span className="small muted">
              Palabra {word.number} de {word.total}
            </span>
            <h2>
              ¿Qué significa <span className="question-word">«{word.word}»</span>?
            </h2>
          </div>
          {!answered && <Chip tone="accent">Vale {value} pts</Chip>}
        </div>

        {word.hints.length > 0 && (
          <ol className="hints" aria-label="Ayudas reveladas">
            {word.hints.map((h) => (
              <li key={h.level} className="hint reveal">
                <Lightbulb size={18} aria-hidden />
                <span>
                  <span className="hint-name">Ayuda {h.level}:</span> {h.content}
                </span>
              </li>
            ))}
          </ol>
        )}

        {!answered && word.nextHint && (
          <div>
            <Button
              className="btn-hint"
              onClick={() => hint.mutate(word.nextHint!.level)}
              disabled={hint.isPending}
              icon={
                <span className="bulb" aria-hidden>
                  <Lightbulb size={22} />
                </span>
              }
            >
              Pedir ayuda {word.nextHint.level}
            </Button>
          </div>
        )}

        <div className="options" role="radiogroup" aria-label="Opciones de respuesta">
          {word.options.map((o) => {
            const isCorrect = feedback?.result.correctOptionId === o.id;
            const isWrong = !!feedback && feedback.chosenId === o.id && !isCorrect;
            const state = !feedback
              ? selected === o.id
                ? "is-selected"
                : ""
              : isCorrect
                ? "is-correct"
                : isWrong
                  ? "is-wrong"
                  : "is-dim";
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={selected === o.id}
                className={`option ${state}`}
                onClick={() => setSelected(o.id)}
                disabled={answered}
              >
                <span className="option-dot" aria-hidden />
                <span className="option-text">{o.text}</span>
                {isCorrect && (
                  <span className="option-tag">
                    <CircleCheck size={18} aria-hidden /> Respuesta correcta
                  </span>
                )}
                {isWrong && (
                  <span className="option-tag">
                    <CircleX size={18} aria-hidden /> Tu respuesta
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <ErrorBox error={hint.error ?? answer.error} />

        {!feedback ? (
          <Button
            variant="primary"
            block
            disabled={selected === null || answer.isPending}
            onClick={() => selected !== null && answer.mutate(selected)}
          >
            Responder
          </Button>
        ) : (
          <div className={`feedback reveal ${feedback.result.isCorrect ? "feedback-ok" : "feedback-bad"}`}>
            <p className="feedback-title">
              {feedback.result.isCorrect ? (
                <>
                  <CircleCheck size={22} aria-hidden /> Correcto · +{feedback.result.points} pts
                </>
              ) : (
                <>
                  <CircleX size={22} aria-hidden /> Incorrecto · 0 pts
                </>
              )}
            </p>
            {feedback.result.lexico && (
              <p>
                <strong>Significado:</strong> {feedback.result.lexico}
              </p>
            )}
            <div>
              <Button variant="primary" onClick={next} autoFocus>
                {feedback.result.next === "word"
                  ? "Siguiente palabra"
                  : feedback.result.next === "reading"
                    ? "Siguiente lectura"
                    : "Ver resumen"}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </main>
  );
}
