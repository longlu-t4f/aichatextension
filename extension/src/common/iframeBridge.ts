export const BRIDGE_CHANNEL = 'ai-chat-iframe-bridge' as const;

export const IFRAME_READY = 'AI_CHAT_IFRAME_READY' as const;
export const HOST_READY = 'AI_CHAT_HOST_READY' as const;
export const PREFILL_REQUEST = 'AI_CHAT_PREFILL_REQUEST' as const;
export const PREFILL_EVENT = 'AI_CHAT_PREFILL_EVENT' as const;
export const OPEN_OPTIONS = 'AI_CHAT_OPEN_OPTIONS' as const;

type BridgeMessageBase<TType extends string, TPayload> = {
  channel: typeof BRIDGE_CHANNEL;
  type: TType;
  payload?: TPayload;
};

export type BridgeMessage =
  | BridgeMessageBase<typeof IFRAME_READY, { source?: string }>
  | BridgeMessageBase<typeof HOST_READY, { tabId?: number }>
  | BridgeMessageBase<typeof PREFILL_REQUEST, Record<string, never>>
  | BridgeMessageBase<typeof PREFILL_EVENT, { text: string; autoSend?: boolean }>
  | BridgeMessageBase<typeof OPEN_OPTIONS, Record<string, never>>;

export type IframeToHostMessage = Extract<
  BridgeMessage,
  | { type: typeof IFRAME_READY }
  | { type: typeof PREFILL_REQUEST }
  | { type: typeof OPEN_OPTIONS }
>;

export type HostToIframeMessage = Extract<
  BridgeMessage,
  | { type: typeof HOST_READY }
  | { type: typeof PREFILL_EVENT }
>;

export function isBridgeMessage(message: unknown): message is BridgeMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'channel' in message &&
    (message as { channel: unknown }).channel === BRIDGE_CHANNEL &&
    'type' in message &&
    typeof (message as { type: unknown }).type === 'string'
  );
}

export function isIframeToHostMessage(message: BridgeMessage): message is IframeToHostMessage {
  return (
    message.type === IFRAME_READY ||
    message.type === PREFILL_REQUEST ||
    message.type === OPEN_OPTIONS
  );
}

export function isHostToIframeMessage(message: BridgeMessage): message is HostToIframeMessage {
  return (
    message.type === HOST_READY ||
    message.type === PREFILL_EVENT
  );
}

