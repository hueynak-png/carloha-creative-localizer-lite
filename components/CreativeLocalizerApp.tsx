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
import { useMemo, useState } from "react";
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

const navItems: Array<{ key: ViewKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "localize", label: "Localize Existing Poster", icon: FileImage },
  { key: "create", label: "Create New Poster", icon: WandSparkles },
  { key: "history", label: "History", icon: History },
  { key: "templates", label: "Templates", icon: Clipboard },
  { key: "assets", label: "Assets", icon: Boxes },
  { key: "admin", label: "Admin Settings", icon: Settings }
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

function makeAssets(files: FileList | null, type: UploadedAsset["type"], limit: number) {
  return Array.from(files ?? [])
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
  disabledOptions = []
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  disabledOptions?: readonly T[];
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
            {option}
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
  notice
}: {
  title: string;
  description: string;
  maxFiles: number;
  files: UploadedAsset[];
  onFiles: (files: UploadedAsset[]) => void;
  notice?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-black/20 bg-white/70 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-carloha-sky p-2 text-carloha-leaf">
          <Upload size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink">{title}</div>
          <p className="mt-1 text-xs leading-5 text-graphite/70">{description}</p>
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
            onChange={(event) => onFiles(makeAssets(event.target.files, "reference", maxFiles))}
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

export function CreativeLocalizerApp() {
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
    <div className="min-h-screen bg-[linear-gradient(135deg,#f8f3ea_0%,#eef5ef_48%,#f7f0e5_100%)]">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-72 border-r border-black/10 bg-white/80 px-4 py-5 backdrop-blur lg:block">
        <div className="flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-ink text-white">
            <Sparkles size={19} />
          </div>
          <div>
            <div className="text-sm font-bold text-ink">Carloha Creative</div>
            <div className="text-xs text-graphite/70">Localizer Lite</div>
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
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="absolute bottom-5 left-4 right-4 rounded-lg border border-black/10 bg-linen p-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BadgeCheck size={16} className="text-carloha-leaf" />
            Manual v1
          </div>
          <p className="mt-1 text-xs leading-5 text-graphite/70">
            No image API is called. Designers copy prompts and upload results manually.
          </p>
        </div>
      </aside>

      <main className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-black/10 bg-linen/85 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-ink">Carloha Creative Localizer Lite</h1>
              <p className="text-sm text-graphite/70">Internal poster localization workflow for the design team</p>
            </div>
            <div className="hidden items-center gap-3 rounded-md border border-black/10 bg-white px-3 py-2 text-sm md:flex">
              <Users size={16} className="text-carloha-leaf" />
              <span>{currentUser.name}</span>
              <span className="rounded bg-carloha-gold/15 px-2 py-1 text-xs font-semibold uppercase text-graphite">
                {currentUser.role}
              </span>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-6">
          {view === "dashboard" ? (
            <Dashboard tasks={visibleTasks} setView={setView} />
          ) : null}
          {view === "localize" ? (
            <LocalizeForm
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
              task={activeTask}
              manualResults={manualResults}
              setManualResults={setManualResults}
              onTaskChange={updateActiveTask}
              onRegenerate={() => createTask(activeTask.workflowType)}
            />
          ) : null}
          {view === "history" ? (
            <HistoryPage tasks={visibleTasks} onOpen={(task) => { setActiveTask(task); setView("result"); }} />
          ) : null}
          {view === "templates" ? <TemplatesPage /> : null}
          {view === "assets" ? <AssetsPage /> : null}
          {view === "admin" ? <AdminSettings /> : null}
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

function Dashboard({ tasks, setView }: { tasks: LocalizationTask[]; setView: (view: ViewKey) => void }) {
  const selectedCount = tasks.filter((task) => task.status === "selected").length;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Total tasks", tasks.length, LayoutDashboard],
          ["Manual prompts", tasks.filter((task) => task.generationMode === "manual").length, MessageSquareText],
          ["Selected results", selectedCount, BadgeCheck]
        ].map(([label, value, Icon]) => (
          <div key={String(label)} className="rounded-lg border border-black/10 bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-graphite/70">{String(label)}</span>
              {typeof Icon !== "number" ? <Icon size={18} className="text-carloha-leaf" /> : null}
            </div>
            <div className="mt-3 text-3xl font-bold text-ink">{String(value)}</div>
          </div>
        ))}
      </div>
      <Panel title="Start a workflow" description="Generate a production-ready prompt, then continue manually in ChatGPT.">
        <div className="grid gap-4 md:grid-cols-2">
          <button onClick={() => setView("localize")} className="focus-ring rounded-lg border border-black/10 bg-linen p-5 text-left transition hover:border-carloha-red/40">
            <FileImage className="text-carloha-red" size={24} />
            <h3 className="mt-4 font-bold text-ink">Localize Existing Poster</h3>
            <p className="mt-2 text-sm leading-6 text-graphite/70">Upload a source poster and preserve vehicle, logo, text, composition, and layout hierarchy.</p>
          </button>
          <button onClick={() => setView("create")} className="focus-ring rounded-lg border border-black/10 bg-linen p-5 text-left transition hover:border-carloha-red/40">
            <WandSparkles className="text-carloha-red" size={24} />
            <h3 className="mt-4 font-bold text-ink">Create New Poster</h3>
            <p className="mt-2 text-sm leading-6 text-graphite/70">Build a campaign prompt from brand, goal, scene, copy, people mode, and localization settings.</p>
          </button>
        </div>
      </Panel>
    </div>
  );
}

function LocalizeForm({
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
  return (
    <Panel
      title="Localize Existing Poster"
      description="Use the uploaded source poster as the design anchor, then generate a manual ChatGPT prompt."
      action={<PrimaryButton icon={Sparkles} onClick={onGenerate}>Generate Prompt</PrimaryButton>}
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField label="Brand" value={settings.brand} options={BRANDS} onChange={(brand: Brand) => setSettings({ ...settings, brand })} />
          <TextInput label="Vehicle model" value={settings.vehicleModel} onChange={(vehicleModel) => setSettings({ ...settings, vehicleModel })} placeholder="e.g. Tiggo 8 Pro Max" />
          <SelectField label="Scene template" value={settings.sceneTemplate} options={SCENE_TEMPLATES} onChange={(sceneTemplate) => setSettings({ ...settings, sceneTemplate })} />
          <SelectField label="Localization level" value={settings.localizationLevel} options={LOCALIZATION_LEVEL_OPTIONS} onChange={(localizationLevel: LocalizationLevel) => setSettings({ ...settings, localizationLevel })} />
          <SelectField label="Clothing style" value={settings.clothingStyle} options={CLOTHING_STYLES} onChange={(clothingStyle: ClothingStyle) => setSettings({ ...settings, clothingStyle })} />
          <SelectField label="Poster ratio" value={settings.posterRatio} options={POSTER_RATIOS} onChange={(posterRatio: PosterRatio) => setSettings({ ...settings, posterRatio })} />
          <SelectField label="Text handling mode" value={settings.textHandlingMode} options={TEXT_HANDLING_MODE_OPTIONS} onChange={(textHandlingMode: TextHandlingMode) => setSettings({ ...settings, textHandlingMode })} />
          <SelectField label="Face reference usage" value={settings.faceReferenceUsage} options={FACE_REFERENCE_USAGE} onChange={(faceReferenceUsage: FaceReferenceUsage) => setSettings({ ...settings, faceReferenceUsage })} />
          <div className="md:col-span-2">
            <TextArea label="Extra instruction" value={settings.extraInstruction ?? ""} onChange={(extraInstruction) => setSettings({ ...settings, extraInstruction })} placeholder="Any special Nigerian market or campaign direction." />
          </div>
        </div>
        <div className="space-y-4">
          <UploadBox title="Original poster image" description="Upload one source poster image." maxFiles={1} files={originalPoster} onFiles={(files) => setOriginalPoster(files.map((file) => ({ ...file, type: "original" })))} />
          <UploadBox title="Face reference images" description="Upload up to 2 authorized face references." maxFiles={2} files={faceReferences} onFiles={(files) => setFaceReferences(files.map((file) => ({ ...file, type: "face" })))} notice={FACE_REFERENCE_NOTICE} />
          <UploadBox title="Additional reference images" description="Upload up to 2 extra visual references." maxFiles={2} files={additionalReferences} onFiles={setAdditionalReferences} />
        </div>
      </div>
    </Panel>
  );
}

function CreatePosterForm({
  settings,
  setSettings,
  faceReferences,
  setFaceReferences,
  additionalReferences,
  setAdditionalReferences,
  onGenerate
}: {
  settings: CreateNewSettings;
  setSettings: (settings: CreateNewSettings) => void;
  faceReferences: UploadedAsset[];
  setFaceReferences: (assets: UploadedAsset[]) => void;
  additionalReferences: UploadedAsset[];
  setAdditionalReferences: (assets: UploadedAsset[]) => void;
  onGenerate: () => void;
}) {
  return (
    <Panel
      title="Create New Poster"
      description="Build a fresh poster prompt from a structured creative brief."
      action={<PrimaryButton icon={Sparkles} onClick={onGenerate}>Generate Prompt</PrimaryButton>}
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField label="Brand" value={settings.brand} options={BRANDS} onChange={(brand: Brand) => setSettings({ ...settings, brand })} />
          <TextInput label="Vehicle model" value={settings.vehicleModel} onChange={(vehicleModel) => setSettings({ ...settings, vehicleModel })} placeholder="e.g. Tiggo 9 PHEV" />
          <SelectField label="Poster goal" value={settings.posterGoal} options={POSTER_GOALS} onChange={(posterGoal: PosterGoal) => setSettings({ ...settings, posterGoal })} />
          <SelectField label="Scene template" value={settings.sceneTemplate} options={SCENE_TEMPLATES} onChange={(sceneTemplate) => setSettings({ ...settings, sceneTemplate })} />
          <SelectField label="Localization level" value={settings.localizationLevel} options={LOCALIZATION_LEVEL_OPTIONS} onChange={(localizationLevel: LocalizationLevel) => setSettings({ ...settings, localizationLevel })} />
          <SelectField label="People mode" value={settings.peopleMode} options={PEOPLE_MODES} onChange={(peopleMode: PeopleMode) => setSettings({ ...settings, peopleMode })} />
          <SelectField label="Clothing style" value={settings.clothingStyle} options={CLOTHING_STYLES} onChange={(clothingStyle: ClothingStyle) => setSettings({ ...settings, clothingStyle })} />
          <SelectField label="Poster ratio" value={settings.posterRatio} options={POSTER_RATIOS} onChange={(posterRatio: PosterRatio) => setSettings({ ...settings, posterRatio })} />
          <SelectField label="Copy mode" value={settings.copyMode} options={COPY_MODES} onChange={(copyMode: CopyMode) => setSettings({ ...settings, copyMode })} />
          <TextInput label="Main headline" value={settings.mainHeadline ?? ""} onChange={(mainHeadline) => setSettings({ ...settings, mainHeadline })} />
          <TextInput label="Subheadline" value={settings.subheadline ?? ""} onChange={(subheadline) => setSettings({ ...settings, subheadline })} />
          <TextInput label="CTA" value={settings.cta ?? ""} onChange={(cta) => setSettings({ ...settings, cta })} />
          <div className="md:col-span-2">
            <TextArea label="Extra description" value={settings.extraDescription ?? ""} onChange={(extraDescription) => setSettings({ ...settings, extraDescription })} placeholder="Optional free-text creative direction." />
          </div>
          <div className="md:col-span-2">
            <TextArea label="Extra instruction" value={settings.extraInstruction ?? ""} onChange={(extraInstruction) => setSettings({ ...settings, extraInstruction })} />
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-black/10 bg-carloha-gold/10 p-4 text-sm leading-6 text-graphite">
            <div className="mb-1 flex items-center gap-2 font-semibold text-ink">
              <Lock size={16} />
              Mandatory compliance rule
            </div>
            {COMPLIANCE_RULE}
          </div>
          <UploadBox title="Face reference images" description="Upload up to 2 authorized face references." maxFiles={2} files={faceReferences} onFiles={(files) => setFaceReferences(files.map((file) => ({ ...file, type: "face" })))} notice={FACE_REFERENCE_NOTICE} />
          <UploadBox title="Additional reference images" description="Upload up to 2 extra visual references." maxFiles={2} files={additionalReferences} onFiles={setAdditionalReferences} />
        </div>
      </div>
    </Panel>
  );
}

function ResultPage({
  task,
  manualResults,
  setManualResults,
  onTaskChange,
  onRegenerate
}: {
  task: LocalizationTask;
  manualResults: UploadedAsset[];
  setManualResults: (assets: UploadedAsset[]) => void;
  onTaskChange: (task: LocalizationTask) => void;
  onRegenerate: () => void;
}) {
  const [prompt, setPrompt] = useState(task.finalPrompt);
  const [copied, setCopied] = useState(false);
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

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Panel
        title="Final Prompt"
        description="Copy this into ChatGPT manually. The app does not automate ChatGPT web actions."
        action={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton icon={Copy} onClick={copyPrompt}>{copied ? "Copied" : "Copy Prompt"}</SecondaryButton>
            <SecondaryButton icon={ChevronRight} onClick={() => window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer")}>Open ChatGPT</SecondaryButton>
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
          <SecondaryButton icon={Pencil}>Edit prompt</SecondaryButton>
          <SecondaryButton icon={RefreshCcw} onClick={onRegenerate}>Regenerate prompt</SecondaryButton>
        </div>
      </Panel>
      <div className="space-y-6">
        <Panel title="Manual Result Upload" description="Upload final images generated outside this app.">
          <UploadBox title="Generated result images" description="Upload one or more final outputs from ChatGPT." maxFiles={8} files={manualResults.length ? manualResults : task.manuallyUploadedGeneratedImages} onFiles={syncResults} />
          <div className="mt-4 grid gap-3">
            {(manualResults.length ? manualResults : task.manuallyUploadedGeneratedImages).map((asset) => (
              <div key={asset.id} className="flex items-center justify-between rounded-md border border-black/10 bg-linen p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{asset.name}</div>
                  <div className="text-xs text-graphite/60">{task.selectedImageId === asset.id ? "Selected result" : "Uploaded result"}</div>
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
                  Mark as selected
                </SecondaryButton>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <SecondaryButton icon={Download}>Download archived result</SecondaryButton>
          </div>
        </Panel>
        <Panel title="Task Settings">
          <div className="grid gap-2 text-sm">
            <InfoRow label="Workflow" value={task.workflowType === "localize_existing" ? "Localize Existing Poster" : "Create New Poster"} />
            <InfoRow label="Generation mode" value={task.generationMode} />
            <InfoRow label="Generation provider" value="Manual ChatGPT Web" />
            <InfoRow label="Status" value={task.status} />
            {Object.entries(task.formSettings).map(([key, value]) => (
              <InfoRow key={key} label={key.replace(/([A-Z])/g, " $1")} value={String(value || "-")} />
            ))}
          </div>
        </Panel>
        <Panel title="Uploaded Assets">
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
            <p className="text-sm text-graphite/70">No uploaded assets attached.</p>
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

function HistoryPage({ tasks, onOpen }: { tasks: LocalizationTask[]; onOpen: (task: LocalizationTask) => void }) {
  return (
    <Panel title="History" description="Admins can view all records. Users only see their own records.">
      <div className="overflow-hidden rounded-lg border border-black/10">
        <table className="w-full min-w-[760px] border-collapse bg-white text-left text-sm">
          <thead className="bg-ink text-white">
            <tr>
              <th className="px-4 py-3">Workflow</th>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Brand</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length ? tasks.map((task) => (
              <tr key={task.id} className="border-t border-black/10">
                <td className="px-4 py-3">{task.workflowType === "localize_existing" ? "Localize Existing" : "Create New"}</td>
                <td className="px-4 py-3">Manual ChatGPT Web</td>
                <td className="px-4 py-3">{task.status}</td>
                <td className="px-4 py-3">{"brand" in task.formSettings ? task.formSettings.brand : "-"}</td>
                <td className="px-4 py-3">{new Date(task.updatedAt).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <SecondaryButton icon={ChevronRight} onClick={() => onOpen(task)}>Open</SecondaryButton>
                </td>
              </tr>
            )) : (
              <tr>
                <td className="px-4 py-8 text-center text-graphite/60" colSpan={6}>No task history yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function TemplatesPage() {
  return (
    <Panel title="Templates" description="Default scene templates are editable by admins in the Supabase-backed version.">
      <div className="grid gap-3 md:grid-cols-3">
        {SCENE_TEMPLATES.map((template) => (
          <div key={template} className="rounded-lg border border-black/10 bg-linen p-4">
            <div className="font-semibold text-ink">{template}</div>
            <p className="mt-2 text-sm leading-6 text-graphite/70">Default scene template for prompt construction.</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AssetsPage() {
  const presets = ["Logo lockups", "Showroom backgrounds", "Vehicle cutouts", "Campaign textures", "Event references"];
  return (
    <Panel title="Preset Assets" description="Reserved storage area for approved design assets and reusable references.">
      <div className="grid gap-3 md:grid-cols-5">
        {presets.map((preset) => (
          <div key={preset} className="rounded-lg border border-black/10 bg-white p-4">
            <Archive className="text-carloha-leaf" size={20} />
            <div className="mt-3 text-sm font-semibold">{preset}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AdminSettings() {
  return (
    <div className="space-y-6">
      <Panel title="Generation Provider" description="Version 1 keeps generation manual while reserving the API provider path.">
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
                    {provider.label}
                    {!provider.enabled ? <span className="rounded bg-black/10 px-2 py-1 text-xs">Disabled</span> : null}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-graphite/70">
                    {provider.helperText ?? "Default and only active provider in version 1."}
                  </p>
                </div>
              </div>
            </label>
          ))}
        </div>
      </Panel>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="User Management" description="Admins can create users and assign Admin or User roles once Supabase auth is connected.">
          <div className="grid gap-3 text-sm">
            {["admin@carloha.local", "designer@carloha.local", "reviewer@carloha.local"].map((email, index) => (
              <InfoRow key={email} label={index === 0 ? "Admin" : "User"} value={email} />
            ))}
          </div>
        </Panel>
        <Panel title="System Prompts" description="Manage reusable prompt foundations and localization rules.">
          <div className="rounded-md bg-linen p-4 text-sm leading-6">
            <div className="font-semibold text-ink">Default compliance rule</div>
            <p className="mt-2 text-graphite/80">{COMPLIANCE_RULE}</p>
          </div>
        </Panel>
        <Panel title="Preset Assets Management" description="Upload and approve brand-safe references for internal use.">
          <div className="rounded-md border border-dashed border-black/20 bg-white p-5 text-sm text-graphite/70">
            Supabase Storage bucket planned: <span className="font-semibold text-ink">preset-assets</span>
          </div>
        </Panel>
        <Panel title="Database Readiness" description="The schema includes future API fields while enforcing manual mode in v1.">
          <div className="grid gap-2">
            {["generation_mode", "generation_provider", "model_name", "quality_level", "estimated_cost", "api_response", "generated_images"].map((field) => (
              <InfoRow key={field} label="Field" value={field} />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
