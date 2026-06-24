/**
 * 工具调用 fallback - 后端若调用未在 registry 中注册的工具,
 * 自动注册一个非交互式徽章,避免 ToolCallRenderer 渲染失败。
 *
 * 触发时机:messages 变化时,扫描其中所有 toolcall content,
 * 给未注册的 toolCallName 注册 fallback badge。
 *
 * 严格 TDesign:不绕开 ToolCallRenderer,而是为它提供完整 registry。
 */
import { useEffect } from "react";
import { agentToolcallRegistry, isToolCallContent } from "@tdesign-react/chat";
import type {
  AgentToolcallConfig,
  AIMessageContent,
  ChatMessagesData,
  ToolCall,
} from "@tdesign-react/chat";
import { makeToolBadge } from "./components/ToolBadge";

function ensureFallback(name: string) {
  if (agentToolcallRegistry.get(name)) return;
  agentToolcallRegistry.register({
    name,
    description: name,
    handler: async (_args: unknown, backendResult: unknown) => backendResult,
    component: makeToolBadge(name),
  } as AgentToolcallConfig);
}

/** 从 AIMessageContent 中抽取 toolCallName,无则返回 undefined */
function getToolCallName(item: AIMessageContent): string | undefined {
  if (!isToolCallContent(item)) return undefined;
  const tc = (item as { data?: ToolCall }).data;
  return tc?.toolCallName;
}

export function useToolcallFallback(messages: ChatMessagesData[]) {
  useEffect(() => {
    for (const m of messages) {
      const content = m.content;
      if (!Array.isArray(content)) continue;
      for (const item of content as AIMessageContent[]) {
        const name = getToolCallName(item);
        if (name) ensureFallback(name);
      }
    }
  }, [messages]);
}
