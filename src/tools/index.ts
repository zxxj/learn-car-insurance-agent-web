/**
 * 工具注册中心
 * 在 App 挂载时调用一次 useTools()，把全部工具注册到全局 toolcall registry
 */
import { useAgentToolcall } from "@tdesign-react/chat";
import type { AgentToolcallConfig } from "@tdesign-react/chat";

import { weatherTool } from "./weather";
import { quoteTool } from "./quote";
import {
  queryPaymentResultTool,
  queryPoliciesTool,
  underwriteTool,
} from "./insuranceFlow";

const ALL_TOOLS: AgentToolcallConfig[] = [
  weatherTool,
  quoteTool,
  underwriteTool,
  queryPaymentResultTool,
  queryPoliciesTool,
];

/** 注册所有工具。在 App 顶层调用一次。 */
export function useTools() {
  useAgentToolcall(ALL_TOOLS);
}

export {
  weatherTool,
  quoteTool,
  underwriteTool,
  queryPaymentResultTool,
  queryPoliciesTool,
};
export { useToolcallFallback } from "./toolcallFallback";
