import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SetupDetailPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/sklad/setupy/${id}`);
}
