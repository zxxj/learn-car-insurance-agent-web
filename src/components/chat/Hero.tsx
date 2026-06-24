/**
 * 空态 Hero - 首屏强视觉入场
 * 包含:hero 标题 (压缩展开) + 卡片 stagger + parallax 光斑
 */
import { forwardRef } from "react";

export const HeroMaskLine = forwardRef<
  HTMLDivElement,
  { children: React.ReactNode }
>(function HeroMaskLine({ children }, ref) {
  return (
    <div ref={ref} className="mask-line">
      <span>{children}</span>
    </div>
  );
});

interface HeroCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick?: () => void;
}

export const HeroCard = forwardRef<HTMLDivElement, HeroCardProps>(
  function HeroCard({ icon, title, desc, onClick }, ref) {
    return (
      <div
        ref={ref}
        onClick={onClick}
        className="reveal group relative cursor-pointer overflow-hidden rounded-xl sm:rounded-2xl p-3.5 sm:p-5 border border-[var(--border-subtle)] bg-gradient-to-br from-white/[0.025] to-white/[0.005] hover:border-[var(--border-default)] active:scale-[0.98] transition-all duration-700"
        style={{ transitionTimingFunction: "var(--ease-out-expo)" }}
      >
        {/* hover 光晕 */}
        <div
          className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000"
          style={{
            background:
              "radial-gradient(circle, rgba(167,139,250,0.18), transparent 70%)",
            filter: "blur(20px)",
            transitionTimingFunction: "var(--ease-out-expo)",
          }}
        />
        <div className="relative z-10 flex flex-row sm:flex-col items-center sm:items-start gap-3 sm:gap-3.5">
          {/* 图标 */}
          <div className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center border border-[var(--border-subtle)] bg-white/[0.025] text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors duration-500">
            {icon}
          </div>
          {/* 文案 */}
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] sm:text-[14px] font-medium text-[var(--text-primary)] tracking-tight mb-0 sm:mb-1.5 truncate sm:whitespace-normal">
              {title}
            </div>
            <div className="hidden sm:block text-[12.5px] text-[var(--text-tertiary)] leading-relaxed">
              {desc}
            </div>
          </div>
          {/* 移动端右箭头 */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="sm:hidden shrink-0 text-[var(--text-tertiary)] group-hover:text-[var(--accent)] transition-colors duration-500"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </div>
      </div>
    );
  },
);
