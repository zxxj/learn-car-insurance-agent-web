/**
 * 通用工具调用徽章 - 暗色风格
 * 通过工厂函数把 toolName 通过闭包注入
 */
import type { ToolcallComponentProps } from "@tdesign-react/chat";

export function makeToolBadge(toolName: string) {
  return function ToolBadge({ status }: ToolcallComponentProps) {
    const stateColor =
      status === "complete"
        ? "#86efac"
        : status === "error"
          ? "#fda4af"
          : "var(--accent)";
    const stateLabel =
      status === "complete" ? "完成" : status === "error" ? "失败" : "调用中…";

    return (
      <div
        className="my-1.5 inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-[var(--border-subtle)] backdrop-blur-sm text-[12.5px]"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.012) 100%)",
        }}
      >
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center"
          style={{ background: "var(--accent-soft)" }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke={stateColor}
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-medium text-[var(--text-primary)] tracking-tight">
            {toolName}
          </span>
          <span
            className="text-[10.5px] tracking-wider uppercase"
            style={{ color: stateColor }}
          >
            {stateLabel}
          </span>
        </div>
      </div>
    );
  };
}
