# TDesign AG-UI 适配器源码(本地参考)

## 背景
项目用 `@tdesign-react/chat` + `protocol: "agui"` 接入 AG-UI 协议。
为了排查 reasoning / toolcall 渲染、自定义 MessageBubble 接管后的事件流转,
从 `tdesign-web-components@1.3.0-alpha.2` 的 `lib/chat-engine/adapters/agui/*.js`
对应的 `*.js.map` 抽出 `sourcesContent`,得到原始 TypeScript 源码。

## 抽取方式
```bash
node -e "
const fs = require('fs');
const map = JSON.parse(fs.readFileSync(
  'node_modules/.pnpm/tdesign-web-components@1.3.0-alpha.2/node_modules/tdesign-web-components/lib/chat-engine/adapters/agui/index.js.map',
  'utf8'
));
fs.writeFileSync('agui-index.ts', map.sourcesContent[0]);
"
```

## 文件清单
| 文件 | 行数 | 作用 |
|---|---|---|
| `agui-index.ts` | 311 | `AGUIAdapter` 主类,含 `convertHistoryMessages` 静态方法 |
| `agui-event-mapper.ts` | 614 | `AGUIEventMapper`,处理实时 SSE 流(SSE → message content) |
| `agui-utils.ts` | 559 | 工具函数,`processReasoningContent` / `processToolCalls` / `buildToolCallMap` 在此 |

## 关键定位

### 1. 历史消息转换(静态方法)
- `agui-index.ts:68-210` — `AGUIAdapter.convertHistoryMessages`
- `agui-index.ts:88-147` — `processMessageGroup`(核心:reasoning → content → toolCalls → activity 顺序)
- `agui-index.ts:194-205` — 主循环,只把 `user / assistant / tool / activity` 收入分组
  - ⚠️ `role: "reasoning"` 这种独立消息**不会被收入**,直接被忽略
  - ✅ 正确做法:后端应把 reasoning 嵌到 `assistant.reasoningContent` 字段

### 2. 实时流事件聚合
- `agui-event-mapper.ts:275-300` — `handleThinkingStart` / `handleThinkingTextStart`
- `agui-event-mapper.ts:300-340` — `handleThinkingTextContent` / `handleThinkingTextEnd`
- 聚合成 `{ type: "reasoning", data: AIMessageContent[], status: "streaming" }`

### 3. reasoning content 处理
- `agui-utils.ts:197-225` — `parseReasoningContent`(字符串 → content item)
- `agui-utils.ts:225-275` — `convertReasoningMessages`(批量)

## 自定义渲染注意
TDesign `<ChatBot>` 内置渲染 reasoning,但**自定义 MessageBubble** 必须自己处理
`type: "reasoning"` 的 content item,否则会走到 `return null` 被静默丢弃。
本项目 `src/components/chat/MessageBubble.tsx` 已实现 `Reasoning` 组件接管这块。
