import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "node:buffer";

export const runtime = "nodejs";
export const maxDuration = 300;

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
    process.env.OPENAI_BASE_URL ||
    "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const size = process.env.OPENAI_IMAGE_SIZE || "1024x1024";
  const quality = process.env.OPENAI_IMAGE_QUALITY || "auto";

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
  const response = data as {
    data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
  };

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
  if (Array.isArray(value)) {
    value.forEach((item) => collectImageUrls(item, urls));
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === "string") {
      if ((key === "url" || key === "image_url") && item) {
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
    Authorization: `Bearer ${apiKey}`
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

  const attemptPromises = [
    requestAndParseImageGeneration({
      apiKey,
      baseUrl,
      endpoint: "generations",
      body: urlBody,
      label: "kaopu_url"
    }),
    requestAndParseImageGeneration({
      apiKey,
      baseUrl,
      endpoint: "generations",
      body: base64Body,
      label: "kaopu_base64"
    })
  ];

  const attempts: ImageApiAttempt[] = [];
  const firstUsableAttempt = await new Promise<ImageApiAttempt | null>((resolve) => {
    let pending = attemptPromises.length;
    let firstOkAttempt: ImageApiAttempt | null = null;

    attemptPromises.forEach((attemptPromise) => {
      attemptPromise
        .then((attempt) => {
          attempts.push(attempt);
          if (attempt.response.ok && normalizeImages(attempt.data).length > 0) {
            resolve(attempt);
            return;
          }
          if (attempt.response.ok && !firstOkAttempt) {
            firstOkAttempt = attempt;
          }
        })
        .finally(() => {
          pending -= 1;
          if (pending === 0) {
            resolve(firstOkAttempt);
          }
        });
    });
  });

  if (firstUsableAttempt) return firstUsableAttempt;

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
    } else {
      const payload = (await request.json()) as ImageGenerationPayload;
      prompt = payload.prompt ?? "";
      logoAssets = payload.logoAssets ?? [];
    }

    if (!prompt.trim()) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
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
      return NextResponse.json(
        {
          error: getErrorMessage(data, response.status, parsed.text, model),
          diagnostics: createDiagnostics({
            endpoint,
            model,
            baseUrl,
            imageCount: files.length,
            status: response.status,
            text: parsed.text
          })
        },
        { status: response.status }
      );
    }

    const images =
      endpoint === "chat/completions"
        ? normalizeChatCompletionImages(data)
        : normalizeImages(data);

    if (!images.length) {
      return NextResponse.json(
        {
          error:
            endpoint === "chat/completions"
              ? "The chat-completions relay returned successfully, but no image URL or base64 image was found in the response."
              : "The image API returned successfully, but no generated image was found in the response.",
          diagnostics: createDiagnostics({
            endpoint,
            model,
            baseUrl,
            imageCount: files.length,
            status: response.status,
            text: parsed.text
          }),
          raw: data
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      images,
      model,
      size,
      quality,
      endpoint,
      raw: data
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
