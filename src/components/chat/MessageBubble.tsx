/**
 * 消息气泡 - 用户/助手两种形态
 * 入场动画由父组件 MessageList 控制
 * 内容渲染:支持 text / markdown(含图片语法) / tool call
 * - markdown 用 TDesign 的 <ChatMarkdown>(基于 cherry-markdown,支持 GFM + 流式)
 * - 多张图片走横向画廊 (固定大小 flex-wrap)
 * - 单张图片走 markdown 原生渲染
 * - 图片点击 → 走事件委托 → React Portal 打开 body 级 lightbox
 * - 多图 lightbox 支持:左右按钮 / 键盘 ←→ / 触屏滑动 / 圆点指示
 */
import { forwardRef, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ChatMessagesData } from "@tdesign-react/chat";
import {
  ChatMarkdown,
  agentToolcallRegistry,
  isToolCallContent,
  ToolCallRenderer,
} from "@tdesign-react/chat";
import type { AgentToolcallConfig, ToolCall } from "@tdesign-react/chat";
import { makeToolBadge } from "../../tools/components/ToolBadge";

interface MessageBubbleProps {
  message: ChatMessagesData;
  isLast: boolean;
}

interface ContentItem {
  type: string;
  data?: unknown;
}

interface ImageItem {
  alt: string;
  url: string;
}

function isSafeImageUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** 解析 markdown 中的图片语法 `![alt](url)` */
const MD_IMG_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function splitMarkdownImages(text: string): {
  images: ImageItem[];
  rest: string;
} {
  const images: ImageItem[] = [];
  const rest = text.replace(MD_IMG_RE, (_, alt: string, url: string) => {
    if (isSafeImageUrl(url)) {
      images.push({ alt, url });
      return "";
    }
    return _;
  });
  return { images, rest: rest.replace(/\n{3,}/g, "\n\n").trim() };
}

// =========================================================
// Lightbox - 通过 React Portal 渲染到 document.body
// 多图:左右按钮 / 键盘 ←→ / 触屏滑动 / 圆点指示
// =========================================================
function ImageLightbox({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: ImageItem[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const total = images.length;
  const hasMany = total > 1;
  const current = images[index];

  // 键盘 ← → ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (hasMany && e.key === "ArrowLeft") {
        onIndexChange((index - 1 + total) % total);
      } else if (hasMany && e.key === "ArrowRight") {
        onIndexChange((index + 1) % total);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onIndexChange, index, total, hasMany]);

  // 打开时锁滚动
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // 触屏滑动 - 计算 touchstart/touchend 横向位移,>50px 触发翻页
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!hasMany || touchStartX.current == null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const dx = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 50) {
      if (dx > 0) onIndexChange((index - 1 + total) % total);
      else onIndexChange((index + 1) % total);
    }
  };

  const goPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    onIndexChange((index - 1 + total) % total);
  };
  const goNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    onIndexChange((index + 1) % total);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="lb-overlay fixed inset-0 z-[9999] flex items-center justify-center cursor-zoom-out select-none"
      style={{
        background: "rgba(0, 0, 0, 0.88)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        animation: "lb-fade-in 0.22s ease-out",
      }}
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 关闭 */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 w-11 h-11 rounded-full flex items-center justify-center text-white transition-colors z-20 lb-btn"
        style={{
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.12)",
          animation: "lb-fade-in 0.3s 0.05s both",
        }}
        aria-label="关闭"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      {/* 左 - 仅多图 */}
      {hasMany && (
        <button
          type="button"
          onClick={goPrev}
          aria-label="上一张"
          className="lb-nav lb-btn absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white"
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}

      {/* 右 - 仅多图 */}
      {hasMany && (
        <button
          type="button"
          onClick={goNext}
          aria-label="下一张"
          className="lb-nav lb-btn absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white"
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      )}

      {/* 当前图片 - 用 key 强制重挂载,触发 lb-zoom-in 重新播放 */}
      <img
        key={current.url}
        src={current.url}
        alt={current.alt}
        className="lb-image"
        style={{
          maxWidth: "84vw",
          maxHeight: "82vh",
          objectFit: "contain",
          borderRadius: 12,
          boxShadow: "0 30px 80px -20px rgba(0,0,0,0.7)",
          animation: "lb-zoom-in 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      {/* 圆点指示器 - 居中底部 */}
      {hasMany && (
        <div
          className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.1)",
            animation: "lb-fade-in 0.3s 0.08s both",
          }}
        >
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onIndexChange(i);
              }}
              aria-label={`第 ${i + 1} 张`}
              className="lb-dot"
              style={{
                width: i === index ? 18 : 6,
                height: 6,
                borderRadius: 999,
                background:
                  i === index
                    ? "rgba(255,255,255,0.95)"
                    : "rgba(255,255,255,0.35)",
                transition: "all 0.35s var(--ease-out-expo)",
                padding: 0,
                border: "none",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      )}

      {/* 计数文字 - 右下 */}
      {hasMany && (
        <div
          className="absolute bottom-5 right-5 sm:bottom-6 sm:right-6 z-20 text-[12px] tabular-nums text-white/70 tracking-wider"
          style={{
            fontVariantNumeric: "tabular-nums",
            animation: "lb-fade-in 0.3s 0.1s both",
          }}
        >
          {index + 1} / {total}
        </div>
      )}
    </div>,
    document.body,
  );
}

// =========================================================
// 多图横向画廊 - flex-wrap,固定大小,圆角
// =========================================================
function ImageGallery({
  images,
  onImageClick,
}: {
  images: ImageItem[];
  onImageClick: (i: number) => void;
}) {
  if (images.length === 0) return null;
  return (
    <div
      className="img-gallery"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        marginTop: 2,
        marginBottom: 4,
      }}
    >
      {images.map((img, i) => (
        <button
          key={`${img.url}-${i}`}
          type="button"
          onClick={() => onImageClick(i)}
          aria-label={img.alt || `图片 ${i + 1}`}
          className="img-gallery__thumb"
          style={{
            position: "relative",
            width: 96,
            height: 96,
            padding: 0,
            border: "1px solid var(--border-subtle)",
            borderRadius: 10,
            overflow: "hidden",
            background: "rgba(255,255,255,0.02)",
            cursor: "zoom-in",
            transition:
              "transform 0.4s var(--ease-out-expo), border-color 0.3s",
            animation: `img-pop-in 0.4s ${0.04 * i}s var(--ease-out-expo) both`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.04)";
            e.currentTarget.style.borderColor = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.borderColor = "var(--border-subtle)";
          }}
        >
          <img
            src={img.url}
            alt={img.alt}
            loading="lazy"
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              pointerEvents: "none",
            }}
          />
          {/* 多图角标 - 提示可点开看更多 */}
          {images.length > 1 && (
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                fontSize: 9.5,
                fontWeight: 600,
                letterSpacing: "0.04em",
                color: "white",
                background: "rgba(0,0,0,0.55)",
                padding: "1px 5px",
                borderRadius: 999,
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
                pointerEvents: "none",
              }}
            >
              {i + 1}/{images.length}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// =========================================================
// 单段内容渲染 - 拆图片 → 画廊 + 剩余 markdown
// =========================================================
function MarkdownBlock({
  data,
  onGalleryClick,
  onSingleImageClick,
}: {
  data: string;
  /** 画廊里的图片被点击 - 传整组 + 索引,外层用整组画廊开 lightbox */
  onGalleryClick: (images: ImageItem[], index: number) => void;
  /** 单图(markdown 原生图片)被点击 - 没有画廊上下文,只传 URL */
  onSingleImageClick: (url: string) => void;
}) {
  const { images, rest } = splitMarkdownImages(data);

  return (
    <div
      className="wrap-break-word"
      onClick={(e) => {
        // 单图情形(markdown 原生渲染的图片)也走 lightbox
        const path = e.nativeEvent.composedPath();
        for (const el of path) {
          if (el instanceof HTMLImageElement) {
            const src = el.getAttribute("src");
            if (src && isSafeImageUrl(src)) onSingleImageClick(src);
            return;
          }
        }
      }}
    >
      {images.length > 0 && (
        <ImageGallery
          images={images}
          onImageClick={(i) => onGalleryClick(images, i)}
        />
      )}
      {rest && (
        <ChatMarkdown
          content={rest}
          options={
            {
              themeSettings: {
                // cherry 实际读取 mainTheme 决定整体配色,不是顶层 theme
                mainTheme: "dark",
                codeBlockTheme: "dark",
              },
            } as any
          }
        />
      )}
    </div>
  );
}

interface LightboxState {
  images: ImageItem[];
  index: number;
}

function ensureFallbackBadge(name: string) {
  if (agentToolcallRegistry.get(name)) return;
  agentToolcallRegistry.register({
    name,
    description: name,
    handler: async (_args: unknown, backendResult: unknown) => backendResult,
    component: makeToolBadge(name),
  } as AgentToolcallConfig);
}

function SafeToolCallRenderer({ toolCall }: { toolCall: ToolCall }) {
  const name = toolCall.toolCallName;
  const [mountKey, setMountKey] = useState(0);

  useEffect(() => {
    if (agentToolcallRegistry.get(name)) {
      // 已注册(已知工具 / 已 fallback 过)—— key 不动,首次 render config 就有值
      return;
    }
    // 未注册:同步注册一个非交互式 fallback,然后 setState 让 React 重新挂载 ToolCallRenderer
    // (因为原实例的 config useMemo 不会因为 register 而重算)
    ensureFallbackBadge(name);
    setMountKey((k) => k + 1);
  }, [name]);

  return <ToolCallRenderer key={mountKey} toolCall={toolCall} />;
}

function ContentRenderer({ content }: { content: ContentItem[] | undefined }) {
  // 多图:存整组画廊 + 当前索引
  // 单图:存只含 1 张的伪画廊
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  if (!content) return null;

  const openGallery = (images: ImageItem[], index: number) =>
    setLightbox({ images, index });

  const openSingle = (url: string) =>
    setLightbox({ images: [{ alt: "", url }], index: 0 });

  const close = () => setLightbox(null);

  return (
    <>
      {content.map((item, i) => {
        if (isToolCallContent(item as never) && item.data) {
          return (
            <div key={i} className="mt-3">
              <SafeToolCallRenderer toolCall={item.data as ToolCall} />
            </div>
          );
        }
        if (item.type === "text" || item.type === "markdown") {
          const data = item.data as string;
          if (!data) return null;
          return (
            <MarkdownBlock
              key={i}
              data={data}
              onGalleryClick={openGallery}
              onSingleImageClick={openSingle}
            />
          );
        }
        return null;
      })}

      {/* Lightbox - 通过 Portal 渲染到 body,真正全屏,多图可导航 */}
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          index={lightbox.index}
          onIndexChange={(i) =>
            setLightbox((lb) => (lb ? { ...lb, index: i } : null))
          }
          onClose={close}
        />
      )}
    </>
  );
}

export const MessageBubble = forwardRef<HTMLDivElement, MessageBubbleProps>(
  function MessageBubble({ message, isLast }, ref) {
    const isUser = message.role === "user";
    const contentArr = Array.isArray(message.content)
      ? (message.content as ContentItem[])
      : undefined;
    const showThinking =
      isLast &&
      !isUser &&
      message.status === "streaming" &&
      (!contentArr || contentArr.length === 0);

    /** 助手消息正在流式输出 - 驱动头像脉冲 / 末尾跳动小点 / 边框呼吸 */
    const isAssistantStreaming = !isUser && message.status === "streaming";

    return (
      <div
        ref={ref}
        data-msg
        data-role={message.role}
        className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
      >
        <div
          className={`max-w-[88%] sm:max-w-[80%] md:max-w-[78%] flex flex-col gap-1.5 ${
            isUser ? "items-end" : "items-stretch"
          }`}
        >
          {/* 角色标签 */}
          <div
            className={`flex items-center gap-2 px-1 ${
              isUser ? "flex-row-reverse" : ""
            }`}
          >
            <div
              className={`relative w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                isUser
                  ? "bg-white/10 text-[var(--text-secondary)]"
                  : "text-[#08080a]"
              } ${isAssistantStreaming ? "msg-avatar-pulse" : ""}`}
              style={!isUser ? { background: "var(--grad-violet)" } : undefined}
            >
              {isUser ? "U" : "J"}
              {/* 脉冲外环 - 仅流式时显示 */}
              {isAssistantStreaming && (
                <span className="msg-avatar-pulse__ring" aria-hidden />
              )}
            </div>
            <span className="text-[11px] text-[var(--text-tertiary)] tracking-wider uppercase">
              {isUser ? "我" : "季小保"}
            </span>
            {isAssistantStreaming && (
              <span className="text-[10px] text-[var(--accent)] tracking-wider uppercase inline-flex items-center gap-1">
                · thinking
                <span className="msg-thinking-bar" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
              </span>
            )}
          </div>

          {/* 消息体 */}
          <div
            className={`relative px-3.5 py-2.5 sm:px-4 sm:py-3 text-[13.5px] sm:text-[14px] leading-[1.7] tracking-[-0.005em] backdrop-blur-sm ${
              isUser
                ? "rounded-2xl rounded-tr-md border border-white/[0.08]"
                : `rounded-2xl rounded-tl-md border ${
                    isAssistantStreaming
                      ? "msg-body-streaming"
                      : "border-[var(--border-subtle)]"
                  }`
            }`}
            style={{
              background: isUser
                ? "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)"
                : "linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.008) 100%)",
            }}
          >
            {/* 内容 */}
            {contentArr ? (
              <ContentRenderer content={contentArr} />
            ) : showThinking ? (
              <ThinkingDots />
            ) : null}

            {/* 流式末尾的跳动小点 - 已有内容时也保留,以表达"还在写" */}
            {isAssistantStreaming && contentArr && contentArr.length > 0 && (
              <span className="msg-typing-cursor" aria-hidden>
                <i />
                <i />
                <i />
              </span>
            )}
          </div>
        </div>
      </div>
    );
  },
);
function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1.5">
      <span
        className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)]"
        style={{ animation: "pulse 1.4s var(--ease-in-out-expo) infinite" }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)]"
        style={{
          animation: "pulse 1.4s var(--ease-in-out-expo) infinite",
          animationDelay: "0.2s",
        }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)]"
        style={{
          animation: "pulse 1.4s var(--ease-in-out-expo) infinite",
          animationDelay: "0.4s",
        }}
      />
    </div>
  );
}
