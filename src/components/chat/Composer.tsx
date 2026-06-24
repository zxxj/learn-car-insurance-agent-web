import { ChatSender } from "@tdesign-react/chat";
import type { TdChatSenderParams, TdAttachmentItem } from "@tdesign-react/chat";
import { uploadFile } from "../../api";

interface ComposerProps {
  /** 受控值 */
  value: string;
  /** 是否正在流式输出 / pending - 决定 send/stop 按钮切换 */
  loading: boolean;
  onChange: (v: string) => void;
  /** 发送消息(仅文本,附件 url 由 App 通过 attachments state 走 chatEngine) */
  onSend: (message: string) => void;
  /** 中止当前生成 */
  onStop: () => void;
  /** 已选附件列表 - 通过 attachmentsProps.items 回灌给 ChatSender 渲染 chip */
  attachments: TdAttachmentItem[];
  /**
   * attachments 变更回调 - 支持函数式 updater(并发上传场景下避免互相覆盖)
   */
  onAttachmentsChange: (
    updater:
      | TdAttachmentItem[]
      | ((prev: TdAttachmentItem[]) => TdAttachmentItem[]),
  ) => void;
}

export function Composer({
  value,
  loading,
  onChange,
  onSend,
  onStop,
  attachments,
  onAttachmentsChange,
}: ComposerProps) {
  const hasReadyAttachment = attachments.some(
    (item) => item.status === "success" && item.url,
  );

  return (
    <ChatSender
      value={value}
      loading={loading}
      placeholder="发消息…"
      actions={["attachment", "send"]}
      autosize={{ minRows: 1, maxRows: 8 }}
      readyToSend={(v) => v.trim().length > 0 || hasReadyAttachment}
      onChange={(e) => onChange(e.detail)}
      onSend={(e: CustomEvent<TdChatSenderParams>) => {
        onSend(e.detail.value);
      }}
      onStop={onStop}
      textareaProps={{
        maxlength: 4000,
      }}
      uploadProps={{
        accept: "image/*",
        multiple: true,
      }}
      attachmentsProps={{
        items: attachments,
        overflow: "scrollX",
      }}
      onFileSelect={(e: CustomEvent<TdAttachmentItem[]>) => {
        e.detail.forEach((item) => {
          const newFile = {
            ...item,
            size: item.size,
            name: item.name,
            status: "progress" as TdAttachmentItem["status"],
            description: "上传中",
          } as TdAttachmentItem;

          onAttachmentsChange((prev) => [newFile, ...prev]);

          const file: File =
            item.raw instanceof File ? item.raw : (item as unknown as File);

          uploadFile(file)
            .then((url) => {
              onAttachmentsChange((prevState) =>
                prevState.map((file) =>
                  file.name === newFile.name
                    ? {
                        ...file,
                        url,
                        status: "success" as TdAttachmentItem["status"],
                        description: `${Math.floor((newFile?.size || 0) / 1024)}KB`,
                      }
                    : file,
                ),
              );
            })
            .catch((err) => {
              onAttachmentsChange((prevState) =>
                prevState.map((file) =>
                  file.name === newFile.name
                    ? {
                        ...file,
                        status: "fail" as TdAttachmentItem["status"],
                        description: (err as Error)?.message ?? "上传失败",
                      }
                    : file,
                ),
              );
            });
        });
      }}
      onFileRemove={(e: CustomEvent<TdAttachmentItem[]>) => {
        onAttachmentsChange(e.detail);
      }}
    />
  );
}
