"use client";

import { LoaderCircle, Mic } from "lucide-react";

import type { KioskPhase } from "@/lib/kiosk/session";
import { kioskT } from "@/lib/kiosk/strings";
import { cn } from "@/lib/utils";

export const Waveform = ({ className }: { className?: string }) => (
  <span className={cn("kiosk-wave inline-flex h-7 items-center gap-1", className)} aria-hidden>
    {[0, 1, 2, 3, 4].map((i) => (
      <span
        key={i}
        className="block h-full w-1.5 rounded-full bg-current"
        style={{ animationDelay: `${i * 0.12}s` }}
      />
    ))}
  </span>
);

/** Live status line: pulsing red (listening), spinner (thinking), waveform (speaking). */
export const PhaseIndicator = ({
  phase,
  lang,
}: {
  phase: KioskPhase;
  lang: string | null;
}) => {
  if (phase === "listening") {
    return (
      <div className="flex items-center gap-3 text-red-400" role="status" aria-live="polite">
        <span className="relative flex size-5">
          <span className="kiosk-ping absolute inset-0 rounded-full bg-red-500" />
          <span className="relative size-5 rounded-full bg-red-500" />
        </span>
        <span className="font-bold">{kioskT(lang, "listening")}</span>
      </div>
    );
  }
  if (phase === "thinking") {
    return (
      <div className="flex items-center gap-3 text-amber-300" role="status" aria-live="polite">
        <LoaderCircle className="size-6 animate-spin" aria-hidden />
        <span className="font-bold">{kioskT(lang, "thinking")}</span>
      </div>
    );
  }
  if (phase === "speaking") {
    return (
      <div className="flex items-center gap-3 text-sky-300" role="status" aria-live="polite">
        <Waveform />
        <span className="font-bold">{kioskT(lang, "speaking")}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 text-white/70" role="status">
      <Mic className="size-6" aria-hidden />
      <span>{kioskT(lang, "idleHint")}</span>
    </div>
  );
};
