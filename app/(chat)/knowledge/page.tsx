"use client";

import { useRef, useState } from "react";

import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

import { toast } from "sonner";
import {
  BookOpen,
  FileText,
  Globe,
  LoaderCircle,
  Lock,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  isStaffRole,
  KB_CATEGORIES,
  KB_CATEGORY_LABELS,
  type KbCategory,
} from "@/lib/constants";

function categoryLabel(category: string): string {
  return (KB_CATEGORIES as readonly string[]).includes(category)
    ? KB_CATEGORY_LABELS[category as KbCategory]
    : category;
}

export default function KnowledgePage() {
  const me = useQuery(api.roles.me);
  const entries = useQuery(api.kb.listEntries, {});
  const ingestText = useAction(api.kb.ingestText);
  const ingestUrl = useAction(api.kb.ingestUrl);
  const ingestFile = useAction(api.kb.ingestFile);
  const deleteEntry = useMutation(api.kb.deleteEntry);
  const backfillEmbeddings = useAction(api.kb.backfillEmbeddings);
  const generateAttachmentUrl = useMutation(api.files.generateAttachmentUrl);

  const [mode, setMode] = useState<"text" | "url" | "file">("text");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isStaff = me ? isStaffRole(me.role) : false;
  const pendingTotal =
    entries?.reduce((sum, e) => sum + e.pendingEmbeddings, 0) ?? 0;

  const indexed = (r: { chunks: number; embedded: boolean }) => {
    if (r.embedded) {
      toast.success(`Indexed ${r.chunks} chunks`);
    } else {
      toast.success(
        `Saved ${r.chunks} chunks. Embeddings are unavailable right now, so they are searchable by keyword until you run a backfill.`,
      );
    }
  };

  const runBackfill = async () => {
    setBackfilling(true);
    try {
      const r = await backfillEmbeddings({});
      toast.success(
        r.remaining > 0
          ? `Embedded ${r.embedded} chunks, ${r.remaining} still pending`
          : `Embedded ${r.embedded} chunks`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backfill failed");
    } finally {
      setBackfilling(false);
    }
  };

  const reset = () => {
    setTitle("");
    setContent("");
    setUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = async () => {
    if (!isStaff) {
      toast.error("Only officers can add content");
      return;
    }
    setBusy(true);
    try {
      if (mode === "text") {
        if (!title.trim() || !content.trim()) {
          toast.error("Title and content are required");
          return;
        }
        indexed(await ingestText({ title, category, content }));
      } else if (mode === "url") {
        if (!url.trim()) {
          toast.error("URL is required");
          return;
        }
        indexed(await ingestUrl({ url, category, title: title || undefined }));
      } else {
        const file = fileInputRef.current?.files?.[0];
        if (!file || !title.trim()) {
          toast.error("Pick a file and give it a title");
          return;
        }
        const postUrl = await generateAttachmentUrl({
          contentType: file.type || "application/octet-stream",
        });
        const up = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        const { storageId } = await up.json();
        indexed(
          await ingestFile({
            storageId,
            title,
            category,
            filename: file.name,
          }),
        );
      }
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ingestion failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl w-full px-4 py-8 flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <BookOpen className="w-5 h-5" /> Knowledge Base
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Curated reference material the assistant draws on — cooperative laws,
          scheme guidelines, PMFBY rules, financial literacy notes.
          {isStaff && " Add text, fetch a URL, or upload a PDF/text file."}
        </p>
      </div>

      {me !== undefined && !isStaff && (
        <div className="rounded-xl border p-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="w-4 h-4 shrink-0" />
          Only officers can add content. You can browse the indexed sources
          below.
        </div>
      )}

      {isStaff && pendingTotal > 0 && (
        <div className="rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {pendingTotal} {pendingTotal === 1 ? "chunk is" : "chunks are"}{" "}
            awaiting embedding. They are searchable by keyword until embedded.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={runBackfill}
            disabled={backfilling}
          >
            {backfilling ? (
              <LoaderCircle className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1.5" />
            )}
            Backfill embeddings
          </Button>
        </div>
      )}

      {isStaff && (
        <div className="rounded-xl border p-4 flex flex-col gap-4">
          <div className="flex gap-2">
            {(
              [
                ["text", FileText, "Paste text"],
                ["url", Globe, "Fetch URL"],
                ["file", Upload, "Upload file"],
              ] as const
            ).map(([m, Icon, label]) => (
              <Button
                key={m}
                variant={mode === m ? "default" : "outline"}
                size="sm"
                onClick={() => setMode(m)}
              >
                <Icon className="w-4 h-4 mr-1.5" />
                {label}
              </Button>
            ))}
          </div>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="kb-title">Title</Label>
              <Input
                id="kb-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. MSCS Act 2002 — membership provisions"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="kb-category">Category</Label>
              <select
                id="kb-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {KB_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {KB_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>

            {mode === "text" && (
              <div className="grid gap-1.5">
                <Label htmlFor="kb-content">Content</Label>
                <Textarea
                  id="kb-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={8}
                  placeholder="Paste the text to index…"
                />
              </div>
            )}
            {mode === "url" && (
              <div className="grid gap-1.5">
                <Label htmlFor="kb-url">URL</Label>
                <Input
                  id="kb-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://cooperation.gov.in/…"
                />
              </div>
            )}
            {mode === "file" && (
              <div className="grid gap-1.5">
                <Label htmlFor="kb-file">File (PDF or text)</Label>
                <Input
                  id="kb-file"
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.txt,.md,.csv"
                />
              </div>
            )}

            <Button onClick={submit} disabled={busy} className="w-fit">
              {busy && <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />}
              Add to knowledge base
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Indexed sources</h2>
        {entries === undefined && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {entries?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {isStaff
              ? "Nothing indexed yet. Add your first source above."
              : "Nothing indexed yet."}
          </p>
        )}
        {entries?.map((e) => (
          <div
            key={e.entryId}
            className="flex items-center justify-between rounded-lg border px-3 py-2"
          >
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">{e.title}</div>
              <div className="text-xs text-muted-foreground">
                {categoryLabel(e.category)}
                {" · "}
                {e.chunks} chunks
                {isStaff && e.pendingEmbeddings > 0
                  ? ` (${e.pendingEmbeddings} awaiting embedding)`
                  : ""}
                {e.source ? ` · ${e.source}` : ""}
              </div>
            </div>
            {isStaff && (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Delete ${e.title}`}
                onClick={async () => {
                  if (
                    !window.confirm(
                      `Remove "${e.title}" from the knowledge base?`,
                    )
                  ) {
                    return;
                  }
                  try {
                    await deleteEntry({ entryId: e.entryId });
                    toast.success("Removed from knowledge base");
                  } catch (err) {
                    toast.error(
                      err instanceof Error && err.message.includes("Forbidden")
                        ? "Only officers can delete content"
                        : "Could not delete entry",
                    );
                  }
                }}
              >
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
