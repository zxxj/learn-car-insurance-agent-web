# agui 项目整体思维导图

> 最后更新: 2026-06-17

## 一、项目总览

```
agui(车险 Agent 聊天前端)
├── 类型: React 19 + TypeScript SPA
├── 构建: Vite 8
├── 样式: Tailwind CSS 4(原生 CSS 变量主题)
├── 动画: GSAP + ScrollTrigger
├── UI 库: @tdesign-react/chat 1.0.2(TDesign Omi web components)
├── 协议: AG-UI(Agent-User Interaction Protocol,SSE 流式)
├── 后端: http://192.168.15.198:8000(Vite 代理转发)
└── 端口: 默认 5173
```

---

## 二、目录结构

```
src/
├── main.tsx                  # 入口,挂载 <App/>,注册 GSAP
├── App.tsx                   # 顶层壳:布局 / 断点 / 入场动画 / 状态总线
├── index.css                 # 全局变量 + 工具类 + 关键帧动画
│
├── api/                      # 后端 HTTP 接口层
│   ├── http.ts               # 通用 fetch 封装(超时/错误/JSON)
│   ├── chat.ts               # SSE 流式对话端点 + createChatServiceConfig
│   ├── messages.ts           # 历史消息加载/清空
│   ├── files.ts              # 文件上传(URL.createObjectURL)
│   └── index.ts              # 统一 re-export
│
├── components/
│   ├── chat/                 # 聊天核心 UI
│   │   ├── MessageBubble.tsx # 单条消息气泡(用户/助手)+ 内容分发(text/markdown/toolcall)
│   │   ├── MessageList.tsx   # 消息列表 + GSAP stagger 入场
│   │   ├── Composer.tsx      # 底部输入框 + 发送/停止
│   │   └── Hero.tsx          # 首屏空态(标题 + 4 张提示卡)
│   │
│   └── layout/               # 框架组件
│       ├── ChatHeader.tsx    # 顶部状态栏
│       └── Sidebar.tsx       # 左侧导航(响应式抽屉)
│
├── tools/                    # Agent 工具注册(TDesign toolcall)
│   ├── index.ts              # useTools() 入口
│   ├── weather.ts            # get_weather 工具(非交互)
│   ├── quote.ts              # quote 工具(交互式卡片)
│   ├── quoteEvents.ts        # 事件总线(QuoteCard → App)
│   └── components/
│       ├── ToolBadge.tsx     # 通用工具调用徽章
│       └── QuoteCard.tsx     # 保司报价卡片(横向滑动)
│
docs/                         # 文档
├── ARCHITECTURE.md           # 本文件
└── agui-source/              # TDesign 适配器源码(从 .js.map 抽出)
    ├── README.md
    ├── agui-index.ts
    ├── agui-event-mapper.ts
    └── agui-utils.ts
```

---

## 三、模块关系图

```
┌──────────────────────────────────────────────────────────────┐
│                          main.tsx                            │
│                           ↓ mount                            │
│                          App.tsx                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ useTools() ──────────────► 注册 weatherTool / quoteTool│  │
│  │ useChat(config) ─────────► TDesign ChatEngine          │  │
│  │   │                                                    │  │
│  │   ├─► api/chat.ts (SSE) ──► /conversations/:id/chat    │  │
│  │   │                          (AG-UI 协议)              │  │
│  │   │                                                    │  │
│  │   └─► api/messages.ts ────► /conversations/:id/messages│  │
│  │                              (历史消息加载)             │  │
│  │                                                        │  │
│  │ messages + status ────► 渲染                              │  │
│  │   ├─► MessageList ─► MessageBubble ─► ContentRenderer   │  │
│  │   │                     │                               │  │
│  │   │                     ├─ text/markdown ─► <ChatMarkdown>│ │
│  │   │                     │   (cherry-markdown / shadow)  │  │
│  │   │                     ├─ toolcall ──────► ToolCallRenderer│
│  │   │                     │                    │           │  │
│  │   │                     │                    └─► QuoteCard/WeatherBadge│
│  │   │                     │                         │      │  │
│  │   │                     │                         ▼      │  │
│  │   │                     │                   quoteEvents  │  │
│  │   │                     │                    (emit)      │  │
│  │   │                     │                         │      │  │
│  │   │                     └─ image ──────────► 自建 lightbox │  │
│  │   │                                                  │   │  │
│  │   └─► Composer ◄──── quoteEvents.subscribe(确认投保)   │   │  │
│  │                          ▼                            │   │  │
│  │                   chatEngine.sendUserMessage          │   │  │
│  │                                                        │  │
│  │ Sidebar / ChatHeader / Hero  ──► 布局                   │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 四、关键数据流

### 1. 用户发送消息
```
Composer.onSend
  → App.handleSend
    → chatEngine.sendUserMessage({ prompt })
      → POST /conversations/:id/chat (SSE)
        → 后端返回 AG-UI 事件流
          → ChatEngine.handleAGUIStreamRequest
            → AGUIAdapter.handleAGUIEvent
              → event-mapper 转 AIMessageContent
                → 更新 messages state
                  → MessageList 重渲染
                    → MessageBubble → ContentRenderer
```

### 2. 工具调用(以 quote 为例)
```
后端发出 TOOL_CALL_START / ARGS / END
  → AGUIEventMapper 创建 toolcall-{name}-{id} 内容项
    → ContentRenderer 识别 isToolCallContent
      → <ToolCallRenderer> 匹配 QuoteCard
        → 用户点击"确认投保"
          → QuoteCard.handleConfirm
            ├─► quoteEvents.emitConfirm("我确认投保XXX")
            │     → App 订阅 → chatEngine.sendUserMessage
            └─► respond({ action: "confirm", company, text })
                  → TDesign SDK 把 tool call 标记为完成
```

### 3. 历史消息加载
```
App 挂载
  → fetchHistoryMessages(THREAD_ID)
    → GET /conversations/:id/messages
      → AGUIAdapter.convertHistoryMessages
        → 按 user 分组 → 每个组生成一条 assistant 消息
          → content 数组:reasoningContent / content / toolCalls
            → 同上渲染链路
```

---

## 五、关键技术点

| 主题 | 实现 | 注意点 |
|---|---|---|
| AG-UI 协议 | `createChatServiceConfig` 设 `protocol: "agui"` | 必须配,否则不解析 THINKING/TOOL_CALL |
| 流式渲染 | ChatEngine 自动增量更新 messages | 自定义 MessageBubble 必须显式处理每种 content type |
| Markdown | TDesign `<ChatMarkdown>` (cherry-markdown) | **渲染在 shadow DOM**,light DOM CSS 穿不进 |
| 白字穿透 | `useEffect` 注入 `<style>` 到 `shadowRoot` | 50ms 轮询等 web component 升级 |
| 横向滑动卡片 | `flex overflow-x-auto snap-x` | 父容器要 `items-stretch` 否则宽度坍塌 |
| Tool Card 交互 | 事件总线 `quoteEvents` 桥接组件 ↔ chatEngine | `respond()` 是给 agent 的回执,不是用户消息 |
| 首屏动画 | GSAP timeline 编排 2.4s 入场 | 尊重 `prefers-reduced-motion` |
| 响应式 | `matchMedia` 监听 1024px 断点 | 桌面/移动两套布局 |
| 文件上传 | `URL.createObjectURL` + multipart/form-data | 需在 chatServiceConfig 配 onUpload |

---

## 六、当前已知约束(踩过的坑)

1. **reasoning 渲染**:自定义 MessageBubble 不渲染 `type: "reasoning"` content,等后端把历史 reasoning 嵌到 `assistant.reasoningContent`
2. **bundle 体积**:cherry-markdown ~2.4MB(主要),需 code-split 优化
3. **JPG 链接 vs 图片语法**:`[text](url.jpg)` vs `![alt](url.png)`,正则需兼容
4. **Card 宽度计算**:`calc(50% - 6px)` 必须父容器有明确 width,且 `items-stretch` 而非 `items-start`
5. **未知 message.role**:`AGUIAdapter.convertHistoryMessages` 只识别 user/assistant/tool/activity,其他静默丢

---

## 七、扩展点(待办)

```
工具层
├── 新增工具: tools/xxx.ts + tools/components/XxxCard.tsx
├── 注册到: tools/index.ts 的 ALL_TOOLS
└── 暴露事件: 走 quoteEvents 或新建 xxxEvents 总线

API 层
├── 新增端点: api/xxx.ts,re-export 自 api/index.ts
└── SSE 协议: protocol 字段切换,或自定义 onMessage 覆盖

UI 层
├── 新增布局: components/layout/
├── 新增消息类型: MessageBubble.ContentRenderer 加分支
└── 新增动画: index.css 加 @keyframes,GSAP 触发
```
