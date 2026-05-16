import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function LegacyNakladkaRedirectPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/zakazky/${id}/scan`);
}