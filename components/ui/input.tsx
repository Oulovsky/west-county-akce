import * as React from "react";

export function Input({
  className = "",
  type,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const isPickerType =
    type === "date" || type === "time" || type === "datetime-local";

  return (
    <input
      {...props}
      type={type}
      className={`mt-2 w-full rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 ${
        isPickerType ? "app-picker-input" : ""
      } ${className}`.trim()}
    />
  );
}