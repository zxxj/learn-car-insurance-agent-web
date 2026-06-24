/**
 * 保险流程工具
 * 后端已执行业务逻辑，前端只展示工具调用完成状态。
 */
import type { AgentToolcallConfig } from "@tdesign-react/chat";
import { makeToolBadge } from "./components/ToolBadge";

function makeInsuranceFlowTool(
  name: "underwrite" | "query_payment_result" | "query_policies",
  description: string,
): AgentToolcallConfig {
  return {
    name,
    description,
    handler: async (_args: unknown, backendResult: unknown) => backendResult,
    component: makeToolBadge(name),
  };
}

export const underwriteTool = makeInsuranceFlowTool("underwrite", "发起核保");

export const queryPaymentResultTool = makeInsuranceFlowTool(
  "query_payment_result",
  "查询支付结果",
);

export const queryPoliciesTool = makeInsuranceFlowTool(
  "query_policies",
  "查询保单",
);
