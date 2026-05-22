import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "node:buffer";

export const runtime = "nodejs";
export const maxDuration = 300;

// --- Simple in-memory rate limiter ---
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // max requests per window per IP
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitMap.set(ip, recent);
    return true;
  }
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return false;
}
// Periodically clean up stale entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  rateLimitMap.forEach((timestamps, ip) => {
    const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) rateLimitMap.delete(ip);
    else rateLimitMap.set(ip, recent);
  });
}, 300_000);

type LogoAssetPayload = {
  label?: string;
  publicPath?: string;
  copyGuidance?: string;
};

type ImageGenerationPayload = {
  prompt?: string;
  logoAssets?: LogoAssetPayload[];
};

type ImageReferenceManifestItem = {
  label?: string;
  role?: string;
  fileName?: string;
};

type ParsedResponseBody = {
  json: unknown | null;
  text: string;
};

type ImageApiEndpoint = "generations" | "edits" | "chat/completions";

type ImageApiAttempt = {
  label: string;
  endpoint: ImageApiEndpoint;
  response: Response;
  parsed: ParsedResponseBody;
  data: unknown;
};

type ImageApiDiagnostics = {
  endpoint: ImageApiEndpoint;
  model: string;
  baseUrlHost: string;
  imageCount: number;
  status?: number;
  upstreamBodyPreview?: string;
  suggestion?: string;
};

function isApiEnabled() {
  return (
    process.env.GENERATION_PROVIDER === "openai_api" ||
    process.env.NEXT_PUBLIC_GENERATION_PROVIDER === "openai_api" ||
    Boolean(process.env.KAOPU_IMAGE_API_KEY || process.env.OPENAI_API_KEY)
  );
}

function getOpenAIImageConfig() {
  const apiKey = process.env.KAOPU_IMAGE_API_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = (
    process.env.KAOPU_IMAGE_BASE_URL ||
    (process.env.KAOPU_IMAGE_API_KEY
      ? "https://image-api.kaopuapi.xyz/v1"
      : process.env.OPENAI_BASE_URL) ||
    "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const size = process.env.OPENAI_IMAGE_SIZE || "1024x1024";
  const quality = process.env.OPENAI_IMAGE_QUALITY || "high";

  return { apiKey, baseUrl, model, size, quality };
}

function getEndpointMode() {
  const mode = process.env.IMAGE_API_ENDPOINT_MODE;
  if (mode === "chat_completions" || mode === "images" || mode === "kaopu_generations") return mode;
  return "auto";
}

function isKaopuImageApi(baseUrl: string) {
  return getBaseUrlHost(baseUrl) === "image-api.kaopuapi.xyz";
}

function getBaseUrlHost(baseUrl: string) {
  try {
    return new URL(baseUrl).host;
  } catch {
    return "invalid-base-url";
  }
}

function isLikelyChatOrCodeModel(model: string) {
  const normalized = model.trim().toLowerCase();
  if (normalized.includes("image")) return false;
  return (
    normalized.includes("codex") ||
    /^gpt-[45]/.test(normalized) ||
    normalized.startsWith("o1") ||
    normalized.startsWith("o3") ||
    normalized.startsWith("o4")
  );
}

function getConfigError(model: string) {
  if (!isLikelyChatOrCodeModel(model)) return null;

  return [
    `OPENAI_IMAGE_MODEL is set to "${model}", which looks like a chat/code model instead of an image model.`,
    "Use an image-capable model such as gpt-image-2, or the exact image model name required by your relay."
  ].join(" ");
}

function isRelayPoolUnavailableMessage(message: string, status?: number) {
  return (
    status === 429 ||
    message.includes("cooling down") ||
    message.includes("provider codex") ||
    message.includes("All credentials")
  );
}

function getErrorMessage(data: unknown, status: number, text = "", model = "") {
  const payload = data as { error?: { message?: string }; message?: string } | null;
  const upstreamMessage =
    payload?.error?.message ??
    payload?.message ??
    text.trim() ??
    `Image generation failed with status ${status}.`;

  if (status === 504) {
    return "Image generation timed out before the upstream API returned a result. Try a smaller image or fewer references.";
  }

  if (
    upstreamMessage.includes("stream error") ||
    upstreamMessage.includes("INTERNAL_ERROR") ||
    upstreamMessage.includes("received from peer")
  ) {
    return "The image API connection was interrupted while uploading or generating. Try again with a smaller image or fewer references.";
  }

  if (isRelayPoolUnavailableMessage(upstreamMessage, status)) {
    const configError = model ? getConfigError(model) : null;
    return configError
      ? `${configError} Upstream returned: ${upstreamMessage}`
      : `The image request was sent with model "${model || "unknown"}", but the relay's internal provider pool is temporarily unavailable. Upstream returned: ${upstreamMessage}`;
  }

  return upstreamMessage;
}

function createDiagnostics({
  endpoint,
  model,
  baseUrl,
  imageCount,
  status,
  text
}: {
  endpoint: ImageApiEndpoint;
  model: string;
  baseUrl: string;
  imageCount: number;
  status?: number;
  text?: string;
}): ImageApiDiagnostics {
  const bodyPreview = text?.trim().slice(0, 600) || undefined;
  const configError = getConfigError(model);
  const relayPoolUnavailable = bodyPreview
    ? isRelayPoolUnavailableMessage(bodyPreview, status)
    : status === 429;

  return {
    endpoint,
    model,
    baseUrlHost: getBaseUrlHost(baseUrl),
    imageCount,
    status,
    upstreamBodyPreview: bodyPreview,
    suggestion:
      configError ??
      (endpoint === "chat/completions"
        ? "This request used /v1/chat/completions because the relay exposes the selected image model as a chat endpoint. Confirm that the relay returns a direct image URL or base64 image in the chat response."
        : undefined) ??
      (endpoint === "generations" && imageCount > 0
        ? "This request used /v1/images/generations with reference images in the JSON image array, which matches the Kaopu gpt-image-2 skill package."
        : undefined) ??
      (relayPoolUnavailable
        ? `The app sent "${model}" to the image API. The relay appears to map it to an internal provider pool that is rate-limited or cooling down. Check the relay's model mapping, provider quota, or try again after the pool recovers.`
        : "If this uses a third-party relay, confirm that the relay supports /v1/images/edits with multipart image uploads.")
  };
}

function buildPrompt({
  prompt,
  logoAssets,
  origin,
  imageManifest
}: {
  prompt: string;
  logoAssets: LogoAssetPayload[];
  origin: string;
  imageManifest: ImageReferenceManifestItem[];
}) {
  const sections = [prompt];

  if (imageManifest.length) {
    const manifestText = imageManifest
      .map((item, index) => {
        const role = item.role ? ` (${item.role})` : "";
        const fileName = item.fileName ? ` File: ${item.fileName}.` : "";
        return `${index + 1}. ${item.label ?? "Reference image"}${role}.${fileName}`;
      })
      .join("\n");

    sections.push(
      [
        "## Required Use Of Attached Reference Images",
        "The attached images are not optional style suggestions. Use them as visual references in the final image.",
        "Use the uploaded poster/reference images to preserve the requested vehicle, composition, people references, and visual direction.",
        "Use the attached brand logo image exactly as the logo reference. Do not invent, redraw, substitute, or approximate the logo.",
        manifestText
      ].join("\n")
    );
  }

  if (!logoAssets.length) return sections.join("\n\n");

  const logoInstructions = logoAssets
    .filter((asset) => asset.publicPath)
    .map((asset) => {
      const url = `${origin}${asset.publicPath}`;
      return [
        asset.label ? `Logo asset: ${asset.label}` : "Logo asset",
        asset.copyGuidance,
        `Logo URL: ${url}`
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  sections.push(
    `${"## Attached Brand Logo References"}\n${logoInstructions}\n\nUse the provided brand logo reference exactly as instructed.`
  );

  return sections.join("\n\n");
}

function normalizeImages(data: unknown) {
  if (!data || typeof data !== "object") return [];

  const response = data as {
    data?: Array<{
      b64_json?: string;
      url?: string;
      revised_prompt?: string;
      image_url?: string | { url?: string };
      base64?: string;
      image_base64?: string;
      output?: string;
    }> | string;
  };

  if (typeof response.data === "string") {
    return stringToImageUrls(response.data).map((url, index) => ({
      id: `api-image-${Date.now()}-${index}`,
      url,
      revisedPrompt: null
    }));
  }

  const openAIStyleImages = (response.data ?? [])
    .map((item, index) => {
      if (item.b64_json) {
        return {
          id: `api-image-${Date.now()}-${index}`,
          url: `data:image/png;base64,${item.b64_json}`,
          revisedPrompt: item.revised_prompt ?? null
        };
      }
      if (item.url) {
        return {
          id: `api-image-${Date.now()}-${index}`,
          url: item.url,
          revisedPrompt: item.revised_prompt ?? null
        };
      }
      if (item.base64) {
        return {
          id: `api-image-${Date.now()}-${index}`,
          url: `data:image/png;base64,${stripDataUrl(item.base64)}`,
          revisedPrompt: item.revised_prompt ?? null
        };
      }
      if (item.image_base64) {
        return {
          id: `api-image-${Date.now()}-${index}`,
          url: `data:image/png;base64,${stripDataUrl(item.image_base64)}`,
          revisedPrompt: item.revised_prompt ?? null
        };
      }
      if (typeof item.image_url === "string") {
        return {
          id: `api-image-${Date.now()}-${index}`,
          url: item.image_url,
          revisedPrompt: item.revised_prompt ?? null
        };
      }
      if (item.image_url?.url) {
        return {
          id: `api-image-${Date.now()}-${index}`,
          url: item.image_url.url,
          revisedPrompt: item.revised_prompt ?? null
        };
      }
      if (item.output) {
        const [url] = stringToImageUrls(item.output);
        if (url) {
          return {
            id: `api-image-${Date.now()}-${index}`,
            url,
            revisedPrompt: item.revised_prompt ?? null
          };
        }
      }
      return null;
    })
    .filter(Boolean);

  if (openAIStyleImages.length) return openAIStyleImages;

  const urls = new Set<string>();
  collectImageUrls(data, urls);
  return Array.from(urls).map((url, index) => ({
    id: `api-image-${Date.now()}-${index}`,
    url,
    revisedPrompt: null
  }));
}

function stripDataUrl(value: string) {
  return value.startsWith("data:image/") ? value.split(",", 2)[1] : value;
}

function looksLikeBase64Image(value: string) {
  const stripped = stripDataUrl(value).replace(/\s/g, "");
  return stripped.length > 100 && /^[A-Za-z0-9+/=]+$/.test(stripped);
}

function collectImageUrls(value: unknown, urls: Set<string>) {
  if (typeof value === "string") {
    stringToImageUrls(value).forEach((url) => urls.add(url));
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectImageUrls(item, urls));
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === "string") {
      if ((key === "url" || key === "image_url" || key === "image") && item) {
        urls.add(item);
        continue;
      }
      if (
        ["b64_json", "base64", "image_base64", "data"].includes(key) &&
        looksLikeBase64Image(item)
      ) {
        urls.add(`data:image/png;base64,${stripDataUrl(item)}`);
        continue;
      }
    }
    collectImageUrls(item, urls);
  }
}

function stringToImageUrls(value: string) {
  if (value.startsWith("data:image/")) return [value];
  if (/^https?:\/\//.test(value)) return [value];
  if (looksLikeBase64Image(value)) return [`data:image/png;base64,${stripDataUrl(value)}`];
  return extractImageUrlsFromText(value);
}

function summarizeResponseShape(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[depth-limit]";
  if (Array.isArray(value)) {
    return value.slice(0, 3).map((item) => summarizeResponseShape(item, depth + 1));
  }
  if (!value || typeof value !== "object") {
    if (typeof value === "string") {
      return value.startsWith("data:image/")
        ? `[data-image length=${value.length}]`
        : value.length > 160
          ? `${value.slice(0, 160)}... [length=${value.length}]`
          : value;
    }
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 20)
      .map(([key, item]) => [key, summarizeResponseShape(item, depth + 1)])
  );
}

function extractImageUrlsFromText(text: string) {
  const urls = new Set<string>();
  const markdownImagePattern = /!\[[^\]]*]\(([^)\s]+)\)/g;
  const urlPattern = /(https?:\/\/[^\s"'<>)]{8,}|data:image\/[a-zA-Z0-9.+-]+;base64,[a-zA-Z0-9+/=]+)/g;
  let match: RegExpExecArray | null;

  while ((match = markdownImagePattern.exec(text))) {
    urls.add(match[1]);
  }
  while ((match = urlPattern.exec(text))) {
    urls.add(match[1]);
  }

  return Array.from(urls);
}

function normalizeChatCompletionImages(data: unknown) {
  const directImages = normalizeImages(data);
  if (directImages.length) return directImages;

  const response = data as {
    choices?: Array<{
      message?: {
        content?:
          | string
          | Array<{
              type?: string;
              text?: string;
              b64_json?: string;
              url?: string;
              image_url?: string | { url?: string };
            }>;
      };
    }>;
  };
  const urls = new Set<string>();

  for (const choice of response.choices ?? []) {
    const content = choice.message?.content;
    if (typeof content === "string") {
      extractImageUrlsFromText(content).forEach((url) => urls.add(url));
      continue;
    }

    for (const item of content ?? []) {
      if (item.text) {
        extractImageUrlsFromText(item.text).forEach((url) => urls.add(url));
      }
      if (item.b64_json) {
        urls.add(`data:image/png;base64,${item.b64_json}`);
      }
      if (item.url) {
        urls.add(item.url);
      }
      if (typeof item.image_url === "string") {
        urls.add(item.image_url);
      } else if (item.image_url?.url) {
        urls.add(item.image_url.url);
      }
    }
  }

  return Array.from(urls).map((url, index) => ({
    id: `api-image-${Date.now()}-${index}`,
    url,
    revisedPrompt: null
  }));
}

async function parseResponseBody(response: Response): Promise<ParsedResponseBody> {
  const text = await response.text();
  if (!text.trim()) {
    return { json: null, text: "" };
  }

  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
}

async function requestImageGeneration({
  apiKey,
  baseUrl,
  body,
  endpoint = "generations",
  timeoutMs = Number(process.env.IMAGE_API_TIMEOUT_MS || 180000)
}: {
  apiKey: string;
  baseUrl: string;
  body: BodyInit;
  endpoint?: ImageApiEndpoint;
  timeoutMs?: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers: HeadersInit = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json"
  };
  if (typeof body === "string") {
    headers["Content-Type"] = "application/json";
  }

  try {
    const url =
      endpoint === "chat/completions"
        ? `${baseUrl}/chat/completions`
        : `${baseUrl}/images/${endpoint}`;
    return await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function createEditFormData({
  prompt,
  files,
  model,
  size,
  quality,
  useArrayImageField,
  includeResponseFormat
}: {
  prompt: string;
  files: File[];
  model: string;
  size: string;
  quality: string;
  useArrayImageField: boolean;
  includeResponseFormat: boolean;
}) {
  const formData = new FormData();
  formData.append("model", model);
  formData.append("prompt", prompt);
  formData.append("size", size);
  formData.append("quality", quality);
  formData.append("input_fidelity", "high");
  formData.append("output_format", "png");
  formData.append("n", "1");
  if (includeResponseFormat) {
    formData.append("response_format", "b64_json");
  }
  files.slice(0, 16).forEach((file) => {
    formData.append(useArrayImageField ? "image[]" : "image", file, file.name);
  });
  return formData;
}

async function fileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type || "application/octet-stream"};base64,${buffer.toString("base64")}`;
}

async function fileToBase64(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return buffer.toString("base64");
}

async function createKaopuGenerationsBody({
  prompt,
  files,
  model,
  size,
  quality,
  responseFormat
}: {
  prompt: string;
  files: File[];
  model: string;
  size: string;
  quality: string;
  responseFormat?: "url";
}) {
  const images: string[] = [];
  for (const file of files.slice(0, 8)) {
    images.push(await fileToBase64(file));
  }

  const payload: Record<string, unknown> = {
    model,
    prompt,
    image: images,
    size
  };
  if (responseFormat) {
    payload.response_format = responseFormat;
  } else {
    payload.quality = quality;
    payload.n = 1;
  }

  return JSON.stringify(payload);
}

async function requestAndParseImageGeneration({
  apiKey,
  baseUrl,
  endpoint,
  body,
  label
}: {
  apiKey: string;
  baseUrl: string;
  endpoint: ImageApiEndpoint;
  body: BodyInit;
  label: string;
}): Promise<ImageApiAttempt> {
  let response: Response;
  let parsed: ParsedResponseBody;

  try {
    response = await requestImageGeneration({
      apiKey,
      baseUrl,
      endpoint,
      body
    });
    parsed = await parseResponseBody(response);
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Image generation timed out while waiting for the upstream API."
        : error instanceof Error
          ? error.message
          : "Image generation failed before the upstream API returned a response.";
    const fallbackData = { error: { message } };
    response = Response.json(fallbackData, {
      status: error instanceof Error && error.name === "AbortError" ? 504 : 502
    });
    parsed = {
      json: fallbackData,
      text: JSON.stringify(fallbackData)
    };
  }

  return {
    label,
    endpoint,
    response,
    parsed,
    data: parsed.json
  };
}

async function requestKaopuDualGenerations({
  apiKey,
  baseUrl,
  prompt,
  files,
  model,
  size,
  quality
}: {
  apiKey: string;
  baseUrl: string;
  prompt: string;
  files: File[];
  model: string;
  size: string;
  quality: string;
}) {
  const [urlBody, base64Body] = await Promise.all([
    createKaopuGenerationsBody({
      prompt,
      files,
      model,
      size,
      quality,
      responseFormat: "url"
    }),
    createKaopuGenerationsBody({
      prompt,
      files,
      model,
      size,
      quality
    })
  ]);

  const urlAttempt = await requestAndParseImageGeneration({
    apiKey,
    baseUrl,
    endpoint: "generations",
    body: urlBody,
    label: "kaopu_url"
  });

  if (
    urlAttempt.response.status === 429 ||
    (urlAttempt.response.ok && normalizeImages(urlAttempt.data).length > 0)
  ) {
    return urlAttempt;
  }

  // If first attempt returned HTML, skip second attempt (same issue will repeat)
  const firstIsHtml = !urlAttempt.data && urlAttempt.parsed.text.trimStart().startsWith("<");
  if (firstIsHtml) {
    return urlAttempt;
  }

  const base64Attempt = await requestAndParseImageGeneration({
    apiKey,
    baseUrl,
    endpoint: "generations",
    body: base64Body,
    label: "kaopu_base64"
  });

  const attempts = [urlAttempt, base64Attempt];

  return (
    attempts.find((attempt) => attempt.response.ok && normalizeImages(attempt.data).length > 0) ??
    attempts.find((attempt) => attempt.response.ok) ??
    attempts[0]
  );
}

async function createChatCompletionsBody({
  prompt,
  files,
  model
}: {
  prompt: string;
  files: File[];
  model: string;
}) {
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "high" } }
  > = [
    {
      type: "text",
      text: [
        prompt,
        "Generate one final poster image from this brief and the attached visual references.",
        "Return the generated image as a direct image URL or base64 image in the response."
      ].join("\n\n")
    }
  ];

  for (const file of files.slice(0, 8)) {
    content.push({
      type: "image_url",
      image_url: {
        url: await fileToDataUrl(file),
        detail: "high"
      }
    });
  }

  return JSON.stringify({
    model,
    stream: false,
    messages: [
      {
        role: "user",
        content
      }
    ]
  });
}

export async function POST(request: NextRequest) {
  try {
    // --- Rate Limiting ---
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // --- Authentication ---
    const internalApiKey = process.env.INTERNAL_API_KEY;
    if (internalApiKey) {
      const providedKey = request.headers.get("x-api-key");
      if (providedKey !== internalApiKey) {
        return NextResponse.json(
          { error: "Unauthorized. Provide a valid x-api-key header." },
          { status: 401 }
        );
      }
    }

    if (!isApiEnabled()) {
      return NextResponse.json(
        { error: "Image API generation is disabled for this deployment." },
        { status: 403 }
      );
    }

    const { apiKey, baseUrl, model, size, quality } = getOpenAIImageConfig();
    const endpointMode = getEndpointMode();
    const useKaopuGenerations =
      endpointMode === "kaopu_generations" || (endpointMode === "auto" && isKaopuImageApi(baseUrl));
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 500 }
      );
    }

    const contentType = request.headers.get("content-type") ?? "";
    let prompt = "";
    let logoAssets: LogoAssetPayload[] = [];
    let imageManifest: ImageReferenceManifestItem[] = [];
    let files: File[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      prompt = String(formData.get("prompt") ?? "");
      logoAssets = JSON.parse(String(formData.get("logoAssets") ?? "[]")) as LogoAssetPayload[];
      imageManifest = JSON.parse(String(formData.get("imageManifest") ?? "[]")) as ImageReferenceManifestItem[];
      files = formData
        .getAll("image")
        .filter((item): item is File => item instanceof File && item.type.startsWith("image/"));

      // --- File size validation ---
      const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB per file
      const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB total
      let totalSize = 0;
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { error: `File "${file.name}" exceeds the 20MB size limit.` },
            { status: 413 }
          );
        }
        totalSize += file.size;
      }
      if (totalSize > MAX_TOTAL_SIZE) {
        return NextResponse.json(
          { error: "Total upload size exceeds the 100MB limit." },
          { status: 413 }
        );
      }
    } else {
      const payload = (await request.json()) as ImageGenerationPayload;
      prompt = payload.prompt ?? "";
      logoAssets = payload.logoAssets ?? [];
    }

    if (!prompt.trim()) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    const MAX_PROMPT_LENGTH = 10_000;
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `Prompt exceeds the maximum length of ${MAX_PROMPT_LENGTH} characters.` },
        { status: 400 }
      );
    }

    const configError = getConfigError(model);
    if (configError && process.env.IMAGE_API_ALLOW_CUSTOM_MODEL !== "true") {
      return NextResponse.json(
        {
          error: configError,
          diagnostics: createDiagnostics({
            endpoint:
              endpointMode === "chat_completions"
                ? "chat/completions"
                : useKaopuGenerations || !files.length
                  ? "generations"
                  : "edits",
            model,
            baseUrl,
            imageCount: files.length
          })
        },
        { status: 500 }
      );
    }

    const finalPrompt = buildPrompt({
      prompt: prompt.trim(),
      logoAssets,
      origin: request.nextUrl.origin,
      imageManifest
    });

    const body: Record<string, unknown> = {
      model,
      prompt: finalPrompt,
      size,
      quality,
      n: 1
    };

    let response: Response;
    let parsed: ParsedResponseBody | null = null;
    let data: unknown = null;
    let endpoint: ImageApiEndpoint =
      endpointMode === "chat_completions"
        ? "chat/completions"
        : useKaopuGenerations || !files.length
          ? "generations"
          : "edits";
    if (endpointMode === "chat_completions") {
      response = await requestImageGeneration({
        apiKey,
        baseUrl,
        endpoint,
        body: await createChatCompletionsBody({
          prompt: finalPrompt,
          files,
          model
        })
      });
    } else if (useKaopuGenerations) {
      const kaopuAttempt = await requestKaopuDualGenerations({
        apiKey,
        baseUrl,
        prompt: finalPrompt,
        files,
        model,
        size,
        quality
      });
      endpoint = kaopuAttempt.endpoint;
      response = kaopuAttempt.response;
      parsed = kaopuAttempt.parsed;
      data = kaopuAttempt.data;
    } else if (files.length) {
      response = await requestImageGeneration({
        apiKey,
        baseUrl,
        endpoint: "edits",
        body: createEditFormData({
          prompt: finalPrompt,
          files,
          model,
          size,
          quality,
          useArrayImageField: true,
          includeResponseFormat: false
        })
      });
    } else {
      response = await requestImageGeneration({
        apiKey,
        baseUrl,
        body: JSON.stringify(body)
      });
    }
    if (!parsed) {
      parsed = await parseResponseBody(response);
      data = parsed.json;
    }

    // Detect HTML response (upstream returned a webpage instead of JSON)
    const isHtmlResponse = !data && parsed.text.trimStart().startsWith("<");
    if (isHtmlResponse && endpoint !== "chat/completions" && files.length) {
      // Fallback to chat/completions which may handle the request differently
      endpoint = "chat/completions";
      response = await requestImageGeneration({
        apiKey,
        baseUrl,
        endpoint,
        body: await createChatCompletionsBody({
          prompt: finalPrompt,
          files,
          model
        })
      });
      parsed = await parseResponseBody(response);
      data = parsed.json;
    } else if (isHtmlResponse) {
      return NextResponse.json(
        { error: "The upstream image API returned an HTML page instead of JSON. This usually means the API endpoint is unreachable, the request payload is too large, or the API key lacks permission for this model. Please verify your KAOPU_IMAGE_BASE_URL and API key configuration." },
        { status: 502 }
      );
    }

    if (!response.ok && response.status === 400) {
      if (endpointMode !== "chat_completions" && !useKaopuGenerations && files.length) {
        endpoint = "edits";
        response = await requestImageGeneration({
          apiKey,
          baseUrl,
          endpoint: "edits",
          body: createEditFormData({
            prompt: finalPrompt,
            files,
            model,
            size,
            quality,
            useArrayImageField: false,
            includeResponseFormat: false
          })
        });
        parsed = await parseResponseBody(response);
        data = parsed.json;
      }
    }

    if (!response.ok && endpointMode === "auto" && !useKaopuGenerations && files.length) {
      endpoint = "chat/completions";
      response = await requestImageGeneration({
        apiKey,
        baseUrl,
        endpoint,
        body: await createChatCompletionsBody({
          prompt: finalPrompt,
          files,
          model
        })
      });
      parsed = await parseResponseBody(response);
      data = parsed.json;
    }

    if (!response.ok) {
      const errorPayload: Record<string, unknown> = {
        error: getErrorMessage(data, response.status, parsed.text, model)
      };
      if (process.env.NODE_ENV === "development") {
        errorPayload.diagnostics = createDiagnostics({
          endpoint,
          model,
          baseUrl,
          imageCount: files.length,
          status: response.status,
          text: parsed.text
        });
      }
      return NextResponse.json(errorPayload, { status: response.status });
    }

    const images =
      endpoint === "chat/completions"
        ? normalizeChatCompletionImages(data)
        : normalizeImages(data);

    if (!images.length) {
      const noImagePayload: Record<string, unknown> = {
        error:
          endpoint === "chat/completions"
            ? "The chat-completions relay returned successfully, but no image URL or base64 image was found in the response."
            : "The image API returned successfully, but no generated image was found in the response."
      };
      if (process.env.NODE_ENV === "development") {
        noImagePayload.diagnostics = createDiagnostics({
          endpoint,
          model,
          baseUrl,
          imageCount: files.length,
          status: response.status,
          text: parsed.text
        });
        noImagePayload.responseShape = summarizeResponseShape(data);
      }
      return NextResponse.json(noImagePayload, { status: 502 });
    }

    return NextResponse.json({
      images,
      model,
      size,
      quality,
      endpoint
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Image generation timed out while waiting for the upstream API."
        : error instanceof Error
          ? error.message
          : "Image generation failed before the upstream API returned a response.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
