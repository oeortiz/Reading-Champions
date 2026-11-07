import logoSvg from "../assets/logo.svg?raw";

/** Simbolo de Reading Champions; hereda el color del texto (currentColor). */
export function LogoMark({ size = 28, label }: { size?: number; label?: string }) {
  return (
    <span
      className="logo-mark"
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: logoSvg }}
    />
  );
}

/** Simbolo mas nombre. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="logo" style={{ fontSize: size * 0.62 }}>
      <LogoMark size={size} />
      <span className="logo-name">Reading Champions</span>
    </span>
  );
}
