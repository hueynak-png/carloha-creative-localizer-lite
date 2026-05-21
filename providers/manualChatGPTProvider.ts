import {
  COMPLIANCE_RULE,
  LOCALIZATION_LEVELS,
  TEXT_HANDLING_MODES
} from "@/lib/constants";
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
  const referenceLine = request.faceReferences.length
    ? "Authorized face reference images are uploaded. Use them only to guide approved face identity where appropriate."
    : "No authorized face reference image is uploaded.";

  return [
    "Create a localized poster variation for Carloha's Nigerian market using the uploaded original poster as the primary source.",
    section("Core Preservation Rules", [
      `Preserve the exact vehicle model: ${settings.vehicleModel || "the uploaded vehicle"}.`,
      "Preserve the vehicle body color, vehicle angle, logo position, original copy, main composition, and layout hierarchy.",
      "Keep the brand presentation premium, clean, and suitable for internal automotive campaign design.",
      COMPLIANCE_RULE
    ]),
    section("Required Logo Asset", [getBrandLogoPromptInstruction(settings.brand)]),
    section("Allowed Localization Changes", [
      "You may change the background to a Nigerian setting.",
      "You may replace all people with Nigerian / West African Black people.",
      "You may reduce the number of people if needed.",
      "You may change people placement, poses, and overlap if it improves the design."
    ]),
    section("Task Settings", [
      `Brand: ${settings.brand}`,
      `Vehicle model: ${settings.vehicleModel || "Use uploaded reference"}`,
      `Scene template: ${settings.sceneTemplate}`,
      `Localization level: ${settings.localizationLevel} - ${LOCALIZATION_LEVELS[settings.localizationLevel]}`,
      `Clothing style: ${settings.clothingStyle}`,
      `Poster ratio: ${settings.posterRatio}`,
      `Text handling mode: ${settings.textHandlingMode} - ${TEXT_HANDLING_MODES[settings.textHandlingMode]}`,
      `Face reference usage: ${settings.faceReferenceUsage}`,
      referenceLine,
      settings.extraInstruction ? `Extra instruction: ${settings.extraInstruction}` : undefined
    ]),
    "Return one polished poster design ready for designer review."
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
      `Scene template: ${settings.sceneTemplate}`,
      `Localization level: ${settings.localizationLevel} - ${LOCALIZATION_LEVELS[settings.localizationLevel]}`,
      `People mode: ${settings.peopleMode}`,
      `Clothing style: ${settings.clothingStyle}`,
      `Poster ratio: ${settings.posterRatio}`,
      `Copy mode: ${settings.copyMode}`,
      ...copyLines,
      settings.extraDescription ? `Extra description: ${settings.extraDescription}` : undefined,
      settings.extraInstruction ? `Extra instruction: ${settings.extraInstruction}` : undefined
    ]),
    section("Design Direction", [
      "Use a clean poster composition with strong vehicle presence, clear hierarchy, tasteful Nigerian lifestyle cues, and a production-ready advertising finish.",
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
