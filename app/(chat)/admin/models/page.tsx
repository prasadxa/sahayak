"use client";

import { useState } from "react";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

import { toast } from "sonner";
import { LoaderCircle, Lock, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect, PageHeader, StaffGate } from "@/components/admin/admin-shell";
import { MODEL_FUNCTIONS, type ModelFunction } from "@/lib/constants";
import {
  MODEL_CATALOG,
  MODEL_PROVIDER_INFO,
  type ModelProvider,
} from "@/lib/model-catalog";

type ModelRow = FunctionReturnType<typeof api.settings.listModels>[number];

const GROUPS: { title: string; functions: ModelFunction[] }[] = [
  { title: "Chat", functions: ["chatSmall", "chatLarge", "reasoning"] },
  { title: "Voice", functions: ["stt", "tts", "ttsVoice"] },
];

const providerName = (id: string) =>
  MODEL_PROVIDER_INFO[id as ModelProvider]?.name ?? id;

const FunctionRow = ({
  fn,
  row,
  value,
  onChange,
}: {
  fn: ModelFunction;
  row: ModelRow | undefined;
  value: string;
  onChange: (value: string) => void;
}) => {
  const spec = MODEL_CATALOG[fn];
  const inCatalog = spec.options.some((o) => o.id === value);
  return (
    <div className="grid sm:grid-cols-[14rem_1fr] gap-2 sm:gap-4 sm:items-center py-3">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={`model-${fn}`} className="text-sm font-medium">
          {spec.label}
        </Label>
        <p className="text-xs text-muted-foreground">{spec.description}</p>
        {row?.overridden && (
          <span className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400 font-medium">
            Override active
          </span>
        )}
      </div>
      <NativeSelect
        id={`model-${fn}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Default — {row?.defaultModel ?? "…"}</option>
        {spec.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
        {value !== "" && !inCatalog && <option value={value}>{value} (custom)</option>}
      </NativeSelect>
    </div>
  );
};

const ModelsForm = () => {
  const rows = useQuery(api.settings.listModels);
  const setModel = useMutation(api.settings.setModel);
  const resetModel = useMutation(api.settings.resetModel);
  // Draft overrides per function; "" means "system default".
  const [draft, setDraft] = useState<Partial<Record<ModelFunction, string>>>({});
  const [busy, setBusy] = useState(false);

  if (rows === undefined) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  const rowFor = (fn: string) => rows.find((r) => r.function === fn);
  const serverValue = (fn: ModelFunction): string => {
    const r = rowFor(fn);
    return r?.overridden ? r.model : "";
  };
  const selected = (fn: ModelFunction) => draft[fn] ?? serverValue(fn);
  const dirty = MODEL_FUNCTIONS.some((fn) => selected(fn) !== serverValue(fn));
  const embedding = rowFor("embedding");

  const save = async () => {
    setBusy(true);
    try {
      for (const fn of MODEL_FUNCTIONS) {
        const value = selected(fn);
        if (value === serverValue(fn)) continue;
        if (value === "") {
          await resetModel({ function: fn });
        } else {
          const option = MODEL_CATALOG[fn].options.find((o) => o.id === value);
          await setModel({
            function: fn,
            provider: option?.provider ?? "callmissed",
            model: value,
          });
        }
      }
      setDraft({});
      toast.success("Model settings saved — new requests use them right away");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save model settings");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-muted-foreground rounded-xl border p-3">
        Provider: {providerName("callmissed")} (OpenAI-compatible). Keys come from the{" "}
        <code>CALLMISSED_API_KEY</code> env var on Next.js and Convex — never from the
        database. Picks apply to new requests immediately; the{" "}
        <code>CALLMISSED_MODEL_*</code> env vars remain the defaults.
      </p>

      {GROUPS.map((group) => (
        <section key={group.title} className="rounded-xl border p-4 flex flex-col">
          <h2 className="text-sm font-medium">{group.title}</h2>
          <div className="divide-y">
            {group.functions.map((fn) => (
              <FunctionRow
                key={fn}
                fn={fn}
                row={rowFor(fn)}
                value={selected(fn)}
                onChange={(v) => setDraft((d) => ({ ...d, [fn]: v }))}
              />
            ))}
          </div>
        </section>
      ))}

      <section className="rounded-xl border p-4 flex flex-col">
        <h2 className="text-sm font-medium">Embeddings</h2>
        <div className="grid sm:grid-cols-[14rem_1fr] gap-2 sm:gap-4 sm:items-center py-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium flex items-center gap-1.5">
              Knowledge base &amp; memory <Lock className="w-3.5 h-3.5 text-muted-foreground" />
            </p>
            <p className="text-xs text-muted-foreground">
              Fixed — the vector indexes are 1536-dimensional. Switching models needs a
              schema change plus a full re-ingest.
            </p>
          </div>
          <p className="text-sm rounded-md border bg-muted/50 px-3 py-2 font-mono">
            {embedding?.model ?? "text-embedding-3-small"}
            <span className="text-muted-foreground font-sans">
              {" "}
              · {providerName(embedding?.provider ?? "callmissed")}
            </span>
          </p>
        </div>
      </section>

      <div>
        <Button onClick={save} disabled={busy || !dirty}>
          {busy && <LoaderCircle className="w-4 h-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </div>
  );
};

export default function AdminModelsPage() {
  return (
    <>
      <PageHeader />
      <div className="mx-auto max-w-3xl w-full px-4 pb-8 pt-2 flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5" /> Models &amp; voice
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose which provider model backs each AI function. No redeploy needed.
          </p>
        </div>
        <StaffGate adminOnly>{() => <ModelsForm />}</StaffGate>
      </div>
    </>
  );
}
