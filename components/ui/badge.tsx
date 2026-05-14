import * as React from "react";

type BadgeProps = {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
};

export function Badge({ children, variant = "default" }: BadgeProps) {
  const variants = {
    default: "bg-slate-700 text-slate-200",
    success: "bg-green-700 text-white",
    warning: "bg-orange-600 text-white",
    danger: "bg-red-700 text-white",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${variants[variant]}`}
    >
      {children}
    </span>
  );
}