"use client";

import PeoplePool from "../PeoplePool";

export default function PeopleClient({ zakazkaId }: { zakazkaId: string }) {
  return <PeoplePool zakazkaId={zakazkaId} />;
}