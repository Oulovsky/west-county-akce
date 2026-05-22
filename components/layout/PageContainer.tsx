import { PAGE_STACK_CLASS, PAGE_STACK_SM_CLASS } from "@/lib/layout/page-shell";

type PageContainerProps = {
  children: React.ReactNode;
  className?: string;
  /** Menší vertikální rozestupy (space-y-4). */
  compact?: boolean;
};

export function PageContainer({ children, className = "", compact = false }: PageContainerProps) {
  const base = compact ? PAGE_STACK_SM_CLASS : PAGE_STACK_CLASS;
  return <div className={className ? `${base} ${className}` : base}>{children}</div>;
}
