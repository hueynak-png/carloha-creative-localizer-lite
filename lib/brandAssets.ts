import type { Brand } from "@/lib/types";

export type BrandLogoAsset = {
  id: string;
  label: string;
  fileName: string;
  publicPath: string;
  copyGuidance: string;
  previewClassName: string;
};

const cheryLogo: BrandLogoAsset = {
  id: "chery-logo",
  label: "Chery Logo",
  fileName: "chery-logo.png",
  publicPath: "/brand-assets/chery-logo.png",
  copyGuidance:
    "For Chery brand posters, the final image must use the provided Chery logo asset. Do not replace it with a generic or recreated logo.",
  previewClassName: "bg-ink"
};

const carlohaCareLogo: BrandLogoAsset = {
  id: "carloha-care-logo",
  label: "Carloha Care Logo",
  fileName: "carloha-care-logo.jpg",
  publicPath: "/brand-assets/carloha-care-logo.jpg",
  copyGuidance:
    "For Carloha or Used Cars posters, use the provided Carloha Care orange logo. The logo may be recolored to white when the poster design requires a light logo on a dark background.",
  previewClassName: "bg-white"
};

export function getBrandLogoAssets(brand: Brand): BrandLogoAsset[] {
  if (brand === "Chery") return [cheryLogo];
  if (brand === "Carloha" || brand === "Used Cars") return [carlohaCareLogo];
  return [];
}

export function getBrandLogoPromptInstruction(brand: Brand) {
  const assets = getBrandLogoAssets(brand);
  if (!assets.length) {
    return "No dedicated logo asset is attached for this brand. Keep brand marks clean and editable-looking.";
  }

  return assets
    .map((asset) => `${asset.copyGuidance} Logo file to use: ${asset.fileName}.`)
    .join("\n");
}
