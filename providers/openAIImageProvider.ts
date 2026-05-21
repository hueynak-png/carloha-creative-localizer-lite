import type { GenerationProvider } from "@/lib/types";

const OPENAI_PROVIDER_DISABLED_MESSAGE =
  "OpenAI API image generation is disabled in version 1. API-based image generation is reserved for a future version.";

export const openAIImageProvider: GenerationProvider = {
  id: "openai_api",
  label: "OpenAI API Coming Soon",
  mode: "api",
  enabled: false,
  helperText: "API-based image generation is reserved for a future version.",
  async generate() {
    throw new Error(OPENAI_PROVIDER_DISABLED_MESSAGE);
  }
};
