"use client";

import { Suspense } from "react";
import { SpravaKusSelectionProvider } from "../sprava/components/SpravaKusSelectionContext";
import { SkladPolozkyCatalog } from "../sprava/components/SkladPolozkyCatalog";

export function SkladPolozkyPage() {
  return (
    <SpravaKusSelectionProvider>
      <Suspense
        fallback={
          <div className="py-10 text-center text-sm text-slate-400">
            Načítám sklad…
          </div>
        }
      >
        <SkladPolozkyCatalog />
      </Suspense>
    </SpravaKusSelectionProvider>
  );
}
