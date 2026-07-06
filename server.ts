import express from "express";
import path from "path";
import fs from "fs";
import os from "node:os";
import * as net from "node:net";
import { spawn } from "node:child_process";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config({ path: ".env.local" });
dotenv.config();

const PROJECT_ROOT = process.cwd();
const app = express();
const REQUESTED_PORT = parsePort(process.env.PORT, 3000);
const PORT_SCAN_LIMIT = parsePort(process.env.PORT_SCAN_LIMIT, 30);
let latestGeneratedSprite: any = null;
const GENERATED_DIR = path.join(PROJECT_ROOT, "public", "generated");
const GAME_LIBRARY_PATH = path.join(GENERATED_DIR, "game_asset_library.json");
const GENERATED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const RUNTIME_GENERATED_WATCH_IGNORES = ["**/public/generated/**"];

function parsePort(value: string | undefined, fallback: number) {
  const port = Number(value ?? fallback);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return fallback;
  }
  return port;
}

function canBindPort(port: number, host: string) {
  return new Promise<boolean>((resolve) => {
    const tester = net.createServer();
    tester.once("error", (error: NodeJS.ErrnoException) => {
      if (host.startsWith("::") && error.code !== "EADDRINUSE") {
        resolve(true);
        return;
      }
      resolve(false);
    });
    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, host);
  });
}

async function isLocalPortAvailable(port: number) {
  const availability = await Promise.all([
    canBindPort(port, "127.0.0.1"),
    canBindPort(port, "0.0.0.0"),
    canBindPort(port, "::1"),
    canBindPort(port, "::")
  ]);
  return availability.every(Boolean);
}

async function findAvailablePort(startPort: number, label: string) {
  for (let port = startPort; port <= startPort + PORT_SCAN_LIMIT; port++) {
    if (await isLocalPortAvailable(port)) {
      if (port !== startPort) {
        console.warn(`${label} port ${startPort} is in use; using ${port} instead.`);
      }
      return port;
    }
  }
  throw new Error(`No available ${label} port found from ${startPort} to ${startPort + PORT_SCAN_LIMIT}.`);
}

function listenOnPort(port: number) {
  return new Promise<void>((resolve, reject) => {
    const server = app.listen(port);
    server.once("listening", () => resolve());
    server.once("error", (error: NodeJS.ErrnoException) => reject(error));
  });
}

async function listenWithPortFallback(startPort: number) {
  for (let port = startPort; port <= startPort + PORT_SCAN_LIMIT; port++) {
    try {
      await listenOnPort(port);
      return port;
    } catch (error) {
      const listenError = error as NodeJS.ErrnoException;
      if (listenError.code !== "EADDRINUSE") {
        throw error;
      }
      console.warn(`app port ${port} became unavailable during startup; trying ${port + 1}.`);
    }
  }
  throw new Error(`No available app port found from ${startPort} to ${startPort + PORT_SCAN_LIMIT}.`);
}

// Increase payload limits for base64 reference images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use("/generated", express.static(GENERATED_DIR));

function readGameLibrary() {
  const empty = { assets: [], scenes: [], startUi: undefined, startUis: [], updatedTime: new Date().toISOString() };
  try {
    if (!fs.existsSync(GAME_LIBRARY_PATH)) {
  console.warn('Game asset library not found, returning empty library.');
  return empty;
}
    const raw = fs.readFileSync(GAME_LIBRARY_PATH, "utf-8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    const startUi = parsed.startUi && typeof parsed.startUi === "object" ? parsed.startUi : undefined;
    const startUis = Array.isArray(parsed.startUis)
      ? parsed.startUis.filter((item: any) => item && typeof item === "object")
      : startUi
        ? [startUi]
        : [];
    return {
      assets: Array.isArray(parsed.assets) ? parsed.assets : [],
      scenes: Array.isArray(parsed.scenes) ? parsed.scenes : [],
      startUi: startUi || startUis[0],
      startUis,
      updatedTime: parsed.updatedTime || empty.updatedTime
    };
  } catch (error) {
    console.warn("Failed to read game asset library:", error);
    return empty;
  }
}

function writeGameLibrary(library: any) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  fs.writeFileSync(
    GAME_LIBRARY_PATH,
    JSON.stringify({ ...library, updatedTime: new Date().toISOString() }, null, 2),
    "utf-8"
  );
}

type SpritesheetMediaExportSettings = {
  sourceUrl: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  columns: number;
  fps: number;
  filename: string;
};

function parseBoundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function sanitizeDownloadFilename(filename: unknown, extension: string) {
  const fallback = `spritesheet_export.${extension}`;
  const raw = typeof filename === "string" ? path.basename(filename) : fallback;
  const normalized = raw
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const safe = normalized || fallback;
  return safe.toLowerCase().endsWith(`.${extension}`)
    ? safe
    : `${safe.replace(/\.[^.]+$/, "")}.${extension}`;
}

function sanitizeGeneratedImageFilename(filename: unknown, fallbackBase = "spritesheet_recolor") {
  const raw = typeof filename === "string" && filename.trim() ? path.basename(filename.trim()) : `${fallbackBase}.png`;
  const normalized = raw
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const withoutExtension = (normalized || fallbackBase).replace(/\.[^.]+$/, "") || fallbackBase;
  return `${withoutExtension}.png`;
}

function generatedImageMetadata(filename: string) {
  const filePath = path.join(GENERATED_DIR, filename);
  const stat = fs.statSync(filePath);
  return {
    name: filename,
    url: `/generated/${filename}`,
    extension: "png",
    size: stat.size,
    updatedTime: stat.mtime.toISOString()
  };
}

function cleanupTempDir(tempDir: string | null) {
  if (!tempDir) return;
  fs.rm(tempDir, { recursive: true, force: true }, error => {
    if (error) console.warn("Failed to clean spritesheet export temp dir:", error);
  });
}

function runFfmpeg(args: string[]) {
  const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";
  return new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", chunk => {
      stderr += String(chunk);
      if (stderr.length > 12000) stderr = stderr.slice(-12000);
    });
    child.once("error", error => {
      reject(new Error(`Unable to start ffmpeg. Set FFMPEG_PATH if it is not on PATH. ${error.message}`));
    });
    child.once("close", code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}

function resolveGeneratedAssetPath(sourceUrl: string) {
  const parsedPathname = /^https?:\/\//i.test(sourceUrl)
    ? new URL(sourceUrl).pathname
    : sourceUrl.split("?")[0].split("#")[0];
  const decodedPathname = decodeURIComponent(parsedPathname);
  if (!decodedPathname.startsWith("/generated/")) {
    throw Object.assign(new Error("Only generated spritesheet files can be exported by URL."), { statusCode: 400 });
  }

  const relativePath = decodedPathname.slice("/generated/".length);
  const resolvedRoot = path.resolve(GENERATED_DIR);
  const resolvedFile = path.resolve(GENERATED_DIR, relativePath);
  if (resolvedFile !== resolvedRoot && !resolvedFile.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw Object.assign(new Error("Invalid generated asset path."), { statusCode: 400 });
  }
  if (!fs.existsSync(resolvedFile) || !fs.statSync(resolvedFile).isFile()) {
    throw Object.assign(new Error("Spritesheet source file was not found."), { statusCode: 404 });
  }
  return resolvedFile;
}

function writeDataUrlSource(sourceUrl: string, tempDir: string) {
  const match = sourceUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
  if (!match) {
    throw Object.assign(new Error("Unsupported inline spritesheet image data."), { statusCode: 400 });
  }
  const extension = match[1] === "jpeg" ? "jpg" : match[1];
  const filePath = path.join(tempDir, `source.${extension}`);
  fs.writeFileSync(filePath, Buffer.from(match[2], "base64"));
  return filePath;
}

function normalizeExportSettings(body: any): SpritesheetMediaExportSettings {
  return {
    columns: parseBoundedInteger(body?.columns, 1, 1, 64),
    filename: typeof body?.filename === "string" ? body.filename : "spritesheet_export",
    fps: parseBoundedInteger(body?.fps, 8, 1, 60),
    frameCount: parseBoundedInteger(body?.frameCount, 1, 1, 256),
    frameHeight: parseBoundedInteger(body?.frameHeight, 256, 1, 4096),
    frameWidth: parseBoundedInteger(body?.frameWidth, 256, 1, 4096),
    sourceUrl: typeof body?.sourceUrl === "string" ? body.sourceUrl : "",
  };
}

async function extractSpritesheetFrames(sourcePath: string, tempDir: string, settings: SpritesheetMediaExportSettings) {
  const outputFrameCount = settings.frameCount > 1 ? settings.frameCount : Math.max(1, settings.fps);
  for (let outputIndex = 0; outputIndex < outputFrameCount; outputIndex += 1) {
    const frameIndex = settings.frameCount > 1 ? outputIndex : 0;
    const column = frameIndex % settings.columns;
    const row = Math.floor(frameIndex / settings.columns);
    const outputPath = path.join(tempDir, `frame_${String(outputIndex).padStart(4, "0")}.png`);
    await runFfmpeg([
      "-y",
      "-i", sourcePath,
      "-vf", `crop=${settings.frameWidth}:${settings.frameHeight}:${column * settings.frameWidth}:${row * settings.frameHeight}`,
      "-frames:v", "1",
      outputPath
    ]);
  }
}

async function buildProfessionalGif(tempDir: string, settings: SpritesheetMediaExportSettings, outputPath: string) {
  const framePattern = path.join(tempDir, "frame_%04d.png");
  const palettePath = path.join(tempDir, "palette.png");
  await runFfmpeg([
    "-y",
    "-framerate", String(settings.fps),
    "-i", framePattern,
    "-vf", "palettegen=stats_mode=full:reserve_transparent=1",
    palettePath
  ]);
  await runFfmpeg([
    "-y",
    "-framerate", String(settings.fps),
    "-i", framePattern,
    "-i", palettePath,
    "-lavfi", "paletteuse=dither=sierra2_4a:alpha_threshold=128",
    "-loop", "0",
    outputPath
  ]);
}

async function buildProfessionalVideo(tempDir: string, settings: SpritesheetMediaExportSettings, outputPath: string) {
  const framePattern = path.join(tempDir, "frame_%04d.png");
  await runFfmpeg([
    "-y",
    "-framerate", String(settings.fps),
    "-i", framePattern,
    "-vf", "format=rgba",
    "-c:v", "libvpx-vp9",
    "-pix_fmt", "yuva420p",
    "-b:v", "0",
    "-crf", "18",
    "-auto-alt-ref", "0",
    "-metadata:s:v:0", "alpha_mode=1",
    outputPath
  ]);
}

// Initialize Gemini API Client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is missing. Create .env.local with GEMINI_API_KEY before using cloud generation.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Resilient helper with automatic model fallbacks and exponential backoff retries for 503/429 transient errors
async function callGeminiWithRetryAndFallback(ai: GoogleGenAI, parts: any[], config: any, maxRetries = 3) {
  const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Gemini Request] Attempting generation with model ${modelName} (Attempt ${attempt}/${maxRetries})...`);
        const result = await ai.models.generateContent({
          model: modelName,
          contents: { parts },
          config: config
        });
        console.log(`[Gemini Request] Successfully generated with ${modelName} on attempt ${attempt}.`);
        return result;
      } catch (error: any) {
        lastError = error;
        const errString = error.stack || error.message || String(error);
        console.warn(`[Gemini Request] Error using model ${modelName} on attempt ${attempt}:`, errString);

        // Treat 503 (service unavailable/high load), 429 (rate limit), and connection timeout as transient retry-eligible
        const isTransient = errString.includes("503") || 
                            errString.includes("UNAVAILABLE") || 
                            errString.includes("429") || 
                            errString.includes("rate limit") || 
                            errString.includes("overloaded") ||
                            errString.includes("timeout") ||
                            errString.includes("fetch failed");

        if (isTransient && attempt < maxRetries) {
          const delay = Math.pow(2.2, attempt) * 1200 + Math.random() * 800;
          console.log(`[Gemini Request] Transient issue, waiting ${Math.round(delay)}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          // Break standard retry flow and fall back straight to the next model in choice matrix
          break;
        }
      }
    }
  }

  throw lastError || new Error("Failed to generate content after exhausting fallback models and retries.");
}

// Highly detailed elegant procedural animation fallback compiler
function generateProceduralFallback(prompt: string, style: string, frameCount: number): { characterName: string, description: string, frames: string[] } {
  const norm = prompt.toLowerCase();
  let name = "Procedural Nexus Core";
  let desc = "Procedurally generated beautiful, seamless loop sequence.";
  let frames: string[] = [];

  // 1. Slime / Bounce Bouncy jelly monster
  if (norm.includes("slime") || norm.includes("jelly") || norm.includes("blob") || norm.includes("squish") || norm.includes("bounce")) {
    name = "Procedural Bio-Slime (Q寮规恫鎬佹偿)";
    desc = "A 2D organic liquid slime bubble bouncing rhythmically on active floor shadow. Generated procedurally due to high cloud demand.";
    for (let i = 0; i < frameCount; i++) {
      const phase = (i * Math.PI * 2) / frameCount;
      const scaleY = 1.0 + 0.22 * Math.sin(phase);
      const scaleX = 1.0 / Math.sqrt(scaleY);
      const wobbleAngle = 5 * Math.cos(phase * 2);
      const eyeLookX = 6 * Math.sin(phase);
      const faceBobY = 12 * (scaleY - 1.0);
      
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
        <defs>
          <radialGradient id="slimeP" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#38BDF8" />
            <stop offset="60%" stop-color="#0284C7" />
            <stop offset="100%" stop-color="#0369A1" />
          </radialGradient>
          <radialGradient id="highlight" cx="30%" cy="30%" r="40%">
            <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.8" />
            <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="128" cy="216" rx="${75 * scaleX}" ry="${12 * (2.0 - scaleY)}" fill="#082F49" fill-opacity="0.3" />
        <g transform="translate(128, 210) scale(${scaleX}, ${scaleY}) rotate(${wobbleAngle}) translate(-128, -210)">
          <path d="M 60 210 C 50 140, 70 80, 128 80 C 186 80, 206 140, 196 210 C 196 220, 60 220, 60 210 Z" fill="url(#slimeP)" stroke="#0F172A" stroke-width="6" />
          <ellipse cx="100" cy="115" rx="18" ry="9" fill="url(#highlight)" transform="rotate(-15, 100, 115)" />
          <g transform="translate(${eyeLookX}, ${faceBobY})">
            <circle cx="105" cy="155" r="8" fill="#0F172A" />
            <circle cx="102" cy="152" r="3.2" fill="#FFF" />
            <circle cx="151" cy="155" r="8" fill="#0F172A" />
            <circle cx="148" cy="152" r="3.2" fill="#FFF" />
            <ellipse cx="91" cy="162" rx="6" ry="3" fill="#F43F5E" fill-opacity="0.5" />
            <ellipse cx="165" cy="162" rx="6" ry="3" fill="#F43F5E" fill-opacity="0.5" />
            <path d="M 124 163 Q 128 ${167 + 2.5 * Math.sin(phase * 2)} 132 163" fill="none" stroke="#0F172A" stroke-width="3" stroke-linecap="round" />
          </g>
        </g>
      </svg>`;
      frames.push(svg);
    }
  }
  // 2. Coin / Spin
  else if (norm.includes("coin") || norm.includes("spin") || norm.includes("rotate") || norm.includes("orb") || norm.includes("globe")) {
    name = "Procedural Arcane Coin (绉戝够绗︽枃閲戝竵)";
    desc = "A 3D horizontal rotation matrix with active refraction, star emboss, and specular highlights. Created procedurally due to high cloud demand.";
    for (let i = 0; i < frameCount; i++) {
      const angle = (i * Math.PI * 2) / frameCount;
      const cosAngle = Math.cos(angle);
      const absCos = Math.abs(cosAngle);
      const strokeColor = cosAngle > 0 ? "#7C3AED" : "#5B21B6";
      const coinColor = cosAngle > 0 ? "url(#purpleCore)" : "url(#purpleCoreDark)";
      
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
        <defs>
          <radialGradient id="purpleCore" cx="45%" cy="45%" r="55%">
            <stop offset="0%" stop-color="#DDD6FE" />
            <stop offset="60%" stop-color="#A78BFA" />
            <stop offset="100%" stop-color="#6D28D9" />
          </radialGradient>
          <radialGradient id="purpleCoreDark" cx="45%" cy="45%" r="55%">
            <stop offset="0%" stop-color="#A78BFA" />
            <stop offset="70%" stop-color="#7C3AED" />
            <stop offset="100%" stop-color="#4C1D95" />
          </radialGradient>
          <linearGradient id="glowR" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9" />
            <stop offset="40%" stop-color="#FFFFFF" stop-opacity="0" />
            <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
          </linearGradient>
        </defs>
        <ellipse cx="128" cy="220" rx="${85 * (0.8 + 0.1 * Math.sin(angle))}" ry="10" fill="#2E1065" fill-opacity="0.25" />
        <g transform="translate(128, 128)">
          <ellipse cx="0" cy="0" rx="${96 * absCos}" ry="96" fill="#8B5CF6" stroke="${strokeColor}" stroke-width="8" />
          <ellipse cx="0" cy="0" rx="${72 * absCos}" ry="72" fill="${coinColor}" stroke="#C084FC" stroke-width="4" />
          ${absCos > 0.2 ? `
          <g transform="scale(${absCos}, 1)">
            <circle cx="0" cy="0" r="30" fill="none" stroke="#F3E8FF" stroke-width="5" stroke-dasharray="10 5" transform="rotate(${i * 15})" />
            <polygon points="0,-18 5,-5 18,-5 8,4 12,17 0,9 -12,17 -8,4 -18,-5 -5,-5" fill="#FFF" opacity="0.9" />
          </g>
          ` : ""}
          <ellipse cx="0" cy="0" rx="${80 * absCos}" ry="80" fill="url(#glowR)" opacity="0.32" transform="rotate(${-35 + 15 * Math.sin(angle)})" />
        </g>
      </svg>`;
      frames.push(svg);
    }
  }
  // 3. Fire / Flame / Explosion
  else if (norm.includes("fire") || norm.includes("flame") || norm.includes("burn") || norm.includes("plasma") || norm.includes("spark") || norm.includes("explosion") || norm.includes("hot")) {
    name = "Procedural Flame Core (绛夌瀛愭牳蹇?";
    desc = "A hot swirling thermal draft of flickering fire particles and magical dust. Created procedurally due to high cloud demand.";
    for (let i = 0; i < frameCount; i++) {
      const angle = (i * Math.PI * 2) / frameCount;
      const pulseRad = 34 + 6 * Math.sin(angle * 4);
      
      const p1X = 128 + 42 * Math.cos(angle * 2.2);
      const p1Y = 120 + 30 * Math.sin(angle * 1.5 - Math.PI/4);
      const p1Size = 15 + 6 * Math.cos(angle);

      const p2X = 128 + 48 * Math.cos(angle * 1.8 + Math.PI);
      const p2Y = 115 + 35 * Math.sin(angle * 2.1 + Math.PI/3);
      const p2Size = 13 + 5 * Math.sin(angle);

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
        <defs>
          <radialGradient id="fireB" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#FFFFFF" />
            <stop offset="35%" stop-color="#F97316" />
            <stop offset="70%" stop-color="#EA580C" />
            <stop offset="100%" stop-color="#9A3412" stop-opacity="0" />
          </radialGradient>
          <radialGradient id="magmaP" cx="40%" cy="40%" r="50%">
            <stop offset="0%" stop-color="#FCD34D" />
            <stop offset="60%" stop-color="#DC2626" />
            <stop offset="100%" stop-color="#7F1D1D" stop-opacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="128" cy="225" rx="80" ry="12" fill="#E11D48" fill-opacity="0.12" filter="blur(6px)" />
        <g transform="translate(128,128) scale(1.1) translate(-128,-128)">
          <!-- Core rising elements -->
          <circle cx="128" cy="128" r="${pulseRad}" fill="url(#fireB)" />
          
          <!-- Flickering spur 1 -->
          <circle cx="${p1X}" cy="${p1Y}" r="${p1Size}" fill="url(#magmaP)" />
          <!-- Flickering spur 2 -->
          <circle cx="${p2X}" cy="${p2Y}" r="${p2Size}" fill="url(#magmaP)" opacity="0.85" />

          <!-- Tiny ascending heat nodes -->
          <circle cx="${112 + 10 * Math.cos(angle * 3)}" cy="${100 - (i * 6) % 65}" r="${2 + i % 3}" fill="#FDE047" opacity="0.8" />
          <circle cx="${144 + 12 * Math.sin(angle * 2)}" cy="${110 - ((i + 4) * 6) % 70}" r="${1.5 + i % 2.5}" fill="#FFF" opacity="0.9" />
        </g>
      </svg>`;
      frames.push(svg);
    }
  }
  // 4. Sword / Slash / Impact/ Kinetic Strike
  else if (norm.includes("sword") || norm.includes("slash") || norm.includes("blade") || norm.includes("strike") || norm.includes("cut") || norm.includes("impact")) {
    name = "Procedural Kinetic Edge (鐐僵鏂╁嚮)";
    desc = "A physics-modeled action slash leaving glowing light trails and impact sparks. Created procedurally due to high cloud demand.";
    for (let i = 0; i < frameCount; i++) {
      const phase = i / frameCount; // 0 to 1
      const isSlashing = phase >= 0.2 && phase <= 0.7;
      
      // Pivot blade angle sweeps from -45 to 135 degrees
      const angle = -45 + 180 * Math.sin(phase * Math.PI);
      const shadowOpacity = 0.3 * (1.0 - Math.sin(phase * Math.PI));
      
      // Swipe sweep opacity
      const sweepOpacity = isSlashing ? (0.7 - Math.abs(phase - 0.45) * 1.5) : 0;
      
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
        <defs>
          <linearGradient id="bladeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#F43F5E" />
            <stop offset="50%" stop-color="#FDA4AF" />
            <stop offset="100%" stop-color="#E11D48" />
          </linearGradient>
          <radialGradient id="flashG" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#FFFFFF" />
            <stop offset="40%" stop-color="#FFE4E6" />
            <stop offset="100%" stop-color="#BE123C" stop-opacity="0" />
          </radialGradient>
        </defs>
        
        <!-- Floor Shadow -->
        <ellipse cx="128" cy="220" rx="60" ry="8" fill="#4C0519" fill-opacity="${shadowOpacity}" />

        <!-- Neon Strike Sweep Arc -->
        ${isSlashing ? `
        <path d="M 40 180 Q 128 ${80 - 40 * Math.sin(phase * Math.PI)} 216 120" fill="none" stroke="#FDA4AF" stroke-width="${12 + 8 * Math.sin(phase * Math.PI)}" stroke-linecap="round" opacity="${sweepOpacity}" />
        <path d="M 40 180 Q 128 ${80 - 40 * Math.sin(phase * Math.PI)} 216 120" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="${sweepOpacity * 1.2}" />
        ` : ""}

        <!-- Action Sword Pivot Center (128, 140) -->
        <g transform="translate(128, 140) rotate(${angle}) translate(-128, -140)">
          <!-- Sword hilt/grip -->
          <rect x="124" y="140" width="8" height="40" fill="#4C1D95" rx="3" stroke="#1E1B4B" stroke-width="2" />
          <!-- Crossguard -->
          <rect x="110" y="132" width="36" height="10" fill="#F59E0B" rx="2" stroke="#1E1B4B" stroke-width="2" />
          <!-- Gem in pommel -->
          <circle cx="128" cy="174" r="3" fill="#3B82F6" />
          
          <!-- Sword Metal Blade -->
          <path d="M 121 132 L 121 40 L 128 20 L 135 40 L 135 132 Z" fill="url(#bladeGrad)" stroke="#9F1239" stroke-width="3" />
          <!-- Center ridge shine line -->
          <line x1="128" y1="30" x2="128" y2="132" stroke="#FFE4E6" stroke-width="1.5" />
        </g>
        
        <!-- Dynamic flash impact spark at active point -->
        ${phase > 0.4 && phase < 0.6 ? `
        <circle cx="160" cy="110" r="30" fill="url(#flashG)" filter="blur(3px)" />
        <polygon points="160,85 163,105 185,110 163,115 160,135 157,115 135,110 157,105" fill="#FFF" />
        ` : ""}
      </svg>`;
      frames.push(svg);
    }
  }
  // 5. Wings / Flight / Hover
  else if (norm.includes("bird") || norm.includes("bat") || norm.includes("wing") || norm.includes("fly") || norm.includes("flight") || norm.includes("ghost") || norm.includes("hover")) {
    name = "Procedural Airborne Flyer (绌轰腑灏忕簿鐏?";
    desc = "Rhythmic wing flapping and altitude oscillations establishing gorgeous loop continuity. Created procedurally due to high cloud demand.";
    for (let i = 0; i < frameCount; i++) {
      const angle = (i * Math.PI * 2) / frameCount;
      const flap = Math.sin(angle);
      const bobY = 14 * Math.cos(angle);
      const shadowSize = 58 - bobY * 0.7;

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
        <defs>
          <radialGradient id="ghostB" cx="45%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#E0F2FE" />
            <stop offset="60%" stop-color="#7DD3FC" />
            <stop offset="100%" stop-color="#0369A1" />
          </radialGradient>
        </defs>
        <ellipse cx="128" cy="225" rx="${shadowSize}" ry="7" fill="#0284C7" fill-opacity="${0.22 - bobY*0.005}" />
        
        <g transform="translate(0, ${bobY})">
          <!-- Left Wing flapping -->
          <g stroke="#0369A1" stroke-width="4" stroke-linejoin="round">
            <path d="M 110 120 C 80 ${120 + 75 * flap}, 45 ${120 - 55 * flap}, 30 ${120 - 25 * flap} 
                     C 48 ${120 - 5 * flap}, 68 ${120 + 10 * flap}, 90 ${120 + 8} Z" fill="#38BDF8" />
          </g>
          
          <!-- Right Wing flapping -->
          <g stroke="#0369A1" stroke-width="4" stroke-linejoin="round">
            <path d="M 146 120 C 176 ${120 + 75 * flap}, 211 ${120 - 55 * flap}, 226 ${120 - 25 * flap} 
                     C 208 ${120 - 5 * flap}, 188 ${120 + 10 * flap}, 166 ${120 + 8} Z" fill="#38BDF8" />
          </g>

          <!-- Cute Flying Body -->
          <circle cx="128" cy="120" r="22" fill="url(#ghostB)" stroke="#0284C7" stroke-width="4.5" />
          
          <!-- Cute face details -->
          <circle cx="119" cy="116" r="3.5" fill="#0F172A" />
          <circle cx="117" cy="114" r="1" fill="#FFF" />
          <circle cx="137" cy="116" r="3.5" fill="#0F172A" />
          <circle cx="135" cy="114" r="1" fill="#FFF" />
          
          <!-- Heart cheeks blush -->
          <ellipse cx="112" cy="123" rx="4" ry="2" fill="#F43F5E" fill-opacity="0.5" />
          <ellipse cx="144" cy="123" rx="4" ry="2" fill="#F43F5E" fill-opacity="0.5" />
          
          <!-- Whistling mouth -->
          <circle cx="128" cy="124" r="3.5" fill="none" stroke="#0F172A" stroke-width="2.5" />
        </g>
      </svg>`;
      frames.push(svg);
    }
  }
  // 6. Generic / Kaleidoscope Portal Star
  else {
    name = "Procedural Astral Spark (鏄熺晫浼犻€侀棬)";
    desc = "A beautiful astronomical spark burst with rotating ring emissions and expanding scales. Created procedurally due to high cloud demand.";
    for (let i = 0; i < frameCount; i++) {
      const angle = (i * Math.PI * 2) / frameCount;
      const spinAngle = i * (360 / frameCount);
      const pulseSize = 1.0 + 0.12 * Math.sin(angle * 2);
      
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
        <defs>
          <radialGradient id="sparkGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#FFF" />
            <stop offset="30%" stop-color="#FCD34D" />
            <stop offset="70%" stop-color="#F59E0B" />
            <stop offset="100%" stop-color="#D97706" stop-opacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="128" cy="222" rx="70" ry="10" fill="#78350F" fill-opacity="0.18" />
        
        <!-- Rotating and pulsing central kaleidoscope star structure -->
        <g transform="translate(128, 128) rotate(${spinAngle}) scale(${pulseSize}) translate(-128, -128)">
          <!-- Outer orbital dashes ring -->
          <circle cx="128" cy="128" r="82" fill="none" stroke="#F59E0B" stroke-width="3" stroke-dasharray="14 10" opacity="0.65" />
          <!-- Inner solid ring -->
          <circle cx="128" cy="128" r="54" fill="none" stroke="#FBBF24" stroke-width="2.5" opacity="0.45" />

          <!-- Dynamic spikes -->
          <polygon points="128,38 135,100 218,128 135,156 128,218 121,156 38,128 121,100" fill="url(#sparkGrad)" stroke="#B45309" stroke-width="2" />
          <polygon points="128,68 132,112 188,128 132,144 128,188 124,144 68,128 124,112" fill="#FFF" opacity="0.85" />
          
          <!-- Center hot node -->
          <circle cx="128" cy="128" r="16" fill="#FFFFFF" />
        </g>
      </svg>`;
      frames.push(svg);
    }
  }

  return { characterName: name, description: desc + " [Procedural Engine Bypassed]", frames };
}

// Health Check API
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", time: new Date().toISOString() });
});

app.get("/api/spritesheet/latest", (req, res) => {
  if (latestGeneratedSprite) {
    return res.json({ sprite: latestGeneratedSprite });
  }
  try {
    const manifestCandidates = [
      path.join(PROJECT_ROOT, "public", "generated", "latest_sprite.json"),
      path.join(process.cwd(), "public", "generated", "latest_sprite.json")
    ];
    const manifestPath = manifestCandidates.find(candidate => fs.existsSync(candidate));
    if (manifestPath) {
      const manifestText = fs.readFileSync(manifestPath, "utf8").replace(/^\\uFEFF/, "");
      return res.json({ sprite: JSON.parse(manifestText) });
    }
  } catch (error) {
    console.warn("Failed to load latest sprite manifest:", error);
  }
  res.json({ sprite: null });
});

async function handleSpritesheetMediaExport(payload: any, res: express.Response) {
  let tempDir: string | null = null;

  try {
    const format = payload?.format;
    if (format !== "gif" && format !== "video") {
      return res.status(400).json({ error: "format must be gif or video" });
    }

    const settings = normalizeExportSettings(payload);
    if (!settings.sourceUrl) {
      return res.status(400).json({ error: "sourceUrl is required" });
    }

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gorest-spritesheet-export-"));
    const sourcePath = settings.sourceUrl.startsWith("data:")
      ? writeDataUrlSource(settings.sourceUrl, tempDir)
      : resolveGeneratedAssetPath(settings.sourceUrl);
    const extension = format === "gif" ? "gif" : "webm";
    const outputPath = path.join(tempDir, `export.${extension}`);

    await extractSpritesheetFrames(sourcePath, tempDir, settings);
    if (format === "gif") {
      await buildProfessionalGif(tempDir, settings, outputPath);
    } else {
      await buildProfessionalVideo(tempDir, settings, outputPath);
    }

    res.download(outputPath, sanitizeDownloadFilename(settings.filename, extension), error => {
      if (error) console.warn("Failed to send spritesheet media export:", error);
      cleanupTempDir(tempDir);
    });
  } catch (error: any) {
    cleanupTempDir(tempDir);
    console.warn("Spritesheet media export failed:", error);
    res.status(error?.statusCode || 500).json({
      error: error?.message || "Failed to export spritesheet media"
    });
  }
}

app.get("/api/spritesheet/export-media", async (req, res) => {
  await handleSpritesheetMediaExport(req.query, res);
});

app.post("/api/spritesheet/export-media", async (req, res) => {
  await handleSpritesheetMediaExport(req.body, res);
});

app.get("/api/game-library", (req, res) => {
  res.json(readGameLibrary());
});

app.get("/api/generated-assets", (req, res) => {
  try {
    if (!fs.existsSync(GENERATED_DIR)) {
      return res.json({ files: [] });
    }
    const files = fs.readdirSync(GENERATED_DIR, { withFileTypes: true })
      .filter(entry => entry.isFile() && GENERATED_IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map(entry => {
        const filePath = path.join(GENERATED_DIR, entry.name);
        const stat = fs.statSync(filePath);
        return {
          name: entry.name,
          url: `/generated/${entry.name}`,
          extension: path.extname(entry.name).slice(1).toLowerCase(),
          size: stat.size,
          updatedTime: stat.mtime.toISOString()
        };
      })
      .sort((a, b) => b.updatedTime.localeCompare(a.updatedTime) || a.name.localeCompare(b.name));
    res.json({ files });
  } catch (error) {
    console.warn("Failed to list generated assets:", error);
    res.status(500).json({ error: "Failed to list generated assets", files: [] });
  }
});

app.post("/api/generated-assets/image", (req, res) => {
  try {
    const dataUrl = typeof req.body?.dataUrl === "string" ? req.body.dataUrl : "";
    const match = dataUrl.match(/^data:image\/png;base64,([a-z0-9+/=\r\n]+)$/i);
    if (!match) {
      return res.status(400).json({ error: "PNG dataUrl is required" });
    }

    fs.mkdirSync(GENERATED_DIR, { recursive: true });
    const requestedName = sanitizeGeneratedImageFilename(req.body?.filename);
    const baseName = requestedName.replace(/\.png$/i, "");
    let filename = requestedName;
    let outputPath = path.join(GENERATED_DIR, filename);
    let suffix = 2;
    while (fs.existsSync(outputPath)) {
      filename = `${baseName}_${suffix}.png`;
      outputPath = path.join(GENERATED_DIR, filename);
      suffix += 1;
    }

    fs.writeFileSync(outputPath, Buffer.from(match[1].replace(/\s+/g, ""), "base64"));
    res.json({ file: generatedImageMetadata(filename) });
  } catch (error: any) {
    console.warn("Failed to save generated image:", error);
    res.status(500).json({ error: error?.message || "Failed to save generated image" });
  }
});

app.post("/api/game-library/assets", (req, res) => {
  const asset = req.body?.asset;
  if (!asset || !asset.id || !asset.sprite || !Array.isArray(asset.sprite.frames)) {
    return res.status(400).json({ error: "asset with id and sprite.frames is required" });
  }
  const library = readGameLibrary();
  const normalizedAsset = {
    ...asset,
    confirmed: true,
    savedTime: asset.savedTime || new Date().toISOString(),
    updatedTime: new Date().toISOString()
  };
  library.assets = [
    normalizedAsset,
    ...library.assets.filter((item: any) => item.id !== normalizedAsset.id)
  ];
  writeGameLibrary(library);
  res.json({ asset: normalizedAsset, library });
});

app.post("/api/game-library/start-ui", (req, res) => {
  const startUi = req.body?.startUi;
  if (!startUi || typeof startUi !== "object") {
    return res.status(400).json({ error: "startUi settings are required" });
  }
  const library = readGameLibrary();
  const normalizedStartUi = {
    ...startUi,
    id: typeof startUi.id === "string" && startUi.id ? startUi.id : "start_ui_main",
    updatedTime: new Date().toISOString()
  };
  const existingStartUis = Array.isArray(library.startUis) ? library.startUis : [];
  const existingIndex = existingStartUis.findIndex((item: any) => item?.id === normalizedStartUi.id);
  library.startUis = existingIndex >= 0
    ? existingStartUis.map((item: any, index: number) => index === existingIndex ? normalizedStartUi : item)
    : [...existingStartUis, normalizedStartUi];
  library.startUi = library.startUis[0] || normalizedStartUi;
  writeGameLibrary(library);
  res.json({ startUi: normalizedStartUi, startUis: library.startUis, library });
});

app.delete("/api/game-library/start-ui/:id", (req, res) => {
  const library = readGameLibrary();
  const existingStartUis = Array.isArray(library.startUis) ? library.startUis : [];
  library.startUis = existingStartUis.filter((item: any) => item?.id !== req.params.id);
  library.startUi = library.startUis[0];
  writeGameLibrary(library);
  res.json({ startUi: library.startUi, startUis: library.startUis, library });
});

app.delete("/api/game-library/assets/:id", (req, res) => {
  const library = readGameLibrary();
  library.assets = library.assets.filter((item: any) => item.id !== req.params.id);
  library.scenes = library.scenes.map((scene: any) => ({
    ...scene,
    layers: Array.isArray(scene.layers) ? scene.layers.filter((layer: any) => layer.assetId !== req.params.id) : []
  }));
  writeGameLibrary(library);
  res.json({ library });
});

app.post("/api/game-library/scenes", (req, res) => {
  const scene = req.body?.scene;
  if (!scene || !scene.id || !Array.isArray(scene.layers)) {
    return res.status(400).json({ error: "scene with id and layers is required" });
  }
  const library = readGameLibrary();
  const normalizedScene = {
    ...scene,
    savedTime: scene.savedTime || new Date().toISOString(),
    updatedTime: new Date().toISOString()
  };
  library.scenes = [
    normalizedScene,
    ...library.scenes.filter((item: any) => item.id !== normalizedScene.id)
  ];
  writeGameLibrary(library);
  res.json({ scene: normalizedScene, library });
});

app.delete("/api/game-library/scenes/:id", (req, res) => {
  const library = readGameLibrary();
  const beforeCount = library.scenes.length;
  library.scenes = library.scenes.filter((item: any) => item.id !== req.params.id);
  if (library.scenes.length === beforeCount) {
    return res.status(404).json({ error: "Scene not found" });
  }
  writeGameLibrary(library);
  res.json({ library });
});

function sanitizeSvg(svg: string): string {
  let cleaned = (svg || "").trim();
  if (!cleaned.startsWith("<svg")) {
    const startIdx = cleaned.indexOf("<svg");
    if (startIdx !== -1) {
      cleaned = cleaned.substring(startIdx);
    } else {
      cleaned = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">${cleaned}</svg>`;
    }
  }
  const endIdx = cleaned.lastIndexOf("</svg>");
  if (endIdx !== -1) {
    cleaned = cleaned.substring(0, endIdx + 6);
  }
  return cleaned;
}

function splitSpritesheetSvg(sheetSvg: string, frameCount: number, columns: number): string[] {
  const cleaned = sanitizeSvg(sheetSvg);
  const startTagEnd = cleaned.indexOf(">");
  const endTagStart = cleaned.lastIndexOf("</svg>");
  const innerBody = startTagEnd !== -1 && endTagStart !== -1
    ? cleaned.substring(startTagEnd + 1, endTagStart)
    : cleaned;

  const frames: string[] = [];
  for (let idx = 0; idx < frameCount; idx++) {
    const col = idx % columns;
    const row = Math.floor(idx / columns);
    const x = col * 256;
    const y = row * 256;
    frames.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} 256 256" width="256" height="256">${innerBody}</svg>`);
  }
  return frames;
}

function escapeXmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function localMotionForPrompt(prompt: string, frameCount: number, idx: number) {
  const text = (prompt || "").toLowerCase();
  const t = idx / frameCount;
  const wave = Math.sin(t * Math.PI * 2);
  const wave2 = Math.cos(t * Math.PI * 2);
  const jump = Math.sin(t * Math.PI);

  if (/walk|run|走|跑/.test(text)) {
    return { y: Math.abs(wave) * -9, x: wave2 * 3, rotate: wave * 3, scaleX: 1 + Math.abs(wave) * 0.025, scaleY: 1 - Math.abs(wave) * 0.025, fx: "dust" };
  }
  if (/attack|slash|hit|攻击|挥|砍/.test(text)) {
    const strike = Math.sin(Math.min(1, t * 1.65) * Math.PI);
    return { y: strike * -7, x: strike * 8, rotate: -8 + strike * 18, scaleX: 1 + strike * 0.04, scaleY: 1 - strike * 0.02, fx: "slash" };
  }
  if (/jump|跳/.test(text)) {
    return { y: jump * -30, x: wave * 2, rotate: wave * 4, scaleX: 1 + (t > .84 ? .08 : 0), scaleY: 1 - (t > .84 ? .08 : 0), fx: "dust" };
  }
  if (/magic|spell|cast|fire|glow|spark|魔法|施法|火|光|粒子/.test(text)) {
    return { y: wave * -5, x: 0, rotate: wave2 * 2, scaleX: 1 + wave * 0.018, scaleY: 1 - wave * 0.018, fx: "magic" };
  }
  return { y: wave * -5, x: wave2 * 1.5, rotate: wave * 2, scaleX: 1 + wave * 0.025, scaleY: 1 - wave * 0.025, fx: "idle" };
}

function constrainReferenceMotion(motion: { y: number; x: number; rotate: number; scaleX: number; scaleY: number; fx: string }) {
  return {
    ...motion,
    x: Math.max(-10, Math.min(10, motion.x)),
    y: Math.max(-30, Math.min(12, motion.y)),
    rotate: Math.max(-4.5, Math.min(4.5, motion.rotate)),
    scaleX: Math.max(0.94, Math.min(1.05, motion.scaleX)),
    scaleY: Math.max(0.94, Math.min(1.05, motion.scaleY))
  };
}

function localReferenceWalkFrame(href: string, filter: string, ox: number, oy: number, idx: number, frameCount: number) {
  const phase = (idx / frameCount) * Math.PI * 2;
  const step = Math.sin(phase);
  const counter = Math.sin(phase + Math.PI);
  const bob = Math.abs(step) * -5;
  const torsoTilt = Math.sin(phase) * 1.4;
  const leftLeg = step * 10;
  const rightLeg = counter * 10;
  const leftFootX = step * 8;
  const rightFootX = counter * 8;
  const skirtSway = step * 2.4;
  const shadowRx = 42 + Math.abs(step) * 5;

  const ids = {
    upper: `upper_${idx}`,
    skirt: `skirt_${idx}`,
    leftLeg: `left_leg_${idx}`,
    rightLeg: `right_leg_${idx}`,
    leftArm: `left_arm_${idx}`,
    rightArm: `right_arm_${idx}`
  };

  const image = `<use href="#refSprite"/>`;

  return `
    <g id="frame_${idx + 1}">
      <defs>
        <clipPath id="${ids.upper}" clipPathUnits="userSpaceOnUse"><rect x="${ox}" y="${oy}" width="256" height="154"/></clipPath>
        <clipPath id="${ids.skirt}" clipPathUnits="userSpaceOnUse"><rect x="${ox + 62}" y="${oy + 116}" width="132" height="58"/></clipPath>
        <clipPath id="${ids.leftLeg}" clipPathUnits="userSpaceOnUse"><rect x="${ox + 65}" y="${oy + 150}" width="66" height="88"/></clipPath>
        <clipPath id="${ids.rightLeg}" clipPathUnits="userSpaceOnUse"><rect x="${ox + 125}" y="${oy + 150}" width="66" height="88"/></clipPath>
        <clipPath id="${ids.leftArm}" clipPathUnits="userSpaceOnUse"><rect x="${ox + 45}" y="${oy + 74}" width="62" height="122"/></clipPath>
        <clipPath id="${ids.rightArm}" clipPathUnits="userSpaceOnUse"><rect x="${ox + 150}" y="${oy + 74}" width="62" height="122"/></clipPath>
      </defs>
      <ellipse cx="${ox + 128}" cy="${oy + 240}" rx="${shadowRx.toFixed(1)}" ry="8" fill="#0f172a" opacity=".20"/>
      <g transform="translate(${ox + 128} ${oy + 128 + bob}) rotate(${torsoTilt.toFixed(2)}) translate(${-ox - 128} ${-oy - 128})" clip-path="url(#${ids.upper})">
        <g transform="translate(${ox} ${oy})">${image}</g>
      </g>
      <g transform="translate(${ox + 86} ${oy + 104 + bob}) rotate(${(-step * 5).toFixed(2)}) translate(${-ox - 86} ${-oy - 104})" clip-path="url(#${ids.leftArm})">
        <g transform="translate(${ox} ${oy})">${image}</g>
      </g>
      <g transform="translate(${ox + 170} ${oy + 104 + bob}) rotate(${(step * 5).toFixed(2)}) translate(${-ox - 170} ${-oy - 104})" clip-path="url(#${ids.rightArm})">
        <g transform="translate(${ox} ${oy})">${image}</g>
      </g>
      <g transform="translate(${ox + 128} ${oy + 142 + bob}) rotate(${skirtSway.toFixed(2)}) translate(${-ox - 128} ${-oy - 142})" clip-path="url(#${ids.skirt})">
        <g transform="translate(${ox} ${oy})">${image}</g>
      </g>
      <g transform="translate(${ox + 105} ${oy + 153 + bob}) rotate(${leftLeg.toFixed(2)}) translate(${-ox - 105} ${-oy - 153})" clip-path="url(#${ids.leftLeg})">
        <g transform="translate(${leftFootX.toFixed(2)} 0) translate(${ox} ${oy})">${image}</g>
      </g>
      <g transform="translate(${ox + 150} ${oy + 153 + bob}) rotate(${rightLeg.toFixed(2)}) translate(${-ox - 150} ${-oy - 153})" clip-path="url(#${ids.rightLeg})">
        <g transform="translate(${rightFootX.toFixed(2)} 0) translate(${ox} ${oy})">${image}</g>
      </g>
    </g>`;
}function localImageSpritesheet(referenceImage: string, prompt: string, style: string, frameCount: number, columns: number) {
  const rows = Math.ceil(frameCount / columns);
  const width = columns * 256;
  const height = rows * 256;
  const href = escapeXmlAttr(referenceImage);
  const text = (prompt || "").toLowerCase();
  const wantsPixel = /pixel|像素/.test(text + " " + style.toLowerCase());
  const wantsFire = /fire|flame|火/.test(text);
  const wantsMagic = /magic|spell|cast|glow|spark|魔法|光|粒子|施法/.test(text);
  const wantsWalk = /walk|walking|run|走|行走|跑/.test(text);
  const filter = wantsPixel ? "image-rendering:pixelated" : "";

  let cells = "";
  for (let idx = 0; idx < frameCount; idx++) {
    const col = idx % columns;
    const row = Math.floor(idx / columns);
    const ox = col * 256;
    const oy = row * 256;
    const t = idx / frameCount;
    if (wantsWalk) {
      throw new Error("Reference-image walking cycles require Codex image redraw spritesheet generation. Local pseudo-rig walking is intentionally disabled to avoid drift/float artifacts.");
    }
    const motion = constrainReferenceMotion(localMotionForPrompt(prompt, frameCount, idx));
    const cx = ox + 128 + motion.x;
    const cy = oy + 128 + motion.y;
    const shadowScale = 1 - Math.min(0.28, Math.abs(motion.y) / 120);
    const phase = t * Math.PI * 2;

    const fx = motion.fx === "slash" ? `
      <path d="M ${ox + 54} ${oy + 176} Q ${ox + 136} ${oy + 54} ${ox + 214} ${oy + 116}" fill="none" stroke="#f8fbff" stroke-width="8" stroke-linecap="round" opacity="${0.22 + Math.max(0, Math.sin(phase)) * 0.45}"/>
      <path d="M ${ox + 64} ${oy + 184} Q ${ox + 138} ${oy + 78} ${ox + 204} ${oy + 128}" fill="none" stroke="#56c7ff" stroke-width="3" stroke-linecap="round" opacity="${0.25 + Math.max(0, Math.sin(phase)) * 0.55}"/>`
      : (motion.fx === "magic" || wantsMagic || wantsFire) ? Array.from({ length: 8 }).map((_, p) => {
        const a = phase + p * Math.PI * 2 / 8;
        const r = 58 + Math.sin(phase + p) * 8;
        const x = ox + 128 + Math.cos(a) * r;
        const y = oy + 124 + Math.sin(a * 1.15) * r * .55;
        const color = wantsFire ? (p % 2 ? "#ff6a2a" : "#ffd166") : (p % 2 ? "#64d8ff" : "#f6d365");
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(2.5 + (p % 3)).toFixed(1)}" fill="${color}" opacity=".82"/>`;
      }).join("")
      : `<circle cx="${ox + 92 + Math.sin(phase) * 6}" cy="${oy + 82}" r="3" fill="#ffffff" opacity=".5"/>`;

    cells += `
      <g id="frame_${idx + 1}">
        <ellipse cx="${ox + 128}" cy="${oy + 218}" rx="${(58 * shadowScale).toFixed(1)}" ry="9" fill="#0f172a" opacity=".18"/>
        ${fx}
        <g transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${motion.rotate.toFixed(2)}) scale(${motion.scaleX.toFixed(3)} ${motion.scaleY.toFixed(3)}) translate(-128 -128)">
          <image href="${href}" x="38" y="38" width="180" height="180" preserveAspectRatio="xMidYMid meet" style="${filter}"/>
        </g>
      </g>`;
  }

  const spritesheetSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <defs>
      ${wantsWalk ? `<image id="refSprite" href="${href}" x="42" y="10" width="172" height="236" preserveAspectRatio="xMidYMid meet" style="${filter}"/>` : ""}
      <filter id="softShadow"><feGaussianBlur stdDeviation="2"/></filter>
    </defs>
    ${cells}
  </svg>`;

  return {
    characterName: "Local Reference Sprite",
    description: "Local spritesheet generated from the uploaded transparent PNG without cloud AI calls. Walk requests use a layered pseudo-rig so the torso, arms, skirt, and legs move as a continuous cycle while the full character remains inside every 256x256 frame.",
    spritesheetSvg,
    frames: splitSpritesheetSvg(spritesheetSvg, frameCount, columns)
  };
}

function bundleFramesToSpritesheet(frames: string[], frameCount: number, columns: number): string {
  const rows = Math.ceil(frameCount / columns);
  const width = columns * 256;
  const height = rows * 256;
  let body = "";
  frames.slice(0, frameCount).forEach((rawSvg, idx) => {
    const svg = sanitizeSvg(rawSvg);
    const startTagEnd = svg.indexOf(">");
    const endTagStart = svg.lastIndexOf("</svg>");
    const inner = startTagEnd !== -1 && endTagStart !== -1 ? svg.substring(startTagEnd + 1, endTagStart) : svg;
    const x = (idx % columns) * 256;
    const y = Math.floor(idx / columns) * 256;
    body += `<g transform="translate(${x} ${y})">${inner}</g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${body}</svg>`;
}

// Spritesheet Generator Endpoint
app.post("/api/spritesheet/generate", async (req, res) => {
  const { prompt = "", referenceImage, frameCount = 12, style = "Local Sprite" } = req.body;
  const actualFrameCount = frameCount === 12 || frameCount === 16 ? frameCount : 12;
  const sheetColumns = 4;
  const sheetRows = Math.ceil(actualFrameCount / sheetColumns);

  try {
    if (!prompt && !referenceImage) {
      return res.status(400).json({ error: "prompt or referenceImage is required" });
    }

    let result: { characterName: string; description: string; spritesheetSvg: string; frames: string[] };

    if (referenceImage && typeof referenceImage === "string" && referenceImage.includes(";base64,")) {
      result = localImageSpritesheet(referenceImage, prompt, style, actualFrameCount, sheetColumns);
    } else {
      const fallbackResult = generateProceduralFallback(prompt || "local idle sprite", style, actualFrameCount);
      const frames = fallbackResult.frames.slice(0, actualFrameCount);
      while (frames.length < actualFrameCount) {
        frames.push(frames[frames.length - 1] || `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256"></svg>`);
      }
      result = {
        characterName: fallbackResult.characterName,
        description: fallbackResult.description.replace("[Procedural Engine Bypassed]", "[Local Codex Sprite Engine]"),
        frames,
        spritesheetSvg: bundleFramesToSpritesheet(frames, actualFrameCount, sheetColumns)
      };
    }

    const responsePayload = {
      characterName: result.characterName,
      description: result.description,
      frames: result.frames,
      spritesheetSvg: result.spritesheetSvg,
      sheetColumns,
      sheetRows,
      style,
      frameCount: result.frames.length,
      isFallback: false,
      generationMode: referenceImage ? "local_reference_image_spritesheet" : "local_procedural_spritesheet"
    };
    latestGeneratedSprite = {
      id: `latest_${Date.now()}`,
      characterName: responsePayload.characterName,
      description: responsePayload.description,
      frameCount: responsePayload.frameCount,
      style,
      prompt,
      frames: responsePayload.frames,
      createdTime: new Date().toISOString(),
      isPreset: false,
      spritesheetSvg: responsePayload.spritesheetSvg,
      generationMode: responsePayload.generationMode
    };
    res.json(responsePayload);
  } catch (error: any) {
    console.error("Local spritesheet generation failed:", error);
    res.status(500).json({
      error: "Failed to generate local spritesheet",
      details: error.message || String(error)
    });
  }
});
// Configure Vite middleware or production build output
async function startServer() {
  const port = await findAvailablePort(REQUESTED_PORT, "app");

  if (process.env.NODE_ENV !== "production") {
    const hmrPort = await findAvailablePort(Math.max(24678, port + 1), "vite hmr");

    // Development mode
    const vite = await createViteServer({
      server: {
        hmr: { port: hmrPort },
        middlewareMode: true,
        watch: { ignored: RUNTIME_GENERATED_WATCH_IGNORES }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log(`Vite HMR is running on ws://localhost:${hmrPort}`);
  } else {
    // Production mode
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const activePort = await listenWithPortFallback(port);
  console.log(`Server is running on http://localhost:${activePort}`);
}

startServer();























