import "./globals.css";
import AuthGate from "@/app/AuthGate";
import SidebarNav from "./SidebarNav";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <div className="border-b border-slate-800 bg-slate-900/95">
          <div className="mx-auto flex w-full max-w-[1920px] items-center justify-between px-4 py-4 sm:px-6 xl:px-8 2xl:px-10">
            <div className="text-sm font-semibold tracking-wide text-white">
              WEST COUNTY
            </div>

            <SidebarNav />
          </div>
        </div>

        <main className="mx-auto w-full max-w-[1920px] px-4 py-5 sm:px-6 xl:px-8 2xl:px-10">
          <AuthGate>{children}</AuthGate>
        </main>
      </body>
    </html>
  );
}