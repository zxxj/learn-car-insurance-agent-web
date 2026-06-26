/**
 * 消息列表 - 入场 stagger 动画 + 新消息监听 + 顶部加载更多
 *
 * 滚动到顶部 → 触发 onLoadMore 回调(由 App 层拉更早历史)
 * prepend 之后必须修正 scrollTop,否则用户视觉上会跳到顶
 */
import { useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { ChatMessagesData } from "@tdesign-react/chat";
import { MessageBubble } from "./MessageBubble";

gsap.registerPlugin(ScrollTrigger);

interface MessageListProps {
  messages: ChatMessagesData[];
  listRef: React.RefObject<HTMLDivElement | null>;
  /** 滚动到顶时触发;返回 false 表示已无更多 */
  onLoadMore?: () => void | Promise<void>;
  /** 是否正在加载更早历史 - 用来在顶部显示 loading 状态 */
  loadingMore?: boolean;
  /** 是否还有更早历史 - 用来控制 sentinel 是否继续监听 */
  hasMore?: boolean;
}

const TOP_THRESHOLD_PX = 80; // 距顶 < 80px 算"到顶"
const SCROLL_ADJUST_DEBOUNCE = 50; // ms

export function MessageList({
  messages,
  listRef,
  onLoadMore,
  loadingMore = false,
  hasMore = true,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false); // 用 ref 避免闭包陷阱
  const scrollAnchorRef = useRef<{ top: number; height: number } | null>(null);

  /**
   * 按 id 去重 messages(保留首次出现)
   * - 上游 chatEngine 在 "prepend" 模式下是直接 concat,不做去重
   * - 后端 before= 可能是 inclusive,游标消息会在两批里都出现
   * - AGUIAdapter.convertHistoryMessages 按用户轮次合并时也可能产生重复 id
   * - 在 useEffect / 渲染 / 自动滚逻辑里全部用这份 deduped,避免 React duplicate key 警告,
   *   也避免 auto-scroll 的 prevLastId / prevFirstId 被重复项污染
   */
  const dedupedMessages = useMemo(() => {
    const seen = new Set<string>();
    const out: ChatMessagesData[] = [];
    for (const m of messages) {
      if (!m?.id || seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
    }
    return out;
  }, [messages]);

  const prevCount = useRef(dedupedMessages.length);
  const prevFirstId = useRef<string | undefined>(dedupedMessages[0]?.id);
  const prevLastId = useRef<string | undefined>(
    dedupedMessages[dedupedMessages.length - 1]?.id,
  );

  // 新消息入场动画 + 滚到底
  // - 依赖 messages(不是 messages.length):streaming 时 content 不断更新,引用变,
  //   useEffect 需要重跑才能把聊天锚到最底;只盯 length 会漏掉流式追加
  // - 用首/末 id 区分 append(尾增) vs prepend(头增):
  //   · append(发送 / 接收 / 流式) → 一定自动滚到底,跟 scrollAnchorRef 无关
  //   · prepend(加载更早历史)     → 用 scrollAnchorRef 还原位置,不自动滚
  // 之前用 `!scrollAnchorRef.current` 短路掉自动滚的写法有 bug:用户已经滚到顶部
  // 准备发消息时 scrollAnchorRef 是 truthy,导致 append 也被吃掉不滚
  useEffect(() => {
    const firstId = dedupedMessages[0]?.id;
    const lastId = dedupedMessages[dedupedMessages.length - 1]?.id;
    const isAppend = lastId !== prevLastId.current;
    const isPrepend =
      !isAppend && firstId !== prevFirstId.current && dedupedMessages.length > 0;
    const lengthIncreased = dedupedMessages.length > prevCount.current;

    if (lengthIncreased) {
      const items =
        containerRef.current?.querySelectorAll<HTMLElement>("[data-msg]");
      if (items && items.length > 0) {
        // 新增的可能在头部(prepend)或尾部(append),都做入场
        const newItems = Array.from(items).filter((_, i) => {
          // 简单做法:对所有 item 做一次淡入,已有动画的会被覆盖
          return i >= prevCount.current;
        });
        if (newItems.length > 0) {
          gsap.from(newItems, {
            y: 16,
            autoAlpha: 0,
            duration: 0.6,
            ease: "expo.out",
            stagger: 0.04,
            clearProps: "transform,opacity",
          });
        }
      }
    }
    prevCount.current = dedupedMessages.length;
    prevFirstId.current = firstId;
    prevLastId.current = lastId;

    // prepend 后修正 scrollTop,避免视觉跳到顶
    // - 真正的滚动容器是 listRef 指向的 App 层外层 div(它有 overflow-y-auto 和 bounded height)
    // - containerRef 是内层,height:auto,不滚,所以不能用作滚动目标
    if (isPrepend && scrollAnchorRef.current && listRef.current) {
      const { top, height } = scrollAnchorRef.current;
      const newHeight = listRef.current.scrollHeight;
      const delta = newHeight - height;
      listRef.current.scrollTop = top + delta;
      scrollAnchorRef.current = null;
    }

    // 自动滚到底 - 发送 / 接收 / 流式追加都触发
    // - append: smooth,有动画感
    // - 流式追加(content 变,id 不变): auto,紧跟内容往下走
    // - prepend: 上面的 block 已经把 scrollTop 还原,这里不要再滚到底
    //   (旧代码用 `!scrollAnchorRef.current` 判断, 但 prepend 还原时 ref 已经被置 null,
    //   导致 else-if 误触发 → 滚到底,体验极差)
    if (isPrepend) {
      // 已在上方还原, 什么都不做
    } else if (isAppend) {
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({
          top: listRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    } else {
      // 流式追加(同一条消息 content 变)→ 紧跟滚到底
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({
          top: listRef.current.scrollHeight,
          behavior: "auto",
        });
      });
    }
  }, [dedupedMessages, listRef]);

  // 滚动监听 - 到顶触发加载更多
  // - 滚动事件挂在外层滚动容器(listRef)上,内层 containerRef height:auto 不滚
  useEffect(() => {
    if (!onLoadMore || !hasMore) return;
    const el = listRef.current;
    if (!el) return;

    let timer: number | null = null;
    const onScroll = () => {
      if (loadingRef.current) return;
      if (el.scrollTop <= TOP_THRESHOLD_PX) {
        // 记录滚动锚点 - 用于 prepend 后还原
        scrollAnchorRef.current = {
          top: el.scrollTop,
          height: el.scrollHeight,
        };
        // 节流
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          loadingRef.current = true;
          Promise.resolve(onLoadMore()).finally(() => {
            // 延迟解锁,等 React 提交 DOM 完成
            window.setTimeout(() => {
              loadingRef.current = false;
            }, SCROLL_ADJUST_DEBOUNCE);
          });
        }, 80);
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (timer) window.clearTimeout(timer);
    };
  }, [onLoadMore, hasMore, listRef]);

  return (
    <div
      ref={containerRef}
      className="px-3 py-6 sm:px-5 sm:py-8 md:px-8 md:py-10"
    >
      <div className="max-w-3xl mx-auto flex flex-col gap-5 sm:gap-7">
        {/* 顶部加载状态指示 */}
        {(loadingMore || hasMore) && (
          <div
            className="flex items-center justify-center gap-2 py-2 text-[11.5px] text-[var(--text-tertiary)] tracking-wider"
            aria-live="polite"
          >
            {loadingMore ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                <span>正在加载更早消息…</span>
              </>
            ) : hasMore ? (
              <span className="opacity-60">↑ 滚动到顶部加载更多</span>
            ) : (
              <span className="opacity-40">— 已是最早的消息 —</span>
            )}
          </div>
        )}

        {dedupedMessages.map((m, idx) => (
          <MessageBubble
            key={m.id}
            message={m}
            isLast={idx === dedupedMessages.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
