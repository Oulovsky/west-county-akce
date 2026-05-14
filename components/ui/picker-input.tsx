import * as React from "react";

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 text-slate-300"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 text-slate-300"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  );
}

type PickerInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  picker: "date" | "time";
};

export function PickerInput({
  className = "",
  picker,
  type,
  ...props
}: PickerInputProps) {
  const Icon = picker === "date" ? CalendarIcon : ClockIcon;

  return (
    <div className="relative mt-2">
      <input
        {...props}
        type={type ?? picker}
        className={`app-picker-input app-native-picker-hide w-full rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-3 pr-12 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 ${className}`.trim()}
      />
      <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
        <Icon />
      </div>
    </div>
  );
}