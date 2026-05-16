import { redirect } from "next/navigation";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getRiskCodes,
  hashClientQuestionnaireToken,
  type QuestionnaireDecision,
} from "@/lib/client-questionnaire";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ odeslano?: string; error?: string }>;
};

type LinkRow = {
  link_id: string;
  zakazka_id: string;
  klient_id: string | null;
  revoked_at: string | null;
  opened_at: string | null;
  open_count: number | null;
};

type ZakazkaRow = {
  zakazka_id: string;
  cislo_zakazky: string | null;
  nazev: string | null;
  misto: string | null;
  akce_od: string | null;
  akce_do: string | null;
  datum_od: string | null;
  datum_do: string | null;
};

function toOptionalNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function normalizeDecision(value: FormDataEntryValue | null): QuestionnaireDecision {
  return value === "technician_visit" ? "technician_visit" : "self";
}

function normalizeChoice(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || "nevim";
}

function formatDateRange(data: ZakazkaRow) {
  const start = data.akce_od ?? data.datum_od;
  const end = data.akce_do ?? data.datum_do;
  if (!start && !end) return "Termín není vyplněný";

  const formatter = new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: start?.includes("T") || end?.includes("T") ? "short" : undefined,
  });

  return [start, end].filter(Boolean).map((value) => formatter.format(new Date(value!))).join(" – ");
}

async function loadValidLink(rawToken: string) {
  const supabase = await createClient();
  const tokenHash = hashClientQuestionnaireToken(rawToken);

  const { data: linkRaw, error: linkError } = await supabase
    .from("zakazka_client_links")
    .select("link_id, zakazka_id, klient_id, revoked_at, opened_at, open_count")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (linkError) {
    throw new Error(linkError.message);
  }

  const link = (linkRaw ?? null) as LinkRow | null;
  if (!link || link.revoked_at) {
    return { supabase, link: null, zakazka: null };
  }

  const { data: zakazkaRaw, error: zakazkaError } = await supabase
    .from("zakazky")
    .select("zakazka_id, cislo_zakazky, nazev, misto, akce_od, akce_do, datum_od, datum_do")
    .eq("zakazka_id", link.zakazka_id)
    .single();

  if (zakazkaError) {
    throw new Error(zakazkaError.message);
  }

  return { supabase, link, zakazka: zakazkaRaw as ZakazkaRow };
}

export default async function PublicDotaznikPage({ params, searchParams }: PageProps) {
  noStore();

  const { token } = await params;
  const resolvedSearchParams = await searchParams;
  const { supabase, link, zakazka } = await loadValidLink(token);

  if (!link || !zakazka) {
    return (
      <div className="mx-auto max-w-2xl py-16">
        <div className="rounded-3xl border border-red-500/40 bg-red-950/20 p-6 text-red-100">
          <h1 className="text-2xl font-bold">Neplatný nebo zneplatněný odkaz.</h1>
          <p className="mt-2 text-sm text-red-200">
            Požádejte prosím organizátora akce o nový odkaz na technický dotazník.
          </p>
        </div>
      </div>
    );
  }

  const now = new Date().toISOString();
  await supabase
    .from("zakazka_client_links")
    .update({
      opened_at: link.opened_at ?? now,
      last_opened_at: now,
      open_count: (link.open_count ?? 0) + 1,
    })
    .eq("link_id", link.link_id);

  async function submitQuestionnaire(formData: FormData) {
    "use server";

    const { supabase, link } = await loadValidLink(token);
    if (!link) {
      redirect(`/dotaznik/${encodeURIComponent(token)}?error=invalid`);
    }

    const decision = normalizeDecision(formData.get("decision"));
    const kontaktJmeno = String(formData.get("kontakt_jmeno") ?? "").trim();
    const kontaktTelefon = String(formData.get("kontakt_telefon") ?? "").trim();
    const lzeZajetAutem = normalizeChoice(formData.get("lze_zajet_autem"));
    const mistoZpevnene = normalizeChoice(formData.get("misto_zpevnene"));
    const prijezdPoznamka = String(formData.get("prijezd_poznamka") ?? "").trim();
    const parkovaniPoznamka = String(formData.get("parkovani_poznamka") ?? "").trim();
    const elektroPripravena = normalizeChoice(formData.get("elektro_pripravena"));
    const elektroPripojka = String(formData.get("elektro_pripojka") ?? "").trim();
    const elektroJisteni = String(formData.get("elektro_jisteni") ?? "").trim();
    const elektroZasuvka = normalizeChoice(formData.get("elektro_zasuvka"));
    const elektroVzdalenostM = toOptionalNumber(formData.get("elektro_vzdalenost_m"));
    const kabelPresSilnici = normalizeChoice(formData.get("kabel_pres_silnici"));
    const potvrzeniPravdivosti = formData.get("potvrzeni_pravdivosti") === "on";
    const potvrzeniDoctovani = formData.get("potvrzeni_doctovani") === "on";
    const potvrzeniVyjezdu = formData.get("potvrzeni_vyjezdu") === "on";

    if (!kontaktJmeno || !kontaktTelefon) {
      redirect(`/dotaznik/${encodeURIComponent(token)}?error=contact_required`);
    }

    if (decision === "technician_visit") {
      if (!potvrzeniVyjezdu) {
        redirect(`/dotaznik/${encodeURIComponent(token)}?error=visit_required`);
      }
    } else {
      if (!potvrzeniPravdivosti) {
        redirect(`/dotaznik/${encodeURIComponent(token)}?error=truth_required`);
      }

      if (!potvrzeniDoctovani) {
        redirect(`/dotaznik/${encodeURIComponent(token)}?error=cost_required`);
      }

      if (!elektroPripravena) {
        redirect(`/dotaznik/${encodeURIComponent(token)}?error=electro_required`);
      }

      if (elektroPripravena === "ano" && elektroVzdalenostM == null) {
        redirect(`/dotaznik/${encodeURIComponent(token)}?error=distance_required`);
      }
    }

    const risks = getRiskCodes({
      decision,
      lzeZajetAutem,
      mistoZpevnene,
      elektroPripravena,
      elektroPripojka,
      elektroJisteni,
      elektroZasuvka,
      elektroVzdalenostM,
      kabelPresSilnici,
      parkovaniPoznamka,
    });
    const submittedAt = new Date().toISOString();
    const stav = decision === "technician_visit" ? "pozadovan_vyjezd_technika" : "vyplneno";

    const { data: existing, error: existingError } = await supabase
      .from("zakazka_dotazniky")
      .select("dotaznik_id")
      .eq("link_id", link.link_id)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    const payload = {
      zakazka_id: link.zakazka_id,
      link_id: link.link_id,
      stav,
      kontakt_jmeno: kontaktJmeno || null,
      kontakt_telefon: kontaktTelefon || null,
      prijezd_poznamka: prijezdPoznamka || null,
      parkovani_poznamka: parkovaniPoznamka || null,
      elektro_pripojka: elektroPripojka || null,
      elektro_jisteni: elektroJisteni || null,
      elektro_zasuvka: elektroZasuvka || null,
      elektro_vzdalenost_m: elektroVzdalenostM,
      pozadovan_vyjezd_technika: decision === "technician_visit",
      potvrzeni_pravdivosti: potvrzeniPravdivosti,
      potvrzeni_doctovani: potvrzeniDoctovani,
      rizika: risks,
      odpovedi_extra: {
        decision,
        lze_zajet_autem: lzeZajetAutem,
        misto_zpevnene: mistoZpevnene,
        elektro_pripravena: elektroPripravena,
        kabel_pres_silnici: kabelPresSilnici,
        potvrzeni_vyjezdu: potvrzeniVyjezdu,
      },
      submitted_at: submittedAt,
      updated_at: submittedAt,
    };

    const { error } = existing?.dotaznik_id
      ? await supabase.from("zakazka_dotazniky").update(payload).eq("dotaznik_id", existing.dotaznik_id)
      : await supabase.from("zakazka_dotazniky").insert(payload);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/zakazky/${link.zakazka_id}`);
    redirect(`/dotaznik/${encodeURIComponent(token)}?odeslano=1`);
  }

  if (resolvedSearchParams?.odeslano === "1") {
    return (
      <div className="mx-auto max-w-2xl py-16">
        <div className="rounded-3xl border border-emerald-500/40 bg-emerald-950/20 p-6 text-emerald-100">
          <h1 className="text-2xl font-bold">Dotazník byl odeslán.</h1>
          <p className="mt-2 text-sm text-emerald-200">Děkujeme, technické informace máme uložené u zakázky.</p>
        </div>
      </div>
    );
  }

  const errorMessage =
    resolvedSearchParams?.error === "contact_required"
      ? "Vyplňte prosím jméno a telefon kontaktní osoby na místě."
      : resolvedSearchParams?.error === "visit_required"
        ? "Potvrďte prosím objednání výjezdu technika před akcí."
        : resolvedSearchParams?.error === "truth_required"
      ? "Potvrďte prosím pravdivost údajů podle nejlepšího vědomí."
      : resolvedSearchParams?.error === "cost_required"
        ? "Při vlastním vyplnění potvrďte prosím i možné dodatečné náklady při nesouladu na místě."
        : resolvedSearchParams?.error === "distance_required"
          ? "Pokud je elektro přípojka připravená, vyplňte prosím přibližnou vzdálenost v metrech."
          : resolvedSearchParams?.error === "electro_required"
            ? "Vyberte prosím, zda je na místě připravená elektro přípojka."
        : resolvedSearchParams?.error === "invalid"
          ? "Odkaz už není platný."
          : null;

  return (
    <div className="mx-auto max-w-3xl py-6">
      <div className="rounded-3xl border border-slate-700 bg-[#0b1324] p-5 shadow-xl sm:p-8">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-blue-300">WEST COUNTY</div>
          <h1 className="mt-2 text-3xl font-black text-white">Technický dotazník k akci</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Potřebujeme ověřit technické informace, abychom správně připravili techniku, kabeláž,
            elektro a logistiku.
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-200">
          <div><strong>Akce:</strong> {zakazka.nazev ?? zakazka.cislo_zakazky ?? "Zakázka"}</div>
          <div><strong>Místo:</strong> {zakazka.misto ?? "Místo není vyplněné"}</div>
          <div><strong>Termín:</strong> {formatDateRange(zakazka)}</div>
        </div>

        {errorMessage ? (
          <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}

        <form action={submitQuestionnaire} className="mt-6 space-y-6">
          <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <h2 className="text-xl font-bold text-white">1. Kontakt na místě</h2>
            <label className="block text-sm font-semibold text-slate-200">
              Jméno kontaktní osoby na místě
              <input
                name="kontakt_jmeno"
                required
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                placeholder="Např. Jan Novák"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-200">
              Telefon kontaktní osoby
              <input
                name="kontakt_telefon"
                required
                type="tel"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                placeholder="Např. +420 777 123 456"
              />
            </label>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <h2 className="text-xl font-bold text-white">2. Příjezd a parkování</h2>

            <div>
              <div className="text-sm font-semibold text-slate-200">
                Lze zajet dodávkou nebo nákladním autem až k místu?
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {[
                  ["ano", "Ano"],
                  ["ne", "Ne"],
                  ["nevim", "Nevím"],
                ].map(([value, label]) => (
                  <label key={value} className="flex gap-2 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200">
                    <input type="radio" name="lze_zajet_autem" value={value} defaultChecked={value === "nevim"} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-200">Je místo zpevněné?</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {[
                  ["ano", "Ano"],
                  ["ne", "Ne"],
                  ["nevim", "Nevím"],
                ].map(([value, label]) => (
                  <label key={value} className="flex gap-2 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200">
                    <input type="radio" name="misto_zpevnene" value={value} defaultChecked={value === "nevim"} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="block text-sm font-semibold text-slate-200">
              Kde lze parkovat?
              <textarea
                name="parkovani_poznamka"
                className="mt-2 min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                placeholder="Např. za budovou, na dvoře, u zadního vjezdu..."
              />
            </label>

            <label className="block text-sm font-semibold text-slate-200">
              Poznámka k příjezdu
              <textarea
                name="prijezd_poznamka"
                className="mt-2 min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                placeholder="Přesný vjezd, brána, areál, backstage, omezení pro auto..."
              />
            </label>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <h2 className="text-xl font-bold text-white">3. Elektro</h2>
            <div>
              <div className="text-sm font-semibold text-slate-200">Je na místě připravená elektro přípojka?</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {[
                  ["ano", "Ano"],
                  ["ne", "Ne"],
                  ["nevim", "Nevím"],
                ].map(([value, label]) => (
                  <label key={value} className="flex gap-2 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200">
                    <input type="radio" name="elektro_pripravena" value={value} defaultChecked={value === "nevim"} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="block text-sm font-semibold text-slate-200">
              Jaká přípojka je k dispozici?
              <input
                name="elektro_pripojka"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                placeholder="Např. 32A, 63A, 2×32A, 230V, nevím"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-200">
              Jištění / počet okruhů, pokud víte
              <input
                name="elektro_jisteni"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                placeholder="Např. samostatný jistič 32A, 2 okruhy, nevím"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-200">
              Jaký je typ zásuvky?
              <select
                name="elektro_zasuvka"
                defaultValue="nevim"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
              >
                <option value="230V běžná zásuvka">230V běžná zásuvka</option>
                <option value="16A 5pin">16A 5pin</option>
                <option value="32A 5pin">32A 5pin</option>
                <option value="63A 5pin">63A 5pin</option>
                <option value="nevim">Nevím</option>
                <option value="Jiné">Jiné</option>
              </select>
            </label>

            <label className="block text-sm font-semibold text-slate-200">
              Přibližná vzdálenost přípojky od místa podia/techniky v metrech
              <input
                name="elektro_vzdalenost_m"
                inputMode="decimal"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                placeholder="Např. 15"
              />
            </label>

            <div>
              <div className="text-sm font-semibold text-slate-200">
                Musí kabel vést přes silnici, chodník nebo veřejný průchod?
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {[
                  ["ano", "Ano"],
                  ["ne", "Ne"],
                  ["nevim", "Nevím"],
                ].map(([value, label]) => (
                  <label key={value} className="flex gap-2 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200">
                    <input type="radio" name="kabel_pres_silnici" value={value} defaultChecked={value === "nevim"} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-4">
            <h2 className="text-xl font-bold text-white">4. Fotky</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              V dalším kroku bude možné přiložit fotky rozvaděče, místa stage a trasy kabeláže.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <h2 className="text-xl font-bold text-white">5. Rozhodnutí</h2>
            <label className="flex gap-3 rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-200">
              <input type="radio" name="decision" value="self" defaultChecked />
              <span>Vyplním technické údaje sám/sama.</span>
            </label>
            <label className="flex gap-3 rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-200">
              <input type="radio" name="decision" value="technician_visit" />
              <span>Chci objednat výjezd technika před akcí.</span>
            </label>
            <p className="rounded-xl border border-blue-500/30 bg-blue-950/20 px-4 py-3 text-sm leading-relaxed text-blue-100">
              Pokud zvolíte výjezd technika, technik místo zkontroluje, zakázka se následně upraví podle
              skutečného stavu a finální cena se stanoví podle ověřených údajů.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <h2 className="text-xl font-bold text-white">6. Potvrzení</h2>
            <label className="flex gap-3 rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-200">
              <input type="checkbox" name="potvrzeni_pravdivosti" />
              <span>Potvrzuji, že údaje vyplňuji pravdivě podle svého nejlepšího vědomí.</span>
            </label>
            <label className="flex gap-3 rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-200">
              <input type="checkbox" name="potvrzeni_doctovani" />
              <span>
                Beru na vědomí, že pokud budou údaje na místě nepravdivé nebo neúplné,
                může být doúčtován potřebný materiál, práce nebo doprava.
              </span>
            </label>
            <label className="flex gap-3 rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-200">
              <input type="checkbox" name="potvrzeni_vyjezdu" />
              <span>Objednávám výjezd technika před akcí.</span>
            </label>
          </section>

          <button className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-base font-black text-white transition hover:bg-blue-500">
            Odeslat dotazník
          </button>
        </form>
      </div>
    </div>
  );
}
