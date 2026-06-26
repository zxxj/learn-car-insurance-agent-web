import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  isAxiosError,
} from "axios";

/** 业务侧统一抛出的 HTTP 错误(原样保留, 业务代码无需感知 axios) */
export class HttpError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

/** 业务侧调用的请求参数(基于 axios AxiosRequestConfig) */
export interface RequestOptions extends Omit<
  AxiosRequestConfig,
  "url" | "data" | "params" | "signal"
> {
  /** 请求体(自动 JSON 序列化) */
  body?: unknown;
  /** 超时时间(毫秒), 默认 30s */
  timeout?: number;
  /** 查询参数 */
  params?: Record<string, string | number | boolean | undefined>;
}

/** 共享 axios 实例(供需要绕过 http() 默认头的场景直接使用, 如文件上传) */
export const instance: AxiosInstance = axios.create({
  timeout: 30_000,
  // 注意: 这里不设 Content-Type。axios 的默认 transformRequest 看到
  // Content-Type: application/json + FormData 时, 会把 FormData 转成 JSON
  // 发出去(导致 422)。http() 自己显式设了 JSON, 文件上传走 FormData 时
  // 由 axios/浏览器自动补 multipart/form-data; boundary。
  headers: {
    Accept: "application/json",
  },
});

/**
 * 响应拦截器: 把 axios 抛出的所有错误统一包装成 HttpError
 * - 有 response: 携带 status / body
 * - 无 response(网络/超时/取消): status = 0, body = undefined
 */
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isAxiosError(error)) {
      const status = error.response?.status ?? 0;
      const body = error.response?.data;
      const message = status
        ? `HTTP ${status} ${error.response?.statusText ?? error.message}`
        : error.message;
      return Promise.reject(new HttpError(status, body, message));
    }
    return Promise.reject(error);
  },
);

/** 业务侧统一入口(签名保持稳定, 内部已切换为 axios) */
export async function http<T = unknown>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, params, headers, ...rest } = options;
  const response = await instance.request<T>({
    url,
    method: rest.method ?? "GET",
    ...rest,
    params,
    data: body,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...headers,
    },
  });
  return response.data;
}
