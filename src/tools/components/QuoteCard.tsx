/**
 * 保司报价工具组件
 * - 横向滑动列表,一次显示 2 张卡片,超出可滚
 * - 卡片底部:确认投保 按钮(全宽)
 * - 点击按钮通过 respond() 把 "我确认投保{公司名}" 回传给 agent
 * - 科技感:扫描线 / 角部 LED / 按钮高光 / 价格流光 / 入场抬升
 */
import { useEffect, useRef, useState } from "react";
import type { ToolcallComponentProps } from "@tdesign-react/chat";
import { quoteEvents } from "../../tools/quoteEvents";

interface QuoteCompany {
  name: string;
  /** 价格字符串,如 "¥1,360/年" */
  price: string;
  /** 公司 logo URL(后端返回) */
  icon?: string;
  /** 评分 (1-5) */
  rating?: number;
  /** 简短特色,2-3 条 */
  features?: string[];
  /** 角标,如 "推荐" / "性价比" */
  badge?: string;
  /** 公司首字母对应色(用于 logo 占位) */
  hue?: number;
}

/**
 * 后端原始字段(小写 + 下划线)
 * - 兼容 平安 / 大家 / 永诚 等保司的实际 schema
 */
interface QuoteRawCompany {
  id?: string;
  company_code?: string;
  company_name?: string;
  company_icon?: string;
  compulsory_premium?: string | number;
  damage_premium?: string | number;
  third_party_premium?: string | number;
  vehicle_tax?: string | number;
  commercial_premium?: string | number;
  total_premium?: string | number;
  /** 兜底:有些字段可能用驼峰 */
  name?: string;
  totalPremium?: string | number;
  icon?: string;
}

/**
 * 工具回传 - 仅保留确认动作
 * - text 字段是直接发给 agent 的语义化消息
 */
interface QuoteConfirmResponse {
  action: "confirm";
  company: string;
  text: string;
}

/**
 * 解析后端返回的报价数据 - 兼容多种格式
 * 1. JSON 字符串 - 先尝试 JSON.parse
 * 2. { companies: [...] } / { data: [...] } / { quotes: [...] } 等
 * 3. [...] 直接数组
 * 4. 字符串 - 尝试按 markdown 表格解析(兜底)
 */
function parseQuoteResult(result: unknown): QuoteCompany[] {
  if (!result) return [];

  // 字符串:优先 JSON.parse,失败再走 markdown 表格
  if (typeof result === "string") {
    const trimmed = result.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        return parseQuoteResult(JSON.parse(trimmed));
      } catch {
        // 不是合法 JSON,继续走 markdown 兜底
      }
    }
    return parseMarkdownTable(result);
  }

  if (Array.isArray(result)) {
    return result.map(normalizeCompany);
  }

  if (typeof result === "object") {
    const obj = result as Record<string, unknown>;
    for (const key of ["companies", "data", "quotes", "list", "items"]) {
      if (Array.isArray(obj[key])) {
        return (obj[key] as QuoteRawCompany[]).map(normalizeCompany);
      }
    }
  }

  return [];
}

/**
 * 把后端原始 schema 映射成 UI 需要的字段
 * - company_name   → name
 * - total_premium  → "¥1,360/年"
 * - company_icon   → icon
 * - 各项保费       → features
 */
function normalizeCompany(raw: QuoteRawCompany): QuoteCompany {
  const name = raw.company_name ?? raw.name ?? "未知保司";
  const total = Number(raw.total_premium ?? raw.totalPremium ?? 0) || 0;
  const price = total > 0 ? `¥${total.toLocaleString("zh-CN")}/年` : "";

  const features: string[] = [];
  const pushPremium = (label: string, v: string | number | undefined) => {
    if (v === undefined || v === null || v === "") return;
    const n = Number(v);
    if (!Number.isFinite(n) || n === 0) return;
    features.push(`${label} ¥${n.toLocaleString("zh-CN")}`);
  };
  pushPremium("交强险", raw.compulsory_premium);
  pushPremium("车损险", raw.damage_premium);
  pushPremium("三者险", raw.third_party_premium);
  pushPremium("车船税", raw.vehicle_tax);
  if (raw.commercial_premium !== undefined) {
    pushPremium("商业险", raw.commercial_premium);
  }

  return {
    name,
    price,
    icon: raw.company_icon ?? raw.icon,
    features,
  };
}

/**
 * markdown 表格兜底解析
 * | **人保财险** | ¥1,360/年 |
 * | --- | --- |
 */
function parseMarkdownTable(text: string): QuoteCompany[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const dataLines = lines.filter(
    (l) => l.startsWith("|") && !/^\|[\s\-:|]+\|$/.test(l),
  );

  return dataLines
    .map((line) => {
      const cols = line
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      const name = cols[0]?.replace(/\*\*/g, "").trim() || "未知";
      const price = cols[1]?.replace(/\*\*/g, "").trim() || "";
      return { name, price };
    })
    .filter((c) => c.name && c.name !== "保司" && c.name !== "公司");
}

export function QuoteToolComponent({
  result,
  respond,
  status,
}: ToolcallComponentProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const companies = parseQuoteResult(result);

  // 监听滚动,更新当前位置指示
  // - 中间卡用 stride 算 idx(snap-mandatory 下取整即可)
  // - 最后一张卡的 snap 中心点通常超出可滚范围(snap 不到),所以滚到尽头时
  //   scrollLeft 落在最后两张之间,Math.round 会回退到倒数第二张的 idx
  //   → 用 maxScroll - 2 的容差判断"已到最右",直接置为最后一张
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || companies.length === 0) return;
    const onScroll = () => {
      const card = el.querySelector<HTMLElement>("[data-quote-card]");
      if (!card) return;
      const stride = card.offsetWidth + 12; // 12 = gap-3
      const maxScroll = el.scrollWidth - el.clientWidth;
      const isAtEnd = maxScroll > 2 && el.scrollLeft >= maxScroll - 2;
      const idx = isAtEnd
        ? companies.length - 1
        : Math.round(el.scrollLeft / stride);
      setActiveIndex(Math.min(Math.max(0, idx), companies.length - 1));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [companies.length]);

  if (status === "executing" && companies.length === 0) {
    return (
      <div className="my-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-white/[0.02] text-[12px] text-[var(--text-tertiary)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
        正在为您匹配方案…
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="my-2 text-[12px] text-[var(--text-tertiary)]">
        暂无可用方案
      </div>
    );
  }

  const handleConfirm = (company: QuoteCompany) => {
    const text = `我确认投保${company.name}`;
    // 1) 通过事件总线让 App 把这句话作为用户消息发出 → 聊天框立即出现
    quoteEvents.emitConfirm(text);
    // 2) 同时把结构化结果回传给 agent(tool call 完成)
    if (respond) {
      const payload: QuoteConfirmResponse = {
        action: "confirm",
        company: company.name,
        text,
      };
      respond(payload);
    }
  };

  return (
    <div className="my-3 -mx-1 w-full">
      {/* 顶部标题 + 进度 */}
      <div className="flex items-center justify-between mb-2.5 px-1">
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center"
            style={{ background: "var(--accent-soft)" }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 11H1l8-8M15 11v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <span className="text-[13px] font-medium text-[var(--text-primary)] tracking-tight">
            为您匹配了 {companies.length} 个方案
          </span>
        </div>
        <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums">
          {activeIndex + 1} / {companies.length}
        </span>
      </div>

      {/* 卡片轨道 - 一次显示 2 张,calc(50% - gap/2) 保证 2 张刚好占满 */}
      {/* min-w-0 必须有,否则 flex 容器的 min-width:auto 会让容器被内容撑开,溢出横向滚动失效 */}
      {/* 保留滚动条(深色主题上也是淡淡的细条),给用户"可滑动"的视觉提示 */}
      <div
        ref={scrollRef}
        className="flex gap-3 w-full min-w-0 overflow-x-auto overflow-y-hidden snap-x snap-mandatory px-1 pb-2"
        style={{ scrollPaddingLeft: "4px" }}
      >
        {companies.map((company, i) => (
          <QuoteCardItem
            key={`${company.name}-${i}`}
            company={company}
            index={i}
            onConfirm={() => handleConfirm(company)}
          />
        ))}
      </div>

      {/* 进度条 */}
      <div className="mt-2.5 px-1 h-0.5 rounded-full bg-white/[0.04] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${((activeIndex + 1) / companies.length) * 100}%`,
            background: "var(--grad-violet)",
          }}
        />
      </div>
    </div>
  );
}

// =========================================================
// 单个保司卡片
// =========================================================
function QuoteCardItem({
  company,
  index,
  onConfirm,
}: {
  company: QuoteCompany;
  /** 用于错开动画 */
  index: number;
  onConfirm: () => void;
}) {
  const hue = company.hue ?? stringHue(company.name);
  // 错开每个卡片的动效节奏,避免"整齐划一"
  const enterDelay = `${index * 0.08}s`;
  const scanDelay = `${index * 0.6}s`;
  const ledDelay = `${index * 0.4}s`;
  const shimmerDelay = `${0.3 + index * 0.25}s`;
  const priceDelay = `${index * 0.5}s`;

  return (
    <div
      data-quote-card
      className="quote-card-rise snap-center shrink-0"
      style={{
        // 2 张卡片刚好铺满父容器(父容器是 message bubble 的内容区)
        width: "calc(50% - 6px)",
        minWidth: 168,
        // 错开入场
        ["--enter-delay" as string]: enterDelay,
        ["--scan-delay" as string]: scanDelay,
        ["--led-delay" as string]: ledDelay,
        ["--shimmer-delay" as string]: shimmerDelay,
        ["--price-delay" as string]: priceDelay,
      }}
    >
      <div
        className="quote-card relative h-full p-3 sm:p-3.5 rounded-2xl border border-[var(--border-subtle)] flex flex-col overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.008) 100%)",
        }}
      >
        {/* 装饰 1:网格底纹 - 顶部强、底部淡,营造数据感 */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(167,139,250,0.6) 1px, transparent 1px),
              linear-gradient(90deg, rgba(167,139,250,0.6) 1px, transparent 1px)
            `,
            backgroundSize: "18px 18px",
            opacity: 0.07,
            maskImage:
              "radial-gradient(ellipse 80% 60% at 50% 0%, black 0%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 60% at 50% 0%, black 0%, transparent 75%)",
          }}
        />

        {/* 装饰 2:顶部扫描线 */}
        <div className="quote-card__scan" />

        {/* 装饰 3:角部 LED 指示灯(右上) */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
          {company.badge && (
            <span
              className="px-1.5 py-0.5 text-[9.5px] font-medium rounded-full tracking-wider"
              style={{
                background: "var(--accent-soft)",
                color: "var(--accent)",
                border: "1px solid rgba(167,139,250,0.25)",
              }}
            >
              {company.badge}
            </span>
          )}
          <span
            className="quote-card__led"
            aria-hidden
          />
        </div>

        {/* 公司 logo + 名称 */}
        <div className="flex items-center gap-2.5 mb-3 pt-0.5 relative z-10 pr-16">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden text-[#08080a] text-[14px] font-bold tracking-tight"
            style={
              company.icon
                ? undefined
                : {
                    background: `linear-gradient(135deg, hsl(${hue}, 70%, 72%), hsl(${(hue + 40) % 360}, 65%, 80%))`,
                  }
            }
          >
            {company.icon ? (
              <img
                src={company.icon}
                alt={company.name}
                className="w-full h-full object-contain bg-white"
                loading="lazy"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = "none";
                  const parent = target.parentElement;
                  if (parent && !parent.dataset.fallback) {
                    parent.dataset.fallback = "1";
                    parent.style.background = `linear-gradient(135deg, hsl(${hue}, 70%, 72%), hsl(${(hue + 40) % 360}, 65%, 80%))`;
                    parent.textContent = company.name.charAt(0);
                  }
                }}
              />
            ) : (
              company.name.charAt(0)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold text-[var(--text-primary)] tracking-tight truncate">
              {company.name}
            </div>
            {company.rating !== undefined && (
              <div className="text-[10.5px] text-[var(--text-tertiary)] flex items-center gap-0.5 tabular-nums">
                <span className="text-amber-400">★</span>
                <span>{company.rating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>

        {/* 价格 + 流光 */}
        <div className="mb-3 relative z-10">
          <div className="quote-card__price text-[22px] sm:text-[24px] font-bold tracking-tight text-gradient leading-none">
            {company.price}
          </div>
        </div>

        {/* 特色列表 */}
        {company.features && company.features.length > 0 && (
          <ul className="space-y-1 mb-3 text-[11.5px] text-[var(--text-secondary)] relative z-10">
            {company.features.slice(0, 3).map((f, i) => (
              <li
                key={i}
                className="flex items-start gap-1.5 leading-snug"
              >
                <span
                  className="shrink-0 mt-1 w-1 h-1 rounded-full"
                  style={{ background: "var(--accent)" }}
                />
                <span className="line-clamp-1">{f}</span>
              </li>
            ))}
          </ul>
        )}

        {/* 弹性空间,让按钮始终贴底 */}
        <div className="flex-1" />

        {/* 分隔线 - 细线,带渐变 */}
        <div
          className="relative z-10 h-px mb-2.5"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(167,139,250,0.25), transparent)",
          }}
        />

        {/* 确认投保 按钮 - 全宽 */}
        <button
          type="button"
          onClick={onConfirm}
          className="relative w-full overflow-hidden rounded-lg active:scale-[0.985] transition-transform duration-200"
          style={{
            padding: "0.6rem 0.75rem",
            background: "var(--grad-violet)",
            boxShadow:
              "0 4px 18px -6px rgba(167,139,250,0.55), 0 0 0 1px rgba(167,139,250,0.4) inset",
          }}
        >
          {/* 按钮上的高光扫光 */}
          <span className="quote-card__shimmer" aria-hidden />
          <span className="relative z-10 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-[#08080a] tracking-tight">
            确认投保
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
}

/** 字符串 → 0~360 色相(用于 logo 渐变) */
function stringHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}
