import type { GenerationProvider } from "@/lib/types";

export const openAIImageProvider: GenerationProvider = {
  id: "openai_api",
  label: "OpenAI API Coming Soon",
  mode: "api",
  enabled: false,
  helperText: "API-based image generation is reserved for a future version.",
  async generate() {
    throw new Error("OpenAI API image generation is coming soon and is disabled in version 1.");
  }
};
