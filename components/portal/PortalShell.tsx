import Image from "next/image";
import Link from "next/link";

const LOGO_SRC = "/brand/westcounty-logo-white-transparent.png";

export function PortalShell({
  children,
  showBackToPortal = false,
}: {
  children: React.ReactNode;
  showBackToPortal?: boolean;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(30,58,138,0.3),transparent)]"
      />

      <header className="relative z-10 border-b border-white/5 bg-[#030712]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/portal" className="flex items-center gap-3">
            <Image
              src={LOGO_SRC}
              alt="WEST COUNTY"
              width={40}
              height={40}
              className="h-10 w-10"
            />
            <span className="text-sm font-bold tracking-[0.18em] text-white">
              Klientská zóna
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {showBackToPortal ? (
              <Link
                href="/portal"
                className="text-xs font-medium text-slate-400 transition hover:text-slate-200 sm:text-sm"
              >
                ← Portál
              </Link>
            ) : null}
            <Link
              href="/"
              className="text-xs font-medium text-slate-400 transition hover:text-slate-200 sm:text-sm"
            >
              Veřejný web
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        {children}
      </main>
    </div>
  );
}

export function PortalCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-xl shadow-black/20">
      <h1 className="text-2xl font-bold tracking-wide text-white">{title}</h1>
      <div className="mt-6">{children}</div>
    </div>
  );
}
