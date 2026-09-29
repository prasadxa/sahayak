import type { Metadata } from "next";

import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "Track a grievance — Sahayak",
  description: "Check the status of a cooperative grievance using its GRV reference ID.",
};

// Public page outside the (chat) layout: no sidebar, so it needs its own
// TooltipProvider for the language selector. Convex comes from the root layout.
export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-dvh bg-background">{children}</div>
    </TooltipProvider>
  );
}
