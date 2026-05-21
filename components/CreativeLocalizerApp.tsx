"use client";

import {
  BadgeCheck,
  ChevronLeft,
  Copy,
  Download,
  FileImage,
  Home,
  ImagePlus,
  Loader2,
  RefreshCcw,
  Sparkles,
  Upload,
  WandSparkles
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { getBrandLogoAssets, type BrandLogoAsset } from "@/lib/brandAssets";
import { BRANDS, POSTER_GOALS, POSTER_RATIOS } from "@/lib/constants";
import { getActiveGenerationProvider } from "@/lib/generationProvider";
import {
  getOptionLabel,
  getText,
  languageLabels,
  type Language,
  type TextKey
} from "@/lib/i18n";
import { isOpenAIImageProviderEnabled } from "@/providers/openAIImageProvider";
import type {
  Brand,
  CreateNewSettings,
  LocalizationTask,
  LocalizeExistingSettings,
  PosterGoal,
  PosterRatio,
  UploadedAsset,
  WorkflowType
} from "@/lib/types";

type ViewKey = "home" | "localize" | "create" | "result";

const currentUser = {
  id: "demo-admin",
  name: "Carloha Design Admin"
};

const initialLocalizeSettings: LocalizeExistingSettings = {
  brand: "Chery",
  vehicleModel: "",
  sceneTemplate: "Nigerian background localization",
  localizationLevel: "Medium",
  clothingStyle: "Business",
  posterRatio: "9:16",
  textHandlingMode: "Precise Text Mode",
  faceReferenceUsage: "No face reference",
  extraInstruction: ""
};

const initialCreateSettings: CreateNewSettings = {
  brand: "Carloha",
  vehicleModel: "",
  sceneTemplate: "Premium Vehicle Hero Poster",
  localizationLevel: "Medium",
  clothingStyle: "Business",
  posterRatio: "9:16",
  posterGoal: "Promo",
  peopleMode: "People Without Clear Face",
  copyMode: "User Provided",
  mainHeadline: "",
  subheadline: "",
  cta: "",
  extraDescription: "",
  extraInstruction: ""
};

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function makeAssets(files: FileList | File[] | null, type: UploadedAsset["type"], limit: number) {
  return Array.from(files ?? [])
    .filter((file) => file.type.startsWith("image/"))
    .slice(0, limit)
    .map((file) => ({
      id: `${type}-${file.name}-${file.lastModified}`,
      name: file.name,
      type,
      size: file.size,
      url: URL.createObjectURL(file)
    }));
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-ink">{label}</span>
      {children}
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  language
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  language: Language;
}) {
  return (
    <Field label={label}>
      <select
        className="focus-ring h-11 w-full rounded-md border border-black/10 bg-white px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {getOptionLabel(language, option)}
          </option>
        ))}
      </select>
    </Field>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <input
        className="focus-ring h-11 w-full rounded-md border border-black/10 bg-white px-3 text-sm"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <textarea
        rows={4}
        className="focus-ring w-full resize-none rounded-md border border-black/10 bg-white px-3 py-3 text-sm leading-6"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function PrimaryButton({
  children,
  icon: Icon,
  onClick,
  disabled
}: {
  children: React.ReactNode;
  icon?: typeof Sparkles;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-md bg-carloha-red px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#d95718] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {Icon ? <Icon size={17} /> : null}
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  icon: Icon,
  onClick,
  disabled
}: {
  children: React.ReactNode;
  icon?: typeof Copy;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-3 text-sm font-medium text-ink transition hover:bg-linen disabled:cursor-not-allowed disabled:opacity-45"
    >
      {Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
}

function UploadBox({
  title,
  description,
  files,
  maxFiles,
  onFiles,
  language
}: {
  title: string;
  description: string;
  files: UploadedAsset[];
  maxFiles: number;
  onFiles: (files: UploadedAsset[]) => void;
  language: Language;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const t = (key: TextKey) => getText(language, key);

  function addFiles(fileList: FileList | File[] | null) {
    const slotsAvailable = Math.max(maxFiles - files.length, 0);
    const newAssets = makeAssets(fileList, "reference", maxFiles === 1 ? 1 : slotsAvailable);
    if (!newAssets.length) return;
    onFiles(maxFiles === 1 ? newAssets : [...files, ...newAssets].slice(0, maxFiles));
  }

  function getClipboardImageFiles(event: React.ClipboardEvent<HTMLDivElement>) {
    const pastedFiles = Array.from(event.clipboardData.files).filter((file) =>
      file.type.startsWith("image/")
    );
    if (pastedFiles.length) return pastedFiles;

    return Array.from(event.clipboardData.items)
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        addFiles(event.dataTransfer.files);
      }}
      onPaste={(event) => {
        const pastedImages = getClipboardImageFiles(event);
        if (!pastedImages.length) return;
        event.preventDefault();
        addFiles(pastedImages);
      }}
      className={cn(
        "focus-ring rounded-lg border border-dashed p-5 transition",
        isDragging ? "border-carloha-red bg-carloha-sky shadow-soft" : "border-black/20 bg-white"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-carloha-sky p-2 text-carloha-red">
          <Upload size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink">{title}</div>
          <p className="mt-1 text-xs leading-5 text-graphite/70">{description}</p>
          <p className="mt-2 rounded-md bg-linen px-3 py-2 text-xs leading-5 text-graphite/70">
            {isDragging ? t("uploadActiveHint") : t("uploadInteractionHint")}
          </p>
          <input
            type="file"
            accept="image/*"
            multiple={maxFiles > 1}
            className="mt-3 block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-2 file:text-xs file:font-medium file:text-white"
            onChange={(event) => {
              addFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />
          {files.length ? (
            <div className="mt-3 grid gap-2">
              {files.map((file) => (
                <div key={file.id} className="flex items-center justify-between rounded-md bg-linen px-3 py-2 text-xs">
                  <span className="truncate">{file.name}</span>
                  <span className="text-graphite/60">{file.size ? `${Math.ceil(file.size / 1024)} KB` : "Asset"}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LanguageToggle({
  language,
  onLanguageChange
}: {
  language: Language;
  onLanguageChange: (language: Language) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-black/10 bg-white p-1">
      {(["en", "zh"] as Language[]).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onLanguageChange(item)}
          className={cn(
            "focus-ring h-8 rounded px-3 text-xs font-semibold",
            language === item ? "bg-carloha-red text-white" : "text-graphite hover:bg-linen"
          )}
        >
          {languageLabels[item]}
        </button>
      ))}
    </div>
  );
}

function PageShell({
  language,
  onLanguageChange,
  children,
  onHome
}: {
  language: Language;
  onLanguageChange: (language: Language) => void;
  children: React.ReactNode;
  onHome: () => void;
}) {
  const t = (key: TextKey) => getText(language, key);

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#fff7f0_0%,#f7f3ea_52%,#fff1e8_100%)]">
      <header className="border-b border-black/10 bg-linen/90 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <button type="button" onClick={onHome} className="focus-ring flex items-center gap-3 rounded-md px-2 py-1 text-left">
            <Image src="/logo.png" alt="Carloha" width={92} height={34} className="h-auto w-20" priority />
            <div>
              <h1 className="text-lg font-bold text-ink">{t("appTitle")}</h1>
              <p className="hidden text-xs text-graphite/70 sm:block">{t("appSubtitle")}</p>
            </div>
          </button>
          <div className="flex items-center gap-3">
            <LanguageToggle language={language} onLanguageChange={onLanguageChange} />
            <div className="hidden rounded-md border border-black/10 bg-white px-3 py-2 text-sm md:block">
              {currentUser.name}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-7">{children}</main>
    </div>
  );
}

function LogoPicker({
  brand,
  language
}: {
  brand: Brand;
  language: Language;
}) {
  const assets = getBrandLogoAssets(brand);
  const emptyText =
    language === "zh"
      ? "当前品牌暂无专用 logo，生成时会保留清晰可编辑的品牌标识区域。"
      : "No dedicated logo for this brand. The generation will preserve a clean editable brand mark area.";

  return (
    <section className="rounded-lg border border-black/10 bg-white p-5">
      <h3 className="font-bold text-ink">{language === "zh" ? "Logo 库" : "Logo Library"}</h3>
      <p className="mt-1 text-sm leading-6 text-graphite/70">
        {language === "zh"
          ? "根据品牌自动选择 logo，并在生成时替换原图中的 logo。"
          : "The logo is selected by brand and sent to the image API as a required reference."}
      </p>
      {assets.length ? (
        <div className="mt-4 grid gap-3">
          {assets.map((asset) => (
            <div key={asset.id} className="rounded-lg border border-carloha-red/30 bg-carloha-red/5 p-3">
              <div className={cn("grid min-h-24 place-items-center rounded-md border border-black/10 p-4", asset.previewClassName)}>
                <Image
                  src={asset.publicPath}
                  alt={asset.label}
                  width={420}
                  height={120}
                  className="max-h-20 w-auto max-w-full object-contain"
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-graphite/70">{asset.copyGuidance}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-md bg-linen p-3 text-sm text-graphite/70">{emptyText}</p>
      )}
    </section>
  );
}

function HomeView({
  language,
  onOpen
}: {
  language: Language;
  onOpen: (view: ViewKey) => void;
}) {
  const t = (key: TextKey) => getText(language, key);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-black/10 bg-white/85 p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-ink">{t("appTitle")}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-graphite/70">
              {language === "zh"
                ? "一个更轻量的内部工具：选择任务，上传素材，直接生成。"
                : "A lighter internal tool: choose a task, upload assets, and generate directly."}
            </p>
          </div>
          <div className="rounded-full bg-carloha-red/10 px-3 py-1 text-xs font-semibold text-carloha-red">
            {isOpenAIImageProviderEnabled() ? "API Mode" : "Manual Mode"}
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onOpen("localize")}
          className="focus-ring rounded-xl border border-black/10 bg-white p-6 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-carloha-red/40"
        >
          <FileImage className="text-carloha-red" size={28} />
          <h3 className="mt-4 text-xl font-bold text-ink">{t("localizeExistingPoster")}</h3>
          <p className="mt-2 text-sm leading-6 text-graphite/70">
            {language === "zh"
              ? "上传现有海报，只本地化人物和背景，保留文字编排、人物位置、车辆位置，并用 logo 库替换原 logo。"
              : "Upload an existing poster, localize only people and background, preserve layout and vehicle placement, and replace the logo from the logo library."}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onOpen("create")}
          className="focus-ring rounded-xl border border-black/10 bg-white p-6 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-carloha-red/40"
        >
          <WandSparkles className="text-carloha-red" size={28} />
          <h3 className="mt-4 text-xl font-bold text-ink">{t("createNewPoster")}</h3>
          <p className="mt-2 text-sm leading-6 text-graphite/70">
            {language === "zh"
              ? "用少量选项快速生成新海报：品牌、目标、比例和核心文案。"
              : "Generate a new poster with fewer options: brand, goal, ratio, and core copy."}
          </p>
        </button>
      </div>
    </div>
  );
}

export function CreativeLocalizerApp() {
  const [language, setLanguage] = useState<Language>("en");
  const [view, setView] = useState<ViewKey>("home");
  const [task, setTask] = useState<LocalizationTask | null>(null);
  const [localizeSettings, setLocalizeSettings] =
    useState<LocalizeExistingSettings>(initialLocalizeSettings);
  const [createSettings, setCreateSettings] = useState<CreateNewSettings>(initialCreateSettings);
  const [originalPoster, setOriginalPoster] = useState<UploadedAsset[]>([]);
  const [referenceImages, setReferenceImages] = useState<UploadedAsset[]>([]);

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem("carloha-localizer-language");
    if (savedLanguage === "en" || savedLanguage === "zh") {
      setLanguage(savedLanguage);
    }
  }, []);

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    window.localStorage.setItem("carloha-localizer-language", nextLanguage);
  }

  async function createTask(workflowType: WorkflowType) {
    const provider = getActiveGenerationProvider();
    const settings = workflowType === "localize_existing" ? localizeSettings : createSettings;
    const result = await provider.generate({
      workflowType,
      userId: currentUser.id,
      settings,
      originalPoster: originalPoster[0] ?? null,
      faceReferences: [],
      additionalReferences: referenceImages
    });
    const now = new Date().toISOString();
    setTask({
      id: `task-${Date.now()}`,
      ...result.taskDraft,
      createdAt: now,
      updatedAt: now
    });
    setView("result");
  }

  return (
    <PageShell language={language} onLanguageChange={changeLanguage} onHome={() => setView("home")}>
      {view === "home" ? <HomeView language={language} onOpen={setView} /> : null}
      {view === "localize" ? (
        <LocalizeView
          language={language}
          settings={localizeSettings}
          setSettings={setLocalizeSettings}
          originalPoster={originalPoster}
          setOriginalPoster={setOriginalPoster}
          referenceImages={referenceImages}
          setReferenceImages={setReferenceImages}
          onGenerate={() => createTask("localize_existing")}
          onBack={() => setView("home")}
        />
      ) : null}
      {view === "create" ? (
        <CreateView
          language={language}
          settings={createSettings}
          setSettings={setCreateSettings}
          referenceImages={referenceImages}
          setReferenceImages={setReferenceImages}
          onGenerate={() => createTask("create_new")}
          onBack={() => setView("home")}
        />
      ) : null}
      {view === "result" && task ? (
        <ResultView
          language={language}
          task={task}
          setTask={setTask}
          referenceImages={referenceImages}
          onBack={() => setView(task.workflowType === "localize_existing" ? "localize" : "create")}
        />
      ) : null}
    </PageShell>
  );
}

function LocalizeView({
  language,
  settings,
  setSettings,
  originalPoster,
  setOriginalPoster,
  referenceImages,
  setReferenceImages,
  onGenerate,
  onBack
}: {
  language: Language;
  settings: LocalizeExistingSettings;
  setSettings: (settings: LocalizeExistingSettings) => void;
  originalPoster: UploadedAsset[];
  setOriginalPoster: (assets: UploadedAsset[]) => void;
  referenceImages: UploadedAsset[];
  setReferenceImages: (assets: UploadedAsset[]) => void;
  onGenerate: () => void;
  onBack: () => void;
}) {
  const t = (key: TextKey) => getText(language, key);

  return (
    <div className="space-y-5">
      <SecondaryButton icon={ChevronLeft} onClick={onBack}>
        {language === "zh" ? "返回首页" : "Back home"}
      </SecondaryButton>
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-black/10 bg-white p-6 shadow-soft">
          <h2 className="text-xl font-bold text-ink">{t("localizeExistingPoster")}</h2>
          <p className="mt-2 text-sm leading-6 text-graphite/70">
            {language === "zh"
              ? "统一规则：保留所有文字编排、人物位置和车辆位置；仅把人物改为黑人、不展示清晰正脸，并把背景改成能体现尼日利亚特色。"
              : "Single rule: preserve all typography, people placement, and vehicle placement; only change people to Black people without clear front-facing faces, and localize the background to Nigeria."}
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <SelectField
              language={language}
              label={t("brand")}
              value={settings.brand}
              options={BRANDS}
              onChange={(brand: Brand) => setSettings({ ...settings, brand })}
            />
            <SelectField
              language={language}
              label={t("posterRatio")}
              value={settings.posterRatio}
              options={POSTER_RATIOS}
              onChange={(posterRatio: PosterRatio) => setSettings({ ...settings, posterRatio })}
            />
            <div className="md:col-span-2">
              <TextArea
                label={t("extraInstruction")}
                value={settings.extraInstruction ?? ""}
                onChange={(extraInstruction) => setSettings({ ...settings, extraInstruction })}
                placeholder={language === "zh" ? "可选：补充希望保留或避免的细节。" : "Optional: add details to preserve or avoid."}
              />
            </div>
          </div>
          <div className="mt-5 grid gap-4">
            <UploadBox
              language={language}
              title={t("originalPosterImage")}
              description={language === "zh" ? "上传 1 张需要本地化的原始海报。" : "Upload one poster to localize."}
              maxFiles={1}
              files={originalPoster}
              onFiles={(files) => setOriginalPoster(files.map((file) => ({ ...file, type: "original" })))}
            />
            <UploadBox
              language={language}
              title={t("additionalReferenceImages")}
              description={language === "zh" ? "可选：上传最多 2 张风格或场景参考图。" : "Optional: upload up to 2 style or scene references."}
              maxFiles={2}
              files={referenceImages}
              onFiles={setReferenceImages}
            />
          </div>
          <div className="mt-5">
            <PrimaryButton icon={Sparkles} onClick={onGenerate} disabled={!originalPoster.length}>
              {isOpenAIImageProviderEnabled()
                ? language === "zh"
                  ? "开始本地化"
                  : "Start localization"
                : t("generatePrompt")}
            </PrimaryButton>
          </div>
        </section>
        <LogoPicker brand={settings.brand} language={language} />
      </div>
    </div>
  );
}

function CreateView({
  language,
  settings,
  setSettings,
  referenceImages,
  setReferenceImages,
  onGenerate,
  onBack
}: {
  language: Language;
  settings: CreateNewSettings;
  setSettings: (settings: CreateNewSettings) => void;
  referenceImages: UploadedAsset[];
  setReferenceImages: (assets: UploadedAsset[]) => void;
  onGenerate: () => void;
  onBack: () => void;
}) {
  const t = (key: TextKey) => getText(language, key);

  return (
    <div className="space-y-5">
      <SecondaryButton icon={ChevronLeft} onClick={onBack}>
        {language === "zh" ? "返回首页" : "Back home"}
      </SecondaryButton>
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-black/10 bg-white p-6 shadow-soft">
          <h2 className="text-xl font-bold text-ink">{t("createNewPoster")}</h2>
          <p className="mt-2 text-sm leading-6 text-graphite/70">
            {language === "zh"
              ? "只保留必要选项，快速生成一张尼日利亚市场汽车海报。"
              : "Only the essential options for quickly generating a Nigerian-market automotive poster."}
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <SelectField
              language={language}
              label={t("brand")}
              value={settings.brand}
              options={BRANDS}
              onChange={(brand: Brand) => setSettings({ ...settings, brand })}
            />
            <SelectField
              language={language}
              label={t("posterGoal")}
              value={settings.posterGoal}
              options={POSTER_GOALS}
              onChange={(posterGoal: PosterGoal) => setSettings({ ...settings, posterGoal })}
            />
            <SelectField
              language={language}
              label={t("posterRatio")}
              value={settings.posterRatio}
              options={POSTER_RATIOS}
              onChange={(posterRatio: PosterRatio) => setSettings({ ...settings, posterRatio })}
            />
            <TextInput
              label={t("vehicleModel")}
              value={settings.vehicleModel}
              onChange={(vehicleModel) => setSettings({ ...settings, vehicleModel })}
              placeholder="e.g. Tiggo 8 Pro"
            />
            <TextInput
              label={t("mainHeadline")}
              value={settings.mainHeadline ?? ""}
              onChange={(mainHeadline) => setSettings({ ...settings, mainHeadline })}
            />
            <TextInput
              label={t("subheadline")}
              value={settings.subheadline ?? ""}
              onChange={(subheadline) => setSettings({ ...settings, subheadline })}
            />
            <div className="md:col-span-2">
              <TextArea
                label={t("extraDescription")}
                value={settings.extraDescription ?? ""}
                onChange={(extraDescription) => setSettings({ ...settings, extraDescription })}
                placeholder={language === "zh" ? "可选：描述背景、场景或希望出现的元素。" : "Optional: describe scene, background, or key elements."}
              />
            </div>
          </div>
          <div className="mt-5">
            <UploadBox
              language={language}
              title={t("additionalReferenceImages")}
              description={language === "zh" ? "可选：上传最多 2 张风格、车辆或场景参考。" : "Optional: upload up to 2 style, vehicle, or scene references."}
              maxFiles={2}
              files={referenceImages}
              onFiles={setReferenceImages}
            />
          </div>
          <div className="mt-5">
            <PrimaryButton icon={WandSparkles} onClick={onGenerate}>
              {isOpenAIImageProviderEnabled()
                ? language === "zh"
                  ? "生成海报"
                  : "Generate poster"
                : t("generatePrompt")}
            </PrimaryButton>
          </div>
        </section>
        <LogoPicker brand={settings.brand} language={language} />
      </div>
    </div>
  );
}

function ResultView({
  language,
  task,
  setTask,
  referenceImages,
  onBack
}: {
  language: Language;
  task: LocalizationTask;
  setTask: (task: LocalizationTask) => void;
  referenceImages: UploadedAsset[];
  onBack: () => void;
}) {
  const t = (key: TextKey) => getText(language, key);
  const [prompt, setPrompt] = useState(task.finalPrompt);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const logoAssets = "brand" in task.formSettings ? getBrandLogoAssets(task.formSettings.brand) : [];

  async function compressImageBlob(blob: Blob, fileName: string, maxSide = 1600) {
    if (!blob.type.startsWith("image/") || blob.type === "image/svg+xml") {
      return blob;
    }

    const imageUrl = URL.createObjectURL(blob);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = imageUrl;
      });
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      if (scale >= 1 && blob.size <= 1_500_000) {
        return blob;
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return blob;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const compressedBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.88);
      });

      return compressedBlob ?? blob;
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  }

  async function appendImageReference(
    formData: FormData,
    manifest: Array<{ label: string; role: string; fileName: string }>,
    source: { url?: string; name: string; role: string; label: string; keepOriginal?: boolean }
  ) {
    if (!source.url) return;
    const response = await fetch(source.url);
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return;
    const uploadBlob = source.keepOriginal ? blob : await compressImageBlob(blob, source.name);
    const fallbackExtension = uploadBlob.type.split("/")[1] || "jpg";
    const fileName = source.keepOriginal
      ? source.name
      : source.name.replace(/\.[^.]+$/, "") + `-api-reference.${fallbackExtension}`;
    formData.append("image", uploadBlob, fileName);
    manifest.push({ label: source.label, role: source.role, fileName });
  }

  async function generateImage() {
    setIsGenerating(true);
    setError(null);
    try {
      const formData = new FormData();
      const imageManifest: Array<{ label: string; role: string; fileName: string }> = [];
      formData.append("prompt", prompt);
      formData.append(
        "logoAssets",
        JSON.stringify(
          logoAssets.map((asset) => ({
            label: asset.label,
            publicPath: asset.publicPath,
            copyGuidance: asset.copyGuidance
          }))
        )
      );

      await appendImageReference(formData, imageManifest, {
        url: task.uploadedOriginalPoster?.url,
        name: task.uploadedOriginalPoster?.name ?? "original-poster.png",
        role: "original poster",
        label: "Original poster image"
      });

      for (let index = 0; index < referenceImages.length; index += 1) {
        const asset = referenceImages[index];
        await appendImageReference(formData, imageManifest, {
          url: asset.url,
          name: asset.name,
          role: "additional design reference",
          label: `Additional reference ${index + 1}`
        });
      }

      for (const asset of logoAssets) {
        await appendImageReference(formData, imageManifest, {
        url: asset.publicPath,
        name: asset.fileName,
        role: "required brand logo",
        label: asset.label,
        keepOriginal: true
      });
      }

      formData.append("imageManifest", JSON.stringify(imageManifest));

      const response = await fetch("/api/generate-image", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Image generation failed.");
      }

      const generatedImages: UploadedAsset[] = (data.images ?? []).map(
        (image: { id: string; url: string }, index: number) => ({
          id: image.id,
          name: `generated-${index + 1}.png`,
          type: "api_result",
          url: image.url
        })
      );
      setTask({
        ...task,
        finalPrompt: prompt,
        generationMode: "api",
        generationProvider: "openai_api",
        status: "result_uploaded",
        generatedImages: [...task.generatedImages, ...generatedImages],
        apiResponse: data,
        modelName: data.model ?? task.modelName,
        qualityLevel: data.quality ?? task.qualityLevel,
        updatedAt: new Date().toISOString()
      });
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Image generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="space-y-5">
      <SecondaryButton icon={ChevronLeft} onClick={onBack}>
        {language === "zh" ? "返回修改" : "Back to edit"}
      </SecondaryButton>
      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-xl border border-black/10 bg-white p-6 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-ink">{t("finalPrompt")}</h2>
              <p className="mt-1 text-sm text-graphite/70">
                {language === "zh" ? "可在生成前微调提示词。" : "You can edit the prompt before generation."}
              </p>
            </div>
            <SecondaryButton icon={Copy} onClick={copyPrompt}>
              {copied ? t("copied") : t("copyPrompt")}
            </SecondaryButton>
          </div>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="focus-ring mt-4 min-h-96 w-full resize-y rounded-md border border-black/10 bg-[#fffdf8] p-4 font-mono text-sm leading-6 text-ink"
          />
        </section>

        <section className="rounded-xl border border-black/10 bg-white p-6 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-ink">{t("apiImageGeneration")}</h2>
              <p className="mt-1 text-sm leading-6 text-graphite/70">
                {isOpenAIImageProviderEnabled()
                  ? language === "zh"
                    ? "会把上传图、参考图和 logo 一起发送给图片 API。"
                    : "Uploaded images, references, and logo assets are sent to the image API."
                  : t("apiProviderDisabled")}
              </p>
            </div>
            <PrimaryButton
              icon={isGenerating ? Loader2 : Sparkles}
              onClick={generateImage}
              disabled={!isOpenAIImageProviderEnabled() || isGenerating}
            >
              {isGenerating ? t("generatingImage") : t("generateImage")}
            </PrimaryButton>
          </div>

          {error ? (
            <div className="mt-4 rounded-md border border-carloha-red/30 bg-carloha-red/10 px-3 py-2 text-sm text-ink">
              <span className="font-semibold">{t("generationError")}:</span> {error}
            </div>
          ) : null}

          <div className="mt-4 grid gap-3">
            {task.generatedImages.length ? (
              task.generatedImages.map((asset) => (
                <div key={asset.id} className="rounded-lg border border-black/10 bg-linen p-3">
                  {asset.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.url} alt={asset.name} className="max-h-[520px] w-full rounded-md object-contain" />
                  ) : null}
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-ink">{asset.name}</div>
                      <div className="text-xs text-graphite/60">
                        {task.selectedImageId === asset.id ? t("selectedResult") : t("apiGeneratedResult")}
                      </div>
                    </div>
                    <SecondaryButton
                      icon={BadgeCheck}
                      onClick={() =>
                        setTask({
                          ...task,
                          selectedImageId: asset.id,
                          status: "selected",
                          updatedAt: new Date().toISOString()
                        })
                      }
                    >
                      {t("markAsSelected")}
                    </SecondaryButton>
                  </div>
                  {asset.url ? (
                    <a
                      href={asset.url}
                      download={asset.name}
                      className="focus-ring mt-3 inline-flex h-10 items-center gap-2 rounded-md border border-black/10 bg-white px-3 text-sm font-medium text-ink hover:bg-linen"
                    >
                      <Download size={16} />
                      {t("downloadLogo")}
                    </a>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-black/15 bg-linen text-sm text-graphite/60">
                <div className="text-center">
                  <ImagePlus className="mx-auto mb-2 text-carloha-red" size={28} />
                  {language === "zh" ? "生成结果会显示在这里" : "Generated results will appear here"}
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 rounded-lg border border-black/10 bg-linen p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <RefreshCcw size={16} />
              {language === "zh" ? "随请求发送的参考素材" : "References sent with the request"}
            </div>
            <ul className="mt-2 space-y-1 text-xs text-graphite/70">
              {task.uploadedOriginalPoster ? <li>{task.uploadedOriginalPoster.name}</li> : null}
              {referenceImages.map((asset) => (
                <li key={asset.id}>{asset.name}</li>
              ))}
              {logoAssets.map((asset) => (
                <li key={asset.id}>{asset.fileName}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
