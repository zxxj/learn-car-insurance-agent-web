/**
 * 报价工具事件总线
 * - QuoteCard 没有 chatEngine 引用,通过 emit 让 App 转发 sendUserMessage
 * - 简单 Set 监听器,无外部依赖
 */
type Listener = (text: string) => void;
const listeners = new Set<Listener>();

export const quoteEvents = {
  /** 用户在报价卡片上确认,需要把这句话作为用户消息发出 */
  emitConfirm(text: string) {
    listeners.forEach((fn) => {
      try {
        fn(text);
      } catch (e) {
        console.error("[quoteEvents] listener error:", e);
      }
    });
  },
  /** App 挂载时订阅,返回 unsubscribe */
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
