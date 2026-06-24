/**
 * 消息列表 - 基于 TDesign ChatList
 *
 * 职责收缩:
 * - 滚动容器 + 自动滚到底(ChatList.autoScroll)
 * - 滚动到顶触发加载更多(ChatList.onScroll)
 * - 顶部 loading 指示(自定义,放 ChatList 之上)
 * - 受控滚动 API(暴露 ref.scrollList)
 * - 渲染每条消息 - 严格 TDesign,直接 <ChatMessage message={m} />
 *
 * 业务回调(比如 quote 卡片确认投保时,把文本作为用户消息发出)由 App 层在
 * chatEngine 的 events 上订阅,而不是每条消息单独 onRespond。
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { ChatList, ChatMessage, ToolCallRenderer } from "@tdesign-react/chat";
import type { ChatMessagesData } from "@tdesign-react/chat";
import type { AIMessageContent, ToolCall } from "@tdesign-react/chat";

interface MessageListProps {
  messages: ChatMessagesData[];
  /** 滚动到顶时触发;返回 Promise<void>,内部已做节流 */
  onLoadMore?: () => void | Promise<void>;
  /** 是否正在加载更早历史(顶部 loading 状态) */
  loadingMore?: boolean;
  /** 是否还有更早历史(顶部提示文案) */
  hasMore?: boolean;
}

/** 距顶 < 80px 算"到顶" */
const TOP_THRESHOLD_PX = 80;

function isToolCallContent(
  content: AIMessageContent,
): content is AIMessageContent & { data: ToolCall } {
  return (
    content.type === "toolcall" ||
    (typeof content.type === "string" && content.type.startsWith("toolcall-"))
  );
}

type UserContentPart =
  | { type: "text"; value: string }
  | { type: "image"; alt: string; url: string };

const MARKDOWN_IMAGE_RE = /!\[([^\]\r\n]*)\]\((https?:\/\/[^)\s]+)\)/g;
const HAS_MARKDOWN_IMAGE_RE = /!\[[^\]\r\n]*\]\(https?:\/\/[^)\s]+\)/;

function parseUserContent(value: string): UserContentPart[] {
  const parts: UserContentPart[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(MARKDOWN_IMAGE_RE)) {
    const index = match.index ?? 0;
    const text = value.slice(lastIndex, index).trim();
    if (text) {
      parts.push({ type: "text", value: text });
    }
    parts.push({
      type: "image",
      alt: match[1] || "image",
      url: match[2],
    });
    lastIndex = index + match[0].length;
  }

  const rest = value.slice(lastIndex).trim();
  if (rest) {
    parts.push({ type: "text", value: rest });
  }

  return parts;
}

function getUserTextContent(message: ChatMessagesData): string {
  if (message.role !== "user") return "";
  return message.content
    .filter((content) => content.type === "text")
    .map((content) => content.data)
    .join("\n\n");
}

interface PreviewImage {
  alt: string;
  url: string;
}

function UserMarkdownContent({
  value,
  onPreview,
}: {
  value: string;
  onPreview: (image: PreviewImage) => void;
}) {
  const parts = parseUserContent(value);
  const images = parts.filter((part) => part.type === "image");
  const texts = parts
    .filter((part) => part.type === "text")
    .map((part) => part.value)
    .join("\n\n");

  return (
    <div
      slot="content"
      className="user-md-content max-w-[min(78vw,520px)] rounded-[16px_16px_4px_16px] border border-[var(--border-subtle)] bg-[rgba(167,139,250,0.12)] px-3.5 py-3 shadow-[0_10px_28px_-18px_rgba(167,139,250,0.45)]"
    >
      {images.length > 0 && (
        <div className="flex max-w-full gap-2 overflow-x-auto overflow-y-hidden pb-1">
          {images.map((part, index) => (
            <button
              key={`image-${index}`}
              type="button"
              className="block h-28 w-28 shrink-0 cursor-zoom-in overflow-hidden rounded-xl border border-white/10 bg-black/20 p-0 sm:h-36 sm:w-36"
              onClick={() => onPreview({ alt: part.alt, url: part.url })}
              aria-label={`预览图片 ${part.alt}`}
            >
              <img
                src={part.url}
                alt={part.alt}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
      {texts && (
        <div className="mt-2 whitespace-pre-wrap break-words text-left text-[var(--text-primary)]">
          {texts}
        </div>
      )}
    </div>
  );
}

export const MessageList = forwardRef<unknown, MessageListProps>(
  function MessageList({ messages, onLoadMore, loadingMore, hasMore }, ref) {
    const innerRef = useRef<HTMLElement | null>(null);
    const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
    const wasLoadingMoreRef = useRef(false);

    useEffect(() => {
      if (!previewImage) return;
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") setPreviewImage(null);
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, [previewImage]);

    // 暴露 scrollList API 给外部(App 用作"发完消息滚到底")
    useImperativeHandle(
      ref,
      () => ({
        scrollList: (opt?: {
          behavior?: "auto" | "smooth";
          to?: "top" | "bottom";
        }) => {
          const el = innerRef.current as
            | (HTMLElement & {
                scrollList?: (o?: {
                  behavior?: "auto" | "smooth";
                  to?: "top" | "bottom";
                }) => void;
              })
            | null;
          el?.scrollList?.(opt);
        },
      }),
      [],
    );

    useEffect(() => {
      if (wasLoadingMoreRef.current && !loadingMore && hasMore) {
        requestAnimationFrame(() => {
          const el = innerRef.current as
            | (HTMLElement & {
                scrollTop?: number;
                scrollList?: (o?: {
                  behavior?: "auto" | "smooth";
                  to?: "top" | "bottom";
                }) => void;
              })
            | null;
          if (typeof el?.scrollTop === "number" && el.scrollTop <= 2) {
            el.scrollTop = TOP_THRESHOLD_PX + 24;
          }
        });
      }
      wasLoadingMoreRef.current = Boolean(loadingMore);
    }, [loadingMore, hasMore]);

    return (
      <>
        {/* 顶部 loading 状态条 - 放在 ChatList 之上,不被列表滚动影响 */}
        {(loadingMore || hasMore) && (
          <div
            className="flex items-center justify-center gap-2 py-2 text-[11.5px] text-[--text-tertiary] tracking-wider"
            aria-live="polite"
          >
            {loadingMore ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[--accent] animate-pulse" />
                <span>正在加载更早消息…</span>
              </>
            ) : hasMore ? (
              <span className="opacity-60">↑ 滚动到顶部加载更多</span>
            ) : (
              <span className="opacity-40">— 已是最早的消息 —</span>
            )}
          </div>
        )}

        <ChatList
          ref={innerRef}
          autoScroll
          onScroll={(e) => {
            if (!onLoadMore || !hasMore) return;
            if (e.detail.scrollTop <= TOP_THRESHOLD_PX) {
              void onLoadMore();
            }
          }}
        >
          {messages.map((m) => {
            const isUser = m.role === "user";
            const userText = getUserTextContent(m);
            const hasUserMarkdownImage =
              isUser && HAS_MARKDOWN_IMAGE_RE.test(userText);

            return (
              <ChatMessage
                key={m.id}
                message={m}
                variant="base"
                placement={isUser ? "right" : "left"}
                name={isUser ? "我" : "季小保"}
                actions={["copy", "replay", "good", "bad"]}
              >
                {hasUserMarkdownImage && (
                  <UserMarkdownContent
                    value={userText}
                    onPreview={setPreviewImage}
                  />
                )}
                {m.role === "assistant" &&
                  m.content?.map((content, index) => {
                    if (!isToolCallContent(content)) return null;

                    return (
                      <div
                        key={`${m.id}-toolcall-${content.data.toolCallId}`}
                        slot={`${content.type}-${index}`}
                      >
                        <ToolCallRenderer toolCall={content.data} />
                      </div>
                    );
                  })}
              </ChatMessage>
            );
          })}
        </ChatList>
        {previewImage && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 px-4 py-6"
            role="dialog"
            aria-modal="true"
            aria-label="图片预览"
            onClick={() => setPreviewImage(null)}
          >
            <button
              type="button"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/40 text-xl leading-none text-white hover:bg-black/60"
              onClick={() => setPreviewImage(null)}
              aria-label="关闭预览"
            >
              ×
            </button>
            <img
              src={previewImage.url}
              alt={previewImage.alt}
              className="max-h-[88vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        )}
      </>
    );
  },
);
