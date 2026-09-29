"use client";

import Link from "next/link";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

import { FileWarning, MapPin, Monitor } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/admin/admin-shell";
import {
  GrievanceTimeline,
  StatusChip,
  humanize,
  useTranslate,
} from "@/components/admin/grievance-ui";

const GrievanceCard = ({ g }: { g: Doc<"grievances"> }) => {
  const updates = g.updates ?? [
    { status: "submitted", note: "Grievance received", at: g.createdAt, byName: "Sahayak" },
  ];
  return (
    <article className="rounded-xl border p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-medium leading-snug">{g.subject}</h2>
        <StatusChip status={g.status} />
      </div>
      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
        <Link href={`/track?ref=${g.refId}`} className="font-mono hover:underline">
          {g.refId}
        </Link>
        <span>{humanize(g.category)}</span>
        <span>{new Date(g.createdAt).toLocaleDateString()}</span>
        {(g.district || g.societyName) && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {[g.societyName, g.district].filter(Boolean).join(", ")}
          </span>
        )}
        {g.channel === "kiosk" && (
          <span className="inline-flex items-center gap-1">
            <Monitor className="w-3 h-3" /> Kiosk
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{g.description}</p>
      <div className="pt-1">
        <GrievanceTimeline updates={updates} />
      </div>
    </article>
  );
};

const LoadingList = () => (
  <div className="flex flex-col gap-3" aria-busy="true">
    {[0, 1, 2].map((i) => (
      <div key={i} className="rounded-xl border p-4 flex flex-col gap-3">
        <div className="flex justify-between gap-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-12 w-full" />
      </div>
    ))}
  </div>
);

export default function GrievancesPage() {
  const tr = useTranslate();
  const user = useQuery(api.users.getUser);
  const grievances = useQuery(api.grievances.listMine);

  return (
    <>
      <PageHeader />
      <div className="mx-auto max-w-3xl w-full px-4 pb-8 pt-2 flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <FileWarning className="w-5 h-5" /> {tr("grievances.title", "My grievances")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complaints filed through the assistant. Keep the reference ID to follow up with your
            District Cooperative Registrar, or track it at{" "}
            <Link href="/track" className="underline">
              /track
            </Link>
            .
          </p>
        </div>

        {user === null && (
          <p className="text-sm text-muted-foreground">Sign in to view your grievances.</p>
        )}

        {user !== null && grievances === undefined && <LoadingList />}

        {user && grievances?.length === 0 && (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {tr("grievances.empty", "No grievances yet. Ask the assistant to file one.")}
            </p>
            <Button asChild variant="outline" className="mt-3">
              <Link href="/">Open chat</Link>
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {grievances?.map((g) => <GrievanceCard key={g._id} g={g} />)}
        </div>
      </div>
    </>
  );
}
