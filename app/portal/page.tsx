import Image from "next/image";
import Link from "next/link";

export default function PortalPlaceholderPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(30,58,138,0.3),transparent)]"
      />

      <header className="relative z-10 border-b border-white/5 bg-[#030712]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/brand/westcounty-logo-bw.png"
              alt="WEST COUNTY"
              width={40}
              height={40}
              className="h-10 w-10"
            />
            <span className="text-sm font-bold tracking-[0.18em] text-white">
              WEST COUNTY
            </span>
          </Link>
          <Link
            href="/"
            className="text-xs font-medium text-slate-400 transition hover:text-slate-200 sm:text-sm"
          >
            ← Veřejný web
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6">
        <Image
          src="/brand/westcounty-logo-bw.png"
          alt="WEST COUNTY logo"
          width={120}
          height={120}
          className="mb-8 h-28 w-28 opacity-90"
        />
        <h1 className="text-2xl font-bold tracking-wide text-white sm:text-3xl">
          Klientská zóna
        </h1>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-400 sm:text-base">
          Připravujeme klientský portál pro zadávání poptávek a přehled zakázek.
          Registrace a přihlášení budou dostupné v další fázi.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <span className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
            Přihlášení — brzy
          </span>
          <span className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
            Registrace — brzy
          </span>
        </div>
      </main>
    </div>
  );
}
