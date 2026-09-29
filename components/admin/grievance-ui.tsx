"use client";

import { useCallback } from "react";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Human label for an enum value like `in_review` → "In review". */
export function humanize(value: string): string {
  const s = value.replaceAll("_", " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * `t(key)` with an English fallback for when the dictionary has no entry yet
 * (the provider returns the key itself in that case).
 */
export function useTranslate() {
  const { t } = useI18n();
  return useCallback(
    (key: string, fallback: string) => {
      const s = t(key);
      return s === key ? fallback : s;
    },
    [t]
  );
}

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  in_review: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  resolved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

const DOT_STYLES: Record<string, string> = {
  submitted: "bg-amber-500",
  in_review: "bg-blue-500",
  resolved: "bg-emerald-500",
  rejected: "bg-rose-500",
};

export const StatusChip = ({ status, className }: { status: string; className?: string }) => {
  const tr = useTranslate();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center text-xs px-2 py-0.5 rounded-full font-medium",
        STATUS_STYLES[status] ?? "bg-muted text-muted-foreground",
        className
      )}
    >
      {tr(`status.${status}`, humanize(status))}
    </span>
  );
};

export type TimelineEntry = { status: string; note: string; at: number; byName: string };

/** Vertical timeline, oldest at the top so it reads like a story. */
export const GrievanceTimeline = ({ updates }: { updates: TimelineEntry[] }) => {
  if (updates.length === 0) return null;
  return (
    <ol className="relative flex flex-col gap-4 border-l border-border ml-1.5 pl-5">
      {updates.map((u, i) => (
        <li key={`${u.at}-${i}`} className="relative">
          <span
            aria-hidden
            className={cn(
              "absolute -left-[26px] top-1 h-3 w-3 rounded-full ring-4 ring-background",
              DOT_STYLES[u.status] ?? "bg-muted-foreground"
            )}
          />
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={u.status} />
            <time className="text-xs text-muted-foreground" dateTime={new Date(u.at).toISOString()}>
              {new Date(u.at).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </time>
          </div>
          <p className="mt-1 text-sm whitespace-pre-wrap">{u.note}</p>
          <p className="text-xs text-muted-foreground">{u.byName}</p>
        </li>
      ))}
    </ol>
  );
};
