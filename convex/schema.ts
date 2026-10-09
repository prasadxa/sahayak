import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.string(),
    email: v.string(),
    image: v.string(),
    emailVerificationTime: v.optional(v.number()),
    avatarUrl: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    isMemoryEnabled: v.optional(v.boolean()),
    // member | officer | admin | kiosk (see lib/constants.ts). Missing = member.
    role: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("by_role", ["role"]),

  chats: defineTable({
    title: v.string(),
    visibility: v.union(v.literal("private"), v.literal("public")),
    chatId: v.string(),
    userId: v.id("users"),
    isPinned: v.optional(v.boolean()),
    // UI language code at chat creation (e.g. "hi"), for analytics.
    language: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_chatId", ["chatId"]),

  messages: defineTable({
    messageId: v.string(),
    chatId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("tool")),
    parts: v.array(v.any()),
    attachments: v.optional(
      v.array(
        v.object({
          url: v.string(),
          name: v.string(),
          contentType: v.string(),
        })
      )
    ),
  })
    .index("by_messageId", ["messageId"])
    .index("by_chatId", ["chatId"]),

  documents: defineTable({
    title: v.string(),
    content: v.string(),
    kind: v.union(
      v.literal("text"),
      v.literal("code"),
      v.literal("image"),
      v.literal("sheet")
    ),
    documentId: v.string(),
    userId: v.id("users"),
    chatId: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_documentId", ["documentId"])
    .index("by_chatId", ["chatId"]),

  suggestions: defineTable({
    originalText: v.string(),
    suggestedText: v.string(),
    description: v.optional(v.string()),
    isResolved: v.boolean(),
    documentId: v.string(),
    suggestionId: v.string(),
    userId: v.id("users"),
  })
    .index("by_documentId", ["documentId"])
    .index("by_userId", ["userId"]),

  votes: defineTable({
    chatId: v.string(),
    messageId: v.string(),
    isUpvoted: v.boolean(),
  })
    .index("by_messageId", ["messageId"])
    .index("by_chatId", ["chatId"]),

  memories: defineTable({
    userId: v.id("users"),
    resourceId: v.string(),
    content: v.string(),
    embedding: v.array(v.float64()),
  })
    .index("by_user", ["userId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["userId"],
    }),

  streams: defineTable({
    streamId: v.string(),
    chatId: v.string(),
  }).index("by_chatId", ["chatId"]),

  // Shared knowledge base — cooperative laws, schemes, PMFBY, finance.
  // Chunks belonging to one ingested source share `entryId`.
  kb_entries: defineTable({
    entryId: v.string(),
    title: v.string(),
    category: v.string(), // laws | schemes | pmfby | finance | grievance | general
    source: v.optional(v.string()),
    content: v.string(),
    chunkIndex: v.number(),
    // Optional so ingestion survives an embeddings outage; missing chunks
    // are found by full-text search and embedded later by a backfill.
    embedding: v.optional(v.array(v.float64())),
    // true while the chunk awaits an embedding (indexed so the backfill
    // never scans embedded rows). Unset once embedded.
    needsEmbedding: v.optional(v.boolean()),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_entry", ["entryId"])
    .index("by_category", ["category"])
    .index("by_title", ["title"])
    .index("by_needsEmbedding", ["needsEmbedding"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536, // text-embedding-3-small native; -large requested with dimensions=1536
      filterFields: ["category"],
    })
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["category"],
    }),

  // One small row per ingested source (entryId), maintained by kb.ts on
  // insert, delete and embedding backfill, so listings and dashboard counts
  // never read the ~12 KB chunk rows. Rebuild with `kb:migrateSources`.
  kb_sources: defineTable({
    entryId: v.string(),
    title: v.string(),
    category: v.string(),
    source: v.optional(v.string()),
    chunks: v.number(),
    pendingEmbeddings: v.number(),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_entry", ["entryId"])
    .index("by_title", ["title"]),

  // One row per knowledge-base search, for the officer dashboard.
  kb_queries: defineTable({
    query: v.string(),
    category: v.optional(v.string()),
    language: v.optional(v.string()),
    hits: v.number(),
    topScore: v.optional(v.number()),
    mode: v.union(v.literal("vector"), v.literal("text"), v.literal("none")),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  grievances: defineTable({
    userId: v.id("users"),
    refId: v.string(),
    category: v.string(),
    subject: v.string(),
    description: v.string(),
    contact: v.optional(v.string()),
    status: v.string(), // submitted | in_review | resolved | rejected
    channel: v.optional(v.string()), // web | kiosk
    district: v.optional(v.string()),
    societyName: v.optional(v.string()),
    language: v.optional(v.string()),
    updates: v.optional(
      v.array(
        v.object({
          status: v.string(),
          note: v.string(),
          at: v.number(),
          byName: v.string(),
        })
      )
    ),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_refId", ["refId"])
    .index("by_status", ["status"]),

  // Generated read-aloud clips; an hourly cron deletes old ones.
  tts_audio: defineTable({
    storageId: v.id("_storage"),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  // Operator-editable settings, one row per namespaced key. "Models & voice"
  // stores `model:<function>` → {provider, model}; writes are admin-only via
  // convex/settings.ts. Never store secrets here — API keys stay in env vars.
  app_settings: defineTable({
    key: v.string(),
    provider: v.string(),
    model: v.string(),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
});
