import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client.ts";
import { LogoMark } from "../../components/Logo.tsx";
import { Button, Card, ErrorBox, Field } from "../../components/ui.tsx";

export function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const login = useMutation({
    mutationFn: () => api("/admin/session", { body: { username, password } }),
    onSuccess: () => navigate("/admin"),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate();
  };

  return (
    <main className="page page-narrow">
      <header className="brand-hero">
        <LogoMark size={64} />
        <h1>Administración</h1>
      </header>
      <Card as="div">
        <form className="stack stack-lg" onSubmit={submit}>
          <Field label="Usuario">
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
          </Field>
          <Field label="Contraseña">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          <ErrorBox error={login.error} />
          <Button type="submit" variant="primary" block disabled={login.isPending}>
            Ingresar
          </Button>
        </form>
      </Card>
    </main>
  );
}
