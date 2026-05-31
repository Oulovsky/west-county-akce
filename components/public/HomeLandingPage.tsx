import Image from "next/image";
import Link from "next/link";

const LOGO_SRC = "/brand/westcounty-logo-white-transparent.png";

const SERVICES = [
  {
    title: "Stage",
    description: "Mobilní a konstrukční řešení pro venkovní i indoor akce.",
  },
  {
    title: "Sound",
    description: "Ozvučení koncertů, slavností a firemních akcí.",
  },
  {
    title: "Lights",
    description: "Světelný design a řízení show.",
  },
  {
    title: "LED wall",
    description: "Velkoplošná obrazovka pro program, kamery i vizuály.",
  },
  {
    title: "Video",
    description: "Kamery, režie a obrazové odbavení.",
  },
] as const;

export default function HomeLandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(30,58,138,0.35),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-32 h-[28rem] w-[28rem] rounded-full bg-amber-500/5 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[22rem] -translate-x-1/2 opacity-[0.04]"
      >
        <Image
          src={LOGO_SRC}
          alt=""
          width={520}
          height={520}
          className="h-auto w-[min(520px,80vw)]"
          priority
        />
      </div>

      <header className="relative z-10 border-b border-white/5 bg-[#030712]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src={LOGO_SRC}
              alt="WEST COUNTY"
              width={44}
              height={44}
              className="h-11 w-11 shrink-0"
              priority
            />
            <span className="text-sm font-bold tracking-[0.22em] text-white sm:text-base">
              WEST COUNTY
            </span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/portal"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-amber-400/40 hover:bg-amber-500/10 hover:text-white sm:px-4 sm:text-sm"
            >
              Zadat poptávku
            </Link>
            <Link
              href="/portal"
              className="rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/25 sm:px-4 sm:text-sm"
            >
              Klientská zóna
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6 sm:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="flex items-center justify-center gap-3 sm:gap-5">
              <Image
                src={LOGO_SRC}
                alt=""
                aria-hidden
                width={56}
                height={56}
                className="h-11 w-11 shrink-0 opacity-95 sm:h-14 sm:w-14"
                priority
              />
              <h1 className="text-3xl font-black tracking-[0.18em] text-white sm:text-5xl md:text-6xl">
                WEST COUNTY
              </h1>
              <Image
                src={LOGO_SRC}
                alt=""
                aria-hidden
                width={56}
                height={56}
                className="h-11 w-11 shrink-0 opacity-95 sm:h-14 sm:w-14"
                priority
              />
            </div>
            <p className="mt-4 text-lg font-medium tracking-wide text-slate-300 sm:text-xl">
              Technické zajištění akcí
            </p>
            <p className="mt-3 text-sm tracking-[0.2em] text-slate-400 sm:text-base">
              Stage · Sound · Lights · LED wall · Video
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/portal"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-500/60 bg-amber-500/20 px-6 py-3 text-sm font-bold text-amber-50 transition hover:bg-amber-500/30"
              >
                Zadat poptávku
              </Link>
              <Link
                href="/portal"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/30 hover:bg-white/10"
              >
                Klientská zóna
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 shadow-2xl shadow-black/40">
            <div className="relative aspect-[21/9] w-full">
              <Image
                src="/images/hero-stage-banner.png"
                alt="Schematická ilustrace stage techniky — truss, LED wall, PA a světla"
                fill
                className="object-cover object-center"
                sizes="(max-width: 1152px) 100vw, 1152px"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#030712]/80 via-transparent to-[#030712]/20" />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((service) => (
              <article
                key={service.title}
                className="rounded-xl border border-white/8 bg-white/[0.03] p-5 transition hover:border-amber-500/20 hover:bg-white/[0.05]"
              >
                <h2 className="text-base font-bold tracking-wide text-white">
                  {service.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {service.description}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 text-center sm:px-6">
          <p className="text-sm font-semibold tracking-[0.18em] text-slate-300">
            WEST COUNTY
          </p>
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} WEST COUNTY. Všechna práva vyhrazena.
          </p>
        </div>
      </footer>
    </div>
  );
}
