import { unstable_noStore as noStore } from "next/cache";
import PoptavkaObjednavkaDocument from "@/components/poptavka/PoptavkaObjednavkaDocument";
import { snapshotToDocumentData } from "@/lib/client-portal/poptavka-objednavka-document";
import {
  loadPoptavkaObjednavkaLinkByToken,
  markPoptavkaObjednavkaLinkOpened,
  type LoadPoptavkaObjednavkaLinkByTokenResult,
} from "@/lib/client-portal/poptavka-objednavka-link-server";
import { PAGE_STANDALONE_CLASS } from "@/lib/layout/page-shell";

type PageProps = {
  params: Promise<{ token: string }>;
};

function errorMessage(error: Exclude<LoadPoptavkaObjednavkaLinkByTokenResult, { ok: true }>["error"]) {
  switch (error) {
    case "revoked":
      return {
        title: "Odkaz byl nahrazen",
        body: "Tato verze objednávky byla nahrazena novější verzí. Požádejte prosím organizátora akce o aktuální odkaz.",
        tone: "amber" as const,
      };
    case "expired":
      return {
        title: "Platnost odkazu vypršela",
        body: "Platnost odkazu vypršela. Požádejte prosím organizátora akce o nový odkaz k závazné objednávce.",
        tone: "amber" as const,
      };
    case "poptavka_state_invalid":
      return {
        title: "Objednávku nelze zobrazit",
        body: "Objednávku už nelze tímto odkazem zobrazit / zpracovat. Kontaktujte prosím organizátora akce.",
        tone: "amber" as const,
      };
    case "invalid_token":
    case "snapshot_invalid":
    default:
      return {
        title: "Odkaz není platný",
        body: "Odkaz není platný. Zkontrolujte prosím adresu nebo požádejte organizátora akce o nový odkaz.",
        tone: "red" as const,
      };
  }
}

function ErrorView({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "red" | "amber";
}) {
  const styles =
    tone === "red"
      ? "border-red-500/40 bg-red-950/20 text-red-100"
      : "border-amber-500/40 bg-amber-950/20 text-amber-100";

  return (
    <div className={`${PAGE_STANDALONE_CLASS} py-16`}>
      <div className={`mx-auto max-w-xl rounded-3xl border p-6 ${styles}`}>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm opacity-90">{body}</p>
      </div>
    </div>
  );
}

export default async function PoptavkaObjednavkaTokenPage({ params }: PageProps) {
  noStore();

  const { token } = await params;
  const loaded = await loadPoptavkaObjednavkaLinkByToken(token);

  if (!loaded.ok) {
    const message = errorMessage(loaded.error);
    return <ErrorView title={message.title} body={message.body} tone={message.tone} />;
  }

  await markPoptavkaObjednavkaLinkOpened(loaded.link.link_id);

  const documentData = snapshotToDocumentData(loaded.snapshot);
  const { poptavka, snapshot } = loaded;

  return (
    <div className={`${PAGE_STANDALONE_CLASS} py-6 sm:py-10`}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-slate-700 bg-[#0b1324] p-5 shadow-xl sm:p-8">
          <div className="text-sm font-semibold uppercase tracking-wide text-indigo-300">
            WEST COUNTY
          </div>
          <h1 className="mt-2 text-3xl font-black text-white">Závazná objednávka</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
            Níže je zobrazena závazná objednávka k poptávce{" "}
            <strong className="text-slate-100">{poptavka.cislo_poptavky}</strong>
            {poptavka.misto_nazev ? (
              <>
                {" "}
                pro akci <strong className="text-slate-100">{poptavka.misto_nazev}</strong>
              </>
            ) : null}
            . Dokument je zmrazený stav odeslaný k vašemu potvrzení — nejde o živou verzi
            poptávky v portálu.
          </p>
          {snapshot.frozenAt ? (
            <p className="mt-2 text-xs text-slate-500">
              Verze dokumentu ze dne{" "}
              {new Intl.DateTimeFormat("cs-CZ", {
                day: "numeric",
                month: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(snapshot.frozenAt))}
            </p>
          ) : null}
        </div>

        <PoptavkaObjednavkaDocument
          data={documentData}
          meta={{
            cisloPoptavky: poptavka.cislo_poptavky,
            nazevAkce: poptavka.misto_nazev ?? snapshot.akce.nazevAkce,
          }}
        />

        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-4 text-sm text-slate-400">
          <p className="font-medium text-slate-300">Potvrzení objednávky</p>
          <p className="mt-1">
            Potvrzení / odmítnutí bude doplněno v dalším kroku. Prozatím si prosím dokument
            prostudujte a v případě dotazů kontaktujte organizátora akce.
          </p>
        </div>
      </div>
    </div>
  );
}
