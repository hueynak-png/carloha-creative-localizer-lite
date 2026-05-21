import type {
  Brand,
  ClothingStyle,
  CopyMode,
  FaceReferenceUsage,
  LocalizationLevel,
  PeopleMode,
  PosterGoal,
  PosterRatio,
  TextHandlingMode
} from "@/lib/types";

export const COMPLIANCE_RULE =
  "Unless an authorized face reference is uploaded, all people must appear as Nigerian / West African Black people and must not show a clear, identifiable front-facing face.";

export const FACE_REFERENCE_NOTICE =
  "Please confirm that you have the right to use any uploaded face reference image for advertising purposes.";

export const BRANDS: Brand[] = ["Chery", "Carloha", "Tiggo", "Used Cars"];

export const SCENE_TEMPLATES = [
  "Family Trip",
  "Business Executive",
  "Urban Commute",
  "Showroom Promotion",
  "PHEV Charging",
  "Outdoor Power / Picnic",
  "Construction Site / Durability",
  "Premium Vehicle Hero Poster",
  "Banquet / Event Arrival"
];

export const LOCALIZATION_LEVELS: Record<LocalizationLevel, string> = {
  Low:
    "Light Nigerian localization. Use Nigerian / West African Black people, Nigerian urban atmosphere, local roads, tropical plants, and subtle local details.",
  Medium:
    "Moderate Nigerian localization. Add Lagos / Abuja / Kano style architecture, local street details, Nigerian clothing details, and local lifestyle cues.",
  High:
    "Strong Nigerian localization. Add clearly recognizable Nigerian cultural elements, traditional clothing, event atmosphere, family gathering, market, park, small Nigerian flags, or landmark-inspired backgrounds where appropriate."
};

export const LOCALIZATION_LEVEL_OPTIONS = Object.keys(
  LOCALIZATION_LEVELS
) as LocalizationLevel[];

export const CLOTHING_STYLES: ClothingStyle[] = [
  "Casual",
  "Business",
  "Traditional Nigerian",
  "Sales Uniform",
  "Family Style"
];

export const POSTER_RATIOS: PosterRatio[] = ["9:16", "16:9", "3:4", "1:1"];

export const TEXT_HANDLING_MODES: Record<TextHandlingMode, string> = {
  "Fast Mode":
    "Create a complete poster including image, text, logo, and layout in one generation. Preserve original text as much as possible.",
  "Precise Text Mode":
    "Prioritize visual localization, vehicle accuracy, people replacement, and background redesign. Keep text and logos clean and editable-looking; final text/logo placement may be manually adjusted by the designer."
};

export const TEXT_HANDLING_MODE_OPTIONS = Object.keys(
  TEXT_HANDLING_MODES
) as TextHandlingMode[];

export const FACE_REFERENCE_USAGE: FaceReferenceUsage[] = [
  "No face reference",
  "Use uploaded face reference"
];

export const POSTER_GOALS: PosterGoal[] = [
  "Launch",
  "Promo",
  "Feature Highlight",
  "Lifestyle",
  "Brand Awareness"
];

export const PEOPLE_MODES: PeopleMode[] = [
  "No People",
  "People Without Clear Face",
  "Use Uploaded Face Reference"
];

export const COPY_MODES: CopyMode[] = ["User Provided", "Auto Generate"];
