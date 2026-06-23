"use client";

import { SpravaManagementHeader } from "./SpravaManagementHeader";
import { SpravaSupportNav } from "./SpravaSupportNav";

type Props = {
  totalPoskozene?: number;
  readOnly?: boolean;
};

export function SkladToolbar({ totalPoskozene, readOnly = false }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <SpravaManagementHeader readOnly={readOnly} />
      <SpravaSupportNav totalPoskozene={totalPoskozene} readOnly={readOnly} />
    </div>
  );
}
