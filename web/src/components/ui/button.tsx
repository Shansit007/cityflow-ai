import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Buttons.
 *
 * Two components share one set of styles:
 *  - <Button>      for actions (submit a form, open a dialog)
 *  - <ButtonLink>  for navigation (goes to another page)
 *
 * Using the right one matters for accessibility: screen readers and keyboard
 * users expect links to navigate and buttons to act.
 */

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium " +
  "transition-colors duration-150 select-none " +
  "disabled:cursor-not-allowed disabled:opacity-55";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // `on-primary` is white in light mode and deep navy in dark mode, because
  // `primary` itself flips from a dark navy to a light blue. See globals.css.
  primary: "bg-primary text-on-primary hover:bg-primary-hover shadow-card",
  secondary: "bg-secondary text-on-primary hover:opacity-90 shadow-card",
  outline: "border border-border-strong bg-surface text-fg hover:bg-surface-2",
  ghost: "text-fg hover:bg-surface-2",
  danger: "bg-danger text-on-primary hover:opacity-90",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  // Minimum height 40–48px keeps every control comfortably tappable on a phone.
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders a spinner and disables the button. */
  loading?: boolean;
  /** Makes the button span the full width of its container. */
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      // Tells screen readers that the button is temporarily busy.
      aria-busy={loading || undefined}
      className={cn(
        BASE_CLASSES,
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && "w-full",
        className
      )}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

interface ButtonLinkProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  children,
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        BASE_CLASSES,
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && "w-full",
        className
      )}
    >
      {children}
    </Link>
  );
}

/** Small inline loading indicator used inside buttons. */
function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        className="opacity-25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
