import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { ApiError } from "../api/client.ts";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "md" | "sm";
  block?: boolean;
  icon?: ReactNode;
};

export function Button({ variant = "outline", size = "md", block, icon, className = "", children, ...rest }: ButtonProps) {
  const classes = ["btn", `btn-${variant}`, size === "sm" && "btn-sm", block && "btn-block", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={classes} {...rest}>
      {icon}
      {children}
    </button>
  );
}

/** Campo con etiqueta visible y error debajo (regla de formularios de UI/UX Pro Max). */
export function Field({
  label,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {hint && <span className="field-hint">{hint}</span>}
      {children}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

export function Card({
  children,
  className = "",
  as: Tag = "section",
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: "section" | "article" | "div" }) {
  return (
    <Tag className={`card ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "ok" | "warn" }) {
  return <span className={`chip chip-${tone}`}>{children}</span>;
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const ratio = max ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span className="progress-fill" style={{ transform: `scaleX(${ratio})` }} />
    </div>
  );
}

/** Mensaje de error de la API, con la lista de problemas si el servidor la envia. */
export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  const issues = error instanceof ApiError && Array.isArray(error.details) ? (error.details as string[]) : [];
  return (
    <div className="alert alert-error" role="alert">
      <p>{(error as Error).message}</p>
      {issues.length > 0 && (
        <ul>
          {issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
