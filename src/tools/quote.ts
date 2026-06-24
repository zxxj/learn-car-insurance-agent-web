/**
 * quote 工具
 * 交互式:渲染保司报价卡片,用户点击按钮通过 respond() 回传动作
 */
import type { AgentToolcallConfig } from "@tdesign-react/chat";
import { QuoteToolComponent } from "./components/QuoteCard";

export const quoteTool: AgentToolcallConfig = {
  name: "quote",
  description: "保险方案报价",
  component: QuoteToolComponent,
};
