import Link from "next/link";
import { headers } from "next/headers";
import { verifyInternalPoptavkyReadPage } from "@/lib/auth/admin-access-server";
import { loadSessionRolePermissions } from "@/lib/auth/internal-role-access-server";
import { canSendPoptavkaBindingOrder, canOpenObjednavkaEditor, loadInternalPoptavkaDetail } from "@/lib/client-portal/poptavka-internal-server";
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
import { buildPoptavkaObjednavkaUrl, countPoptavkaObjednavkaLinkVersions } from "@/lib/client-portal/poptavka-objednavka-link-server";
import { loadPortalSestavaKatalog } from "@/lib/client-portal/sestava-konfigurator-server";
import { loadPortalSetups } from "@/lib/client-portal/poptavka-server";
import { loadObjednavkaPricingCatalog } from "@/lib/client-portal/poptavka-objednavka-pricing-server";
import { createClient } from "@/lib/supabase/server";
import PoptavkaOutboundMessagePanel from "../../PoptavkaOutboundMessagePanel";
import PoptavkaObjednavkaDraftEditor from "./PoptavkaObjednavkaDraftEditor";

const ORDER_EMAIL_STATUS_MESSAGES: Record<string, string> = {
  sent: "Klientovi byl odeslán e-mail s odkazem na závaznou objednávku.",
  missing_email:
    "Závazná objednávka byla vytvořena, ale klient nemá dostupný e-mail pro upozornění.",
  missing_resend_key:
    "Závazná objednávka byla vytvořena, ale chybí RESEND_API_KEY — e-mail klientovi nebyl odeslán.",
  missing_base_url:
    "Závazná objednávka byla vytvořena, ale nepodařilo se sestavit veřejnou URL aplikace pro e-mail.",
  failed: "Závazná objednávka byla vytvořena, ale odeslání e-mailu klientovi selhalo.",
};

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
  const shouldAutoCreateDraft =
    !readOnly &&
    !orderSent &&
    canSendPoptavkaBindingOrder(detail.stav);

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
            Závazná objednávka byla vytvořena a odeslána klientovi ke schválení.
          </p>
          {orderEmailStatus && ORDER_EMAIL_STATUS_MESSAGES[orderEmailStatus] ? (
            <p
              className={[
                "rounded-lg border px-4 py-3 text-sm",
                orderEmailStatus === "sent"
                  ? "border-blue-500/30 bg-blue-950/20 text-blue-100"
                  : "border-amber-500/30 bg-amber-950/20 text-amber-100",
              ].join(" ")}
            >
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
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Závazná objednávka</h1>
          <p className="mt-2 text-slate-400">{detail.cislo_poptavky}</p>
        </div>
        <p className="rounded-lg border border-blue-500/30 bg-blue-950/20 px-4 py-3 text-sm text-blue-100">
          Závazná objednávka byla odeslána klientovi a čeká na jeho potvrzení.
        </p>
        <Link
          href={`/zakazky/poptavky/${poptavkaId}`}
          className="inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          ← Detail poptávky
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

  const canSend = canSendPoptavkaBindingOrder(detail.stav);
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
            Závazná objednávka byla vytvořena a odeslána klientovi ke schválení. Draft byl zmrazen.
            {" "}
            <Link href={`/zakazky/poptavky/${poptavkaId}`} className="font-semibold underline">
              Zobrazit detail poptávky
            </Link>
          </p>
          {orderEmailStatus && ORDER_EMAIL_STATUS_MESSAGES[orderEmailStatus] ? (
            <p
              className={[
                "rounded-lg border px-4 py-3 text-sm",
                orderEmailStatus === "sent"
                  ? "border-blue-500/30 bg-blue-950/20 text-blue-100"
                  : "border-amber-500/30 bg-amber-950/20 text-amber-100",
              ].join(" ")}
            >
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
