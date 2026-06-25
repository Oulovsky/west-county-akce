import "./globals.css";
import "leaflet/dist/leaflet.css";
import AppShell from "./AppShell";
import { InternalAccessGuard } from "./InternalAccessGuard";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <InternalAccessGuard>
          <AppShell>{children}</AppShell>
        </InternalAccessGuard>
      </body>
    </html>
  );
}
