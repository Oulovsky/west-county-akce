"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`.trim()}
      aria-hidden
    />
  );
}

export type SubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Label when the form is not submitting. */
  children: ReactNode;
  /** Label while the server action is running. */
  pendingText: string;
  showSpinner?: boolean;
};

/**
 * Submit button for server-action forms. Must be rendered inside `<form>`.
 */
export function SubmitButton({
  children,
  pendingText,
  showSpinner = true,
  className = "",
  disabled,
  type = "submit",
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = Boolean(disabled) || pending;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={pending || undefined}
      className={[
        className,
        pending ? "cursor-wait opacity-80" : "",
        isDisabled && !pending ? "cursor-not-allowed opacity-70" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          {showSpinner ? <Spinner /> : null}
          <span>{pendingText}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
