import type { ButtonHTMLAttributes, ReactNode } from "react";

type Tone = "primary" | "secondary" | "quiet";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  children: ReactNode;
}

const TONES: Record<Tone, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90 disabled:opacity-50",
  secondary:
    "border border-[var(--line-strong)] text-[var(--ink)] hover:bg-[var(--surface-sunken)] disabled:opacity-50",
  quiet: "text-[var(--ink-muted)] hover:text-[var(--ink)] disabled:opacity-50",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-2.5" +
  " text-sm font-medium transition-opacity disabled:cursor-not-allowed";

export function Button({ tone = "primary", className, ...rest }: ButtonProps) {
  return <button className={`${BASE} ${TONES[tone]} ${className ?? ""}`} {...rest} />;
}
