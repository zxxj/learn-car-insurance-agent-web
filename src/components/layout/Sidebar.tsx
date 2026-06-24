/**
 * 左侧栏
 * - lg+ : 静态侧栏(常驻)
 * - <lg: fixed 抽屉,带遮罩 + 关闭按钮 (受 open / onClose 控制)
 */
import { useEffect, useRef } from "react";
import { gsap } from "gsap";

interface SidebarProps {
  onNewChat: () => void;
  onClear: () => void;
  loading: boolean;
  /** 移动端是否打开 */
  open: boolean;
  /** 移动端关闭回调 */
  onClose: () => void;
}

const HISTORY = [
  { id: 1, title: "周三的品牌周会摘要", time: "2 小时前" },
  { id: 2, title: "上海天气与行程建议", time: "昨天" },
  { id: 3, title: "帮我重写一段产品文案", time: "昨天" },
  { id: 4, title: "Q3 增长复盘", time: "3 天前" },
  { id: 5, title: "设计稿评审反馈", time: "上周" },
];

export function Sidebar({
  onNewChat,
  onClear,
  loading,
  open,
  onClose,
}: SidebarProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // 历史项入场 (只在大屏跑一次,小屏第一次打开也跑)
  useEffect(() => {
    const items = listRef.current?.querySelectorAll("[data-history-item]");
    if (!items) return;
    gsap.from(items, {
      x: -16,
      opacity: 0,
      duration: 0.7,
      ease: "expo.out",
      stagger: 0.05,
      delay: 0.6,
    });
  }, []);

  // 抽屉显隐动画
  useEffect(() => {
    if (!drawerRef.current) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const xTarget = open ? "0%" : "-100%";

    gsap.to(drawerRef.current, {
      x: xTarget,
      duration: reduce ? 0 : 0.55,
      ease: "expo.inOut",
    });
    if (overlayRef.current) {
      gsap.to(overlayRef.current, {
        opacity: open ? 1 : 0,
        duration: reduce ? 0 : 0.4,
        ease: "expo.out",
        onStart: () => {
          if (open) {
            overlayRef.current!.style.pointerEvents = "auto";
            overlayRef.current!.style.visibility = "visible";
          }
        },
        onComplete: () => {
          if (!open && overlayRef.current) {
            overlayRef.current.style.pointerEvents = "none";
            overlayRef.current.style.visibility = "hidden";
          }
        },
      });
    }
  }, [open]);

  // 移动端打开时禁止 body 滚动
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const handleNewChat = () => {
    onNewChat();
    onClose();
  };

  const handleClear = () => {
    onClear();
    onClose();
  };

  return (
    <>
      {/* 移动端遮罩 */}
      <div
        ref={overlayRef}
        onClick={onClose}
        aria-hidden
        className="lg:hidden fixed inset-0 z-[60] opacity-0 invisible"
        style={{
          background: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />

      <aside
        ref={drawerRef}
        className="w-[280px] sm:w-[300px] shrink-0 h-full flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-elevated)]/95 backdrop-blur-xl z-[70]
                   fixed lg:static inset-y-0 left-0 -translate-x-full lg:translate-x-0"
      >
        {/* 品牌区 */}
        <div className="px-5 pt-5 pb-4 flex items-center gap-3 safe-pt">
          <div className="relative w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
            <div
              className="absolute inset-0"
              style={{ background: "var(--grad-violet)" }}
            />
            <span className="relative z-10 text-[#08080a] font-bold text-sm tracking-tight">
              J
            </span>
            <div className="absolute inset-0 ring-1 ring-inset ring-white/20 rounded-xl" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)] truncate">
              季小保
            </span>
            <span className="text-[11px] text-[var(--text-tertiary)] tracking-wide truncate">
              ASSISTANT · v0.1
            </span>
          </div>
          {/* 移动端关闭按钮 */}
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-all duration-300 shrink-0"
            aria-label="关闭侧栏"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 新建对话按钮 */}
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={handleNewChat}
            disabled={loading}
            className="btn-luxe primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>新建对话</span>
          </button>
        </div>

        {/* 历史区 */}
        <div className="flex-1 overflow-y-auto px-3 no-scrollbar">
          <div className="px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            Recent
          </div>
          <div ref={listRef} className="flex flex-col gap-0.5">
            {HISTORY.map((h) => (
              <button
                key={h.id}
                data-history-item
                type="button"
                onClick={onClose}
                className="group text-left px-3 py-2.5 rounded-lg bg-white/[0.015] hover:bg-white/[0.05] active:bg-white/[0.08] border border-transparent hover:border-[var(--border-subtle)] transition-all duration-300 flex flex-col gap-0.5"
              >
                <span className="text-[14px] font-medium text-[var(--text-primary)]/90 group-hover:text-[var(--text-primary)] transition-colors duration-300 truncate">
                  {h.title}
                </span>
                <span className="text-[11.5px] text-[var(--text-tertiary)]/90 group-hover:text-[var(--text-secondary)] transition-colors duration-300">
                  {h.time}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 底部用户区 */}
        <div className="px-4 py-3 border-t border-[var(--border-subtle)] flex items-center gap-3 safe-pb">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-300/30 to-cyan-300/20 flex items-center justify-center text-[12px] font-semibold text-[var(--text-primary)] ring-1 ring-white/10 shrink-0">
            ZX
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] text-[var(--text-primary)] truncate">
              zhang.xinxin
            </div>
            <div className="text-[10.5px] text-[var(--text-tertiary)] truncate">
              Pro · workspace
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:text-red-300 hover:bg-white/[0.04] transition-all duration-300"
            aria-label="清空消息"
            title="清空消息"
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
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
          </button>
        </div>
      </aside>
    </>
  );
}
