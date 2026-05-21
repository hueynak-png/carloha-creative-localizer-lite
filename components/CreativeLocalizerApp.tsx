"use client";

import {
  Archive,
  BadgeCheck,
  Boxes,
  ChevronRight,
  Clipboard,
  Copy,
  Download,
  FileImage,
  Gauge,
  History,
  ImagePlus,
  LayoutDashboard,
  Lock,
  MessageSquareText,
  Pencil,
  RefreshCcw,
  Settings,
  Sparkles,
  Upload,
  Users,
  WandSparkles
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { getBrandLogoAssets, type BrandLogoAsset } from "@/lib/brandAssets";
import {
  BRANDS,
  CLOTHING_STYLES,
  COMPLIANCE_RULE,
  COPY_MODES,
  FACE_REFERENCE_NOTICE,
  FACE_REFERENCE_USAGE,
  LOCALIZATION_LEVEL_OPTIONS,
  PEOPLE_MODES,
  POSTER_GOALS,
  POSTER_RATIOS,
  SCENE_TEMPLATES,
  TEXT_HANDLING_MODE_OPTIONS
} from "@/lib/constants";
import { generationProviders, getActiveGenerationProvider } from "@/lib/generationProvider";
import {
  getOptionLabel,
  getText,
  getWorkflowLabel,
  languageLabels,
  type Language,
  type TextKey
} from "@/lib/i18n";
import type {
  Brand,
  ClothingStyle,
  CopyMode,
  FaceReferenceUsage,
  LocalizationTask,
  LocalizeExistingSettings,
  LocalizationLevel,
  PeopleMode,
  PosterGoal,
  PosterRatio,
  TextHandlingMode,
  UploadedAsset,
  WorkflowType,
  CreateNewSettings
} from "@/lib/types";

type ViewKey =
  | "dashboard"
  | "localize"
  | "create"
  | "history"
  | "templates"
  | "assets"
  | "admin"
  | "result";

const currentUser = {
  id: "demo-admin",
  name: "Carloha Design Admin",
  role: "admin" as const
};

const navItems: Array<{ key: ViewKey; labelKey: TextKey; icon: typeof LayoutDashboard }> = [
  { key: "dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { key: "localize", labelKey: "localizeExistingPoster", icon: FileImage },
  { key: "create", labelKey: "createNewPoster", icon: WandSparkles },
  { key: "history", labelKey: "history", icon: History },
  { key: "templates", labelKey: "templates", icon: Clipboard },
  { key: "assets", labelKey: "assets", icon: Boxes },
  { key: "admin", labelKey: "adminSettings", icon: Settings }
];

const initialLocalizeSettings: LocalizeExistingSettings = {
  brand: "Chery",
  vehicleModel: "",
  sceneTemplate: "Urban Commute",
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

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-graphite">{label}</span>
      {children}
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  disabledOptions = [],
  language
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  disabledOptions?: readonly T[];
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
          <option key={option} value={option} disabled={disabledOptions.includes(option)}>
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
  placeholder,
  rows = 4
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <Field label={label}>
      <textarea
        rows={rows}
        className="focus-ring w-full resize-none rounded-md border border-black/10 bg-white px-3 py-3 text-sm leading-6"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function UploadBox({
  title,
  description,
  maxFiles,
  files,
  onFiles,
  notice,
  language
}: {
  title: string;
  description: string;
  maxFiles: number;
  files: UploadedAsset[];
  onFiles: (files: UploadedAsset[]) => void;
  notice?: string;
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
        "focus-ring rounded-lg border border-dashed p-4 transition",
        isDragging
          ? "border-carloha-red bg-carloha-sky shadow-soft"
          : "border-black/20 bg-white/70"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-carloha-sky p-2 text-carloha-red">
          <Upload size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink">{title}</div>
          <p className="mt-1 text-xs leading-5 text-graphite/70">{description}</p>
          <p className="mt-2 rounded-md bg-white px-3 py-2 text-xs leading-5 text-graphite/70">
            {isDragging ? t("uploadActiveHint") : t("uploadInteractionHint")}
          </p>
          {notice ? (
            <p className="mt-2 rounded-md bg-carloha-gold/10 px-3 py-2 text-xs leading-5 text-graphite">
              {notice}
            </p>
          ) : null}
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

function PrimaryButton({
  children,
  icon: Icon,
  onClick,
  type = "button"
}: {
  children: React.ReactNode;
  icon?: typeof Sparkles;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-md bg-carloha-red px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#981925]"
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

function LanguageToggle({
  language,
  onLanguageChange
}: {
  language: Language;
  onLanguageChange: (language: Language) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-black/10 bg-white p-1" aria-label="Language selector">
      {(["en", "zh"] as Language[]).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onLanguageChange(item)}
          aria-label={`Switch to ${item === "en" ? "English" : "Chinese"}`}
          aria-pressed={language === item}
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

export function CreativeLocalizerApp() {
  const [language, setLanguage] = useState<Language>("en");
  const [view, setView] = useState<ViewKey>("dashboard");
  const [tasks, setTasks] = useState<LocalizationTask[]>([]);
  const [activeTask, setActiveTask] = useState<LocalizationTask | null>(null);
  const [localizeSettings, setLocalizeSettings] =
    useState<LocalizeExistingSettings>(initialLocalizeSettings);
  const [createSettings, setCreateSettings] =
    useState<CreateNewSettings>(initialCreateSettings);
  const [originalPoster, setOriginalPoster] = useState<UploadedAsset[]>([]);
  const [faceReferences, setFaceReferences] = useState<UploadedAsset[]>([]);
  const [additionalReferences, setAdditionalReferences] = useState<UploadedAsset[]>([]);
  const [manualResults, setManualResults] = useState<UploadedAsset[]>([]);

  const visibleTasks = useMemo(() => {
    if (currentUser.role === "admin") return tasks;
    return tasks.filter((task) => task.userId === currentUser.id);
  }, [tasks]);
  const t = (key: TextKey) => getText(language, key);

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
    const result = await provider.generate({
      workflowType,
      userId: currentUser.id,
      settings: workflowType === "localize_existing" ? localizeSettings : createSettings,
      originalPoster: originalPoster[0] ?? null,
      faceReferences,
      additionalReferences
    });
    const now = new Date().toISOString();
    const task: LocalizationTask = {
      id: `task-${Date.now()}`,
      ...result.taskDraft,
      createdAt: now,
      updatedAt: now
    };
    setTasks((items) => [task, ...items]);
    setActiveTask(task);
    setManualResults([]);
    setView("result");
  }

  function updateActiveTask(nextTask: LocalizationTask) {
    setActiveTask(nextTask);
    setTasks((items) => items.map((task) => (task.id === nextTask.id ? nextTask : task)));
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#fff7f0_0%,#f7f3ea_48%,#fff1e8_100%)]">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-72 border-r border-black/10 bg-white/80 px-4 py-5 backdrop-blur lg:block">
        <div className="flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-md bg-white">
            <Image src="/logo.png" alt="Carloha Creative Localizer Lite logo" width={88} height={32} className="h-auto w-20" priority />
          </div>
          <div>
            <div className="text-sm font-bold text-ink">{t("brandLineOne")}</div>
            <div className="text-xs text-graphite/70">{t("brandLineTwo")}</div>
          </div>
        </div>
        <nav className="mt-8 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={cn(
                  "focus-ring flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition",
                  view === item.key
                    ? "bg-ink text-white"
                    : "text-graphite hover:bg-linen hover:text-ink"
                )}
              >
                <Icon size={17} />
                {t(item.labelKey)}
              </button>
            );
          })}
        </nav>
        <div className="absolute bottom-5 left-4 right-4 rounded-lg border border-black/10 bg-linen p-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BadgeCheck size={16} className="text-carloha-red" />
            {t("manualV1")}
          </div>
          <p className="mt-1 text-xs leading-5 text-graphite/70">
            {t("manualV1Desc")}
          </p>
        </div>
      </aside>

      <main className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-black/10 bg-linen/85 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-ink">{t("appTitle")}</h1>
              <p className="text-sm text-graphite/70">{t("appSubtitle")}</p>
            </div>
            <div className="flex items-center gap-3">
              <LanguageToggle language={language} onLanguageChange={changeLanguage} />
              <div className="hidden items-center gap-3 rounded-md border border-black/10 bg-white px-3 py-2 text-sm md:flex">
              <Users size={16} className="text-carloha-red" />
              <span>{currentUser.name}</span>
              <span className="rounded bg-carloha-gold/15 px-2 py-1 text-xs font-semibold uppercase text-graphite">
                {getOptionLabel(language, currentUser.role === "admin" ? "Admin" : "User")}
              </span>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-6">
          {view === "dashboard" ? (
            <Dashboard tasks={visibleTasks} setView={setView} language={language} />
          ) : null}
          {view === "localize" ? (
            <LocalizeForm
              language={language}
              settings={localizeSettings}
              setSettings={setLocalizeSettings}
              originalPoster={originalPoster}
              setOriginalPoster={setOriginalPoster}
              faceReferences={faceReferences}
              setFaceReferences={setFaceReferences}
              additionalReferences={additionalReferences}
              setAdditionalReferences={setAdditionalReferences}
              onGenerate={() => createTask("localize_existing")}
            />
          ) : null}
          {view === "create" ? (
            <CreatePosterForm
              language={language}
              settings={createSettings}
              setSettings={setCreateSettings}
              faceReferences={faceReferences}
              setFaceReferences={setFaceReferences}
              additionalReferences={additionalReferences}
              setAdditionalReferences={setAdditionalReferences}
              onGenerate={() => createTask("create_new")}
            />
          ) : null}
          {view === "result" && activeTask ? (
            <ResultPage
              language={language}
              task={activeTask}
              manualResults={manualResults}
              setManualResults={setManualResults}
              onTaskChange={updateActiveTask}
              onRegenerate={() => createTask(activeTask.workflowType)}
            />
          ) : null}
          {view === "history" ? (
            <HistoryPage language={language} tasks={visibleTasks} onOpen={(task) => { setActiveTask(task); setView("result"); }} />
          ) : null}
          {view === "templates" ? <TemplatesPage language={language} /> : null}
          {view === "assets" ? <AssetsPage language={language} /> : null}
          {view === "admin" ? <AdminSettings language={language} /> : null}
        </div>
      </main>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
  action
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-black/10 bg-white/82 p-5 shadow-soft">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-graphite/70">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Dashboard({
  tasks,
  setView,
  language
}: {
  tasks: LocalizationTask[];
  setView: (view: ViewKey) => void;
  language: Language;
}) {
  const t = (key: TextKey) => getText(language, key);
  const selectedCount = tasks.filter((task) => task.status === "selected").length;
  const stats: Array<[string, number, typeof LayoutDashboard]> = [
    [t("totalTasks"), tasks.length, LayoutDashboard],
    [t("manualPrompts"), tasks.filter((task) => task.generationMode === "manual").length, MessageSquareText],
    [t("selectedResults"), selectedCount, BadgeCheck]
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map(([label, value, Icon]) => (
          <div key={String(label)} className="rounded-lg border border-black/10 bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-graphite/70">{String(label)}</span>
              <Icon size={18} className="text-carloha-red" />
            </div>
            <div className="mt-3 text-3xl font-bold text-ink">{String(value)}</div>
          </div>
        ))}
      </div>
      <Panel title={t("startWorkflow")} description={t("startWorkflowDesc")}>
        <div className="grid gap-4 md:grid-cols-2">
          <button onClick={() => setView("localize")} className="focus-ring rounded-lg border border-black/10 bg-linen p-5 text-left transition hover:border-carloha-red/40">
            <FileImage className="text-carloha-red" size={24} />
            <h3 className="mt-4 font-bold text-ink">{t("localizeExistingPoster")}</h3>
            <p className="mt-2 text-sm leading-6 text-graphite/70">{t("localizeCardDesc")}</p>
          </button>
          <button onClick={() => setView("create")} className="focus-ring rounded-lg border border-black/10 bg-linen p-5 text-left transition hover:border-carloha-red/40">
            <WandSparkles className="text-carloha-red" size={24} />
            <h3 className="mt-4 font-bold text-ink">{t("createNewPoster")}</h3>
            <p className="mt-2 text-sm leading-6 text-graphite/70">{t("createCardDesc")}</p>
          </button>
        </div>
      </Panel>
    </div>
  );
}

function LocalizeForm({
  language,
  settings,
  setSettings,
  originalPoster,
  setOriginalPoster,
  faceReferences,
  setFaceReferences,
  additionalReferences,
  setAdditionalReferences,
  onGenerate
}: {
  language: Language;
  settings: LocalizeExistingSettings;
  setSettings: (settings: LocalizeExistingSettings) => void;
  originalPoster: UploadedAsset[];
  setOriginalPoster: (assets: UploadedAsset[]) => void;
  faceReferences: UploadedAsset[];
  setFaceReferences: (assets: UploadedAsset[]) => void;
  additionalReferences: UploadedAsset[];
  setAdditionalReferences: (assets: UploadedAsset[]) => void;
  onGenerate: () => void;
}) {
  const t = (key: TextKey) => getText(language, key);
  return (
    <Panel
      title={t("localizeExistingPoster")}
      description={t("localizeDesc")}
      action={<PrimaryButton icon={Sparkles} onClick={onGenerate}>{t("generatePrompt")}</PrimaryButton>}
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField language={language} label={t("brand")} value={settings.brand} options={BRANDS} onChange={(brand: Brand) => setSettings({ ...settings, brand })} />
          <TextInput label={t("vehicleModel")} value={settings.vehicleModel} onChange={(vehicleModel) => setSettings({ ...settings, vehicleModel })} placeholder="e.g. Tiggo 8 Pro Max" />
          <SelectField language={language} label={t("sceneTemplate")} value={settings.sceneTemplate} options={SCENE_TEMPLATES} onChange={(sceneTemplate) => setSettings({ ...settings, sceneTemplate })} />
          <SelectField language={language} label={t("localizationLevel")} value={settings.localizationLevel} options={LOCALIZATION_LEVEL_OPTIONS} onChange={(localizationLevel: LocalizationLevel) => setSettings({ ...settings, localizationLevel })} />
          <SelectField language={language} label={t("clothingStyle")} value={settings.clothingStyle} options={CLOTHING_STYLES} onChange={(clothingStyle: ClothingStyle) => setSettings({ ...settings, clothingStyle })} />
          <SelectField language={language} label={t("posterRatio")} value={settings.posterRatio} options={POSTER_RATIOS} onChange={(posterRatio: PosterRatio) => setSettings({ ...settings, posterRatio })} />
          <SelectField language={language} label={t("textHandlingMode")} value={settings.textHandlingMode} options={TEXT_HANDLING_MODE_OPTIONS} onChange={(textHandlingMode: TextHandlingMode) => setSettings({ ...settings, textHandlingMode })} />
          <SelectField language={language} label={t("faceReferenceUsage")} value={settings.faceReferenceUsage} options={FACE_REFERENCE_USAGE} onChange={(faceReferenceUsage: FaceReferenceUsage) => setSettings({ ...settings, faceReferenceUsage })} />
          <div className="md:col-span-2">
            <TextArea label={t("extraInstruction")} value={settings.extraInstruction ?? ""} onChange={(extraInstruction) => setSettings({ ...settings, extraInstruction })} placeholder={t("anyNigerianDirection")} />
          </div>
        </div>
        <div className="space-y-4">
          <UploadBox language={language} title={t("originalPosterImage")} description={t("originalPosterDesc")} maxFiles={1} files={originalPoster} onFiles={(files) => setOriginalPoster(files.map((file) => ({ ...file, type: "original" })))} />
          <UploadBox language={language} title={t("faceReferenceImages")} description={t("faceReferenceDesc")} maxFiles={2} files={faceReferences} onFiles={(files) => setFaceReferences(files.map((file) => ({ ...file, type: "face" })))} notice={FACE_REFERENCE_NOTICE} />
          <UploadBox language={language} title={t("additionalReferenceImages")} description={t("additionalReferenceDesc")} maxFiles={2} files={additionalReferences} onFiles={setAdditionalReferences} />
        </div>
      </div>
    </Panel>
  );
}

function CreatePosterForm({
  language,
  settings,
  setSettings,
  faceReferences,
  setFaceReferences,
  additionalReferences,
  setAdditionalReferences,
  onGenerate
}: {
  language: Language;
  settings: CreateNewSettings;
  setSettings: (settings: CreateNewSettings) => void;
  faceReferences: UploadedAsset[];
  setFaceReferences: (assets: UploadedAsset[]) => void;
  additionalReferences: UploadedAsset[];
  setAdditionalReferences: (assets: UploadedAsset[]) => void;
  onGenerate: () => void;
}) {
  const t = (key: TextKey) => getText(language, key);
  return (
    <Panel
      title={t("createNewPoster")}
      description={t("createDesc")}
      action={<PrimaryButton icon={Sparkles} onClick={onGenerate}>{t("generatePrompt")}</PrimaryButton>}
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField language={language} label={t("brand")} value={settings.brand} options={BRANDS} onChange={(brand: Brand) => setSettings({ ...settings, brand })} />
          <TextInput label={t("vehicleModel")} value={settings.vehicleModel} onChange={(vehicleModel) => setSettings({ ...settings, vehicleModel })} placeholder="e.g. Tiggo 9 PHEV" />
          <SelectField language={language} label={t("posterGoal")} value={settings.posterGoal} options={POSTER_GOALS} onChange={(posterGoal: PosterGoal) => setSettings({ ...settings, posterGoal })} />
          <SelectField language={language} label={t("sceneTemplate")} value={settings.sceneTemplate} options={SCENE_TEMPLATES} onChange={(sceneTemplate) => setSettings({ ...settings, sceneTemplate })} />
          <SelectField language={language} label={t("localizationLevel")} value={settings.localizationLevel} options={LOCALIZATION_LEVEL_OPTIONS} onChange={(localizationLevel: LocalizationLevel) => setSettings({ ...settings, localizationLevel })} />
          <SelectField language={language} label={t("peopleMode")} value={settings.peopleMode} options={PEOPLE_MODES} onChange={(peopleMode: PeopleMode) => setSettings({ ...settings, peopleMode })} />
          <SelectField language={language} label={t("clothingStyle")} value={settings.clothingStyle} options={CLOTHING_STYLES} onChange={(clothingStyle: ClothingStyle) => setSettings({ ...settings, clothingStyle })} />
          <SelectField language={language} label={t("posterRatio")} value={settings.posterRatio} options={POSTER_RATIOS} onChange={(posterRatio: PosterRatio) => setSettings({ ...settings, posterRatio })} />
          <SelectField language={language} label={t("copyMode")} value={settings.copyMode} options={COPY_MODES} onChange={(copyMode: CopyMode) => setSettings({ ...settings, copyMode })} />
          <TextInput label={t("mainHeadline")} value={settings.mainHeadline ?? ""} onChange={(mainHeadline) => setSettings({ ...settings, mainHeadline })} />
          <TextInput label={t("subheadline")} value={settings.subheadline ?? ""} onChange={(subheadline) => setSettings({ ...settings, subheadline })} />
          <TextInput label={t("cta")} value={settings.cta ?? ""} onChange={(cta) => setSettings({ ...settings, cta })} />
          <div className="md:col-span-2">
            <TextArea label={t("extraDescription")} value={settings.extraDescription ?? ""} onChange={(extraDescription) => setSettings({ ...settings, extraDescription })} placeholder={t("optionalCreativeDirection")} />
          </div>
          <div className="md:col-span-2">
            <TextArea label={t("extraInstruction")} value={settings.extraInstruction ?? ""} onChange={(extraInstruction) => setSettings({ ...settings, extraInstruction })} />
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-black/10 bg-carloha-gold/10 p-4 text-sm leading-6 text-graphite">
            <div className="mb-1 flex items-center gap-2 font-semibold text-ink">
              <Lock size={16} />
              {t("complianceRuleTitle")}
            </div>
            {COMPLIANCE_RULE}
          </div>
          <UploadBox language={language} title={t("faceReferenceImages")} description={t("faceReferenceDesc")} maxFiles={2} files={faceReferences} onFiles={(files) => setFaceReferences(files.map((file) => ({ ...file, type: "face" })))} notice={FACE_REFERENCE_NOTICE} />
          <UploadBox language={language} title={t("additionalReferenceImages")} description={t("additionalReferenceDesc")} maxFiles={2} files={additionalReferences} onFiles={setAdditionalReferences} />
        </div>
      </div>
    </Panel>
  );
}

function ResultPage({
  language,
  task,
  manualResults,
  setManualResults,
  onTaskChange,
  onRegenerate
}: {
  language: Language;
  task: LocalizationTask;
  manualResults: UploadedAsset[];
  setManualResults: (assets: UploadedAsset[]) => void;
  onTaskChange: (task: LocalizationTask) => void;
  onRegenerate: () => void;
}) {
  const [prompt, setPrompt] = useState(task.finalPrompt);
  const [copied, setCopied] = useState(false);
  const [copiedLogoId, setCopiedLogoId] = useState<string | null>(null);
  const [copiedLogoLinkId, setCopiedLogoLinkId] = useState<string | null>(null);
  const t = (key: TextKey) => getText(language, key);
  const brandLogoAssets = "brand" in task.formSettings ? getBrandLogoAssets(task.formSettings.brand) : [];
  const allAssets = [
    task.uploadedOriginalPoster,
    ...task.uploadedFaceReferenceImages,
    ...task.uploadedAdditionalReferenceImages
  ].filter(Boolean) as UploadedAsset[];

  function syncResults(files: UploadedAsset[]) {
    const mapped = files.map((file) => ({ ...file, type: "manual_result" as const }));
    setManualResults(mapped);
    onTaskChange({
      ...task,
      status: mapped.length ? "result_uploaded" : task.status,
      manuallyUploadedGeneratedImages: mapped,
      updatedAt: new Date().toISOString()
    });
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function getLogoAssetUrl(asset: BrandLogoAsset) {
    return `${globalThis.location.origin}${asset.publicPath}`;
  }

  async function copyLogoImage(asset: BrandLogoAsset) {
    const response = await fetch(asset.publicPath);
    const blob = await response.blob();
    if ("ClipboardItem" in window) {
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      setCopiedLogoId(asset.id);
      globalThis.setTimeout(() => setCopiedLogoId(null), 1400);
      return;
    }
    await navigator.clipboard.writeText(getLogoAssetUrl(asset));
    setCopiedLogoLinkId(asset.id);
    globalThis.setTimeout(() => setCopiedLogoLinkId(null), 1400);
  }

  async function copyLogoLink(asset: BrandLogoAsset) {
    await navigator.clipboard.writeText(getLogoAssetUrl(asset));
    setCopiedLogoLinkId(asset.id);
    globalThis.setTimeout(() => setCopiedLogoLinkId(null), 1400);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Panel
        title={t("finalPrompt")}
        description={t("finalPromptDesc")}
        action={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton icon={Copy} onClick={copyPrompt}>{copied ? t("copied") : t("copyPrompt")}</SecondaryButton>
            <SecondaryButton icon={ChevronRight} onClick={() => window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer")}>{t("openChatGPT")}</SecondaryButton>
          </div>
        }
      >
        <textarea
          className="focus-ring min-h-[520px] w-full resize-y rounded-md border border-black/10 bg-[#fffdf8] p-4 font-mono text-sm leading-6 text-ink"
          value={prompt}
          onChange={(event) => {
            setPrompt(event.target.value);
            onTaskChange({ ...task, finalPrompt: event.target.value, updatedAt: new Date().toISOString() });
          }}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <SecondaryButton icon={Pencil}>{t("editPrompt")}</SecondaryButton>
          <SecondaryButton icon={RefreshCcw} onClick={onRegenerate}>{t("regeneratePrompt")}</SecondaryButton>
        </div>
      </Panel>
      <div className="space-y-6">
        <Panel title={t("manualResultUpload")} description={t("manualResultUploadDesc")}>
          <UploadBox language={language} title={t("generatedResultImages")} description={t("generatedResultDesc")} maxFiles={8} files={manualResults.length ? manualResults : task.manuallyUploadedGeneratedImages} onFiles={syncResults} />
          <div className="mt-4 grid gap-3">
            {(manualResults.length ? manualResults : task.manuallyUploadedGeneratedImages).map((asset) => (
              <div key={asset.id} className="flex items-center justify-between rounded-md border border-black/10 bg-linen p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{asset.name}</div>
                  <div className="text-xs text-graphite/60">{task.selectedImageId === asset.id ? t("selectedResult") : t("uploadedResult")}</div>
                </div>
                <SecondaryButton
                  icon={BadgeCheck}
                  onClick={() =>
                    onTaskChange({
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
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <SecondaryButton icon={Download}>{t("downloadArchivedResult")}</SecondaryButton>
          </div>
        </Panel>
        <Panel title={t("brandLogoAssets")} description={t("brandLogoAssetsDesc")}>
          {brandLogoAssets.length ? (
            <div className="grid gap-3">
              {brandLogoAssets.map((asset) => (
                <div key={asset.id} className="rounded-lg border border-black/10 bg-white p-3">
                  <div className={cn("grid min-h-24 place-items-center rounded-md border border-black/10 p-4", asset.previewClassName)}>
                    <Image
                      src={asset.publicPath}
                      alt={asset.label}
                      width={420}
                      height={120}
                      className="max-h-20 w-auto max-w-full object-contain"
                    />
                  </div>
                  <div className="mt-3">
                    <div className="text-sm font-semibold text-ink">{asset.label}</div>
                    <p className="mt-1 text-xs leading-5 text-graphite/70">{asset.copyGuidance}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <SecondaryButton icon={Copy} onClick={() => copyLogoImage(asset)}>
                      {copiedLogoId === asset.id ? t("logoCopied") : t("copyLogoImage")}
                    </SecondaryButton>
                    <SecondaryButton icon={Clipboard} onClick={() => copyLogoLink(asset)}>
                      {copiedLogoLinkId === asset.id ? t("logoLinkCopied") : t("copyLogoLink")}
                    </SecondaryButton>
                    <SecondaryButton icon={ChevronRight} onClick={() => window.open(asset.publicPath, "_blank", "noopener,noreferrer")}>
                      {t("openLogo")}
                    </SecondaryButton>
                    <a
                      className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-3 text-sm font-medium text-ink transition hover:bg-linen"
                      href={asset.publicPath}
                      download={asset.fileName}
                    >
                      <Download size={16} />
                      {t("downloadLogo")}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-graphite/70">{t("noBrandLogoAsset")}</p>
          )}
        </Panel>
        <Panel title={t("taskSettings")}>
          <div className="grid gap-2 text-sm">
            <InfoRow label={t("workflow")} value={getWorkflowLabel(language, task.workflowType)} />
            <InfoRow label={t("generationMode")} value={getOptionLabel(language, task.generationMode)} />
            <InfoRow label={t("generationProvider")} value={getOptionLabel(language, "Manual ChatGPT Web")} />
            <InfoRow label={t("status")} value={getOptionLabel(language, task.status)} />
            {Object.entries(task.formSettings).map(([key, value]) => (
              <InfoRow key={key} label={key.replace(/([A-Z])/g, " $1")} value={getOptionLabel(language, String(value || "-"))} />
            ))}
          </div>
        </Panel>
        <Panel title={t("uploadedAssets")}>
          {allAssets.length ? (
            <div className="grid gap-2">
              {allAssets.map((asset) => (
                <div key={asset.id} className="flex items-center gap-3 rounded-md bg-linen p-3 text-sm">
                  <ImagePlus size={16} className="text-carloha-leaf" />
                  <span className="min-w-0 flex-1 truncate">{asset.name}</span>
                  <span className="text-xs uppercase text-graphite/60">{asset.type}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-graphite/70">{t("noUploadedAssets")}</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3 rounded-md bg-linen px-3 py-2">
      <span className="text-xs font-semibold uppercase text-graphite/60">{label}</span>
      <span className="min-w-0 break-words text-ink">{value}</span>
    </div>
  );
}

function HistoryPage({
  language,
  tasks,
  onOpen
}: {
  language: Language;
  tasks: LocalizationTask[];
  onOpen: (task: LocalizationTask) => void;
}) {
  const t = (key: TextKey) => getText(language, key);
  return (
    <Panel title={t("history")} description={t("historyDesc")}>
      <div className="overflow-hidden rounded-lg border border-black/10">
        <table className="w-full min-w-[760px] border-collapse bg-white text-left text-sm">
          <thead className="bg-ink text-white">
            <tr>
              <th className="px-4 py-3">{t("workflow")}</th>
              <th className="px-4 py-3">{t("provider")}</th>
              <th className="px-4 py-3">{t("status")}</th>
              <th className="px-4 py-3">{t("brand")}</th>
              <th className="px-4 py-3">{t("updated")}</th>
              <th className="px-4 py-3">{t("action")}</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length ? tasks.map((task) => (
              <tr key={task.id} className="border-t border-black/10">
                <td className="px-4 py-3">{getWorkflowLabel(language, task.workflowType)}</td>
                <td className="px-4 py-3">{getOptionLabel(language, "Manual ChatGPT Web")}</td>
                <td className="px-4 py-3">{getOptionLabel(language, task.status)}</td>
                <td className="px-4 py-3">{"brand" in task.formSettings ? getOptionLabel(language, task.formSettings.brand) : "-"}</td>
                <td className="px-4 py-3">{new Date(task.updatedAt).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <SecondaryButton icon={ChevronRight} onClick={() => onOpen(task)}>{t("open")}</SecondaryButton>
                </td>
              </tr>
            )) : (
              <tr>
                <td className="px-4 py-8 text-center text-graphite/60" colSpan={6}>{t("noTaskHistory")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function TemplatesPage({ language }: { language: Language }) {
  const t = (key: TextKey) => getText(language, key);
  return (
    <Panel title={t("templates")} description={t("templatesDesc")}>
      <div className="grid gap-3 md:grid-cols-3">
        {SCENE_TEMPLATES.map((template) => (
          <div key={template} className="rounded-lg border border-black/10 bg-linen p-4">
            <div className="font-semibold text-ink">{getOptionLabel(language, template)}</div>
            <p className="mt-2 text-sm leading-6 text-graphite/70">{t("templateDefaultDesc")}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AssetsPage({ language }: { language: Language }) {
  const t = (key: TextKey) => getText(language, key);
  const presets =
    language === "zh"
      ? ["Logo 组合", "展厅背景", "车辆抠图", "活动纹理", "活动参考"]
      : ["Logo lockups", "Showroom backgrounds", "Vehicle cutouts", "Campaign textures", "Event references"];
  return (
    <Panel title={t("presetAssets")} description={t("presetAssetsDesc")}>
      <div className="grid gap-3 md:grid-cols-5">
        {presets.map((preset) => (
          <div key={preset} className="rounded-lg border border-black/10 bg-white p-4">
            <Archive className="text-carloha-red" size={20} />
            <div className="mt-3 text-sm font-semibold">{preset}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AdminSettings({ language }: { language: Language }) {
  const t = (key: TextKey) => getText(language, key);
  return (
    <div className="space-y-6">
      <Panel title={t("generationProviderSetting")} description={t("generationProviderDesc")}>
        <div className="grid gap-3 md:grid-cols-2">
          {generationProviders.map((provider) => (
            <label
              key={provider.id}
              className={cn(
                "rounded-lg border p-4",
                provider.enabled ? "border-carloha-leaf bg-white" : "border-black/10 bg-linen opacity-70"
              )}
            >
              <div className="flex items-start gap-3">
                <input type="radio" checked={provider.id === "manual_chatgpt_web"} disabled={!provider.enabled} readOnly className="mt-1" />
                <div>
                  <div className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    {getOptionLabel(language, provider.label)}
                    {!provider.enabled ? <span className="rounded bg-black/10 px-2 py-1 text-xs">{t("disabled")}</span> : null}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-graphite/70">
                    {provider.helperText ? getOptionLabel(language, provider.helperText) : t("defaultOnlyProvider")}
                  </p>
                </div>
              </div>
            </label>
          ))}
        </div>
      </Panel>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={t("userManagement")} description={t("userManagementDesc")}>
          <div className="grid gap-3 text-sm">
            {["admin@carloha.local", "designer@carloha.local", "reviewer@carloha.local"].map((email, index) => (
              <InfoRow key={email} label={getOptionLabel(language, index === 0 ? "Admin" : "User")} value={email} />
            ))}
          </div>
        </Panel>
        <Panel title={t("systemPrompts")} description={t("systemPromptsDesc")}>
          <div className="rounded-md bg-linen p-4 text-sm leading-6">
            <div className="font-semibold text-ink">{t("defaultComplianceRule")}</div>
            <p className="mt-2 text-graphite/80">{COMPLIANCE_RULE}</p>
          </div>
        </Panel>
        <Panel title={t("presetAssetsManagement")} description={t("presetAssetsManagementDesc")}>
          <div className="rounded-md border border-dashed border-black/20 bg-white p-5 text-sm text-graphite/70">
            {t("storageBucketPlanned")} <span className="font-semibold text-ink">preset-assets</span>
          </div>
        </Panel>
        <Panel title={t("databaseReadiness")} description={t("databaseReadinessDesc")}>
          <div className="grid gap-2">
            {["generation_mode", "generation_provider", "model_name", "quality_level", "estimated_cost", "api_response", "generated_images"].map((field) => (
              <InfoRow key={field} label={t("field")} value={field} />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
