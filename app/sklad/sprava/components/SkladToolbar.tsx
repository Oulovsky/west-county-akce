"use client";

import { SpravaManagementHeader } from "./SpravaManagementHeader";
import { SpravaSupportNav } from "./SpravaSupportNav";

type Props = {
  onAddClick: () => void;
  totalPoskozene?: number;
};

export function SkladToolbar({ onAddClick, totalPoskozene }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <SpravaManagementHeader onAddClick={onAddClick} />
      <SpravaSupportNav totalPoskozene={totalPoskozene} />
    </div>
  );
}
