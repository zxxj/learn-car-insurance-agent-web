import { http } from "./http";
import type { AGUIHistoryMessage } from "@tdesign-react/chat";

export const MESSAGES_ENDPOINTS = {
  /** 获取某线程的消息(支持分页) */
  list: (threadId: string) => `/conversations/${threadId}/messages`,
  /** 清空消息 */
  clear: () => `/messages`,
} as const;

// 重新导出 AG-UI 消息类型，业务侧统一从 api/* 引入
export type { AGUIHistoryMessage };

/** 后端返回的 MESSAGES_SNAPSHOT 结构 */
export interface MessagesSnapshot {
  messages: AGUIHistoryMessage[];
  /** 可选：线程元信息 */
  threadId?: string;
  /** 可选：是否还有更多历史(hasMore) */
  hasMore?: boolean;
  /** 可选：最早一条消息的 id(用于下次 before 翻页) */
  earliestId?: string;
}

/** 加载历史消息的可选参数 */
export interface FetchHistoryOptions {
  /**
   * 游标分页 - 加载此 id 之前的消息
   * 第一次加载不传,后续每次传当前列表最早一条消息的 id
   */
  before?: string;
  /** 每页条数,默认 10 */
  limit?: number;
}

/** 加载某线程的历史消息(支持分页游标) */
export async function fetchHistoryMessages(
  threadId: string,
  options: FetchHistoryOptions = {},
): Promise<AGUIHistoryMessage[]> {
  const params = new URLSearchParams();
  if (options.before) params.set("before", options.before);
  if (options.limit !== undefined) {
    params.set("limit", String(options.limit));
  }
  const query = params.toString();
  const url = `${MESSAGES_ENDPOINTS.list(threadId)}${query ? `?${query}` : ""}`;

  const data = await http<MessagesSnapshot | AGUIHistoryMessage[]>(url, {
    method: "GET",
  });
  // 兼容两种返回结构:包一层 / 直接是数组
  if (Array.isArray(data)) return data;
  return data?.messages ?? [];
}

/** 清空消息 */
export async function clearHistoryMessages(): Promise<void> {
  await http(MESSAGES_ENDPOINTS.clear(), { method: "DELETE" });
}
