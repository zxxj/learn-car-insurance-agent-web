/**
 * App · 暗色 · 高级克制 · 强视觉首屏 · 多端响应
 */
import { useEffect, useRef, useState, useMemo } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useChat, AGUIAdapter } from "@tdesign-react/chat";
import type { ChatMessagesData } from "@tdesign-react/chat";

import {
  createChatServiceConfig,
  fetchHistoryMessages,
  clearHistoryMessages,
} from "./api";
import type { AGUIHistoryMessage } from "./api";

/** 首次 / 每次"加载更多"的历史消息条数 */
const HISTORY_PAGE_SIZE = 10;
import { useTools } from "./tools";
import { quoteEvents } from "./tools/quoteEvents";

import { Sidebar } from "./components/layout/Sidebar";
import { ChatHeader } from "./components/layout/ChatHeader";
import { MessageList } from "./components/chat/MessageList";
import { Composer } from "./components/chat/Composer";
import { HeroCard, HeroMaskLine } from "./components/chat/Hero";

gsap.registerPlugin(ScrollTrigger);

const THREAD_ID = "2";
const LG_BREAKPOINT = 1024;

/**
 * 后端 /messages 返回的每条记录结构(input/output 数组)
 * 与标准 AG-UI 消息格式不同,需要单独转换。
 */
type ResponseHistoryRecord = {
  id?: number | string;
  input?: Array<{
    role?: string;
    content?: string;
  }> | null;
  output?: Array<{
    type?: string;
    role?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }> | null;
  created_at?: number | string;
};

function toDatetime(value: ResponseHistoryRecord["created_at"]): string {
  if (typeof value === "number") {
    return new Date(value * 1000).toISOString();
  }
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return new Date(numeric * 1000).toISOString();
    }
  }
  return new Date().toISOString();
}

function convertResponseHistoryRecords(
  history: ResponseHistoryRecord[],
): ChatMessagesData[] {
  const messages: ChatMessagesData[] = [];

  history.forEach((record) => {
    record.input?.forEach((input, index) => {
      if (input.role !== "user" || !input.content) return;
      messages.push({
        id: `history-${record.id ?? messages.length}-user-${index}`,
        role: "user",
        status: "complete",
        datetime: toDatetime(record.created_at),
        content: [
          {
            type: "text",
            data: input.content,
          },
        ],
      });
    });

    record.output?.forEach((output, outputIndex) => {
      if (output.type !== "message" && output.role !== "assistant") return;
      const text = output.content
        ?.filter((content) => content.type === "output_text" && content.text)
        .map((content) => content.text)
        .join("\n\n");
      if (!text) return;

      messages.push({
        id: `history-${record.id ?? messages.length}-assistant-${outputIndex}`,
        role: "assistant",
        status: "complete",
        datetime: toDatetime(record.created_at),
        content: [
          {
            type: "markdown",
            data: text,
          },
        ],
      });
    });
  });

  return messages;
}

/**
 * 历史消息转换入口
 * - 如果某条记录带 input/output 数组 → 视为后端原始结构,用 convertResponseHistoryRecords
 * - 否则视为标准 AG-UI 格式,走 AGUIAdapter
 */
function convertHistoryMessages(
  history: AGUIHistoryMessage[],
): ChatMessagesData[] {
  const responseRecords = history as unknown as ResponseHistoryRecord[];
  if (
    responseRecords.some(
      (message) =>
        Array.isArray(message.input) || Array.isArray(message.output),
    )
  ) {
    return convertResponseHistoryRecords(responseRecords);
  }
  return AGUIAdapter.convertHistoryMessages(history) as ChatMessagesData[];
}

export default function App() {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [initialMessages, setInitialMessages] = useState<ChatMessagesData[]>(
    [],
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`).matches,
  );
  /** 历史消息分页游标 - 当前列表最早一条消息的 id */
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  /** 是否还有更早历史(后端通过 hasMore / 实际返回条数 < pageSize 推断) */
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  /** 是否正在加载更早历史(防止重复触发) */
  const [loadingMore, setLoadingMore] = useState(false);

  useTools();

  // 监听断点
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`);
    const onChange = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches);
      if (e.matches) setSidebarOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // ESC 关闭抽屉
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  // 历史消息加载 - 首次只拉 HISTORY_PAGE_SIZE 条
  useEffect(() => {
    let cancelled = false;
    fetchHistoryMessages(THREAD_ID, { limit: HISTORY_PAGE_SIZE })
      .then((history: AGUIHistoryMessage[]) => {
        if (cancelled) return;
        const converted = convertHistoryMessages(history);
        setInitialMessages(converted);
        // 推断是否还有更早历史
        if (history.length < HISTORY_PAGE_SIZE) {
          setHasMoreHistory(false);
        }
        // 游标 = 当前最早一条的 id
        const firstRaw = history[0];
        if (firstRaw?.id) setHistoryCursor(firstRaw.id);
      })
      .catch((err) => {
        console.error("[HistoryMessages] 加载失败:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * 加载更早历史(滚动到顶时触发)
   * - 用 historyCursor 做游标分页(before=<id>&limit=10)
   * - 新消息用 setMessages("prepend") 插到列表前面
   * - 保留当前滚动位置(MessageList 监听 scrollAnchorRef 自动修正)
   *
   * **重要:后端 before= 可能是包含游标的(inclusive),同一 id 会在两批里都出现;
   * 此外 AGUIAdapter.convertHistoryMessages 会按"用户轮次"合并消息,如果原始数据中
   * 同一轮里有重复 id,转换后也会重复。而 TDesign 的 MessageStore.setMessages
   * "prepend" 模式是直接 [...new, ...old] 拼接,不做去重 → 触发 React duplicate key 警告。
   * 所以这里在 push 进 chatEngine 前先按 id 去重。**
   */
  const handleLoadMoreHistory = async () => {
    if (loadingMore || !hasMoreHistory || !historyCursor) return;
    setLoadingMore(true);
    try {
      const older = await fetchHistoryMessages(THREAD_ID, {
        cursor: historyCursor,
        limit: HISTORY_PAGE_SIZE,
      });
      if (older.length === 0) {
        setHasMoreHistory(false);
        return;
      }
      const converted = convertHistoryMessages(older);

      // 用 messages 拿当前 chatEngine 的真实快照 - 注意:此处从 useChat 来的
      // `messages` 是异步同步的 React state,在 await 期间可能不是最新;
      // 用 chatEngine.messageStore.getState() 直接读 store 更可靠。
      // MessageStore 暴露了 getState(),内部 shape = { messageIds, messages, ... }
      const storeState = chatEngine.messageStore.getState() as {
        messages: ChatMessagesData[];
      };
      const existingIds = new Set(storeState.messages.map((m) => m.id));
      const deduped = converted.filter((m) => !existingIds.has(m.id));

      // 整批都是重复 → 后端在原地兜圈,视为已无更多
      if (deduped.length === 0) {
        setHasMoreHistory(false);
        return;
      }

      chatEngine.setMessages(deduped, "prepend");
      // 推下游标 - 必须用后端原始记录的 id, 不能用 convertHistoryMessages
      // 生成的虚拟 id(如 history-52-user-0), 否则后端不认 → 422。
      const firstRaw = older[0] as unknown as ResponseHistoryRecord;
      if (firstRaw?.id !== undefined) {
        setHistoryCursor(String(firstRaw.id));
      } else {
        setHasMoreHistory(false);
      }
      if (older.length < HISTORY_PAGE_SIZE) {
        setHasMoreHistory(false);
      }
    } catch (err) {
      console.error("[HistoryMessages] 加载更早历史失败:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const chatServiceConfig = useMemo(
    () => createChatServiceConfig(THREAD_ID),
    [],
  );

  const { chatEngine, messages, status } = useChat({
    defaultMessages: initialMessages,
    chatServiceConfig,
  });

  useEffect(() => {
    if (initialMessages.length > 0) {
      chatEngine.setMessages(initialMessages, "replace");
      // 加载到历史消息 → 切到聊天列表,Hero 隐藏
      setShowHero(false);
    }
  }, [initialMessages, chatEngine]);

  const senderLoading = useMemo(
    () => status === "pending" || status === "streaming",
    [status],
  );

  /**
   * Hero(推荐问题)显隐 - 独立 state 驱动
   * - 不直接依赖 messages.length,因为 chatEngine.setMessages 的回填是 microtask 异步的,
   *   在 async handleClear 里 + 多次 setState 混合时,React 18 的批处理有时不会触发
   *   messages → [] 的同步更新,导致 showHero 短暂/永久不到 true
   * - 显式 setShowHero(true) 比"等 messages 自己变空"更可靠
   */
  const [showHero, setShowHero] = useState(true);

  // 报价卡片点击确认 → 把"我确认投保XXX"作为用户消息发出
  useEffect(() => {
    return quoteEvents.subscribe((text) => {
      if (senderLoading) return;
      setShowHero(false); // 报价卡片确认投保后,Hero 隐藏
      void chatEngine.sendUserMessage({ prompt: text });
    });
  }, [chatEngine, senderLoading]);

  // =========================================================
  // 首屏入场动画 refs
  // =========================================================
  const maskTopRef = useRef<HTMLDivElement>(null);
  const maskBottomRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const titleLine1Ref = useRef<HTMLDivElement>(null);
  const titleLine2Ref = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const cardARef = useRef<HTMLDivElement>(null);
  const cardBRef = useRef<HTMLDivElement>(null);
  const cardCRef = useRef<HTMLDivElement>(null);
  const cardDRef = useRef<HTMLDivElement>(null);
  const orbsRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      gsap.set(
        [
          maskTopRef.current,
          maskBottomRef.current,
          titleLine1Ref.current,
          titleLine2Ref.current,
          subtitleRef.current,
          pillRef.current,
          cardARef.current,
          cardBRef.current,
          cardCRef.current,
          cardDRef.current,
          composerRef.current,
          headerRef.current,
          heroRef.current,
        ],
        { clearProps: "all" },
      );
      gsap.set(maskTopRef.current, { yPercent: -100 });
      gsap.set(maskBottomRef.current, { yPercent: 100 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.set(maskTopRef.current, { yPercent: 0 });
      gsap.set(maskBottomRef.current, { yPercent: 0 });

      [titleLine1Ref.current, titleLine2Ref.current].forEach((line) => {
        const spans = line?.querySelectorAll("span");
        if (spans) gsap.set(spans, { yPercent: 110 });
      });

      gsap.set([composerRef.current, headerRef.current], {
        autoAlpha: 0,
        y: 24,
      });
      gsap.set(orbsRef.current, { autoAlpha: 0 });

      // 总节奏 ≈ 2.4s
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });

      tl.to(maskTopRef.current, {
        yPercent: -100,
        duration: 1.0,
        ease: "expo.inOut",
      });
      tl.to(
        maskBottomRef.current,
        { yPercent: 100, duration: 1.0, ease: "expo.inOut" },
        "<",
      );

      tl.to(
        [headerRef.current, composerRef.current],
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.9,
          ease: "expo.out",
          stagger: 0.05,
        },
        "-=0.5",
      );

      const line1Spans = titleLine1Ref.current?.querySelectorAll("span");
      const line2Spans = titleLine2Ref.current?.querySelectorAll("span");
      if (line1Spans) {
        tl.to(
          line1Spans,
          { yPercent: 0, duration: 1.0, ease: "expo.out", stagger: 0.05 },
          "-=0.35",
        );
      }
      if (line2Spans) {
        tl.to(
          line2Spans,
          { yPercent: 0, duration: 1.0, ease: "expo.out", stagger: 0.05 },
          "-=0.7",
        );
      }

      tl.to(
        orbsRef.current,
        { autoAlpha: 1, duration: 1.4, ease: "expo.out" },
        "-=1.2",
      );

      const orbs = orbsRef.current?.querySelectorAll(".glow-orb");
      orbs?.forEach((orb, i) => {
        gsap.to(orb, {
          y: `random(${-30 - i * 5}, ${30 + i * 5})`,
          x: `random(${-25 - i * 3}, ${25 + i * 3})`,
          duration: `random(${10 + i * 2}, ${16 + i * 2})`,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          delay: 1.0 + i * 0.4,
        });
      });
    });

    return () => ctx.revert();
  }, []);

  /**
   * Hero 内容入场 - 每次 showHero 变 true 都跑一遍
   * 原因:首屏 GSAP 动画只跑一次 (`[]` deps),Hero 重渲染(清空消息后)
   * 不会被重新触发,而 HeroCard 自带 `.reveal` (opacity:0),导致盒子在,
   * 但内容不可见。
   */
  useEffect(() => {
    if (!showHero) return;
    const targets = [
      heroRef.current,
      pillRef.current,
      subtitleRef.current,
      cardARef.current,
      cardBRef.current,
      cardCRef.current,
      cardDRef.current,
    ].filter((el): el is HTMLElement => Boolean(el));

    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { autoAlpha: 0, y: 24 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.55,
          ease: "expo.out",
          stagger: 0.06,
        },
      );
    });
    return () => ctx.revert();
  }, [showHero]);

  // 滚动时,header 阴影 (ScrollTrigger)
  useEffect(() => {
    if (!headerRef.current) return;
    const st = ScrollTrigger.create({
      trigger: headerRef.current,
      start: "top+=40 top",
      onEnter: () =>
        gsap.to(headerRef.current, {
          borderBottomColor: "rgba(255,255,255,0.12)",
          duration: 0.4,
          ease: "expo.out",
        }),
      onLeaveBack: () =>
        gsap.to(headerRef.current, {
          borderBottomColor: "rgba(255,255,255,0.06)",
          duration: 0.4,
          ease: "expo.out",
        }),
    });
    return () => st.kill();
  }, []);

  // =========================================================
  // 事件
  // =========================================================
  const handleSend = async (message: string) => {
    if (!message.trim() || senderLoading) return;
    setInputValue("");
    setShowHero(false); // 发了消息,Hero 隐藏
    await chatEngine.sendUserMessage({ prompt: message });
  };

  const handleClear = async () => {
    if (!window.confirm("确认清空当前会话消息？")) return;
    try {
      await clearHistoryMessages();
      setInitialMessages([]);
      chatEngine.setMessages([], "replace");
      setShowHero(true); // 清空后立即显示推荐问题,不依赖 messages 异步回填
    } catch (err) {
      console.error("[ClearMessages] 清空失败:", err);
      window.alert("清空失败，请重试");
    }
  };

  const handleNewChat = () => {
    // if (messages.length === 0) return;
    // handleClear();
    window.confirm("待开发.");
  };

  return (
    <div
      ref={mainRef}
      className="h-screen w-full overflow-hidden relative flex"
      style={{ background: "var(--bg-base)" }}
    >
      {/* 装饰光斑 */}
      <div
        ref={orbsRef}
        aria-hidden
        className="absolute inset-0 pointer-events-none overflow-hidden z-0"
      >
        <div
          className="glow-orb"
          style={{
            top: "-15%",
            left: "20%",
            width: 520,
            height: 520,
            background:
              "radial-gradient(circle, rgba(167,139,250,0.18), transparent 70%)",
          }}
        />
        <div
          className="glow-orb"
          style={{
            top: "40%",
            right: "-10%",
            width: 480,
            height: 480,
            background:
              "radial-gradient(circle, rgba(103,232,249,0.12), transparent 70%)",
          }}
        />
        <div
          className="glow-orb"
          style={{
            bottom: "-20%",
            left: "35%",
            width: 600,
            height: 600,
            background:
              "radial-gradient(circle, rgba(240,171,252,0.10), transparent 70%)",
          }}
        />
      </div>

      {/* 侧栏(响应式) */}
      <Sidebar
        open={isDesktop || sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        onClear={handleClear}
        loading={senderLoading}
      />

      {/* 主区域 */}
      <main className="relative z-10 flex-1 flex flex-col min-w-0 min-h-0">
        <div ref={headerRef}>
          <ChatHeader
            title={showHero ? "新对话" : "进行中的对话"}
            status={status}
            onMenuClick={() => setSidebarOpen(true)}
          />
        </div>

        {/* Hero / 消息列表 二选一,占据中间空间,超出可滚
            - 真正的滚动容器在这层,MessageList 内部不再有 overflow-y-auto
            - listRef 挂这里,MessageList 收到的 listRef 指向这层,scrollTo / 滚动监听都走这层 */}
        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto">
          {showHero ? (
            <div
              ref={heroRef}
              className="px-4 pt-7 pb-5 sm:px-6 sm:pt-12 sm:pb-8 md:px-10 md:pt-16 md:pb-12 max-w-3xl mx-auto"
            >
              <div ref={pillRef} className="mb-6 sm:mb-8">
                <span className="pill">
                  <span className="dot" />
                  <span>Ready · 与 AI 协作</span>
                </span>
              </div>

              <h1 className="text-[clamp(1.85rem,7vw,4rem)] font-semibold leading-[1.12] tracking-[-0.035em] mb-5 sm:mb-8">
                <HeroMaskLine ref={titleLine1Ref}>
                  <span className="text-[var(--text-primary)]">与</span>{" "}
                  <span className="text-gradient">季小保</span>{" "}
                  <span className="text-[var(--text-primary)]">对话,</span>
                </HeroMaskLine>
                <HeroMaskLine ref={titleLine2Ref}>
                  <span className="text-[var(--text-primary)]">
                    让每个想法都更清晰。
                  </span>
                </HeroMaskLine>
              </h1>

              <p
                ref={subtitleRef}
                className="text-[14px] sm:text-[15px] text-[var(--text-secondary)] leading-[1.75] max-w-xl mb-8 sm:mb-12"
              >
                一个克制、专注、值得信赖的 AI 工作伙伴。
                提问、思考、创造,从此处开始。
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <HeroCard
                  ref={cardARef}
                  title="解释 RAG"
                  desc="用通俗语言讲清检索增强生成的原理"
                  icon={
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    >
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                    </svg>
                  }
                  onClick={() => setInputValue("解释一下什么是 RAG?")}
                />
                <HeroCard
                  ref={cardBRef}
                  title="撰写客户邮件"
                  desc="按你给的语气与上下文起草正式回复"
                  icon={
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    >
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  }
                  onClick={() => setInputValue("帮我写一封客户跟进邮件")}
                />
                <HeroCard
                  ref={cardCRef}
                  title="本周工作计划"
                  desc="按目标拆解可执行清单与时间分配"
                  icon={
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                  }
                  onClick={() => setInputValue("帮我安排本周工作计划")}
                />
                <HeroCard
                  ref={cardDRef}
                  title="推荐一本书"
                  desc="根据你最近关注的话题,挑一本值得读的"
                  icon={
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    >
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                    </svg>
                  }
                  onClick={() => setInputValue("推荐一本值得读的产品书")}
                />
              </div>
            </div>
          ) : (
            <MessageList
              messages={messages}
              listRef={listRef}
              onLoadMore={handleLoadMoreHistory}
              loadingMore={loadingMore}
              hasMore={hasMoreHistory}
            />
          )}
        </div>

        {/* Composer 永远固定在底部 */}
        <div
          ref={composerRef}
          className="shrink-0 px-3 pb-4 pt-2 sm:px-5 sm:pb-5 md:px-8 md:pb-7 safe-pb bg-[var(--bg-base)]"
        >
          <Composer
            value={inputValue}
            loading={senderLoading}
            onChange={setInputValue}
            onSend={handleSend}
            onStop={() => chatEngine.abortChat()}
          />
          <div className="max-w-3xl mx-auto mt-2 sm:mt-2.5 hidden sm:flex items-center justify-center gap-1.5 text-[10.5px] text-[var(--text-tertiary)] tracking-wider uppercase">
            <span>季小保可能会犯错 · 请核查重要信息</span>
          </div>
        </div>
      </main>

      {/* 顶部 + 底部开场遮罩 */}
      <div
        ref={maskTopRef}
        aria-hidden
        className="fixed inset-x-0 top-0 h-1/2 z-[80] pointer-events-none"
        style={{ background: "var(--bg-base)" }}
      />
      <div
        ref={maskBottomRef}
        aria-hidden
        className="fixed inset-x-0 bottom-0 h-1/2 z-[80] pointer-events-none"
        style={{ background: "var(--bg-base)" }}
      />
    </div>
  );
}
