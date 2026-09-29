"use client";

import { TTS_LANGUAGES, languageByCode } from "@/lib/languages";
import { cn } from "@/lib/utils";

/** Big touch tiles for the 11 languages the kiosk can speak. */
export const LanguageGrid = ({
  current,
  onPick,
}: {
  current?: string | null;
  onPick: (code: string) => void;
}) => (
  <div className="grid h-full grid-cols-3 gap-3 sm:grid-cols-4 [@media(min-height:700px)]:gap-5">
    {TTS_LANGUAGES.map((code) => {
      const l = languageByCode(code);
      const selected = current === code;
      return (
        <button
          key={code}
          type="button"
          lang={code}
          onClick={() => onPick(code)}
          className={cn(
            "flex min-h-20 flex-col items-center justify-center rounded-2xl border-2 px-2 py-2 text-center transition-transform active:scale-[0.97]",
            selected
              ? "border-amber-300 bg-amber-300 text-black"
              : "border-white/25 bg-white/[0.06] text-white hover:bg-white/10"
          )}
        >
          <span className="text-[clamp(22px,5.4vh,44px)] font-bold leading-tight">
            {l.native}
          </span>
          {l.native !== l.name && (
            <span
              className={cn(
                "mt-0.5 text-[clamp(13px,2.4vh,18px)]",
                selected ? "text-black/70" : "text-white/60"
              )}
            >
              {l.name}
            </span>
          )}
        </button>
      );
    })}
  </div>
);
