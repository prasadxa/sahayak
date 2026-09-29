"use client";

import Link from "next/link";
import {
  BookOpen,
  Calculator,
  CheckCircle2,
  FileWarning,
  Globe,
  LoaderCircle,
  Wheat,
} from "lucide-react";

import { useI18n } from "@/lib/i18n";

const CALL_LABEL_KEYS: Record<string, string> = {
  searchKnowledgeBase: "tool.searchingKb",
  fileGrievance: "tool.filingGrievance",
  webSearch: "tool.searchingWeb",
  calculatePmfbyPremium: "tool.calculating",
};

/** Tool names that get a {@link ToolCallChip} while running. */
export const CHIP_TOOLS = Object.keys(CALL_LABEL_KEYS);

/** Small inline chip shown while a tool call is in flight. */
export function ToolCallChip({ toolName, label }: { toolName: string; label?: string }) {
  const { t } = useI18n();
  const key = CALL_LABEL_KEYS[toolName];
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
      <LoaderCircle className="w-4 h-4 animate-spin" />
      {label ?? (key ? t(key) : `Running ${toolName}…`)}
    </div>
  );
}

/** Card shown when the assistant successfully files a grievance. */
export function GrievanceResult({ result }: { result: unknown }) {
  const { t } = useI18n();
  if (typeof result !== "object" || result === null || !("refId" in result)) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
        <FileWarning className="w-4 h-4" />
        {typeof result === "string" ? result : t("tool.grievanceFiled")}
      </div>
    );
  }
  const r = result as { refId: string; message?: string };
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-sm">
      <div className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="w-4 h-4" />
        {t("tool.grievanceFiled")}
      </div>
      <div className="mt-1 text-muted-foreground">
        {t("tool.referenceId")}:{" "}
        <span className="font-mono font-medium text-foreground">{r.refId}</span>
      </div>
      <Link
        href={`/track?ref=${encodeURIComponent(r.refId)}`}
        className="mt-1 inline-block text-emerald-700 dark:text-emerald-400 underline underline-offset-2"
      >
        {t("nav.track")}
      </Link>
    </div>
  );
}

interface PmfbyPremiumResult {
  season: string;
  sumInsured: number;
  farmerRatePct: number;
  farmerPremium: number;
}

function isPmfbyResult(result: unknown): result is PmfbyPremiumResult {
  return (
    typeof result === "object" &&
    result !== null &&
    "farmerPremium" in result &&
    "sumInsured" in result
  );
}

const rupees = (n: number) =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Card for a `calculatePmfbyPremium` result (farmer's share of the premium). */
export function PmfbyResult({ result }: { result: unknown }) {
  const { t } = useI18n();
  if (!isPmfbyResult(result)) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
        <Calculator className="w-4 h-4" />
        {typeof result === "string" ? result : t("pmfby.title")}
      </div>
    );
  }
  const rows: Array<[string, string]> = [
    [t("pmfby.season"), t(`pmfby.season.${result.season}`)],
    [t("pmfby.sumInsured"), rupees(result.sumInsured)],
    [t("pmfby.farmerRate"), `${result.farmerRatePct}%`],
  ];
  return (
    <div
      data-testid="pmfby-result"
      className="rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm max-w-md"
    >
      <div className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-400">
        <Wheat className="w-4 h-4" />
        {t("pmfby.title")}
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right tabular-nums">{value}</dd>
          </div>
        ))}
        <dt className="font-medium">{t("pmfby.farmerPremium")}</dt>
        <dd className="text-right text-lg font-semibold tabular-nums">
          {rupees(result.farmerPremium)}
        </dd>
      </dl>
      {/* The tool's English `note` is for the model; show the localised one. */}
      <p className="mt-2 text-xs text-muted-foreground">{t("pmfby.note")}</p>
    </div>
  );
}

/** Compact chip for a finished knowledge-base / web-search lookup. */
export function LookupResult({ toolName }: { toolName: string }) {
  const { t } = useI18n();
  const isKb = toolName === "searchKnowledgeBase";
  const Icon = isKb ? BookOpen : Globe;
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
      <Icon className="w-3.5 h-3.5" />
      {isKb ? t("tool.searchedKb") : t("tool.searchedWeb")}
    </div>
  );
}
