import type { ChatServiceConfig, ChatRequestParams } from "@tdesign-react/chat";

export const CHAT_ENDPOINTS = {
  stream: (threadId: string) => `/conversations/${threadId}/chat`,
} as const;

/**
 * 创建 ChatBot 用的服务配置
 * - 使用 AG-UI 协议（自动解析 RUN_/THINKING_/TEXT_MESSAGE_/TOOL_CALL_* 事件）
 * - @param threadId 会话 ID,默认 "1"
 */
export function createChatServiceConfig(
  threadId: string = "2",
): ChatServiceConfig {
  return {
    endpoint: CHAT_ENDPOINTS.stream(threadId),
    protocol: "agui",
    stream: true,
    onRequest: (params: ChatRequestParams) => ({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: params.prompt ?? "" }),
    }),
    onError: (err) => {
      console.error("[ChatStream] 请求失败:", err);
    },
  };
}
