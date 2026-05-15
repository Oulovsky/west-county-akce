"use client";

import type { SkladBlok } from "@/lib/sklad/types";
import { SpravaManagementHeader } from "./SpravaManagementHeader";
import { SpravaSupportNav } from "./SpravaSupportNav";

type Props = {
  onAddClick: () => void;
  bloky: SkladBlok[];
  totalPoskozene?: number;
};

export function SkladToolbar({ onAddClick, bloky, totalPoskozene }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <SpravaManagementHeader onAddClick={onAddClick} />
      <SpravaSupportNav bloky={bloky} totalPoskozene={totalPoskozene} />
    </div>
  );
}
