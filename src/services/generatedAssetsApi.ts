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

export async function fetchGeneratedAssets(): Promise<RepositoryGeneratedImage[]> {
  const response = await fetch("/api/generated-assets");
  const data = await response.json().catch(() => ({ files: [] })) as GeneratedAssetsResponse;
  return Array.isArray(data.files) ? data.files : [];
}
