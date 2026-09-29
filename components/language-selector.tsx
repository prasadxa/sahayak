"use client";

import { memo } from "react";
import { Check, Languages, Volume2 } from "lucide-react";

import { isTtsLanguage, LANGUAGES } from "@/lib/languages";
import { translate, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const PureLanguageSelector = ({ className }: { className?: string }) => {
  const { lang, setLang, t } = useI18n();
  // Keep an English hint so someone who picked an unfamiliar language can switch back.
  const tooltip =
    lang === "en"
      ? t("chooseLanguage")
      : `${t("chooseLanguage")} / ${translate("en", "chooseLanguage")}`;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={cn("md:px-2 md:h-[34px] gap-1.5", className)}
            >
              <Languages className="w-4 h-4" />
              <span className="text-sm">
                {LANGUAGES.find((l) => l.code === lang)?.native ?? "English"}
              </span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto min-w-44">
        <DropdownMenuLabel className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
          <Volume2 className="w-3.5 h-3.5" aria-hidden />
          {t("ttsCapable")}
        </DropdownMenuLabel>
        {LANGUAGES.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onSelect={() => setLang(language.code)}
            className="flex items-center justify-between gap-3"
          >
            <span>
              {language.native}
              <span className="text-muted-foreground text-xs ml-2">{language.name}</span>
            </span>
            <span className="flex items-center gap-1.5">
              {isTtsLanguage(language.code) && (
                <Volume2
                  className="w-3.5 h-3.5 text-muted-foreground"
                  aria-label={t("ttsCapable")}
                  role="img"
                />
              )}
              {language.code === lang && <Check className="w-4 h-4" />}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const LanguageSelector = memo(PureLanguageSelector);
