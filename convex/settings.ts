import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

import { internalQuery, mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireAdmin } from "./roles";
import { MODEL_FUNCTIONS, type ModelFunction } from "@/lib/constants";
import { CALLMISSED_MODELS } from "@/lib/callmissed";
import { defaultModelId, isCatalogChoice } from "@/lib/model-catalog";

/**
 * Operator-selectable provider/model per AI function (the "Models & voice"
 * page at /admin/models). One `app_settings` row per function, keyed
 * `model:<function>`; a missing row means the catalog default, which the
 * CALLMISSED_MODEL_* env vars can still override. Callers resolve the
 * selection at call time — voice.ts via `internal.settings.modelFor`, the
 * chat route via `api.settings.effectiveModel`.
 */

const KEY_PREFIX = "model:";
const DEFAULT_PROVIDER = "callmissed";

const selectionValidator = v.object({ provider: v.string(), model: v.string() });
type Selection = { provider: string; model: string };

function assertModelFunction(fn: string): asserts fn is ModelFunction {
  if (!(MODEL_FUNCTIONS as readonly string[]).includes(fn)) {
    throw new Error(
      `Unknown model function "${fn}". Use one of: ${MODEL_FUNCTIONS.join(", ")}`
    );
  }
}

function storedRow(ctx: QueryCtx, fn: ModelFunction) {
  return ctx.db
    .query("app_settings")
    .withIndex("by_key", (q) => q.eq("key", `${KEY_PREFIX}${fn}`))
    .unique();
}

/** The stored override, else the env-resolved catalog default. */
async function resolveModel(ctx: QueryCtx, fn: ModelFunction): Promise<Selection> {
  const row = await storedRow(ctx, fn);
  return row
    ? { provider: row.provider, model: row.model }
    : { provider: DEFAULT_PROVIDER, model: defaultModelId(fn) };
}

/** For Convex actions (voice.ts); the public mirror is `effectiveModel`. */
export const modelFor = internalQuery({
  args: { function: v.string() },
  returns: selectionValidator,
  handler: async (ctx, args): Promise<Selection> => {
    assertModelFunction(args.function);
    return await resolveModel(ctx, args.function);
  },
});

/**
 * Read by the Next.js chat route with the caller's token, once per POST.
 * Any signed-in user may read it — model ids are not secret.
 */
export const effectiveModel = query({
  args: { function: v.string() },
  returns: selectionValidator,
  handler: async (ctx, args): Promise<Selection> => {
    if (!(await getAuthUserId(ctx))) throw new Error("Not authenticated");
    assertModelFunction(args.function);
    return await resolveModel(ctx, args.function);
  },
});

/**
 * Every function's effective selection for the admin page (admin only).
 * Ends with an `embedding` row that is not in MODEL_FUNCTIONS — it is
 * read-only because the vector indexes are fixed at 1536 dimensions.
 */
export const listModels = query({
  args: {},
  returns: v.array(
    v.object({
      function: v.string(),
      provider: v.string(),
      model: v.string(),
      defaultModel: v.string(),
      overridden: v.boolean(),
    })
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    type Row = {
      function: string;
      provider: string;
      model: string;
      defaultModel: string;
      overridden: boolean;
    };
    const rows: Row[] = await Promise.all(
      MODEL_FUNCTIONS.map(async (fn): Promise<Row> => {
        const row: Doc<"app_settings"> | null = await storedRow(ctx, fn);
        return {
          function: fn,
          provider: row?.provider ?? DEFAULT_PROVIDER,
          model: row?.model ?? defaultModelId(fn),
          defaultModel: defaultModelId(fn),
          overridden: row !== null,
        };
      })
    );
    rows.push({
      function: "embedding",
      provider: DEFAULT_PROVIDER,
      model: CALLMISSED_MODELS.embedding,
      defaultModel: CALLMISSED_MODELS.embedding,
      overridden: false,
    });
    return rows;
  },
});

export const setModel = mutation({
  args: { function: v.string(), provider: v.string(), model: v.string() },
  returns: selectionValidator,
  handler: async (ctx, args): Promise<Selection> => {
    const userId = await requireAdmin(ctx);
    assertModelFunction(args.function);
    // The env-var default may be a model outside the static catalog; let
    // the admin pin it explicitly even though it is not an option.
    const allowed =
      isCatalogChoice(args.function, args.provider, args.model) ||
      (args.provider === DEFAULT_PROVIDER &&
        args.model === defaultModelId(args.function));
    if (!allowed) {
      throw new Error(
        `"${args.model}" is not in the catalog for ${args.function}. Add it to MODEL_CATALOG (lib/model-catalog.ts) first.`
      );
    }
    const existing = await storedRow(ctx, args.function);
    const value = {
      provider: args.provider,
      model: args.model,
      updatedBy: userId,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, value);
    } else {
      await ctx.db.insert("app_settings", {
        key: `${KEY_PREFIX}${args.function}`,
        ...value,
      });
    }
    return { provider: args.provider, model: args.model };
  },
});

/** Delete the override so the function falls back to its catalog default. */
export const resetModel = mutation({
  args: { function: v.string() },
  returns: selectionValidator,
  handler: async (ctx, args): Promise<Selection> => {
    await requireAdmin(ctx);
    assertModelFunction(args.function);
    const row = await storedRow(ctx, args.function);
    if (row) await ctx.db.delete(row._id);
    return { provider: DEFAULT_PROVIDER, model: defaultModelId(args.function) };
  },
});
