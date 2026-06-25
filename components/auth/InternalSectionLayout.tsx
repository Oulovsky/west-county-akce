import type { ReactNode } from "react";
import { requireInternalEmployeePage } from "@/lib/auth/internal-access-server";

export default async function InternalSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireInternalEmployeePage();
  return children;
}
