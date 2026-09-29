import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { asUser } from "./test.helpers";

async function setup() {
  const t = convexTest(schema, modules);
  const alice = await asUser(t, { email: "alice@example.com" });
  const mallory = await asUser(t, { email: "mallory@example.com" });
  await alice.client.mutation(api.chats.saveChat, {
    chatId: "chat-private",
    title: "My grievance",
    visibility: "private",
  });
  await alice.client.mutation(api.chats.saveChat, {
    chatId: "chat-public",
    title: "Shared answer",
    visibility: "public",
  });
  await alice.client.mutation(api.documents.saveDocument, {
    documentId: "doc-private",
    title: "Grievance letter",
    kind: "text",
    content: "Dear Registrar, my name is Asha and my phone is 98xxxx",
    chatId: "chat-private",
  });
  await alice.client.mutation(api.documents.saveDocument, {
    documentId: "doc-public",
    title: "PMFBY explainer",
    kind: "text",
    content: "PMFBY covers crop loss",
    chatId: "chat-public",
  });
  await alice.client.mutation(api.suggestions.saveSuggestions, {
    suggestions: [
      {
        suggestionId: "s1",
        documentId: "doc-private",
        originalText: "Dear Registrar",
        suggestedText: "Respected Registrar",
        description: "More formal",
        isResolved: false,
      },
    ],
  });
  return { t, alice, mallory };
}

const suggestion = (documentId: string) => ({
  suggestionId: "s-x",
  documentId,
  originalText: "a",
  suggestedText: "b",
  isResolved: false,
});

describe("document access control", () => {
  it("rejects an anonymous saveDocument and stores the caller as owner", async () => {
    const { t, alice } = await setup();
    await expect(
      t.mutation(api.documents.saveDocument, {
        documentId: "doc-anon",
        title: "x",
        kind: "text",
        content: "x",
      })
    ).rejects.toThrow(/Not authenticated/);
    const doc = await t.run((ctx) =>
      ctx.db
        .query("documents")
        .withIndex("by_documentId", (q) => q.eq("documentId", "doc-private"))
        .first()
    );
    expect(doc?.userId).toBe(alice.userId);
  });

  it("refuses a new version of someone else's document", async () => {
    const { mallory } = await setup();
    await expect(
      mallory.client.mutation(api.documents.saveDocument, {
        documentId: "doc-private",
        title: "hijack",
        kind: "text",
        content: "overwritten",
      })
    ).rejects.toThrow(/Forbidden/);
  });

  it("hides a private document from non-owners and anonymous callers", async () => {
    const { t, mallory } = await setup();
    expect(
      await mallory.client.query(api.documents.getDocumentById, { documentId: "doc-private" })
    ).toBeNull();
    expect(await t.query(api.documents.getDocumentById, { documentId: "doc-private" })).toBeNull();
    expect(
      await mallory.client.query(api.documents.getDocumentVersions, { documentId: "doc-private" })
    ).toEqual([]);
    expect(
      await t.query(api.documents.getDocumentVersions, { documentId: "doc-private" })
    ).toEqual([]);
  });

  it("refuses updates and version deletes from non-owners", async () => {
    const { t, mallory } = await setup();
    await expect(
      mallory.client.mutation(api.documents.updateDocument, {
        documentId: "doc-private",
        content: "defaced",
      })
    ).rejects.toThrow(/Forbidden/);
    await expect(
      mallory.client.mutation(api.documents.deleteDocumentsByIdAfterTimestamp, {
        documentId: "doc-private",
        timestamp: 0,
      })
    ).rejects.toThrow(/Forbidden/);
    await expect(
      t.mutation(api.documents.deleteDocumentsByIdAfterTimestamp, {
        documentId: "doc-private",
        timestamp: 0,
      })
    ).rejects.toThrow(/Not authenticated/);
    const remaining = await t.run((ctx) =>
      ctx.db
        .query("documents")
        .withIndex("by_documentId", (q) => q.eq("documentId", "doc-private"))
        .collect()
    );
    expect(remaining).toHaveLength(1);
  });

  it("hides and protects suggestions on a document the caller does not own", async () => {
    const { t, mallory } = await setup();
    expect(
      await mallory.client.query(api.suggestions.getSuggestionsByDocumentId, {
        documentId: "doc-private",
      })
    ).toEqual([]);
    expect(
      await t.query(api.suggestions.getSuggestionsByDocumentId, { documentId: "doc-private" })
    ).toEqual([]);
    await expect(
      mallory.client.mutation(api.suggestions.saveSuggestions, {
        suggestions: [suggestion("doc-private")],
      })
    ).rejects.toThrow(/Forbidden/);
    await expect(
      t.mutation(api.suggestions.saveSuggestions, { suggestions: [suggestion("doc-private")] })
    ).rejects.toThrow(/Not authenticated/);
  });

  it("lets the owner read, version, update, list, delete and suggest", async () => {
    const { t, alice } = await setup();
    const doc = await alice.client.query(api.documents.getDocumentById, {
      documentId: "doc-private",
    });
    expect(doc?.title).toBe("Grievance letter");

    await alice.client.mutation(api.documents.saveDocument, {
      documentId: "doc-private",
      title: "Grievance letter",
      kind: "text",
      content: "v2",
      chatId: "chat-private",
    });
    await alice.client.mutation(api.documents.updateDocument, {
      documentId: "doc-private",
      content: "v3",
    });
    const versions = await alice.client.query(api.documents.getDocumentVersions, {
      documentId: "doc-private",
    });
    expect(versions.map((d) => d.content)).toEqual([
      "v3",
      "v2",
      "Dear Registrar, my name is Asha and my phone is 98xxxx",
    ]);
    const latest = await t.run((ctx) =>
      ctx.db
        .query("documents")
        .withIndex("by_documentId", (q) => q.eq("documentId", "doc-private"))
        .order("desc")
        .first()
    );
    expect(latest?.userId).toBe(alice.userId);

    const suggestions = await alice.client.query(api.suggestions.getSuggestionsByDocumentId, {
      documentId: "doc-private",
    });
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].userId).toBe(alice.userId);
    await alice.client.mutation(api.suggestions.saveSuggestions, {
      suggestions: [suggestion("doc-private")],
    });

    await alice.client.mutation(api.documents.deleteDocumentsByIdAfterTimestamp, {
      documentId: "doc-private",
      timestamp: versions[2]._creationTime,
    });
    const after = await alice.client.query(api.documents.getDocumentVersions, {
      documentId: "doc-private",
    });
    expect(after).toHaveLength(1);
  });

  it("lets anyone read a document in a public chat, without the owner's userId", async () => {
    const { t, mallory } = await setup();
    for (const client of [t, mallory.client]) {
      const doc = await client.query(api.documents.getDocumentById, { documentId: "doc-public" });
      expect(doc?.content).toBe("PMFBY covers crop loss");
      expect(doc).not.toHaveProperty("userId");
      const versions = await client.query(api.documents.getDocumentVersions, {
        documentId: "doc-public",
      });
      expect(versions).toHaveLength(1);
      expect(versions[0]).not.toHaveProperty("userId");
    }
    // Public read access does not extend to writes.
    await expect(
      mallory.client.mutation(api.documents.updateDocument, {
        documentId: "doc-public",
        content: "defaced",
      })
    ).rejects.toThrow(/Forbidden/);
  });

  it("refuses to attach a document to someone else's chat", async () => {
    const { mallory } = await setup();
    await expect(
      mallory.client.mutation(api.documents.saveDocument, {
        documentId: "doc-mallory",
        title: "x",
        kind: "text",
        content: "x",
        chatId: "chat-public",
      })
    ).rejects.toThrow(/Forbidden/);
  });
});

describe("file access control", () => {
  it("rejects anonymous getAttachmentUrl and getAiImageUrl", async () => {
    const { t, alice } = await setup();
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["png"])));
    await expect(
      t.mutation(api.files.getAttachmentUrl, {
        storageId,
        name: "a.png",
        contentType: "image/png",
      })
    ).rejects.toThrow(/Not authenticated/);
    await expect(t.query(api.files.getAiImageUrl, { storageId })).rejects.toThrow(
      /Not authenticated/
    );
    const signed = await alice.client.mutation(api.files.getAttachmentUrl, {
      storageId,
      name: "a.png",
      contentType: "image/png",
    });
    expect(signed.url).toBeTruthy();
    expect((await alice.client.query(api.files.getAiImageUrl, { storageId })).url).toBeTruthy();
  });

  it("rejects an anonymous storeAiImage", async () => {
    const { t, alice } = await setup();
    const png = "data:image/png;base64,iVBORw0KGgo=";
    await expect(t.action(api.files.storeAiImage, { base64Image: png })).rejects.toThrow(
      /Not authenticated/
    );
    const { storageId } = await alice.client.action(api.files.storeAiImage, { base64Image: png });
    expect(storageId).toBeTruthy();
  });
});
