"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

import { LoaderCircle, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { LanguageSelector } from "@/components/language-selector";
import {
  GrievanceTimeline,
  StatusChip,
  humanize,
  useTranslate,
} from "@/components/admin/grievance-ui";

function normaliseRef(raw: string): string {
  return raw.trim().toUpperCase();
}

const TrackResult = ({ refId }: { refId: string }) => {
  const tr = useTranslate();
  // Public query: works signed out, and re-renders live when an officer updates it.
  const result = useQuery(api.grievances.track, { refId });

  if (result === undefined) {
    return (
      <div className="rounded-xl border p-5 flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (result === null) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        {tr("track.notFound", "No grievance found with that reference ID. Check it and try again.")}
      </div>
    );
  }

  return (
    <article className="rounded-xl border p-5 flex flex-col gap-4 text-left">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{result.refId}</p>
          <h2 className="font-medium leading-snug mt-0.5">{result.subject}</h2>
        </div>
        <StatusChip status={result.status} />
      </div>
      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
        <span>{humanize(result.category)}</span>
        <span>{new Date(result.createdAt).toLocaleDateString()}</span>
      </div>
      <GrievanceTimeline updates={result.updates} />
    </article>
  );
};

const TrackView = () => {
  const tr = useTranslate();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlRef = normaliseRef(searchParams.get("ref") ?? "");

  const [input, setInput] = useState(urlRef);
  const [activeRef, setActiveRef] = useState(urlRef);

  // Follow back/forward navigation and QR links opened in the same tab.
  useEffect(() => {
    setInput(urlRef);
    setActiveRef(urlRef);
  }, [urlRef]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const ref = normaliseRef(input);
    setActiveRef(ref);
    router.replace(ref ? `${pathname}?ref=${encodeURIComponent(ref)}` : pathname);
  };

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10 flex flex-col gap-6">
      <div className="flex justify-end">
        <LanguageSelector />
      </div>
      <header className="text-center flex flex-col gap-1">
        <Link href="/" className="text-2xl font-semibold tracking-tight">
          Sahayak
        </Link>
        <h1 className="text-lg font-medium">{tr("track.title", "Track your grievance")}</h1>
        <p className="text-sm text-muted-foreground">
          {tr("track.subtitle", "Enter the reference ID from your receipt, e.g. GRV-1A2B3C4D.")}
        </p>
      </header>

      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={tr("track.placeholder", "GRV-XXXXXXXX")}
          aria-label={tr("track.placeholder", "GRV-XXXXXXXX")}
          className="font-mono uppercase h-11 text-base"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={32}
        />
        <Button type="submit" className="h-11 shrink-0" disabled={!input.trim()}>
          <Search className="w-4 h-4" />
          {tr("track.button", "Track")}
        </Button>
      </form>

      {activeRef && <TrackResult refId={activeRef} />}
    </main>
  );
};

export default function TrackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <LoaderCircle className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <TrackView />
    </Suspense>
  );
}
