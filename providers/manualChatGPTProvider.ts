import { COMPLIANCE_RULE } from "@/lib/constants";
import { getBrandLogoPromptInstruction } from "@/lib/brandAssets";
import type {
  CreateNewSettings,
  GenerationProvider,
  GenerationRequest,
  LocalizeExistingSettings
} from "@/lib/types";

function section(title: string, lines: Array<string | undefined>) {
  return [`## ${title}`, ...lines.filter(Boolean)].join("\n");
}

function generateLocalizePrompt(request: GenerationRequest) {
  const settings = request.settings as LocalizeExistingSettings;

  return [
    "Localize the uploaded poster image for the Nigerian market using the uploaded poster as the primary source image.",
    section("Strict Preservation Rules", [
      "Preserve all original text content, typography, text placement, spacing, and layout hierarchy.",
      "Preserve every person's original position, scale, pose, and overlap relationship.",
      "Preserve the vehicle's original position, size, angle, body color, lighting direction, and relationship to the layout.",
      "Preserve the overall poster composition. Do not redesign the poster.",
      "Do not invent new headline copy, change original copy, or move major layout elements."
    ]),
    section("Only Allowed Localization Changes", [
      "Change all people into Nigerian / West African Black people.",
      "People must not show a clear, identifiable front-facing face. Use side angles, partial face visibility, turned heads, or natural occlusion.",
      "Change only the background/environment so it clearly reflects Nigeria, such as Lagos or Abuja urban details, Nigerian roads, local architecture, tropical plants, market/street/event atmosphere, or subtle Nigerian cultural cues.",
      "Keep the changes realistic and advertising-ready."
    ]),
    section("Logo Replacement", [
      "Replace the original logo in the uploaded poster with the attached logo from the logo library.",
      "Keep the logo in the same general logo area unless the source layout makes a slight adjustment necessary.",
      getBrandLogoPromptInstruction(settings.brand)
    ]),
    section("Compliance", [
      COMPLIANCE_RULE
    ]),
    section("Task Settings", [
      `Brand: ${settings.brand}`,
      `Poster ratio: ${settings.posterRatio}`,
      settings.extraInstruction ? `Extra instruction: ${settings.extraInstruction}` : undefined
    ]),
    "Return one localized poster image that still looks like the same poster, with only the allowed localization changes applied."
  ].join("\n\n");
}

function generateCreatePrompt(request: GenerationRequest) {
  const settings = request.settings as CreateNewSettings;
  const copyLines =
    settings.copyMode === "User Provided"
      ? [
          settings.mainHeadline ? `Main headline: ${settings.mainHeadline}` : undefined,
          settings.subheadline ? `Subheadline: ${settings.subheadline}` : undefined,
          settings.cta ? `CTA: ${settings.cta}` : undefined
        ]
      : [
          "Copy mode: Auto Generate. Create concise English poster copy suitable for Carloha's Nigerian automotive audience."
        ];

  return [
    "Create a new premium automotive poster for Carloha's Nigerian market.",
    section("Mandatory Compliance Rule", [COMPLIANCE_RULE]),
    section("Required Logo Asset", [getBrandLogoPromptInstruction(settings.brand)]),
    section("Creative Brief", [
      `Brand: ${settings.brand}`,
      `Vehicle model: ${settings.vehicleModel || "Use the selected campaign vehicle"}`,
      `Poster goal: ${settings.posterGoal}`,
      `Poster ratio: ${settings.posterRatio}`,
      `Copy mode: ${settings.copyMode}`,
      ...copyLines,
      settings.extraDescription ? `Extra description: ${settings.extraDescription}` : undefined,
      settings.extraInstruction ? `Extra instruction: ${settings.extraInstruction}` : undefined
    ]),
    section("Design Direction", [
      "Use a clean poster composition with strong vehicle presence, clear hierarchy, tasteful Nigerian lifestyle cues, and a production-ready advertising finish.",
      "When reference images are attached, use them as visual inputs, not as optional inspiration.",
      "Keep logos and text areas clean, organized, and editable-looking for final designer adjustment."
    ]),
    "Return one polished poster concept ready for designer review."
  ].join("\n\n");
}

export function generatePromptForRequest(request: GenerationRequest) {
  return request.workflowType === "localize_existing"
    ? generateLocalizePrompt(request)
    : generateCreatePrompt(request);
}

export const manualChatGPTProvider: GenerationProvider = {
  id: "manual_chatgpt_web",
  label: "Manual ChatGPT Web",
  mode: "manual",
  enabled: true,
  async generate(request) {
    const prompt = generatePromptForRequest(request);

    return {
      provider: "manual_chatgpt_web",
      mode: "manual",
      prompt,
      taskDraft: {
        userId: request.userId,
        workflowType: request.workflowType,
        generationMode: "manual",
        generationProvider: "manual_chatgpt_web",
        status: "prompt_ready",
        uploadedOriginalPoster: request.originalPoster ?? null,
        uploadedFaceReferenceImages: request.faceReferences,
        uploadedAdditionalReferenceImages: request.additionalReferences,
        formSettings: request.settings,
        finalPrompt: prompt,
        manuallyUploadedGeneratedImages: [],
        selectedImageId: null,
        modelName: null,
        qualityLevel: null,
        estimatedCost: null,
        apiResponse: null,
        generatedImages: []
      }
    };
  }
};
