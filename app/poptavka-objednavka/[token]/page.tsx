import { unstable_noStore as noStore } from "next/cache";
import PoptavkaObjednavkaDocument from "@/components/poptavka/PoptavkaObjednavkaDocument";
import { snapshotToDocumentData } from "@/lib/client-portal/poptavka-objednavka-document";
import {
  canDecideOnPoptavkaObjednavkaLink,
  getPoptavkaObjednavkaPublicViewState,
  loadPoptavkaObjednavkaLinkByToken,
  markPoptavkaObjednavkaLinkOpened,
  type LoadPoptavkaObjednavkaLinkByTokenResult,
} from "@/lib/client-portal/poptavka-objednavka-link-server";
import { PAGE_STANDALONE_CLASS } from "@/lib/layout/page-shell";
import { PoptavkaObjednavkaDecisionClient } from "./PoptavkaObjednavkaDecisionClient";

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

function StatusBanner({
  viewState,
  rejectReason,
}: {
  viewState: "already_confirmed" | "already_rejected";
  rejectReason?: string | null;
}) {
  if (viewState === "already_confirmed") {
    return (
      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-4 text-sm text-emerald-100">
        <p className="font-semibold">Objednávka už byla potvrzena.</p>
        <p className="mt-1 text-emerald-100/90">
          Závazná objednávka byla potvrzena. Děkujeme, nyní ji interně zpracujeme.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-950/30 px-4 py-4 text-sm text-amber-100">
      <p className="font-semibold">Objednávka už byla odmítnuta.</p>
      <p className="mt-1 text-amber-100/90">
        Závazná objednávka byla odmítnuta. Důvod jsme uložili a ozveme se.
      </p>
      {rejectReason?.trim() ? (
        <p className="mt-3 whitespace-pre-wrap rounded-lg border border-amber-500/20 bg-amber-950/40 px-3 py-2 text-amber-50/90">
          {rejectReason.trim()}
        </p>
      ) : null}
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
  const { poptavka, snapshot, link } = loaded;
  const viewState = getPoptavkaObjednavkaPublicViewState(link, poptavka.stav);
  const showDecisionPanel = canDecideOnPoptavkaObjednavkaLink(link, poptavka.stav);

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

        {viewState !== "pending" ? (
          <StatusBanner
            viewState={viewState}
            rejectReason={link.odmitnuto_duvod}
          />
        ) : null}

        <PoptavkaObjednavkaDocument
          data={documentData}
          meta={{
            cisloPoptavky: poptavka.cislo_poptavky,
            nazevAkce: poptavka.misto_nazev ?? snapshot.akce.nazevAkce,
            navrhVerze: snapshot.meta.navrhVerze ?? null,
            upravenoOprotiPoptavce: snapshot.meta.upravenoOprotiPoptavce ?? false,
          }}
        />

        {showDecisionPanel ? <PoptavkaObjednavkaDecisionClient token={token} /> : null}
      </div>
    </div>
  );
}
