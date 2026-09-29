import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";

import { callmissed, CALLMISSED_MODELS } from "@/lib/callmissed";

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
