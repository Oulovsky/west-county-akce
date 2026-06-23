"use client";

import { Suspense } from "react";
import { SpravaKusSelectionProvider } from "@/app/sklad/sprava/components/SpravaKusSelectionContext";
import { SkladPolozkyCatalog } from "@/app/sklad/sprava/components/SkladPolozkyCatalog";

type Props = {
  setupId: string;
};

export function SetupDetailCatalog({ setupId }: Props) {
  return (
    <SpravaKusSelectionProvider>
      <Suspense
        fallback={
          <div className="py-10 text-center text-sm text-slate-400">
            Načítám sklad…
          </div>
        }
      >
        <SkladPolozkyCatalog catalogMode="setup" setupId={setupId} />
      </Suspense>
    </SpravaKusSelectionProvider>
  );
}
