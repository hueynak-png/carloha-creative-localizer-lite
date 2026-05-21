import type { GenerationProvider } from "@/lib/types";
import { generatePromptForRequest } from "@/providers/manualChatGPTProvider";

const OPENAI_PROVIDER_DISABLED_MESSAGE =
  "OpenAI API image generation is not enabled. Set NEXT_PUBLIC_GENERATION_PROVIDER=openai_api and configure server OpenAI image environment variables.";

export function isOpenAIImageProviderEnabled() {
  return process.env.NEXT_PUBLIC_GENERATION_PROVIDER === "openai_api";
}

export const openAIImageProvider: GenerationProvider = {
  id: "openai_api",
  label: "OpenAI API",
  mode: "api",
  enabled: isOpenAIImageProviderEnabled(),
  helperText: isOpenAIImageProviderEnabled()
    ? "Generate images inside the web app through the configured image API."
    : "API-based image generation requires provider environment variables.",
  async generate(request) {
    if (!isOpenAIImageProviderEnabled()) {
      throw new Error(OPENAI_PROVIDER_DISABLED_MESSAGE);
    }

    const prompt = generatePromptForRequest(request);

    return {
      provider: "openai_api",
      mode: "api",
      prompt,
      taskDraft: {
        userId: request.userId,
        workflowType: request.workflowType,
        generationMode: "api",
        generationProvider: "openai_api",
        status: "prompt_ready",
        uploadedOriginalPoster: request.originalPoster ?? null,
        uploadedFaceReferenceImages: request.faceReferences,
        uploadedAdditionalReferenceImages: request.additionalReferences,
        formSettings: request.settings,
        finalPrompt: prompt,
        manuallyUploadedGeneratedImages: [],
        selectedImageId: null,
        modelName: process.env.NEXT_PUBLIC_OPENAI_IMAGE_MODEL ?? null,
        qualityLevel: process.env.NEXT_PUBLIC_OPENAI_IMAGE_QUALITY ?? null,
        estimatedCost: null,
        apiResponse: null,
        generatedImages: []
      }
    };
  }
};
