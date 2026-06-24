import { HttpError } from "./http";

export const FILES_ENDPOINTS = {
  upload: "/files",
} as const;

export interface UploadResponse {
  url: string;
}

export async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(FILES_ENDPOINTS.upload, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      throw new HttpError(
        response.status,
        data,
        `Upload failed: HTTP ${response.status}`,
      );
    }

    const data = (await response.json()) as UploadResponse;
    if (!data?.url) {
      throw new HttpError(
        response.status,
        data,
        "Upload response missing 'url' field",
      );
    }
    return data.url;
  } finally {
    clearTimeout(timer);
  }
}
