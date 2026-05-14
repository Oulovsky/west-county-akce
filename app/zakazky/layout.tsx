import type { ReactNode } from "react";
import AuthGate from "@/app/AuthGate";

export default async function ZakazkyLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AuthGate>{children}</AuthGate>;
}