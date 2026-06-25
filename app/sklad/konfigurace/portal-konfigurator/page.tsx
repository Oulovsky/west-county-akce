import Link from "next/link";
import { redirect } from "next/navigation";
import PortalKonfiguratorKatalogEditor from "@/components/sklad/PortalKonfiguratorKatalogEditor";
import { requireAppAdminOrSef } from "@/lib/auth/admin-access-server";
import {
  loadPortalKonfiguratorAdminOptions,
  loadPortalKonfiguratorKatalogAdmin,
} from "@/lib/sklad/portal-konfigurator-admin-server";

export default async function PortalKonfiguratorAdminPage() {
  try {
    await requireAppAdminOrSef();
  } catch {
    redirect("/sklad/konfigurace?error=forbidden");
  }

  const [initialRow, options] = await Promise.all([
    loadPortalKonfiguratorKatalogAdmin(),
    loadPortalKonfiguratorAdminOptions(),
  ]);

  return (
    <div className="w-full py-7">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Portálový konfigurátor — katalog</h1>
          <p className="text-sm text-slate-400">
            Správa katalogu pro klientský konfigurátor stage, pódia, LED, zvuku a světel. Změny se
            projeví v klientském portálu bez deploye.
          </p>
        </div>
        <Link
          href="/sklad/konfigurace"
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
        >
          ← Konfigurace skladu
        </Link>
      </div>

      <PortalKonfiguratorKatalogEditor initialRow={initialRow} options={options} />
    </div>
  );
}
