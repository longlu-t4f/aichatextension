/**
 * iframe 通信 Hook
 */

import { useEffect, useRef } from 'react';
import {
  BRIDGE_CHANNEL,
  HOST_READY,
  IFRAME_READY,
  OPEN_OPTIONS,
  PREFILL_EVENT,
  PREFILL_REQUEST,
  type HostToIframeMessage,
  type IframeToHostMessage,
  isBridgeMessage,
  isHostToIframeMessage
} from '../../extension/src/common/iframeBridge';

type UseIframeBridgeOptions = {
  onPrefill?: (text: string, autoSend?: boolean) => void;
};

// 检测是否在 iframe 中运行
function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function useIframeBridge({ onPrefill }: UseIframeBridgeOptions = {}) {
  const hostOriginRef = useRef<string | null>(null);

  useEffect(() => {

    // 只在 iframe 环境中通知 host
    if (isInIframe()) {
      const message: IframeToHostMessage = {
        channel: BRIDGE_CHANNEL,
        type: IFRAME_READY,
        payload: { source: 'remote-ui' }
      };
      window.parent.postMessage(message, '*');
    }

    // 监听来自 host 的消息
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) {
        return;
      }
      if (!isBridgeMessage(event.data) || !isHostToIframeMessage(event.data)) {
        return;
      }
      if (hostOriginRef.current && event.origin !== hostOriginRef.current) {
        return;
      }
      hostOriginRef.current = event.origin;

      const message = event.data as HostToIframeMessage;
      handleHostMessage(message);
    };

    const handleHostMessage = (message: HostToIframeMessage) => {
      switch (message.type) {
        case HOST_READY:
          // Host 已准备好，请求预填充内容
          requestPrefill();
          break;
        case PREFILL_EVENT:
          // 收到预填充内容
          if (onPrefill && message.payload) {
            onPrefill(message.payload.text ?? '', message.payload.autoSend);
          }
          break;
        default:
          break;
      }
    };

    const requestPrefill = () => {
      if (isInIframe()) {
        const message: IframeToHostMessage = {
          channel: BRIDGE_CHANNEL,
          type: PREFILL_REQUEST
        };
        window.parent.postMessage(message, hostOriginRef.current ?? '*');
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [onPrefill]);

  // 打开设置页面
  const openOptions = () => {
    if (isInIframe()) {
      const message: IframeToHostMessage = {
        channel: BRIDGE_CHANNEL,
        type: OPEN_OPTIONS
      };
      window.parent.postMessage(message, hostOriginRef.current ?? '*');
    }
  };

  return { openOptions };
}

