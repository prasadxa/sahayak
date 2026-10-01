"use client";

import Link from "next/link";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

import { LayoutDashboard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, StaffGate } from "@/components/admin/admin-shell";
import { BarList } from "@/components/admin/bar-list";
import { humanize } from "@/components/admin/grievance-ui";
import { KB_CATEGORY_LABELS, type KbCategory } from "@/lib/constants";
import { GRIEVANCE_SLA_DAYS } from "@/lib/grievance-sla";
import { LANGUAGES } from "@/lib/languages";
import { useHourlyNow } from "@/components/admin/use-hourly-now";

function languageName(code: string): string {
  const lang = LANGUAGES.find((l) => l.code === code);
  return lang ? `${lang.name} (${lang.native})` : humanize(code);
}

function kbCategoryName(key: string): string {
  return KB_CATEGORY_LABELS[key as KbCategory] ?? humanize(key);
}

const Tile = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
  <div className="rounded-xl border p-4">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-2xl font-semibold tabular-nums mt-1">{value}</p>
    {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
  </div>
);

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-xl border p-4 flex flex-col gap-3">
    <h2 className="text-sm font-medium">{title}</h2>
    {children}
  </section>
);

const Dashboard = ({ isAdmin }: { isAdmin: boolean }) => {
  const now = useHourlyNow();
  const o = useQuery(api.analytics.overview, { now });

  if (o === undefined) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-busy="true">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  const g = o.grievances;
  const open = (g.byStatus.submitted ?? 0) + (g.byStatus.in_review ?? 0);
  const unansweredPct =
    o.queries.total === 0 ? 0 : Math.round(((o.queries.byMode.none ?? 0) / o.queries.total) * 100);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Total grievances" value={g.total} />
        <Tile label="Open" value={open} hint="Submitted + in review" />
        <Tile
          label={`Overdue (>${GRIEVANCE_SLA_DAYS} days)`}
          value={g.overdue}
          hint={`Open past the ${GRIEVANCE_SLA_DAYS}-day target`}
        />
        <Tile label="Resolved" value={g.byStatus.resolved ?? 0} />
        <Tile
          label="Avg. resolution time"
          value={g.avgResolutionDays === null ? "—" : `${g.avgResolutionDays} days`}
          hint="Filing to resolved"
        />
        <Tile
          label="Knowledge base entries"
          value={o.kb.entries}
          hint={
            o.kb.pendingEmbeddings > 0
              ? `${o.kb.chunks} chunks, ${o.kb.pendingEmbeddings} awaiting embedding`
              : `${o.kb.chunks} chunks`
          }
        />
        <Tile label="Questions (30 days)" value={o.queries.truncated ? `${o.queries.total}+` : o.queries.total} />
        <Tile label="Unanswered" value={`${unansweredPct}%`} hint="No knowledge-base match" />
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Panel title="Questions by language (30 days)">
          <BarList data={o.queries.byLanguage} label={languageName} />
        </Panel>
        <Panel title="Questions by topic (30 days)">
          <BarList data={o.queries.byCategory} label={kbCategoryName} />
        </Panel>
        <Panel title="Grievances by status">
          <BarList data={g.byStatus} label={humanize} empty="No grievances yet" />
        </Panel>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Panel title="Grievances by category">
          <BarList data={g.byCategory} label={humanize} empty="No grievances yet" />
        </Panel>
        <Panel title="Grievances by district">
          <BarList
            data={Object.fromEntries(g.byDistrict.map((d) => [d.district, d.count]))}
            empty="No grievances yet"
          />
        </Panel>
      </div>

      <Panel title="Unanswered questions">
        <p className="text-xs text-muted-foreground -mt-2">
          Recent questions the knowledge base could not answer. These are the knowledge gaps NCCT
          should fill: add content for them at{" "}
          <Link href="/knowledge" className="underline">
            Knowledge
          </Link>
          .
        </p>
        {o.unanswered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing unanswered. Good coverage.</p>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2 pr-3 font-medium">Question</th>
                  <th className="py-2 pr-3 font-medium text-right">Asked</th>
                  <th className="py-2 pr-3 font-medium">Language</th>
                  <th className="py-2 font-medium whitespace-nowrap">Last asked</th>
                </tr>
              </thead>
              <tbody>
                {o.unanswered.map((u, i) => (
                  <tr key={`${u.createdAt}-${i}`} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-3 min-w-[12rem]">{u.query}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{u.count}×</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {u.language ? languageName(u.language) : "—"}
                    </td>
                    <td className="py-2 whitespace-nowrap text-muted-foreground">
                      {new Date(u.createdAt).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/admin/grievances">Open grievance console</Link>
        </Button>
        {isAdmin && (
          <Button asChild variant="outline">
            <Link href="/admin/users">Manage roles</Link>
          </Button>
        )}
        {isAdmin && (
          <Button asChild variant="outline">
            <Link href="/admin/models">Models &amp; voice</Link>
          </Button>
        )}
      </div>
    </div>
  );
};

export default function AdminPage() {
  return (
    <>
      <PageHeader />
      <div className="mx-auto max-w-5xl w-full px-4 pb-8 pt-2 flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5" /> Officer dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Grievances, knowledge-base coverage and what citizens are asking, in every language.
          </p>
        </div>
        <StaffGate>{(me) => <Dashboard isAdmin={me.role === "admin"} />}</StaffGate>
      </div>
    </>
  );
}
