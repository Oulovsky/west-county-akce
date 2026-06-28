import Link from "next/link";
import { headers } from "next/headers";
import { verifyInternalPoptavkyReadPage } from "@/lib/auth/admin-access-server";
import { loadSessionRolePermissions } from "@/lib/auth/internal-role-access-server";
import { canInitialSendPoptavkaBindingOrder, canOpenObjednavkaEditor, canResendPoptavkaBindingOrder, loadInternalPoptavkaDetail } from "@/lib/client-portal/poptavka-internal-server";
import {
  formatPoptavkaOutboundForCopy,
  getPortalAppBaseUrl,
  preparePoptavkaBindingOrderOutboundMessage,
} from "@/lib/client-portal/poptavka-email-server";
import {
  ACTIVE_POPTAVKA_OBJEDNAVKA_DRAFT_STAVY,
  createOrLoadPoptavkaObjednavkaDraft,
  loadPoptavkaObjednavkaDraft,
} from "@/lib/client-portal/poptavka-objednavka-draft-server";
import { hydrateObjednavkaDraftKonfigurace } from "@/lib/client-portal/poptavka-objednavka-draft";
import { buildPoptavkaObjednavkaUrl, countPoptavkaObjednavkaLinkVersions, loadActivePoptavkaObjednavkaLink } from "@/lib/client-portal/poptavka-objednavka-link-server";
import { loadPortalSestavaKatalog } from "@/lib/client-portal/sestava-konfigurator-server";
import { loadPortalSetups } from "@/lib/client-portal/poptavka-server";
import { loadObjednavkaPricingCatalog } from "@/lib/client-portal/poptavka-objednavka-pricing-server";
import { createClient } from "@/lib/supabase/server";
import PoptavkaOutboundMessagePanel from "../../PoptavkaOutboundMessagePanel";
import PoptavkaObjednavkaDraftEditor from "./PoptavkaObjednavkaDraftEditor";
import { resendPoptavkaObjednavkaEmailAction } from "./actions";

const ORDER_EMAIL_STATUS_MESSAGES: Record<string, string> = {
  sent: "Objednávka byla odeslána klientovi. Klient ji může potvrdit nebo odmítnout přes odkaz v e-mailu.",
  missing_email:
    "Objednávka byla vytvořena, ale klient nemá vyplněný e-mail. Odkaz zkopírujte a pošlete ručně.",
  missing_resend_key:
    "Objednávka byla vytvořena a odkaz je platný, ale e-mail se nepodařilo odeslat. Zkopírujte klientovi odkaz ručně nebo zkontrolujte nastavení e-mailů.",
  missing_from:
    "Objednávka byla vytvořena a odkaz je platný, ale chybí RESEND_FROM_EMAIL — e-mail se neodeslal. Zkopírujte klientovi odkaz ručně.",
  missing_base_url:
    "Objednávka byla vytvořena a odkaz je platný, ale nepodařilo se sestavit veřejnou URL aplikace pro e-mail. Zkopírujte odkaz ručně.",
  failed:
    "Objednávka byla vytvořena a odkaz je platný, ale e-mail se nepodařilo odeslat. Zkopírujte klientovi odkaz ručně.",
};

function orderSentPrimaryMessage(emailStatus: string | null, isResend: boolean): string {
  if (emailStatus === "sent" && isResend) {
    return "E-mail byl odeslán klientovi.";
  }
  if (emailStatus === "sent") {
    return "Objednávka byla odeslána klientovi. Klient ji může potvrdit nebo odmítnout přes odkaz v e-mailu.";
  }
  if (isResend) {
    return "Nový odkaz byl vytvořen. Starý odkaz už není platný.";
  }
  return "Objednávka byla vytvořena a je platná v systému. Draft byl zmrazen.";
}

export default async function PoptavkaObjednavkaEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    saved?: string;
    error?: string;
    order?: string;
    email?: string;
    token?: string;
    resend?: string;
  }>;
}) {
  const { id: poptavkaId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const supabase = await createClient();
  const [{ perms }, access] = await Promise.all([
    loadSessionRolePermissions(supabase),
    verifyInternalPoptavkyReadPage(supabase),
  ]);
  const readOnly = !perms.zakazkyEditace;

  if (!access.ok) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-white">Závazná objednávka</h1>
        <p className="mt-4 text-red-400">{access.message}</p>
      </div>
    );
  }

  const detail = await loadInternalPoptavkaDetail(supabase, poptavkaId);
  if (!detail) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-white">Závazná objednávka</h1>
        <p className="mt-4 text-red-400">Poptávka nenalezena.</p>
        <Link href="/zakazky/poptavky" className="mt-4 inline-block text-blue-300">
          ← Seznam poptávek
        </Link>
      </div>
    );
  }

  if (!canOpenObjednavkaEditor(detail.stav)) {
    const backLink = (
      <Link href={`/zakazky/poptavky/${poptavkaId}`} className="mt-4 inline-block text-blue-300">
        ← Zpět na poptávku
      </Link>
    );

    if (detail.stav === "objednavka_potvrzena") {
      return (
        <div className="p-6">
          <h1 className="text-3xl font-bold text-white">Závazná objednávka</h1>
          <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100">
            Klient potvrdil závaznou objednávku. Čeká na interní schválení k převodu — použijte
            detail poptávky.
          </p>
          {backLink}
        </div>
      );
    }

    if (detail.stav === "schvalena") {
      return (
        <div className="p-6">
          <h1 className="text-3xl font-bold text-white">Závazná objednávka</h1>
          <p className="mt-4 rounded-lg border border-blue-500/30 bg-blue-950/20 px-4 py-3 text-sm text-blue-100">
            Poptávka je schválená k převodu. Novou objednávku nelze odeslat — pokračujte vytvořením
            zakázky z detailu poptávky.
          </p>
          {backLink}
        </div>
      );
    }

    if (detail.stav === "v_revizi") {
      return (
        <div className="p-6">
          <h1 className="text-3xl font-bold text-white">Závazná objednávka</h1>
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
            Poptávka byla vrácena klientovi k doplnění. Závaznou objednávku lze připravit až po
            opětovném odeslání poptávky klientem.
          </p>
          {backLink}
        </div>
      );
    }

    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-white">Závazná objednávka</h1>
        <p className="mt-4 text-amber-200">
          Pro tuto poptávku zatím nelze připravit závaznou objednávku ve stavu{" "}
          <strong>{detail.stav}</strong>.
        </p>
        {backLink}
      </div>
    );
  }

  const orderSent = resolvedSearchParams?.order === "sent";
  const isResendResult = resolvedSearchParams?.resend === "1";
  const shouldAutoCreateDraft =
    !readOnly &&
    !orderSent &&
    canInitialSendPoptavkaBindingOrder(detail.stav);

  const [sestavaKatalog, setupsByOblast, pricingCatalog] = await Promise.all([
    loadPortalSestavaKatalog(),
    loadPortalSetups(supabase),
    loadObjednavkaPricingCatalog(supabase),
  ]);

  const draftRaw = readOnly
    ? await loadPoptavkaObjednavkaDraft(supabase, poptavkaId)
    : shouldAutoCreateDraft
      ? await createOrLoadPoptavkaObjednavkaDraft(supabase, poptavkaId, {
          preparedByUserId: undefined,
          katalog: sestavaKatalog,
        })
      : await loadPoptavkaObjednavkaDraft(supabase, poptavkaId);

  const draft = draftRaw
    ? {
        ...draftRaw,
        draftData: hydrateObjednavkaDraftKonfigurace(
          draftRaw.draftData,
          detail,
          sestavaKatalog,
          { pricingCatalog, portalSetups: setupsByOblast }
        ),
      }
    : null;

  if (!draft && orderSent) {
    const orderEmailStatus = resolvedSearchParams?.email ?? null;
    const orderToken = resolvedSearchParams?.token?.trim() ?? null;
    const baseUrl = getPortalAppBaseUrl(await headers());
    const bindingOrderOutbound =
      orderEmailStatus && orderEmailStatus !== "sent" && orderToken
        ? await preparePoptavkaBindingOrderOutboundMessage({
            cisloPoptavky: detail.cislo_poptavky,
            publicLink: baseUrl.trim()
              ? buildPoptavkaObjednavkaUrl(baseUrl, orderToken)
              : `/poptavka-objednavka/${encodeURIComponent(orderToken)}`,
            emailTo: detail.klient?.email ?? detail.kontakt_email,
          })
        : null;

    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Závazná objednávka odeslána</h1>
          <p className="mt-2 text-slate-400">{detail.cislo_poptavky}</p>
        </div>
        <div className="space-y-3">
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100">
            {orderSentPrimaryMessage(orderEmailStatus, isResendResult)}
          </p>
          {orderEmailStatus && orderEmailStatus !== "sent" && ORDER_EMAIL_STATUS_MESSAGES[orderEmailStatus] ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
              {ORDER_EMAIL_STATUS_MESSAGES[orderEmailStatus]}
            </p>
          ) : null}
          {bindingOrderOutbound ? (
            <PoptavkaOutboundMessagePanel
              subject={bindingOrderOutbound.subject}
              fullText={formatPoptavkaOutboundForCopy(bindingOrderOutbound)}
              bodyText={bindingOrderOutbound.text}
              link={bindingOrderOutbound.link}
              emailTo={bindingOrderOutbound.emailTo}
            />
          ) : null}
        </div>
        <Link
          href={`/zakazky/poptavky/${poptavkaId}`}
          className="inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          ← Detail poptávky
        </Link>
      </div>
    );
  }

  if (!draft && detail.stav === "objednavka_odeslana" && !orderSent) {
    const activeLink = await loadActivePoptavkaObjednavkaLink(supabase, poptavkaId);
    const canResend = !readOnly && canResendPoptavkaBindingOrder(detail.stav);

    return (
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-slate-500">
              {detail.cislo_poptavky} · závazná objednávka
            </div>
            <h1 className="mt-1 text-3xl font-bold text-white">
              {detail.misto_nazev || "Závazná objednávka"}
            </h1>
            <p className="mt-2 text-slate-400">
              {detail.klient?.nazev ?? "—"}
              {detail.klient?.ico ? ` · IČO ${detail.klient.ico}` : ""}
            </p>
          </div>
          <Link href={`/zakazky/poptavky/${poptavkaId}`} className="text-sm text-blue-300 hover:text-blue-200">
            ← Detail poptávky
          </Link>
        </div>

        <p className="rounded-lg border border-blue-500/30 bg-blue-950/20 px-4 py-3 text-sm text-blue-100">
          Závazná objednávka byla odeslána klientovi a čeká na jeho potvrzení.
          {detail.objednavka_odeslana_at
            ? ` Odesláno ${new Intl.DateTimeFormat("cs-CZ", {
                day: "numeric",
                month: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(detail.objednavka_odeslana_at))}.`
            : null}
        </p>

        {activeLink ? (
          <div className="rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
            <p className="font-semibold text-slate-100">Aktivní odkaz pro klienta</p>
            <dl className="mt-2 grid gap-1 text-xs text-slate-400 sm:grid-cols-2">
              <div>
                <dt className="inline">Komu: </dt>
                <dd className="inline text-slate-200">{activeLink.email_to ?? "—"}</dd>
              </div>
              <div>
                <dt className="inline">Stav linku: </dt>
                <dd className="inline text-slate-200">{activeLink.stav}</dd>
              </div>
              {activeLink.email_sent_at ? (
                <div>
                  <dt className="inline">E-mail odeslán: </dt>
                  <dd className="inline text-slate-200">
                    {new Intl.DateTimeFormat("cs-CZ", {
                      day: "numeric",
                      month: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(activeLink.email_sent_at))}
                  </dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-2 text-xs text-slate-500">
              Plná URL odkazu není uložena v systému (bezpečnost tokenu). Pro nový odkaz použijte
              tlačítko níže — starý odkaz se zneplatní.
            </p>
          </div>
        ) : null}

        {canResend ? (
          <form action={resendPoptavkaObjednavkaEmailAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="poptavka_id" value={poptavkaId} />
            <button
              type="submit"
              className="rounded-xl border border-emerald-500/50 bg-emerald-950/40 px-5 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-900/50"
            >
              Znovu odeslat e-mail klientovi
            </button>
            <p className="text-xs text-slate-500">
              Vygeneruje nový platný odkaz a odešle e-mail. Obsah objednávky se nemění.
            </p>
          </form>
        ) : readOnly ? (
          <p className="text-sm text-slate-400">Nemáte oprávnění znovu odeslat e-mail klientovi.</p>
        ) : null}

        <Link
          href={`/zakazky/poptavky/${poptavkaId}/objednavka/nahled`}
          className="inline-flex rounded-xl border border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-900"
        >
          Náhled objednávky
        </Link>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-white">Závazná objednávka</h1>
        <p className="mt-4 text-red-400">
          {readOnly
            ? "Aktivní draft objednávky neexistuje."
            : "Nepodařilo se vytvořit draft objednávky."}
        </p>
        <Link href={`/zakazky/poptavky/${poptavkaId}`} className="mt-4 inline-block text-blue-300">
          ← Zpět na poptávku
        </Link>
      </div>
    );
  }

  const canEdit =
    !readOnly &&
    (ACTIVE_POPTAVKA_OBJEDNAVKA_DRAFT_STAVY as readonly string[]).includes(draft.stav);

  const orderEmailStatus = resolvedSearchParams?.email ?? null;
  const orderToken = resolvedSearchParams?.token?.trim() ?? null;
  const baseUrl = getPortalAppBaseUrl(await headers());

  const bindingOrderOutbound =
    orderSent && orderEmailStatus && orderEmailStatus !== "sent" && orderToken
      ? await preparePoptavkaBindingOrderOutboundMessage({
          cisloPoptavky: detail.cislo_poptavky,
          publicLink: baseUrl.trim()
            ? buildPoptavkaObjednavkaUrl(baseUrl, orderToken)
            : `/poptavka-objednavka/${encodeURIComponent(orderToken)}`,
          emailTo: draft.draftData.klient.email,
        })
      : null;

  const canSend = canInitialSendPoptavkaBindingOrder(detail.stav);
  const odeslanychVerzi = await countPoptavkaObjednavkaLinkVersions(supabase, poptavkaId);
  const dalsiNavrhVerze = odeslanychVerzi + 1;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.14em] text-slate-500">
            {detail.cislo_poptavky} · draft objednávky
          </div>
          <h1 className="mt-1 text-3xl font-bold text-white">
            {detail.misto_nazev || "Závazná objednávka"}
          </h1>
          <p className="mt-2 text-slate-400">
            {detail.klient?.nazev ?? "—"}
            {detail.klient?.ico ? ` · IČO ${detail.klient.ico}` : ""}
          </p>
        </div>
        <Link href={`/zakazky/poptavky/${poptavkaId}`} className="text-sm text-blue-300 hover:text-blue-200">
          ← Detail poptávky
        </Link>
      </div>

      {orderSent ? (
        <div className="space-y-3">
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100">
            {orderSentPrimaryMessage(orderEmailStatus, isResendResult)}
            {" "}
            <Link href={`/zakazky/poptavky/${poptavkaId}`} className="font-semibold underline">
              Zobrazit detail poptávky
            </Link>
          </p>
          {orderEmailStatus && orderEmailStatus !== "sent" && ORDER_EMAIL_STATUS_MESSAGES[orderEmailStatus] ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
              {ORDER_EMAIL_STATUS_MESSAGES[orderEmailStatus]}
            </p>
          ) : null}
          {bindingOrderOutbound ? (
            <PoptavkaOutboundMessagePanel
              subject={bindingOrderOutbound.subject}
              fullText={formatPoptavkaOutboundForCopy(bindingOrderOutbound)}
              bodyText={bindingOrderOutbound.text}
              link={bindingOrderOutbound.link}
              emailTo={bindingOrderOutbound.emailTo}
            />
          ) : null}
        </div>
      ) : null}

      <PoptavkaObjednavkaDraftEditor
        poptavkaId={poptavkaId}
        cisloPoptavky={detail.cislo_poptavky}
        draftId={draft.draft_id}
        draftStav={draft.stav}
        draftData={draft.draftData}
        sourceChanged={draft.sourceChanged}
        readOnly={readOnly}
        canEdit={canEdit}
        canSend={canSend}
        odeslanychVerzi={odeslanychVerzi}
        dalsiNavrhVerze={dalsiNavrhVerze}
        saved={resolvedSearchParams?.saved === "1"}
        errorCode={resolvedSearchParams?.error ?? null}
        sestavaKatalog={sestavaKatalog}
        setupsByOblast={setupsByOblast}
        pricingCatalog={pricingCatalog}
        initialFotky={detail.fotky}
      />
    </div>
  );
}
