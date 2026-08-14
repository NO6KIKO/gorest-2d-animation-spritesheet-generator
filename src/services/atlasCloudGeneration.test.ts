import assert from "node:assert/strict";
import test from "node:test";
import {
  atlasSpritesheetDimensions,
  buildAtlasSpritesheetPrompt,
  buildRasterSpritesheetResponse,
  generateAtlasCloudSpritesheet
} from "./atlasCloudGeneration";

test("selects a grid-aligned Atlas image size", () => {
  assert.deepEqual(atlasSpritesheetDimensions(12), {
    size: "2304*1728",
    width: 2304,
    height: 1728,
    columns: 4,
    rows: 3
  });
  assert.equal(atlasSpritesheetDimensions(16).size, "2048*2048");
});

test("builds a model prompt with exact grid and continuity requirements", () => {
  const prompt = buildAtlasSpritesheetPrompt("a swordswoman running", "inked anime", 12);
  assert.match(prompt, /exactly 4 columns by 3 rows/);
  assert.match(prompt, /same character identity/);
  assert.match(prompt, /seamless animation loop/);
  assert.match(prompt, /inked anime/);
});

test("submits and polls Atlas Cloud image generation", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const responses = [
    new Response(JSON.stringify({ code: 200, data: { id: "prediction-1", status: "starting" } }), { status: 200 }),
    new Response(JSON.stringify({ code: 200, data: { id: "prediction-1", status: "processing" } }), { status: 200 }),
    new Response(JSON.stringify({ code: 200, data: { id: "prediction-1", status: "completed", outputs: ["https://cdn.example/sheet.png"] } }), { status: 200 })
  ];
  const fetchImpl: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    const response = responses.shift();
    if (!response) throw new Error("Unexpected request");
    return response;
  };

  const result = await generateAtlasCloudSpritesheet({
    apiKey: "test-key",
    prompt: "running knight",
    style: "pixel art",
    frameCount: 12,
    fetchImpl,
    pollIntervalMs: 0,
    sleep: async () => undefined
  });

  assert.equal(result.outputUrl, "https://cdn.example/sheet.png");
  assert.equal(requests.length, 3);
  assert.equal(requests[0].url, "https://api.atlascloud.ai/api/v1/model/generateImage");
  assert.equal(requests[1].url, "https://api.atlascloud.ai/api/v1/model/prediction/prediction-1");
  const body = JSON.parse(String(requests[0].init?.body));
  assert.equal(body.model, "bytedance/seedream-v5.0-lite");
  assert.equal(body.size, "2304*1728");
  assert.equal(body.output_format, "png");
  assert.equal((requests[0].init?.headers as Record<string, string>).Authorization, "Bearer test-key");
});

test("rejects a failed Atlas Cloud prediction", async () => {
  const responses = [
    new Response(JSON.stringify({ code: 200, data: { id: "prediction-2" } }), { status: 200 }),
    new Response(JSON.stringify({ code: 200, data: { status: "failed" } }), { status: 200 })
  ];
  const fetchImpl: typeof fetch = async () => responses.shift()!;

  await assert.rejects(
    generateAtlasCloudSpritesheet({
      apiKey: "test-key",
      prompt: "idle mage",
      style: "painted",
      frameCount: 16,
      fetchImpl,
      sleep: async () => undefined
    }),
    /generation failed/
  );
});

test("builds raster frame crops without embedding credentials", () => {
  const result = buildRasterSpritesheetResponse("/generated/cloud-sheet.png?x=1&y=2", 12);
  assert.equal(result.frames.length, 12);
  assert.match(result.frames[5], /x="-576" y="-576"/);
  assert.match(result.frames[0], /x=1&amp;y=2/);
  assert.match(result.spritesheetSvg, /viewBox="0 0 2304 1728"/);
});
