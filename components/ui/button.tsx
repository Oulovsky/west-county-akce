import * as React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  const base =
    "rounded-xl px-5 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-70";

  const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary: "bg-blue-600 text-white hover:bg-blue-500",
    secondary: "border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700",
    danger: "bg-red-700 text-white hover:bg-red-600",
  };

  return (
    <button
      type={type}
      {...props}
      className={`${base} ${variants[variant]} ${className}`.trim()}
    />
  );
}