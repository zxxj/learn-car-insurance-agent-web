import { instance, HttpError } from "./http";

export const FILES_ENDPOINTS = {
  upload: "/files",
} as const;

export interface UploadResponse {
  url: string;
}

/** 上传文件(FormData), 60s 超时; 返回后端给出的可访问 URL */
export async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  // 走底层 instance(不走 http() 是为了不强制 application/json 头,
  // 且需要独立超时); 错误仍由响应拦截器统一转 HttpError
  // 注意: FormData 不要手动设 Content-Type, axios 会自动加 boundary
  const { data } = await instance.post<UploadResponse>(
    FILES_ENDPOINTS.upload,
    formData,
    { timeout: 60_000 },
  );

  if (!data?.url) {
    throw new HttpError(200, data, "Upload response missing 'url' field");
  }
  return data.url;
}
