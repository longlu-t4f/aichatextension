// 侧边栏输入框预填用：内容脚本将选中文本推送给扩展侧边栏
export const MSG_PREFILL = 'MSG_PREFILL' as const;
// 触发生成回复：侧边栏把用户输入发送给后台处理
export const MSG_GENERATE = 'MSG_GENERATE' as const;
// 通知预填流程完成：后台或侧边栏告知内容脚本已处理完预填
export const MSG_PREFILL_DONE = 'MSG_PREFILL_DONE' as const;
// 请求当前选区内容：侧边栏初始化时向内容脚本拉取选中文本
export const MSG_PREFILL_REQUEST = 'MSG_PREFILL_REQUEST' as const;
export type PrefillMessage = {
  type: typeof MSG_PREFILL;
  text: string;
  tabId?: number;
  autoSend?: boolean;
};

export type PrefillRequestMessage = {
  type: typeof MSG_PREFILL_REQUEST;
  tabId?: number;
};

export type GenerateMessage = {
  type: typeof MSG_GENERATE;
  input: string;
};

export type PrefillDoneMessage = {
  type: typeof MSG_PREFILL_DONE;
};

// 扩展内部交互统一的消息联合类型
export type ExtensionMessage =
  | PrefillMessage
  | GenerateMessage
  | PrefillDoneMessage
  | PrefillRequestMessage;
/**
 * 判断给定的消息对象是否符合扩展消息的类型结构。
 * @param message 需要检查的消息对象
 * @returns 如果消息对象符合扩展消息类型结构，则返回 true；否则返回 false
 */
export function isExtensionMessage(message: unknown): message is ExtensionMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    typeof (message as { type: unknown }).type === 'string'
  );
}

/**
 * 判断给定的消息对象是否为预填消息。
 * @param message 需要检查的消息对象
 * @returns 如果消息对象为预填消息，则返回 true；否则返回 false
 */
export function isPrefillMessage(message: ExtensionMessage): message is PrefillMessage {
  return message.type === MSG_PREFILL;
}

/**
 * 判断给定的消息对象是否为预填请求消息。
 * @param message 需要检查的消息对象
 * @returns 如果消息对象为预填请求消息，则返回 true；否则返回 false
 */
export function isPrefillRequestMessage(
  message: ExtensionMessage
): message is PrefillRequestMessage {
  return message.type === MSG_PREFILL_REQUEST;
}