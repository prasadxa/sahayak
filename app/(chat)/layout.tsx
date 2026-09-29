import Script from "next/script";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const [user, cookieStore] = await Promise.all([getCurrentUser(), cookies()]);
  const isCollapsed = cookieStore.get("sidebar:state")?.value !== "true";

  // A kiosk account serves walk-in citizens; keep it on the kiosk screen so the
  // chat UI (history, grievances) is never shown at the kiosk.
  if (user?.role === "kiosk") redirect("/kiosk");

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js"
        strategy="beforeInteractive"
      />
      <SidebarProvider defaultOpen={!isCollapsed}>
        <AppSidebar user={user} />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </>
  );
}
