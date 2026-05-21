export function MobileFieldLayout({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-lg space-y-4 pb-2 lg:max-w-none ${className}`.trim()}>
      {children}
    </div>
  );
}
