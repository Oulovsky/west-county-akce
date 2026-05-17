"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { logZakazkaHistory } from "@/lib/zakazka-history";
import { setZakazkaWorkflowStatus } from "@/lib/zakazka-workflow";
import { isApprovedOrLaterWorkflowStatus } from "@/lib/zakazka-critical-changes";
import {
  buildQuestionnaireUrl,
  createClientQuestionnaireToken,
  hashClientQuestionnaireToken,
} from "@/lib/client-questionnaire";
import {
  buildApprovalUrl,
  createClientApprovalToken,
  hashClientApprovalToken,
} from "@/lib/client-approval";

function getZakazkaId(formData: FormData) {
  const zakazkaId = String(formData.get("zakazka_id") ?? "").trim();
  if (!zakazkaId) {
    throw new Error("Chybí ID zakázky.");
  }
  return zakazkaId;
}

function toOptionalNumber(value: unknown) {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

type LogisticsAction = "start_loading" | "complete_loading" | "start_unloading" | "complete_return";

function getLogisticsUpdate(action: LogisticsAction, userId: string, timestamp: string) {
  if (action === "start_loading") {
    return {
      logistika_stav: "naklada_se",
      nakladka_started_by: userId,
      nakladka_started_at: timestamp,
    };
  }

  if (action === "complete_loading") {
    return {
      logistika_stav: "nalozeno",
      nakladka_completed_by: userId,
      nakladka_completed_at: timestamp,
    };
  }

  if (action === "start_unloading") {
    return {
      logistika_stav: "vykladka",
      vykladka_started_by: userId,
      vykladka_started_at: timestamp,
    };
  }

  return {
    logistika_stav: "vraceno",
    vraceno_completed_by: userId,
    vraceno_completed_at: timestamp,
  };
}

function getLogisticsHistoryTitle(action: LogisticsAction) {
  if (action === "start_loading") return "Zahájena nakládka.";
  if (action === "complete_loading") return "Nakládka dokončena.";
  if (action === "start_unloading") return "Zahájena vykládka.";
  return "Vrácení dokončeno.";
}

function getClientQuestionnaireBaseUrl(headersList: Headers) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  if (!host) return "";

  const proto = headersList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function getPublicBaseUrl(headersList: Headers) {
  return getClientQuestionnaireBaseUrl(headersList);
}

function formatDateRangeForEmail(data: {
  akce_od?: string | null;
  akce_do?: string | null;
  datum_od?: string | null;
  datum_do?: string | null;
}) {
  const start = data.akce_od ?? data.datum_od;
  const end = data.akce_do ?? data.datum_do;

  if (!start && !end) return "Termín není vyplněný";

  const formatter = new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: start?.includes("T") || end?.includes("T") ? "short" : undefined,
  });

  const formattedStart = start ? formatter.format(new Date(start)) : "";
  const formattedEnd = end ? formatter.format(new Date(end)) : "";

  return [formattedStart, formattedEnd].filter(Boolean).join(" – ");
}

function createQuestionnaireEmailHtml({
  zakazkaNazev,
  misto,
  termin,
  link,
}: {
  zakazkaNazev: string;
  misto: string;
  termin: string;
  link: string;
}) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;max-width:640px;margin:0 auto;padding:24px">
      <h1 style="font-size:24px;margin:0 0 16px">Technický dotazník k akci</h1>
      <p>Dobrý den,</p>
      <p>potřebujeme ověřit technické informace k akci, abychom správně připravili techniku, kabeláž, elektro a logistiku.</p>
      <div style="background:#f1f5f9;border-radius:12px;padding:16px;margin:20px 0">
        <div><strong>Akce:</strong> ${zakazkaNazev}</div>
        <div><strong>Místo:</strong> ${misto}</div>
        <div><strong>Termín:</strong> ${termin}</div>
      </div>
      <p style="margin:24px 0">
        <a href="${link}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:700">
          Otevřít technický dotazník
        </a>
      </p>
      <p style="font-size:14px;color:#475569">Pokud nechcete vyplňovat technické údaje sami, můžete v dotazníku požádat o výjezd technika před akcí.</p>
      <p style="font-size:12px;color:#64748b;word-break:break-all">Pokud tlačítko nefunguje, otevřete tento odkaz:<br>${link}</p>
    </div>
  `;
}

function createApprovalEmailHtml({
  zakazkaNazev,
  misto,
  termin,
  link,
}: {
  zakazkaNazev: string;
  misto: string;
  termin: string;
  link: string;
}) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;max-width:640px;margin:0 auto;padding:24px">
      <h1 style="font-size:24px;margin:0 0 16px">Schválení finální podoby zakázky</h1>
      <p>Dobrý den,</p>
      <p>posíláme vám finální podobu zakázky ke kontrole a schválení.</p>
      <div style="background:#f1f5f9;border-radius:12px;padding:16px;margin:20px 0">
        <div><strong>Akce:</strong> ${zakazkaNazev}</div>
        <div><strong>Místo:</strong> ${misto}</div>
        <div><strong>Termín:</strong> ${termin}</div>
      </div>
      <p style="margin:24px 0">
        <a href="${link}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:700">
          Otevřít schválení zakázky
        </a>
      </p>
      <p style="font-size:14px;color:#475569">Po otevření odkazu můžete zakázku schválit, nebo odmítnout s komentářem.</p>
      <p style="font-size:12px;color:#64748b;word-break:break-all">Pokud tlačítko nefunguje, otevřete tento odkaz:<br>${link}</p>
    </div>
  `;
}

async function setClientVerificationStatus(
  zakazkaId: string,
  stav: "neni_potreba" | "overeno_interne"
) {
  const supabase = await createClient();

  const { data: currentDotaznik, error: currentError } = await supabase
    .from("zakazka_dotazniky")
    .select("dotaznik_id")
    .eq("zakazka_id", zakazkaId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (currentError) {
    throw new Error(currentError.message);
  }

  const payload = {
    zakazka_id: zakazkaId,
    stav,
    pozadovan_vyjezd_technika: false,
    updated_at: new Date().toISOString(),
  };

  const { error } = currentDotaznik?.dotaznik_id
    ? await supabase
        .from("zakazka_dotazniky")
        .update(payload)
        .eq("dotaznik_id", currentDotaznik.dotaznik_id)
    : await supabase.from("zakazka_dotazniky").insert(payload);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/zakazky/${zakazkaId}`);
}

export async function markQuestionnaireNotNeededAction(formData: FormData) {
  const zakazkaId = getZakazkaId(formData);
  await setClientVerificationStatus(zakazkaId, "neni_potreba");
}

export async function markQuestionnaireInternallyVerifiedAction(formData: FormData) {
  const zakazkaId = getZakazkaId(formData);
  await setClientVerificationStatus(zakazkaId, "overeno_interne");
}

export async function updateZakazkaLogisticsAction(formData: FormData) {
  const zakazkaId = getZakazkaId(formData);
  const action = String(formData.get("logistics_action") ?? "") as LogisticsAction;

  if (
    action !== "start_loading" &&
    action !== "complete_loading" &&
    action !== "start_unloading" &&
    action !== "complete_return"
  ) {
    throw new Error("Neplatná logistická akce.");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Pro změnu logistického stavu musíte být přihlášeni.");
  }

  const { data: zakazka, error: zakazkaError } = await supabase
    .from("zakazky")
    .select("zrusena, workflow_stav")
    .eq("zakazka_id", zakazkaId)
    .maybeSingle();

  if (zakazkaError) throw new Error(zakazkaError.message);
  if (zakazka?.zrusena || zakazka?.workflow_stav === "zruseno") {
    throw new Error("Logistiku zrušené zakázky už nelze měnit.");
  }

  const { error } = await supabase
    .from("zakazky")
    .update(getLogisticsUpdate(action, user.id, new Date().toISOString()))
    .eq("zakazka_id", zakazkaId);

  if (error) {
    throw new Error(error.message);
  }

  if (action === "start_loading" || action === "complete_loading") {
    await setZakazkaWorkflowStatus(supabase, {
      zakazkaId,
      nextStatus: "priprava",
      actorId: user.id,
      source: `logistics_${action}`,
    });
  }

  if (action === "start_unloading") {
    await setZakazkaWorkflowStatus(supabase, {
      zakazkaId,
      nextStatus: "v_realizaci",
      actorId: user.id,
      source: `logistics_${action}`,
    });
  }

  if (action === "complete_return") {
    await setZakazkaWorkflowStatus(supabase, {
      zakazkaId,
      nextStatus: "dokonceno",
      actorId: user.id,
      source: `logistics_${action}`,
    });
  }

  await logZakazkaHistory(supabase, {
    zakazkaId,
    eventType: `logistics_${action}`,
    actorId: user.id,
    title: getLogisticsHistoryTitle(action),
    detail: null,
    metadata: { action },
  });

  revalidatePath(`/zakazky/${zakazkaId}`);
  revalidatePath("/zakazky");
  revalidatePath("/moje");
  revalidatePath(`/moje/zakazky/${zakazkaId}`);
}

export async function createPlaceFromZakazkaAction(formData: FormData) {
  const zakazkaId = getZakazkaId(formData);
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, errorMessage: "Pro vytvoření místa musíte být přihlášeni.", mistoId: null };
  }

  const { data: zakazka, error: zakazkaError } = await supabase
    .from("zakazky")
    .select("zakazka_id, nazev, klient_id, misto_id, misto, misto_lat, misto_lng, misto_gps_radius_m")
    .eq("zakazka_id", zakazkaId)
    .single();

  if (zakazkaError) {
    return { ok: false, errorMessage: zakazkaError.message, mistoId: null };
  }

  if (zakazka.misto_id) {
    return { ok: true, errorMessage: null, mistoId: zakazka.misto_id as string };
  }

  const placeName = String(zakazka.misto ?? "").trim() || String(zakazka.nazev ?? "").trim() || "Místo konání";
  const lat = toOptionalNumber(zakazka.misto_lat);
  const lng = toOptionalNumber(zakazka.misto_lng);
  const radius = toOptionalNumber(zakazka.misto_gps_radius_m);

  const { data: misto, error: mistoError } = await supabase
    .from("mista_konani")
    .insert({
      klient_id: zakazka.klient_id ?? null,
      nazev: placeName,
      adresa_text: String(zakazka.misto ?? "").trim() || null,
      lat,
      lng,
      radius_m: radius ?? 300,
      aktivni: true,
    })
    .select("misto_id")
    .single();

  if (mistoError) {
    return { ok: false, errorMessage: mistoError.message, mistoId: null };
  }

  const { error: updateError } = await supabase
    .from("zakazky")
    .update({ misto_id: misto.misto_id })
    .eq("zakazka_id", zakazkaId);

  if (updateError) {
    return { ok: false, errorMessage: updateError.message, mistoId: null };
  }

  revalidatePath(`/zakazky/${zakazkaId}`);
  revalidatePath(`/mista/${misto.misto_id}`);
  revalidatePath("/mista");

  return { ok: true, errorMessage: null, mistoId: misto.misto_id as string };
}

export async function linkZakazkaToExistingPlaceAction(formData: FormData) {
  const zakazkaId = getZakazkaId(formData);
  const mistoId = String(formData.get("misto_id") ?? "").trim();

  if (!mistoId) {
    return { ok: false, errorMessage: "Vyberte prosím existující místo.", mistoId: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, errorMessage: "Pro propojení místa musíte být přihlášeni.", mistoId: null };
  }

  const { data: misto, error: mistoError } = await supabase
    .from("mista_konani")
    .select("misto_id")
    .eq("misto_id", mistoId)
    .maybeSingle();

  if (mistoError) {
    return { ok: false, errorMessage: mistoError.message, mistoId: null };
  }

  if (!misto) {
    return { ok: false, errorMessage: "Vybrané místo nebylo nalezeno.", mistoId: null };
  }

  const { error } = await supabase
    .from("zakazky")
    .update({ misto_id: mistoId })
    .eq("zakazka_id", zakazkaId);

  if (error) {
    return { ok: false, errorMessage: error.message, mistoId: null };
  }

  revalidatePath(`/zakazky/${zakazkaId}`);
  revalidatePath(`/mista/${mistoId}`);
  revalidatePath("/mista");

  return { ok: true, errorMessage: null, mistoId };
}

export async function sendClientQuestionnaireAction(formData: FormData) {
  const zakazkaId = getZakazkaId(formData);
  const supabase = await createClient();

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (!resendApiKey) {
    redirect(`/zakazky/${zakazkaId}?technicke_overeni=missing_resend_key`);
  }

  const { data: zakazka, error: zakazkaError } = await supabase
    .from("zakazky")
    .select("zakazka_id, klient_id, nazev, misto, akce_od, akce_do, datum_od, datum_do, workflow_stav, workflow_change_pending")
    .eq("zakazka_id", zakazkaId)
    .single();

  if (zakazkaError) {
    throw new Error(zakazkaError.message);
  }

  let emailTo: string | null = null;
  if (zakazka.klient_id) {
    const { data: klient, error: klientError } = await supabase
      .from("klienti")
      .select("email")
      .eq("klient_id", zakazka.klient_id)
      .maybeSingle();

    if (klientError) {
      throw new Error(klientError.message);
    }

    emailTo = klient?.email ?? null;
  }

  if (!emailTo?.trim()) {
    redirect(`/zakazky/${zakazkaId}?technicke_overeni=missing_email`);
  }

  const recipientEmail = emailTo.trim();
  const headersList = await headers();
  const questionnaireBaseUrl = getClientQuestionnaireBaseUrl(headersList);
  const rawToken = createClientQuestionnaireToken();
  const tokenHash = hashClientQuestionnaireToken(rawToken);
  const publicLink = buildQuestionnaireUrl(questionnaireBaseUrl, rawToken);
  const now = new Date().toISOString();

  const { error: revokeError } = await supabase
    .from("zakazka_client_links")
    .update({ revoked_at: now })
    .eq("zakazka_id", zakazkaId)
    .is("revoked_at", null);

  if (revokeError) {
    throw new Error(revokeError.message);
  }

  const { data: link, error: linkError } = await supabase
    .from("zakazka_client_links")
    .insert({
      zakazka_id: zakazkaId,
      klient_id: zakazka.klient_id,
      token_hash: tokenHash,
      email_to: recipientEmail,
      stav: "vytvoren",
    })
    .select("link_id")
    .single();

  if (linkError) {
    throw new Error(linkError.message);
  }

  const resend = new Resend(resendApiKey);
  const { error: resendError } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL?.trim() || "WEST COUNTY <onboarding@resend.dev>",
    to: recipientEmail,
    subject: `Technický dotazník k akci ${zakazka.nazev ?? ""}`.trim(),
    html: createQuestionnaireEmailHtml({
      zakazkaNazev: zakazka.nazev ?? "Zakázka",
      misto: zakazka.misto ?? "Místo není vyplněné",
      termin: formatDateRangeForEmail(zakazka),
      link: publicLink,
    }),
  });

  if (resendError) {
    await supabase
      .from("zakazka_client_links")
      .update({ revoked_at: new Date().toISOString(), stav: "email_error" })
      .eq("link_id", link.link_id);
    throw new Error(resendError.message);
  }

  const { error: linkUpdateError } = await supabase
    .from("zakazka_client_links")
    .update({ email_sent_at: new Date().toISOString(), stav: "email_odeslan" })
    .eq("link_id", link.link_id);

  if (linkUpdateError) {
    throw new Error(linkUpdateError.message);
  }

  const { data: currentDotaznik, error: currentError } = await supabase
    .from("zakazka_dotazniky")
    .select("dotaznik_id")
    .eq("zakazka_id", zakazkaId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (currentError) {
    throw new Error(currentError.message);
  }

  const dotaznikPayload = {
    zakazka_id: zakazkaId,
    link_id: link.link_id,
    stav: "rozpracovano",
    pozadovan_vyjezd_technika: false,
    updated_at: new Date().toISOString(),
  };

  const { error: dotaznikError } = currentDotaznik?.dotaznik_id
    ? await supabase
        .from("zakazka_dotazniky")
        .update(dotaznikPayload)
        .eq("dotaznik_id", currentDotaznik.dotaznik_id)
    : await supabase.from("zakazka_dotazniky").insert(dotaznikPayload);

  if (dotaznikError) {
    throw new Error(dotaznikError.message);
  }

  await supabase
    .from("zakazky")
    .update({ client_approval_status: "questionnaire_sent" })
    .eq("zakazka_id", zakazkaId)
    .neq("client_approval_status", "approved");

  revalidatePath(`/zakazky/${zakazkaId}`);
  redirect(`/zakazky/${zakazkaId}?technicke_overeni=sent`);
}

export async function sendClientApprovalAction(formData: FormData) {
  const zakazkaId = getZakazkaId(formData);
  const supabase = await createClient();

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (!resendApiKey) {
    redirect(`/zakazky/${zakazkaId}?schvaleni=missing_resend_key`);
  }

  const { data: zakazka, error: zakazkaError } = await supabase
    .from("zakazky")
    .select("zakazka_id, klient_id, nazev, misto, akce_od, akce_do, datum_od, datum_do, workflow_stav, workflow_change_pending")
    .eq("zakazka_id", zakazkaId)
    .single();

  if (zakazkaError) {
    throw new Error(zakazkaError.message);
  }

  let emailTo: string | null = null;
  if (zakazka.klient_id) {
    const { data: klient, error: klientError } = await supabase
      .from("klienti")
      .select("email")
      .eq("klient_id", zakazka.klient_id)
      .maybeSingle();

    if (klientError) {
      throw new Error(klientError.message);
    }

    emailTo = klient?.email ?? null;
  }

  if (!emailTo?.trim()) {
    redirect(`/zakazky/${zakazkaId}?schvaleni=missing_email`);
  }

  const recipientEmail = emailTo.trim();
  const now = new Date().toISOString();
  const rawToken = createClientApprovalToken();
  const tokenHash = hashClientApprovalToken(rawToken);
  const publicLink = buildApprovalUrl(getPublicBaseUrl(await headers()), rawToken);

  const { error: revokeError } = await supabase
    .from("zakazka_approval_links")
    .update({ revoked_at: now })
    .eq("zakazka_id", zakazkaId)
    .is("revoked_at", null);

  if (revokeError) {
    throw new Error(revokeError.message);
  }

  const { data: link, error: linkError } = await supabase
    .from("zakazka_approval_links")
    .insert({
      zakazka_id: zakazkaId,
      klient_id: zakazka.klient_id,
      token_hash: tokenHash,
      email_to: recipientEmail,
      stav: "vytvoren",
    })
    .select("link_id")
    .single();

  if (linkError) {
    throw new Error(linkError.message);
  }

  const resend = new Resend(resendApiKey);
  const { error: resendError } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL?.trim() || "WEST COUNTY <onboarding@resend.dev>",
    to: recipientEmail,
    subject: `Schválení zakázky ${zakazka.nazev ?? ""}`.trim(),
    html: createApprovalEmailHtml({
      zakazkaNazev: zakazka.nazev ?? "Zakázka",
      misto: zakazka.misto ?? "Místo není vyplněné",
      termin: formatDateRangeForEmail(zakazka),
      link: publicLink,
    }),
  });

  if (resendError) {
    await supabase
      .from("zakazka_approval_links")
      .update({ revoked_at: new Date().toISOString(), stav: "email_error" })
      .eq("link_id", link.link_id);
    throw new Error(resendError.message);
  }

  const { error: updateLinkError } = await supabase
    .from("zakazka_approval_links")
    .update({ email_sent_at: new Date().toISOString(), stav: "email_odeslan" })
    .eq("link_id", link.link_id);

  if (updateLinkError) {
    throw new Error(updateLinkError.message);
  }

  const { error: updateZakazkaError } = await supabase
    .from("zakazky")
    .update({
      client_approval_status: "sent_for_approval",
      client_approval_declined_at: null,
      client_approval_declined_reason: null,
    })
    .eq("zakazka_id", zakazkaId);

  if (updateZakazkaError) {
    throw new Error(updateZakazkaError.message);
  }

  if (isApprovedOrLaterWorkflowStatus(zakazka.workflow_stav)) {
    await logZakazkaHistory(supabase, {
      zakazkaId,
      eventType: "workflow_changes_sent_for_approval",
      actorId: null,
      title: "Změny zakázky byly odeslány klientovi k novému potvrzení.",
      detail: `Odesláno na ${recipientEmail}.`,
      metadata: { link_id: link.link_id },
    });
  } else {
    const workflowResult = await setZakazkaWorkflowStatus(supabase, {
      zakazkaId,
      nextStatus: "cekani_na_schvaleni",
      actorId: null,
      source: "client_approval_sent",
      metadata: { link_id: link.link_id },
    });
    if (!workflowResult.ok) throw new Error(workflowResult.error);
  }

  await logZakazkaHistory(supabase, {
    zakazkaId,
    eventType: "client_approval_sent",
    actorId: null,
    title: "Finální zakázka odeslána klientovi ke schválení.",
    detail: `Odesláno na ${recipientEmail}.`,
    metadata: { link_id: link.link_id },
  });

  revalidatePath(`/zakazky/${zakazkaId}`);
  revalidatePath("/zakazky");
  redirect(`/zakazky/${zakazkaId}?schvaleni=sent&approval_token=${encodeURIComponent(rawToken)}`);
}

export async function revokeClientApprovalLinkAction(formData: FormData) {
  const zakazkaId = getZakazkaId(formData);
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("zakazka_approval_links")
    .update({ revoked_at: now, stav: "revoked" })
    .eq("zakazka_id", zakazkaId)
    .is("revoked_at", null);

  if (error) {
    throw new Error(error.message);
  }

  await logZakazkaHistory(supabase, {
    zakazkaId,
    eventType: "client_approval_revoked",
    actorId: null,
    title: "Odkaz na schválení zakázky byl zneplatněn.",
    detail: null,
    metadata: {},
  });

  revalidatePath(`/zakazky/${zakazkaId}`);
  redirect(`/zakazky/${zakazkaId}?schvaleni=revoked`);
}
