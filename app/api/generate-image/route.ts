import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

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

type ImageApiDiagnostics = {
  endpoint: "generations" | "edits";
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
    process.env.NEXT_PUBLIC_GENERATION_PROVIDER === "openai_api"
  );
}

function getOpenAIImageConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5";
  const size = process.env.OPENAI_IMAGE_SIZE || "1024x1024";
  const quality = process.env.OPENAI_IMAGE_QUALITY || "auto";

  return { apiKey, baseUrl, model, size, quality };
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
    "Use an image-capable model such as gpt-image-1.5, gpt-image-1, or the exact image model name required by your relay."
  ].join(" ");
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

  if (
    upstreamMessage.includes("cooling down") ||
    upstreamMessage.includes("provider codex") ||
    upstreamMessage.includes("All credentials")
  ) {
    const configError = model ? getConfigError(model) : null;
    return configError
      ? `${configError} Upstream returned: ${upstreamMessage}`
      : `The configured relay rejected the selected model/provider pool. Upstream returned: ${upstreamMessage}`;
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
  endpoint: "generations" | "edits";
  model: string;
  baseUrl: string;
  imageCount: number;
  status?: number;
  text?: string;
}): ImageApiDiagnostics {
  return {
    endpoint,
    model,
    baseUrlHost: getBaseUrlHost(baseUrl),
    imageCount,
    status,
    upstreamBodyPreview: text?.trim().slice(0, 600) || undefined,
    suggestion:
      getConfigError(model) ??
      "If this uses a third-party relay, confirm that the relay supports /v1/images/edits with multipart image uploads."
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

  return (response.data ?? [])
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
  timeoutMs = 55000
}: {
  apiKey: string;
  baseUrl: string;
  body: BodyInit;
  endpoint?: "generations" | "edits";
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
    return await fetch(`${baseUrl}/images/${endpoint}`, {
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

export async function POST(request: NextRequest) {
  try {
    if (!isApiEnabled()) {
      return NextResponse.json(
        { error: "Image API generation is disabled for this deployment." },
        { status: 403 }
      );
    }

    const { apiKey, baseUrl, model, size, quality } = getOpenAIImageConfig();
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
            endpoint: files.length ? "edits" : "generations",
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
    let endpoint: "generations" | "edits" = files.length ? "edits" : "generations";
    if (files.length) {
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
    let parsed = await parseResponseBody(response);
    let data = parsed.json;

    if (!response.ok && response.status === 400) {
      if (files.length) {
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

    return NextResponse.json({
      images: normalizeImages(data),
      model,
      size,
      quality,
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
