type InfoRowProps = {
  label: string;
  children: React.ReactNode;
  gridClassName?: string;
};

export function InfoRow({
  label,
  children,
  gridClassName = "grid-cols-[140px_1fr]",
}: InfoRowProps) {
  return (
    <div className={`grid ${gridClassName} gap-3`}>
      <div className="text-slate-500">{label}</div>
      <div>{children}</div>
    </div>
  );
}
