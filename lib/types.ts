export type UserRole = "admin" | "user";

export type WorkflowType = "localize_existing" | "create_new";
export type GenerationMode = "manual" | "api";
export type GenerationProviderId = "manual_chatgpt_web" | "openai_api";
export type TaskStatus = "draft" | "prompt_ready" | "result_uploaded" | "selected";

export type Brand = "Chery" | "Carloha" | "Tiggo" | "Used Cars";
export type LocalizationLevel = "Low" | "Medium" | "High";
export type ClothingStyle =
  | "Casual"
  | "Business"
  | "Traditional Nigerian"
  | "Sales Uniform"
  | "Family Style";
export type PosterRatio = "9:16" | "16:9" | "3:4" | "1:1";
export type TextHandlingMode = "Fast Mode" | "Precise Text Mode";
export type FaceReferenceUsage = "No face reference" | "Use uploaded face reference";
export type PosterGoal =
  | "Launch"
  | "Promo"
  | "Feature Highlight"
  | "Lifestyle"
  | "Brand Awareness";
export type PeopleMode =
  | "No People"
  | "People Without Clear Face"
  | "Use Uploaded Face Reference";
export type CopyMode = "User Provided" | "Auto Generate";

export type UploadedAsset = {
  id: string;
  name: string;
  type: "original" | "face" | "reference" | "manual_result" | "preset";
  url?: string;
  size?: number;
};

export type BaseTaskSettings = {
  brand: Brand;
  vehicleModel: string;
  sceneTemplate: string;
  localizationLevel: LocalizationLevel;
  clothingStyle: ClothingStyle;
  posterRatio: PosterRatio;
  extraInstruction?: string;
};

export type LocalizeExistingSettings = BaseTaskSettings & {
  textHandlingMode: TextHandlingMode;
  faceReferenceUsage: FaceReferenceUsage;
};

export type CreateNewSettings = BaseTaskSettings & {
  posterGoal: PosterGoal;
  peopleMode: PeopleMode;
  copyMode: CopyMode;
  mainHeadline?: string;
  subheadline?: string;
  cta?: string;
  extraDescription?: string;
};

export type TaskSettings = LocalizeExistingSettings | CreateNewSettings;

export type LocalizationTask = {
  id: string;
  userId: string;
  workflowType: WorkflowType;
  generationMode: GenerationMode;
  generationProvider: GenerationProviderId;
  status: TaskStatus;
  uploadedOriginalPoster?: UploadedAsset | null;
  uploadedFaceReferenceImages: UploadedAsset[];
  uploadedAdditionalReferenceImages: UploadedAsset[];
  formSettings: TaskSettings;
  finalPrompt: string;
  manuallyUploadedGeneratedImages: UploadedAsset[];
  selectedImageId?: string | null;
  modelName?: string | null;
  qualityLevel?: string | null;
  estimatedCost?: number | null;
  apiResponse?: unknown | null;
  generatedImages: UploadedAsset[];
  createdAt: string;
  updatedAt: string;
};

export type GenerationRequest = {
  workflowType: WorkflowType;
  userId: string;
  settings: TaskSettings;
  originalPoster?: UploadedAsset | null;
  faceReferences: UploadedAsset[];
  additionalReferences: UploadedAsset[];
};

export type GenerationResult = {
  provider: GenerationProviderId;
  mode: GenerationMode;
  prompt: string;
  taskDraft: Omit<LocalizationTask, "id" | "createdAt" | "updatedAt">;
};

export type GenerationProvider = {
  id: GenerationProviderId;
  label: string;
  mode: GenerationMode;
  enabled: boolean;
  helperText?: string;
  generate(request: GenerationRequest): Promise<GenerationResult>;
};
