"use client";

import { SpravaManagementHeader } from "./SpravaManagementHeader";
import { SpravaSupportNav } from "./SpravaSupportNav";

type Props = {
  onAddClick: () => void;
  totalPoskozene?: number;
  readOnly?: boolean;
};

export function SkladToolbar({ onAddClick, totalPoskozene, readOnly = false }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <SpravaManagementHeader onAddClick={onAddClick} readOnly={readOnly} />
      <SpravaSupportNav totalPoskozene={totalPoskozene} readOnly={readOnly} />
    </div>
  );
}
