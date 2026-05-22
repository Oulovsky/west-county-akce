import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

/** Legacy detail sestavy — přesměrování na aktivní setupy skladu. */
export default async function TemplateDetailPage({ params }: PageProps) {
  void (await params);
  redirect("/sklad/setupy");
}
