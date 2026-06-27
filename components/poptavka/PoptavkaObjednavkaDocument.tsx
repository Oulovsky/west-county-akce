import type { ReactNode } from "react";
import { SETUP_OBLAST_LABELS } from "@/lib/client-portal/labels";
import {
  formatObjednavkaDateRange,
  formatObjednavkaGps,
  formatObjednavkaTermin,
  formatObjednavkaTime,
  formatObjednavkaTriVolba,
} from "@/lib/client-portal/poptavka-objednavka-document";
import { POPTAVKA_FOTKA_TYP_LABELS } from "@/lib/client-portal/poptavka-fotky-shared";
import type {
  PartyBlock,
  PoptavkaObjednavkaDocumentData,
  PoptavkaObjednavkaDocumentMeta,
  SmluvniPodminkyBlock,
} from "@/lib/client-portal/poptavka-objednavka-types";

function DocSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-slate-200 pb-6 last:border-b-0 last:pb-0">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function DocRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null;
  return (
    <div className="grid gap-1 border-b border-slate-100 py-2 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="whitespace-pre-wrap text-sm text-slate-900">{value}</dd>
    </div>
  );
}

function PartySection({ title, party }: { title: string; party: PartyBlock }) {
  return (
    <DocSection title={title}>
      <dl>
        <DocRow label="Název / firma" value={party.nazev} />
        <DocRow label="IČO" value={party.ico} />
        <DocRow label="DIČ" value={party.dic} />
        <DocRow label="Adresa" value={party.adresa} />
        <DocRow label="Kontaktní osoba" value={party.kontaktJmeno} />
        <DocRow label="Telefon" value={party.telefon} />
        <DocRow label="E-mail" value={party.email} />
        <DocRow label="Bankovní spojení" value={party.bankovniSpojeni} />
      </dl>
    </DocSection>
  );
}

function ProseBlock({ title, text }: { title: string; text: string | null | undefined }) {
  if (!text?.trim()) return null;
  return (
    <div className="mb-4 last:mb-0">
      <h3 className="mb-2 text-sm font-semibold text-slate-800">{title}</h3>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{text}</p>
    </div>
  );
}

function SmluvniSection({ block }: { block: SmluvniPodminkyBlock }) {
  return (
    <DocSection title="Smluvní podmínky">
      <ProseBlock title="Závaznost objednávky" text={block.zavaznost} />
      <ProseBlock title="Součinnost klienta" text={block.soucinnostKlienta} />
      <ProseBlock title="Elektro a technické podmínky" text={block.elektroTechnicke} />
      <ProseBlock title="Počasí / vyšší moc" text={block.pocasiVyssiMoc} />
      <ProseBlock title="Storno" text={block.storno} />
      <ProseBlock title="Odpovědnost za místo" text={block.odpovednostZaMisto} />
      <ProseBlock title="Bezpečnost" text={block.bezpecnost} />
      <ProseBlock title="Platební podmínky" text={block.platebni} />
    </DocSection>
  );
}

type Props = {
  data: PoptavkaObjednavkaDocumentData;
  meta?: PoptavkaObjednavkaDocumentMeta;
};

export default function PoptavkaObjednavkaDocument({ data, meta }: Props) {
  const akce = data.akce;
  const misto = data.misto;
  const org = data.organizace;
  const terminyAkce = formatObjednavkaDateRange(akce.datumOd, akce.datumDo);
  const casAkce =
    akce.casProgramuOd || akce.casProgramuDo
      ? [formatObjednavkaTime(akce.casProgramuOd), formatObjednavkaTime(akce.casProgramuDo)]
          .filter(Boolean)
          .join(" – ")
      : null;

  return (
    <article className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      <header className="mb-8 border-b border-slate-200 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Závazná objednávka
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
          {akce.nazevAkce || meta?.nazevAkce || "Objednávka akce"}
        </h1>
        {meta?.cisloPoptavky ? (
          <p className="mt-2 text-sm text-slate-500">
            Reference: {meta.cisloPoptavky}
            {meta.navrhVerze ? ` · verze ${meta.navrhVerze}` : null}
          </p>
        ) : null}
      </header>

      <div className="space-y-8">
        {meta?.upravenoOprotiPoptavce ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
            Na základě naší komunikace byly v poptávce provedeny změny.
          </div>
        ) : null}

        {data.textProKlienta.uvod ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
            {data.textProKlienta.uvod}
          </div>
        ) : null}

        <PartySection title="Klient" party={data.klient} />
        <PartySection title="Dodavatel" party={data.dodavatel} />

        <DocSection title="Akce">
          <dl>
            <DocRow label="Název akce" value={akce.nazevAkce} />
            <DocRow label="Typ akce" value={akce.typAkce} />
            <DocRow label="Upřesnění typu" value={akce.typAkcePoznamka} />
            <DocRow label="Termín" value={terminyAkce} />
            <DocRow label="Čas programu" value={casAkce} />
            <DocRow label="Vícedenní" value={akce.viceDenni ? "Ano" : "Ne"} />
            <DocRow label="Poznámka" value={akce.poznamka} />
            <DocRow label="Přesný popis místa" value={akce.presnyPopisMista} />
            <DocRow label="Poznámka k logistice" value={akce.logistikaPoznamkaKlienta} />
          </dl>
        </DocSection>

        <DocSection title="Místo a technické podmínky">
          <dl>
            <DocRow label="Název místa" value={misto.nazev} />
            <DocRow label="Adresa" value={misto.adresa} />
            <DocRow label="GPS" value={formatObjednavkaGps(misto.gps.lat, misto.gps.lng)} />
            <DocRow label="Popis příjezdu" value={misto.prijezdPopis} />
            <DocRow label="Přístupová cesta" value={misto.pristupovaCesta} />
            <DocRow label="Povrch / terén" value={formatObjednavkaTriVolba(misto.povrchTeren)} />
            <DocRow label="Vjezd technikou" value={formatObjednavkaTriVolba(misto.vjezdTechnikou)} />
            <DocRow label="Místo pro stage" value={misto.mistoStage} />
            <DocRow label="Místo pro FOH" value={misto.mistoFoh} />
            <DocRow label="LED / režie" value={misto.mistoLedRezie} />
            <DocRow label="Elektro přípojka" value={misto.elektro.pripojka} />
            <DocRow label="Jištění" value={misto.elektro.jisteni} />
            <DocRow label="Typ zásuvky" value={misto.elektro.zasuvka} />
            <DocRow
              label="Vzdálenost elektřiny"
              value={
                misto.elektro.vzdalenostM != null ? `${misto.elektro.vzdalenostM} m` : null
              }
            />
            <DocRow label="Rozvaděče" value={misto.elektro.rozvadecePoznamka} />
            <DocRow label="Kabelové trasy" value={misto.elektro.kabeloveTrasy} />
            <DocRow
              label="Kabel přes silnici"
              value={formatObjednavkaTriVolba(misto.elektro.kabelPresSilnici)}
            />
            <DocRow
              label="Potřeba elektrocentrály"
              value={formatObjednavkaTriVolba(misto.elektro.potrebaElektrocentraly)}
            />
            <DocRow label="Vzdálenost rozvaděče" value={misto.elektro.vzdalenostRozvadece} />
            <DocRow label="Omezení hluku" value={misto.omezeniHluku} />
            <DocRow label="Časová omezení" value={misto.casovaOmezeni} />
            <DocRow label="Omezení noční práce" value={misto.nocniPraceOmezeni} />
            <DocRow label="Kotvení / zavěšení" value={misto.kotveniZaveseni} />
            <DocRow label="Požadavky pořadatele" value={misto.pozadavkyPoradatele} />
            <DocRow label="Další technické poznámky" value={misto.dalsiTechnickePoznamky} />
            <DocRow
              label="Výjezd technika"
              value={misto.pozadovanVyjezdTechnika ? "Požadován" : null}
            />
          </dl>
        </DocSection>

        <DocSection title="Organizace — stavba a bourání">
          <dl>
            <DocRow label="Příjezd techniky" value={org.prijezdTechniky} />
            <DocRow label="Stavba — termín" value={formatObjednavkaTermin(org.stavba)} />
            <DocRow label="Stavba — přístup od" value={org.stavba.pristupOd} />
            <DocRow label="Stavba — omezení vjezdu" value={org.stavba.omezeniVjezdu} />
            <DocRow label="Stavba — poznámka" value={org.stavba.poznamka} />
            <DocRow label="Bourání — termín" value={formatObjednavkaTermin(org.bourani)} />
            <DocRow label="Místo uvolněno do" value={org.bourani.mistoUvolnenoDo} />
            <DocRow label="Bourání — poznámka" value={org.bourani.poznamka} />
            <DocRow label="Součinnost klienta" value={org.soucinnostKlienta} />
          </dl>
        </DocSection>

        <DocSection title="Konfigurace sestavy">
          {data.sestavaSummary ? (
            <div className="mb-4 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-800">
              {data.sestavaSummary}
            </div>
          ) : data.technickePlneni.setupy.length > 0 ? (
            <ul className="mb-4 space-y-2">
              {data.technickePlneni.setupy.map((row) => (
                <li
                  key={row.setupId}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                >
                  <span className="font-medium">{row.nazev}</span>
                  <span className="text-slate-500">
                    {" "}
                    · {SETUP_OBLAST_LABELS[row.oblast]} · {row.mnozstvi}× setup
                  </span>
                  {row.poznamkaKlienta ? (
                    <p className="mt-1 text-slate-600">Poznámka klienta: {row.poznamkaKlienta}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-sm text-slate-500">Konfigurace sestavy není uvedena.</p>
          )}
        </DocSection>

        {data.fotky.length > 0 ? (
          <DocSection title="Fotografie místa">
            <div className="grid gap-4 sm:grid-cols-2">
              {data.fotky.map((fotka) => (
                <figure
                  key={fotka.fotkaId}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                >
                  {fotka.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={fotka.imageUrl}
                      alt={fotka.popis || POPTAVKA_FOTKA_TYP_LABELS[fotka.typ]}
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center px-4 text-center text-sm text-slate-500">
                      Fotografie není k dispozici pro náhled
                    </div>
                  )}
                  <figcaption className="px-3 py-2 text-xs text-slate-600">
                    {POPTAVKA_FOTKA_TYP_LABELS[fotka.typ]}
                    {fotka.popis ? ` — ${fotka.popis}` : null}
                  </figcaption>
                </figure>
              ))}
            </div>
          </DocSection>
        ) : null}

        <SmluvniSection block={data.smluvniPodminky} />

        {data.textProKlienta.poznamkaSefa || data.textProKlienta.zaver ? (
          <DocSection title="Závěrečné informace">
            <ProseBlock title="Poznámka" text={data.textProKlienta.poznamkaSefa} />
            <ProseBlock title="Závěr" text={data.textProKlienta.zaver} />
          </DocSection>
        ) : null}
      </div>
    </article>
  );
}
