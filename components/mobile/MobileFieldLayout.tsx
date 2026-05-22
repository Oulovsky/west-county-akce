export function MobileFieldLayout({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`page-shell w-full space-y-4 pb-2 ${className}`.trim()}>
      {children}
    </div>
  );
}
