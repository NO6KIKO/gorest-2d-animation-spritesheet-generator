export const ATLAS_CLOUD_MEDIA_API_BASE = "https://api.atlascloud.ai/api/v1";
export const ATLAS_CLOUD_IMAGE_MODEL = "bytedance/seedream-v5.0-lite";

type AtlasCloudPayload = {
  code?: number | string;
  data?: unknown;
  id?: string;
  status?: string;
  outputs?: string[];
  message?: string;
  msg?: string;
};

type AtlasCloudGenerationOptions = {
  apiKey: string;
  prompt: string;
  style: string;
  frameCount: 12 | 16;
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  pollIntervalMs?: number;
  timeoutMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
};

export type AtlasCloudGenerationResult = {
  id: string;
  model: string;
  outputUrl: string;
  size: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function responseData(payload: AtlasCloudPayload): Record<string, unknown> {
  return isRecord(payload.data) ? payload.data : payload;
}

function responseMessage(payload: AtlasCloudPayload) {
  return payload.message || payload.msg || "Unknown Atlas Cloud error";
}

async function readAtlasResponse(response: Response, operation: string) {
  const payload = await response.json().catch(() => ({})) as AtlasCloudPayload;
  const code = payload.code === undefined ? "200" : String(payload.code);
  if (!response.ok || !["0", "200"].includes(code)) {
    throw new Error(`${operation} failed (${response.status}): ${responseMessage(payload)}`);
  }
  return payload;
}

function escapeXmlAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function atlasSpritesheetDimensions(frameCount: 12 | 16) {
  return frameCount === 16
    ? { size: "2048*2048", width: 2048, height: 2048, columns: 4, rows: 4 }
    : { size: "2304*1728", width: 2304, height: 1728, columns: 4, rows: 3 };
}

export function buildAtlasSpritesheetPrompt(prompt: string, style: string, frameCount: 12 | 16) {
  const { columns, rows } = atlasSpritesheetDimensions(frameCount);
  return [
    `Create one complete ${frameCount}-frame 2D animation spritesheet for: ${prompt.trim()}.`,
    `Arrange exactly ${columns} columns by ${rows} rows with equal square cells and no gutters.`,
    "Keep the same character identity, outfit, palette, proportions, camera, framing, and scale in every cell.",
    "Use distinct sequential key poses that form a seamless animation loop; do not duplicate the final frame.",
    "Keep the subject fully inside every cell with stable foot/root registration and clean transparent background.",
    `Visual style: ${style.trim() || "high-detail game sprite art"}.`,
    "Return only the spritesheet image without labels, borders, captions, or layout guides."
  ].join(" ");
}

export function buildRasterSpritesheetResponse(sourceUrl: string, frameCount: 12 | 16) {
  const { width, height, columns, rows } = atlasSpritesheetDimensions(frameCount);
  const frameWidth = width / columns;
  const frameHeight = height / rows;
  const escapedUrl = escapeXmlAttribute(sourceUrl);
  const frames = Array.from({ length: frameCount }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${frameWidth} ${frameHeight}" width="256" height="256"><image href="${escapedUrl}" x="${-column * frameWidth}" y="${-row * frameHeight}" width="${width}" height="${height}" preserveAspectRatio="none"/></svg>`;
  });
  const spritesheetSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><image href="${escapedUrl}" width="${width}" height="${height}" preserveAspectRatio="none"/></svg>`;
  return { frames, spritesheetSvg, columns, rows };
}

export async function generateAtlasCloudSpritesheet(
  options: AtlasCloudGenerationOptions
): Promise<AtlasCloudGenerationResult> {
  const fetchImpl = options.fetchImpl || fetch;
  const sleep = options.sleep || ((milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds)));
  const baseUrl = (options.baseUrl || ATLAS_CLOUD_MEDIA_API_BASE).replace(/\/$/, "");
  const model = options.model || ATLAS_CLOUD_IMAGE_MODEL;
  const dimensions = atlasSpritesheetDimensions(options.frameCount);
  const submission = await fetchImpl(`${baseUrl}/model/generateImage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      prompt: buildAtlasSpritesheetPrompt(options.prompt, options.style, options.frameCount),
      size: dimensions.size,
      output_format: "png"
    })
  });
  const submissionPayload = await readAtlasResponse(submission, "Atlas Cloud image submission");
  const submissionData = responseData(submissionPayload);
  const id = typeof submissionData.id === "string" ? submissionData.id : "";
  if (!id) throw new Error("Atlas Cloud image submission did not return a prediction id");

  const timeoutMs = options.timeoutMs ?? 180_000;
  const pollIntervalMs = options.pollIntervalMs ?? 3_000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(pollIntervalMs);
    const prediction = await fetchImpl(`${baseUrl}/model/prediction/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${options.apiKey}` }
    });
    const predictionPayload = await readAtlasResponse(prediction, "Atlas Cloud image polling");
    const predictionData = responseData(predictionPayload);
    const status = typeof predictionData.status === "string" ? predictionData.status.toLowerCase() : "";
    const outputs = Array.isArray(predictionData.outputs)
      ? predictionData.outputs.filter((value): value is string => typeof value === "string" && value.length > 0)
      : [];

    if (["completed", "succeeded"].includes(status)) {
      if (!outputs[0]) throw new Error("Atlas Cloud image generation completed without an output URL");
      return { id, model, outputUrl: outputs[0], size: dimensions.size };
    }
    if (["failed", "canceled", "cancelled"].includes(status)) {
      throw new Error(`Atlas Cloud image generation ${status}`);
    }
  }

  throw new Error(`Atlas Cloud image generation timed out after ${timeoutMs}ms`);
}
