import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";

import { callmissed, CALLMISSED_MODELS } from "@/lib/callmissed";
import type { ModelFunction } from "@/lib/constants";

export const DEFAULT_CHAT_MODEL: string = "chat-model-small";

const cm = callmissed();

export const myProvider = customProvider({
  languageModels: {
    "chat-model-small": cm.chat(CALLMISSED_MODELS.chatSmall),
    "chat-model-large": cm.chat(CALLMISSED_MODELS.chatLarge),
    "chat-model-reasoning": wrapLanguageModel({
      model: cm.chat(CALLMISSED_MODELS.reasoning),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    "title-model": cm.chat(CALLMISSED_MODELS.title),
    "block-model": cm.chat(CALLMISSED_MODELS.block),
  },
  textEmbeddingModels: {
    "text-embedding-3-small": cm.textEmbeddingModel(CALLMISSED_MODELS.embedding),
    "text-embedding-3-large": cm.textEmbeddingModel("text-embedding-3-large"),
  },
  imageModels: {
    "image-model-small": cm.image(CALLMISSED_MODELS.imageSmall),
    "image-model-large": cm.image(CALLMISSED_MODELS.imageLarge),
  },
});

interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: "chat-model-small",
    name: "Sahayak Fast",
    description: "Indic-optimised model for everyday questions",
  },
  {
    id: "chat-model-large",
    name: "Sahayak Pro",
    description: "Larger model for detailed legal & scheme guidance",
  },
  {
    id: "chat-model-reasoning",
    name: "Sahayak Reasoning",
    description: "Step-by-step reasoning for complex questions",
  },
];

/**
 * Client-facing chat tier id → the settings function whose stored selection
 * (api.settings.effectiveModel, set at /admin/models) decides its backing
 * provider model. Tiers without an entry always use the env default.
 */
export const CHAT_MODEL_FUNCTIONS: Record<string, ModelFunction> = {
  "chat-model-small": "chatSmall",
  "chat-model-large": "chatLarge",
  "chat-model-reasoning": "reasoning",
};

/**
 * Language model for a chat tier, honouring the admin's stored selection.
 * `selection` is `{ provider, model }` from api.settings.effectiveModel;
 * an absent or unknown provider falls back to the env-configured provider.
 */
export function chatLanguageModel(
  appModelId: string,
  selection?: { provider: string; model: string } | null
) {
  if (selection && selection.provider === "callmissed") {
    const base = cm.chat(selection.model);
    return appModelId === "chat-model-reasoning"
      ? wrapLanguageModel({
          model: base,
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        })
      : base;
  }
  return myProvider.languageModel(appModelId);
}
