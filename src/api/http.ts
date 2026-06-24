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

export interface RequestOptions extends Omit<RequestInit, "body"> {
  /** 请求体（自动 JSON 序列化） */
  body?: unknown;
  /** 超时时间（毫秒），默认 30s */
  timeout?: number;
  /** 查询参数 */
  params?: Record<string, string | number | boolean | undefined>;
}

function buildURL(url: string, params?: RequestOptions["params"]): string {
  if (!params) return url;
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) usp.set(k, String(v));
  }
  const qs = usp.toString();
  return qs ? `${url}${url.includes("?") ? "&" : "?"}${qs}` : url;
}

export async function http<T = unknown>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, timeout = 30_000, params, headers, ...init } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(buildURL(url, params), {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    // 204 No Content
    if (response.status === 204) return undefined as T;

    const text = await response.text();
    const data = text ? safeJsonParse(text) : undefined;

    if (!response.ok) {
      throw new HttpError(
        response.status,
        data,
        `HTTP ${response.status} ${response.statusText}`,
      );
    }

    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
