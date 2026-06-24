/**
 * 顶部信息条
 * - <lg : 左侧汉堡按钮唤起侧栏
 * - lg+ : 正常布局
 */
import { useEffect, useRef } from "react";
import { gsap } from "gsap";

interface ChatHeaderProps {
  title?: string;
  status?: "idle" | "pending" | "streaming" | "stop" | "complete" | "error";
  model?: string;
  onMenuClick?: () => void;
}

export function ChatHeader({
  title = "新对话",
  status = "idle",
  model = "jixiaobao · v0.1",
  onMenuClick,
}: ChatHeaderProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    gsap.from(ref.current, {
      duration: 0.9,
      ease: "expo.out",
      delay: 0.8,
    });
  }, []);

  const statusMap: Record<string, { label: string; color: string }> = {
    idle: { label: "就绪", color: "var(--text-tertiary)" },
    pending: { label: "连接中", color: "var(--accent-cyan)" },
    streaming: { label: "生成中", color: "var(--accent)" },
    stop: { label: "已停止", color: "var(--text-tertiary)" },
    complete: { label: "已完成", color: "#86efac" },
    error: { label: "出错", color: "#fda4af" },
  };
  const s = statusMap[status] ?? statusMap.idle;

  return (
    <header
      ref={ref}
      className="shrink-0 border-b border-[var(--border-default)] md:border-[var(--border-subtle)] bg-[var(--bg-elevated)] md:bg-[var(--bg-elevated)]/60 md:backdrop-blur-xl relative safe-pt shadow-[0_2px_18px_-8px_rgba(0,0,0,0.6)] md:shadow-none"
    >
      <div className="h-16 md:h-14 px-5 md:px-6 flex items-center justify-between gap-2 relative">
        {/* 左侧:移动端汉堡 + 桌面端 title/model */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {/* 移动端汉堡按钮 - 大尺寸 + 可见背景,确保深色背景上不隐形 */}
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden relative w-10 h-10 -ml-1 rounded-xl flex items-center justify-center text-[var(--text-primary)] bg-white/[0.06] border border-[var(--border-default)] hover:bg-white/[0.10] hover:border-[var(--border-strong)] active:scale-95 transition-all duration-300 shrink-0"
            aria-label="打开侧栏"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
            {/* 未读小红点 - 视觉锚点 */}
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_6px_var(--accent-glow)]" />
          </button>

          {/* 桌面端 title + model */}
          <div className="hidden md:flex items-center gap-2 sm:gap-3 min-w-0">
            <h2 className="text-[14px] sm:text-[14.5px] font-medium text-[var(--text-primary)] tracking-tight truncate min-w-0">
              {title}
            </h2>
            <span className="hidden sm:inline-block w-px h-4 bg-[var(--border-subtle)] shrink-0" />
            <span className="hidden sm:inline text-[11.5px] text-[var(--text-tertiary)] tracking-wider uppercase truncate">
              {model}
            </span>
          </div>
        </div>

        {/* 中央:移动端标题居中(absolute,不占布局) */}
        <h2 className="md:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 truncate max-w-[40%] text-[14px] sm:text-[14.5px] font-medium text-[var(--text-primary)] tracking-tight pointer-events-none text-center">
          {title}
        </h2>

        {/* 右侧:状态 + 操作 */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full border border-[var(--border-subtle)] bg-white/[0.02]">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background: s.color,
                boxShadow: `0 0 8px ${s.color}`,
              }}
            />
            <span
              className="text-[10.5px] sm:text-[11px] tracking-wider uppercase whitespace-nowrap"
              style={{ color: s.color }}
            >
              {s.label}
            </span>
          </div>

          <button
            type="button"
            className="hidden sm:flex w-8 h-8 rounded-lg items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-all duration-300"
            title="分享"
            aria-label="分享"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="m8.59 13.51 6.83 3.98M15.41 6.51 8.59 10.49" />
            </svg>
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-all duration-300"
            title="设置"
            aria-label="设置"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
