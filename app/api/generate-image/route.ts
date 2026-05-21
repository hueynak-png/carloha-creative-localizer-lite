import { NextRequest, NextResponse } from "next/server";

type LogoAssetPayload = {
  label?: string;
  publicPath?: string;
  copyGuidance?: string;
};

type ImageGenerationPayload = {
  prompt?: string;
  logoAssets?: LogoAssetPayload[];
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
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const size = process.env.OPENAI_IMAGE_SIZE || "1024x1024";
  const quality = process.env.OPENAI_IMAGE_QUALITY || "auto";

  return { apiKey, baseUrl, model, size, quality };
}

function buildPrompt(prompt: string, logoAssets: LogoAssetPayload[], origin: string) {
  if (!logoAssets.length) return prompt;

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

  return `${prompt}\n\n## Attached Brand Logo References\n${logoInstructions}\n\nUse the provided brand logo reference exactly as instructed.`;
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

async function requestImageGeneration({
  apiKey,
  baseUrl,
  body
}: {
  apiKey: string;
  baseUrl: string;
  body: Record<string, unknown>;
}) {
  return fetch(`${baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

export async function POST(request: NextRequest) {
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

  const payload = (await request.json()) as ImageGenerationPayload;
  if (!payload.prompt?.trim()) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  const prompt = buildPrompt(
    payload.prompt.trim(),
    payload.logoAssets ?? [],
    request.nextUrl.origin
  );

  const body: Record<string, unknown> = {
    model,
    prompt,
    size,
    quality,
    n: 1,
    response_format: "b64_json"
  };

  let response = await requestImageGeneration({ apiKey, baseUrl, body });
  let data = await response.json().catch(() => null);

  if (!response.ok && response.status === 400 && body.response_format) {
    const fallbackBody = { ...body };
    delete fallbackBody.response_format;
    response = await requestImageGeneration({ apiKey, baseUrl, body: fallbackBody });
    data = await response.json().catch(() => null);
  }

  if (!response.ok) {
    return NextResponse.json(
      {
        error:
          data?.error?.message ??
          data?.message ??
          `Image generation failed with status ${response.status}.`
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
}
