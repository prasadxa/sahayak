import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { CALLMISSED_MODELS, callmissedFetch } from "@/lib/callmissed";
import { toBcp47 } from "@/lib/languages";

/** Generated read-aloud clips older than this are deleted by the hourly cron. */
export const TTS_AUDIO_TTL_MS = 6 * 60 * 60 * 1000;
const CLEANUP_BATCH = 100;

/**
 * Speech-to-text via CallMissed POST /v1/audio/transcriptions.
 * Accepts a Convex storage id holding an audio clip (webm/mp3/wav/...).
 * `language` is a short code (`hi`); it is sent as BCP-47 (`hi-IN`). For
 * English or when omitted, `saaras:v3` auto-detects across 22 Indian
 * languages, which suits code-mixed rural speech. The uploaded clip is
 * deleted once transcribed. Only files whose stored content type is
 * `audio/*` are accepted, so the action can't be used to delete someone
 * else's avatar or KB upload by id.
 */
export const transcribe = action({
  args: {
    storageId: v.id("_storage"),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ text: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const meta: { contentType: string | null } | null = await ctx.runQuery(
      internal.voice.fileMeta,
      { storageId: args.storageId }
    );
    if (!meta) throw new Error("Audio file not found");
    if (!meta.contentType?.toLowerCase().startsWith("audio/")) {
      throw new Error("Not an audio file");
    }

    const blob = await ctx.storage.get(args.storageId);
    if (!blob) throw new Error("Audio file not found");

    try {
      const ext = blob.type.includes("mp4")
        ? "m4a"
        : blob.type.includes("wav")
          ? "wav"
          : blob.type.includes("mpeg") || blob.type.includes("mp3")
            ? "mp3"
            : "webm";

      const form = new FormData();
      form.append("file", blob, `recording.${ext}`);
      form.append("model", CALLMISSED_MODELS.stt);
      if (args.language && args.language !== "en") {
        form.append("language", toBcp47(args.language));
      }
      form.append("response_format", "json");

      const res = await callmissedFetch("/audio/transcriptions", {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as { text?: string };
      return { text: json.text ?? "" };
    } finally {
      // The citizen's voice clip is not kept after transcription.
      await ctx.storage.delete(args.storageId);
    }
  },
});

/**
 * Text-to-speech via CallMissed POST /v1/audio/speech (`bulbul:v3`,
 * 11 Indian languages). `language` is a short code; it is sent as BCP-47
 * in both `language` and `target_language_code` (the API ignores unknown
 * fields). Returns a Convex storage URL; the clip is recorded in
 * `tts_audio` so the cron can delete it later.
 */
export const synthesize = action({
  args: {
    text: v.string(),
    voice: v.optional(v.string()),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ url: string | null }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const bcp47 = args.language ? toBcp47(args.language) : undefined;
    const res = await callmissedFetch("/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: CALLMISSED_MODELS.tts,
        voice: args.voice ?? CALLMISSED_MODELS.ttsVoice,
        input: args.text.slice(0, 4000),
        response_format: "mp3",
        ...(bcp47 ? { language: bcp47, target_language_code: bcp47 } : {}),
      }),
    });

    const audio = await res.arrayBuffer();
    // CallMissed may return WAV even when mp3 is requested; keep its real type.
    const type = res.headers.get("content-type")?.split(";")[0] || "audio/mpeg";
    const storageId = await ctx.storage.store(new Blob([audio], { type }));
    await ctx.runMutation(internal.voice.recordAudio, { storageId });
    const audioUrl = await ctx.storage.getUrl(storageId);
    return { url: audioUrl };
  },
});

/** System metadata for a stored file (actions have no ctx.db). */
export const fileMeta = internalQuery({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args): Promise<{ contentType: string | null } | null> => {
    const file = await ctx.db.system.get(args.storageId);
    return file ? { contentType: file.contentType ?? null } : null;
  },
});

export const recordAudio = internalMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await ctx.db.insert("tts_audio", {
      storageId: args.storageId,
      createdAt: Date.now(),
    });
  },
});

/**
 * Deletes read-aloud clips (rows and files) older than 6 hours, 100 at a
 * time, rescheduling itself until none are left. Run hourly by crons.ts.
 */
export const cleanupOldAudio = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ deleted: number }> => {
    const cutoff = Date.now() - TTS_AUDIO_TTL_MS;
    const rows = await ctx.db
      .query("tts_audio")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(CLEANUP_BATCH);

    for (const row of rows) {
      const file = await ctx.db.system.get(row.storageId);
      if (file) await ctx.storage.delete(row.storageId);
      await ctx.db.delete(row._id);
    }

    if (rows.length === CLEANUP_BATCH) {
      await ctx.scheduler.runAfter(0, internal.voice.cleanupOldAudio, {});
    }
    return { deleted: rows.length };
  },
});
