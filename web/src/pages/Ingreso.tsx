import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client.ts";
import type { SessionResponse } from "../api/types.ts";
import { LogoMark } from "../components/Logo.tsx";
import { Button, Card, Field } from "../components/ui.tsx";

export function Ingreso() {
  const navigate = useNavigate();
  const [documentNumber, setDocumentNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [errors, setErrors] = useState<{ documentNumber?: string; fullName?: string }>({});

  const login = useMutation({
    mutationFn: () => api<SessionResponse>("/participants/session", { body: { documentNumber, fullName } }),
    onSuccess: (res) => navigate(res.next === "summary" ? "/resumen" : "/lectura"),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = {
      documentNumber: documentNumber.trim() ? undefined : "Ingresa tu número de documento",
      fullName: fullName.trim() ? undefined : "Ingresa tu nombre completo",
    };
    setErrors(next);
    if (!next.documentNumber && !next.fullName) login.mutate();
  };

  const serverError = login.error instanceof ApiError ? login.error.message : login.error ? "No se pudo ingresar" : null;

  return (
    <main className="page page-narrow">
      <header className="brand-hero">
        <LogoMark size={80} />
        <h1>Reading Champions</h1>
        <p className="muted">Lee con atención y demuestra cuánto entiendes cada palabra.</p>
      </header>
      <Card as="div">
        <form className="stack stack-lg" onSubmit={submit} noValidate>
          <h2>Antes de empezar</h2>
          <Field label="Número de documento" error={errors.documentNumber}>
            <input
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              autoComplete="off"
              aria-invalid={!!errors.documentNumber}
              autoFocus
            />
          </Field>
          <Field label="Nombre completo" error={errors.fullName}>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              aria-invalid={!!errors.fullName}
            />
          </Field>
          {serverError && (
            <p className="alert alert-error" role="alert">
              {serverError}
            </p>
          )}
          <Button type="submit" variant="primary" block disabled={login.isPending}>
            {login.isPending ? "Ingresando…" : "Comenzar"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
