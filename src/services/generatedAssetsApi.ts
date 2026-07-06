export type RepositoryGeneratedImage = {
  name: string;
  url: string;
  extension: string;
  size: number;
  updatedTime: string;
};

type GeneratedAssetsResponse = {
  files?: RepositoryGeneratedImage[];
};

type SaveGeneratedImageResponse = {
  file?: RepositoryGeneratedImage;
  error?: string;
};

export async function fetchGeneratedAssets(): Promise<RepositoryGeneratedImage[]> {
  const response = await fetch("/api/generated-assets");
  const data = await response.json().catch(() => ({ files: [] })) as GeneratedAssetsResponse;
  return Array.isArray(data.files) ? data.files : [];
}

export async function saveGeneratedImage(dataUrl: string, filename: string, fallbackError = "Failed to save generated image") {
  const response = await fetch("/api/generated-assets/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl, filename }),
  });
  const data = await response.json().catch(() => ({})) as SaveGeneratedImageResponse;
  if (!response.ok || !data.file) throw new Error(data.error || fallbackError);
  return data.file;
}
