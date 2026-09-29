"use client";

import { useState } from "react";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

import { toast } from "sonner";
import { ClipboardList, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect, PageHeader, StaffGate } from "@/components/admin/admin-shell";
import { GrievanceTimeline, StatusChip, humanize } from "@/components/admin/grievance-ui";
import { GRIEVANCE_CATEGORIES, GRIEVANCE_STATUSES } from "@/lib/constants";
import { LANGUAGES } from "@/lib/languages";

const Detail = ({ label, value }: { label: string; value?: string }) =>
  value ? (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{value}</dd>
    </div>
  ) : null;

const GrievanceDialog = ({
  grievance,
  onClose,
}: {
  grievance: Doc<"grievances"> | null;
  onClose: () => void;
}) => {
  const updateStatus = useMutation(api.grievances.updateStatus);
  const [status, setStatus] = useState<string>(
    !grievance || grievance.status === "submitted" ? "in_review" : grievance.status
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (!grievance) return null;
  const g = grievance;
  const updates = g.updates ?? [
    { status: "submitted", note: "Grievance received", at: g.createdAt, byName: "Sahayak" },
  ];
  const language = g.language ? LANGUAGES.find((l) => l.code === g.language)?.name : undefined;

  const submit = async () => {
    if (!note.trim()) {
      toast.error("Add a note for the citizen explaining the update");
      return;
    }
    setBusy(true);
    try {
      await updateStatus({ refId: g.refId, status, note });
      toast.success(`${g.refId} updated to ${humanize(status)}`);
      setNote("");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-left">
            <span className="font-mono text-sm">{g.refId}</span>
            <StatusChip status={g.status} />
          </DialogTitle>
          <DialogDescription className="text-left text-foreground font-medium">
            {g.subject}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-3">
          <Detail label="Category" value={humanize(g.category)} />
          <Detail label="Filed" value={new Date(g.createdAt).toLocaleString()} />
          <Detail label="Contact" value={g.contact ?? "Not given"} />
          <Detail label="Channel" value={g.channel ? humanize(g.channel) : "Web"} />
          <Detail label="Society" value={g.societyName} />
          <Detail label="District" value={g.district} />
          <Detail label="Language" value={language ?? g.language} />
        </dl>

        <div>
          <p className="text-xs text-muted-foreground mb-1">Description</p>
          <p className="text-sm whitespace-pre-wrap rounded-md bg-muted/50 p-3">{g.description}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2">Timeline (visible to the citizen)</p>
          <GrievanceTimeline updates={updates} />
        </div>

        <div className="flex flex-col gap-3 border-t pt-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status">New status</Label>
            <NativeSelect id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {GRIEVANCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Note for the citizen</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Forwarded to the PACS secretary; hearing on 12 Oct."
              rows={3}
              maxLength={1000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={busy || !note.trim()}>
            {busy && <LoaderCircle className="w-4 h-4 animate-spin" />}
            Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Console = () => {
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = useQuery(api.grievances.listAll, {
    status: status || undefined,
    category: category || undefined,
  });
  // Look the row up from the live list so the dialog reflects updates immediately.
  const selected = rows?.find((g) => g._id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:max-w-md">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-status">Status</Label>
          <NativeSelect id="f-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {GRIEVANCE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-category">Category</Label>
          <NativeSelect
            id="f-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {GRIEVANCE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {humanize(c)}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {rows === undefined ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No grievances match these filters.
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b bg-muted/40">
                <th className="py-2 px-3 font-medium">Ref</th>
                <th className="py-2 px-3 font-medium">Subject</th>
                <th className="py-2 px-3 font-medium hidden sm:table-cell">Category</th>
                <th className="py-2 px-3 font-medium hidden md:table-cell">Society / district</th>
                <th className="py-2 px-3 font-medium">Status</th>
                <th className="py-2 px-3 font-medium hidden sm:table-cell whitespace-nowrap">
                  Filed
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr
                  key={g._id}
                  tabIndex={0}
                  onClick={() => setSelectedId(g._id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId(g._id);
                    }
                  }}
                  className="border-b last:border-0 cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 outline-none"
                >
                  <td className="py-2 px-3 font-mono text-xs whitespace-nowrap">{g.refId}</td>
                  <td className="py-2 px-3 max-w-[16rem] truncate">{g.subject}</td>
                  <td className="py-2 px-3 hidden sm:table-cell whitespace-nowrap">
                    {humanize(g.category)}
                  </td>
                  <td className="py-2 px-3 hidden md:table-cell text-muted-foreground">
                    {[g.societyName, g.district].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="py-2 px-3">
                    <StatusChip status={g.status} />
                  </td>
                  <td className="py-2 px-3 hidden sm:table-cell whitespace-nowrap text-muted-foreground">
                    {new Date(g.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows && rows.length >= 200 && (
        <p className="text-xs text-muted-foreground">Showing the newest 200. Narrow the filters.</p>
      )}

      {selected && (
        <GrievanceDialog
          key={selected._id}
          grievance={selected}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
};

export default function AdminGrievancesPage() {
  return (
    <>
      <PageHeader />
      <div className="mx-auto max-w-5xl w-full px-4 pb-8 pt-2 flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <ClipboardList className="w-5 h-5" /> Grievance console
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review complaints, update their status and leave a note. Citizens see each update live
            on their tracking page.
          </p>
        </div>
        <StaffGate>{() => <Console />}</StaffGate>
      </div>
    </>
  );
}
