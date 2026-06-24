/**
 * 输入区 - 自定义发送框
 * 响应式:
 * - 移动端:padding 更小,工具栏只留必要按钮,建议词隐藏
 * - 桌面端:完整布局
 * 附件:支持图片上传,带预览、loading、移除
 */
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { uploadFile } from "../../api";

interface ComposerProps {
  value: string;
  loading: boolean;
  onChange: (v: string) => void;
  /**
   * 发送消息
   * @param message 组装后的完整消息(已包含文件 URL)
   */
  onSend: (message: string) => void;
  onStop: () => void;
}

interface AttachedFile {
  id: string;
  name: string;
  type: string;
  url: string;
  uploading: boolean;
  error?: string;
  /** 本地预览(图片用) */
  preview?: string;
}

const SUGGESTIONS = [
  "解释一下什么是 RAG",
  "帮我写一封客户邮件",
  "本周工作计划",
  "推荐一本产品书",
];

export function Composer({
  value,
  loading,
  onChange,
  onSend,
  onStop,
}: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [files, setFiles] = useState<AttachedFile[]>([]);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = Math.min(ref.current.scrollHeight, 200) + "px";
    }
  }, [value]);

  // 焦点光环呼吸
  useEffect(() => {
    if (!wrapRef.current) return;
    const ring = wrapRef.current.querySelector("[data-ring]") as HTMLElement;
    if (focused) {
      gsap.to(ring, { opacity: 1, duration: 0.6, ease: "expo.out" });
    } else {
      gsap.to(ring, { opacity: 0, duration: 0.6, ease: "expo.out" });
    }
  }, [focused]);

  // 组件卸载时回收 object URL
  useEffect(() => {
    return () => {
      files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =========================================================
  // 附件处理
  // =========================================================
  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = ""; // 重置以便下次能选同一文件

    for (const file of selected) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const isImage = file.type.startsWith("image/");
      const preview = isImage ? URL.createObjectURL(file) : undefined;

      setFiles((prev) => [
        ...prev,
        {
          id,
          name: file.name,
          type: file.type,
          url: "",
          uploading: true,
          preview,
        },
      ]);

      try {
        const url = await uploadFile(file);
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, url, uploading: false } : f)),
        );
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id
              ? {
                  ...f,
                  uploading: false,
                  error: (err as Error)?.message ?? "上传失败",
                }
              : f,
          ),
        );
      }
    }
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((f) => f.id !== id);
    });
  };

  // =========================================================
  // 组装最终消息
  // - 图片: 追加 `![name](url)`
  // - 文件: 追加 `[name](url)`
  // =========================================================
  const buildMessage = (): string => {
    const uploaded = files.filter((f) => f.url && !f.uploading && !f.error);
    if (uploaded.length === 0) return value;

    const lines = uploaded.map((f) => {
      const safeName = f.name.replace(/[\[\]]/g, "");
      if (f.type.startsWith("image/")) {
        return `![${safeName}](${f.url})`;
      }
      return `[${safeName}](${f.url})`;
    });

    return value
      ? `${value}\n\n${lines.join("\n")}`
      : lines.join("\n");
  };

  // 清理所有附件(发送后调用)
  const clearFiles = () => {
    files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    setFiles([]);
  };

  const hasUploading = files.some((f) => f.uploading);
  const hasReadyFile = files.some((f) => f.url && !f.uploading);
  const canSend =
    !loading && !hasUploading && (value.trim().length > 0 || hasReadyFile);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    const message = buildMessage();
    clearFiles();
    onSend(message);
  };

  return (
    <form
      ref={wrapRef}
      onSubmit={handleSubmit}
      className="relative w-full max-w-3xl mx-auto"
    >
      {/* 焦点光晕 */}
      <div
        data-ring
        className="absolute -inset-px rounded-[20px] sm:rounded-[22px] opacity-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, rgba(167,139,250,0.4), rgba(103,232,249,0.2) 60%, transparent 90%)",
          filter: "blur(0.5px)",
        }}
      />

      <div
        className="relative glass-panel rounded-[20px] sm:rounded-[22px] overflow-hidden transition-all duration-500"
        style={{
          background: focused
            ? "linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.015) 100%)"
            : "linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.008) 100%)",
        }}
      >
        {/* 隐藏的文件 input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
          aria-hidden
        />

        {/* 附件预览条 - 仅在有附件时显示 */}
        {files.length > 0 && (
          <div className="flex gap-2 px-3 pt-2.5 sm:px-4 sm:pt-3 overflow-x-auto no-scrollbar">
            {files.map((file) => (
              <FileChip
                key={file.id}
                file={file}
                onRemove={() => handleRemoveFile(file.id)}
              />
            ))}
          </div>
        )}

        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) handleSubmit(e as unknown as React.FormEvent);
            }
          }}
          placeholder={
            hasReadyFile ? "可补充说明,直接发送即可" : "发消息…"
          }
          rows={1}
          className="w-full bg-transparent border-0 outline-none resize-none px-4 pt-3 pb-2 sm:px-5 sm:pt-4 sm:pb-2 text-[14px] sm:text-[14.5px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] tracking-[-0.005em] leading-[1.6]"
          style={{ maxHeight: 200 }}
        />

        {/* 工具条 */}
        <div className="flex items-center justify-between px-2.5 pb-2.5 pt-1 sm:px-4 sm:pb-3 sm:pt-1 gap-2">
          <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={handleAttachmentClick}
              disabled={loading}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] active:scale-95 transition-all duration-300 shrink-0 disabled:opacity-40"
              title="上传图片"
              aria-label="上传图片"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <div className="ml-1 sm:ml-2 hidden md:flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] min-w-0 overflow-hidden">
              {SUGGESTIONS.slice(0, 2).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange(s)}
                  className="px-2.5 py-1 rounded-md border border-[var(--border-subtle)] hover:border-[var(--border-default)] hover:text-[var(--text-secondary)] transition-all duration-300 whitespace-nowrap shrink-0"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="text-[10.5px] text-[var(--text-tertiary)] tabular-nums tracking-wider hidden sm:inline">
              {value.length} / 4000
            </span>
            {loading ? (
              <button
                type="button"
                onClick={onStop}
                className="btn-luxe primary !py-1.5 !px-3 sm:!py-2 sm:!px-4 !text-[12px] sm:!text-[12.5px]"
              >
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-[#08080a] rounded-sm animate-pulse" />
                <span>停止</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSend}
                className="btn-luxe primary !py-1.5 !px-3 sm:!py-2 sm:!px-4 !text-[12px] sm:!text-[12.5px] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span>发送</span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}

// =========================================================
// 附件预览小卡片
// =========================================================
function FileChip({
  file,
  onRemove,
}: {
  file: AttachedFile;
  onRemove: () => void;
}) {
  return (
    <div className="relative shrink-0 group" title={file.name}>
      <div
        className={`w-14 h-14 rounded-lg overflow-hidden border flex items-center justify-center transition-colors duration-300 ${
          file.error
            ? "border-red-500/30 bg-red-500/[0.08]"
            : file.uploading
              ? "border-[var(--border-default)] bg-white/[0.03]"
              : "border-[var(--border-subtle)] bg-white/[0.02] group-hover:border-[var(--border-default)]"
        }`}
      >
        {file.uploading ? (
          <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        ) : file.error ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-red-400"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        ) : file.preview ? (
          <img
            src={file.preview}
            alt={file.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            className="text-[var(--text-tertiary)]"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
          </svg>
        )}
      </div>
      {/* 移除按钮 - 上传中禁用 */}
      {!file.uploading && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:scale-110 opacity-0 group-hover:opacity-100 transition-all duration-200"
          aria-label={`移除 ${file.name}`}
        >
          <svg
            width="8"
            height="8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
