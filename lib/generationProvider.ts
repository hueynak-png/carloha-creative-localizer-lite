import { manualChatGPTProvider } from "@/providers/manualChatGPTProvider";
import { openAIImageProvider } from "@/providers/openAIImageProvider";
import type { GenerationProvider, GenerationProviderId } from "@/lib/types";

export const generationProviders: GenerationProvider[] = [
  manualChatGPTProvider,
  openAIImageProvider
];

export const defaultGenerationProviderId: GenerationProviderId =
  "manual_chatgpt_web";

export function getGenerationProvider(id: GenerationProviderId = defaultGenerationProviderId) {
  const provider = generationProviders.find((item) => item.id === id);
  if (!provider) {
    throw new Error(`Unknown generation provider: ${id}`);
  }
  return provider;
}

export function getActiveGenerationProvider() {
  return manualChatGPTProvider;
}
