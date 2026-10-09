import { embed, embedMany } from "ai";

import { callmissed, CALLMISSED_MODELS, EMBEDDING_DIMENSIONS } from "@/lib/callmissed";

/** Embedding models to try in order, de-duplicated. */
function embeddingChain(): string[] {
  return [...new Set([CALLMISSED_MODELS.embedding, CALLMISSED_MODELS.embeddingFallback])];
}

function modelFor(id: string) {
  return callmissed().textEmbeddingModel(id, { dimensions: EMBEDDING_DIMENSIONS });
}

async function withFallback<T>(run: (id: string) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (const id of embeddingChain()) {
    try {
      return await run(id);
    } catch (e) {
      lastError = e;
      console.error(
        `[embed] ${id} failed: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
  throw lastError;
}

/** Embed one value, falling through the model chain; always EMBEDDING_DIMENSIONS long. */
export async function embedOne(value: string, maxRetries = 0): Promise<number[]> {
  return withFallback(async (id) => {
    const { embedding } = await embed({ model: modelFor(id), value, maxRetries });
    return embedding;
  });
}

/** Embed many values, falling through the model chain (never mixes models in one batch). */
export async function embedBatch(values: string[], maxRetries = 1): Promise<number[][]> {
  if (values.length === 0) return [];
  return withFallback(async (id) => {
    const { embeddings } = await embedMany({ model: modelFor(id), values, maxRetries });
    return embeddings;
  });
}
