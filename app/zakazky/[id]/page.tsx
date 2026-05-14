import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PeoplePool from "./PeoplePool";
import { combineDateAndTime, recomputeZakazkaTechnikaFromTemplates } from "./helpers";
import { ZakazkaBasicLookCard } from "./components/ZakazkaBasicLookCard";
import { ZakazkaScheduleCard } from "./components/ZakazkaScheduleCard";
import { ZakazkaTemplatesCard } from "./components/ZakazkaTemplatesCard";
import { ZakazkaHeaderCard } from "./components/ZakazkaHeaderCard";

import { ZakazkaSubnav } from "@/components/zakazky/zakazka-subnav";

type PageProps = {
  params: Promise<{ id: string }>;
};

type TemplateRow = {
  id: string;
  name: string;
};

type ZakazkaTemplateRow = {
  id: string;
  template_id: string;
  quantity: number | string;
  templates:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
};

type TechnikaSummaryRow = {
  skladova_polozka_id: string;
  nazev: string;
  mnozstvi: number | string;
};

type RealizaceRow = {
  realizace_id: string;
  zakazka_id: string;
  nazev: string | null;
  poradi: number | string | null;
  stage_typ: string | null;
  stage_sirka: number | string | null;
  stage_hloubka: number | string | null;
  sound_typ: string | null;
  lights_typ: string | null;
  led_typ: string | null;
  led_sirka: number | string | null;
  led_vyska: number | string | null;
  led_rohy: boolean | null;
  kamery: number | string | null;
  dron: boolean | null;
};

export default async function ZakazkaDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  async function addTemplate(formData: FormData) {
    "use server";
    const supabase = await createClient();

    const templateId = String(formData.get("templateId") ?? "").trim();
    const quantity = Math.max(1, Number(formData.get("quantity") ?? 1) || 1);

    if (!templateId) {
      throw new Error("Nebyla vybrĂˇna sestava.");
    }

    const { error } = await supabase.from("zakazka_templates").insert({
      zakazka_id: id,
      template_id: templateId,
      quantity,
    });

    if (error) {
      throw new Error(error.message);
    }

    await recomputeZakazkaTechnikaFromTemplates(supabase, id);
    revalidatePath(`/zakazky/${id}`);
  }

  async function removeTemplate(formData: FormData) {
    "use server";
    const supabase = await createClient();

    const rowId = String(formData.get("rowId") ?? "").trim();

    if (!rowId) {
      throw new Error("ChybĂ­ ID vazby sestavy.");
    }

    const { error } = await supabase
      .from("zakazka_templates")
      .delete()
      .eq("id", rowId)
      .eq("zakazka_id", id);

    if (error) {
      throw new Error(error.message);
    }

    await recomputeZakazkaTechnikaFromTemplates(supabase, id);
    revalidatePath(`/zakazky/${id}`);
  }

  async function changeTemplateQuantity(formData: FormData) {
    "use server";
    const supabase = await createClient();

    const rowId = String(formData.get("rowId") ?? "").trim();
    const direction = String(formData.get("direction") ?? "").trim();

    if (!rowId) {
      throw new Error("ChybĂ­ ID vazby sestavy.");
    }

    if (direction !== "plus" && direction !== "minus") {
      throw new Error("NeplatnĂ˝ smÄ›r zmÄ›ny mnoĹľstvĂ­.");
    }

    const { data: row, error: rowError } = await supabase
      .from("zakazka_templates")
      .select("quantity")
      .eq("id", rowId)
      .single();

    if (rowError) {
      throw new Error(rowError.message);
    }

    const qty = Number(row?.quantity ?? 1);

    if (direction === "minus" && qty <= 1) {
      const { error: deleteError } = await supabase
        .from("zakazka_templates")
        .delete()
        .eq("id", rowId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }
    } else {
      const { error: updateError } = await supabase
        .from("zakazka_templates")
        .update({ quantity: direction === "plus" ? qty + 1 : qty - 1 })
        .eq("id", rowId);

      if (updateError) {
        throw new Error(updateError.message);
      }
    }

    await recomputeZakazkaTechnikaFromTemplates(supabase, id);
    revalidatePath(`/zakazky/${id}`);
  }

  async function updateZakazkaSchedule(formData: FormData) {
    "use server";
    const supabase = await createClient();

    const akceOd = combineDateAndTime(
      String(formData.get("akce_od_datum") ?? ""),
      String(formData.get("akce_od_cas") ?? "")
    );

    const akceDo = combineDateAndTime(
      String(formData.get("akce_do_datum") ?? ""),
      String(formData.get("akce_do_cas") ?? "")
    );

    if (!akceOd || !akceDo) {
      throw new Error("VyplĹ zaÄŤĂˇtek a konec akce.");
    }

    const { error } = await supabase
      .from("zakazky")
      .update({
        akce_od: akceOd,
        akce_do: akceDo,
      })
      .eq("zakazka_id", id);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/zakazky/${id}`);
  }

  async function cancelZakazka() {
    "use server";
    const supabase = await createClient();

    const { error } = await supabase.rpc("zrusit_zakazku", { p_zakazka_id: id });

    if (error) {
      throw new Error(error.message);
    }

    redirect("/zakazky");
  }

  const { data, error } = await supabase
    .from("zakazky")
    .select("*")
    .eq("zakazka_id", id)
    .single();

  if (error) {
    return <div>Chyba: {error.message}</div>;
  }

  if (!data) {
    return <div>ZakĂˇzka nenalezena</div>;
  }

  const { data: realizace, error: realizaceError } = await supabase
    .from("zakazka_realizace")
    .select("*")
    .eq("zakazka_id", id);

  if (realizaceError) {
    return <div>Chyba: {realizaceError.message}</div>;
  }

  const { data: templates, error: templatesError } = await supabase
    .from("templates")
    .select("id, name");

  if (templatesError) {
    return <div>Chyba: {templatesError.message}</div>;
  }

  const { data: zakazkaTemplates, error: zakazkaTemplatesError } = await supabase
    .from("zakazka_templates")
    .select("id, template_id, quantity, templates(id, name)")
    .eq("zakazka_id", id);

  if (zakazkaTemplatesError) {
    return <div>Chyba: {zakazkaTemplatesError.message}</div>;
  }

  const { data: technikaSummaryRaw, error: technikaSummaryError } = await supabase
    .from("technika_na_zakazce")
    .select("skladova_polozka_id, mnozstvi, skladove_polozky(nazev)")
    .eq("zakazka_id", id);

  if (technikaSummaryError) {
    return <div>Chyba: {technikaSummaryError.message}</div>;
  }

  const technikaSummary = ((technikaSummaryRaw ?? []) as TechnikaSummaryRawRow[]).map((row) => ({
    skladova_polozka_id: row.skladova_polozka_id,
    mnozstvi: row.mnozstvi,
    nazev: getSkladovaPolozkaNazev(row.skladove_polozky),
  })) as TechnikaSummaryRow[];

  return (
    <div className="mx-auto w-full max-w-6xl px-4">
      <ZakazkaHeaderCard zakazkaId={id} data={data} cancelAction={cancelZakazka} />

      <ZakazkaScheduleCard data={data} action={updateZakazkaSchedule} />

      <ZakazkaBasicLookCard realizace={(realizace ?? []) as RealizaceRow[]} data={data} />

      <ZakazkaTemplatesCard
        templates={(templates ?? []) as TemplateRow[]}
        zakazkaTemplates={(zakazkaTemplates ?? []) as ZakazkaTemplateRow[]}
        technikaSummary={technikaSummary}
        addTemplateAction={addTemplate}
        changeTemplateQuantityAction={changeTemplateQuantity}
        removeTemplateAction={removeTemplate}
      />

      <div className="mt-6">
        <ZakazkaSubnav zakazkaId={id} active="detail" showBackLink />
      </div>

      <div className="mt-10">
        <PeoplePool zakazkaId={id} />
      </div>
    </div>
  );
}


