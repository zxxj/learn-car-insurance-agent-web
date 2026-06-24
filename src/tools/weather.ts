/**
 * get_weather 工具
 * 非交互式：handler 让 SDK 在 JSON.parse 失败时 fallback 到原字符串
 */
import type { AgentToolcallConfig } from "@tdesign-react/chat";
import { makeToolBadge } from "./components/ToolBadge";

export const weatherTool: AgentToolcallConfig = {
  name: "get_weather",
  description: "查询天气",
  parameters: [{ name: "city", type: "string" }],
  handler: async (_args: unknown, backendResult: unknown) => backendResult,
  component: makeToolBadge("get_weather"),
};
