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
  isIframeToHostMessage
} from '../common/iframeBridge';
import {
  MSG_PREFILL_REQUEST,
  MSG_PANEL_OPENED,
  PORT_PANEL_CLOSED,
  isExtensionMessage,
  isPrefillMessage,
  type PrefillMessage
} from '../common/messaging';
import { buildIframeUrl, IFRAME_ALLOWED_ORIGINS } from '../config';

const iframeEl = document.getElementById('ai-chat-frame') as HTMLIFrameElement | null;
if (!iframeEl) {
  throw new Error('缺少 iframe 容器，无法初始化侧边栏宿主。');
}

const loadingEl = document.getElementById('host-loading');

// 获取当前活动标签页作为 currentTabId
let currentTabId: number | undefined;

// 通知后台面板已打开
chrome.runtime.sendMessage({ type: MSG_PANEL_OPENED }).catch(() => {});

// 创建端口连接，用于监听面板关闭
const port = chrome.runtime.connect({ name: PORT_PANEL_CLOSED });

// 获取当前活动标签页
function updateCurrentTabId() {
  chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    if (tabs[0]?.id) {
      currentTabId = tabs[0].id;
    }
  }).catch(() => {});
}

updateCurrentTabId();

// 监听标签页激活事件 - 只更新 currentTabId，不自动请求预填充
chrome.tabs.onActivated.addListener(() => {
  updateCurrentTabId();
});

const iframeUrl = buildIframeUrl(currentTabId);
iframeEl.src = iframeUrl;

const allowedOrigins = new Set(IFRAME_ALLOWED_ORIGINS);
const iframeOrigin = safeGetOrigin(iframeUrl);
if (iframeOrigin) {
  allowedOrigins.add(iframeOrigin);
}

let bridgeReady = false;
let pendingPrefill: PrefillMessage | null = null;
window.addEventListener('message', (event) => {
  if (event.source !== iframeEl.contentWindow) {
    return;
  }
  if (!allowedOrigins.has(event.origin)) {
    return;
  }
  if (!isBridgeMessage(event.data) || !isIframeToHostMessage(event.data)) {
    return;
  }
  const message = event.data as IframeToHostMessage;
  handleIframeMessage(message);
});

chrome.runtime.onMessage.addListener((rawMessage: unknown) => {
  if (!isExtensionMessage(rawMessage) || !isPrefillMessage(rawMessage)) {
    return false;
  }
  if (!isRelevantPrefill(rawMessage as PrefillMessage)) {
    return false;
  }
  pendingPrefill = rawMessage as PrefillMessage;
  dispatchPrefill();
  return true;
});

// 移除自动请求预填充，保持面板内容状态独立

function handleIframeMessage(message: IframeToHostMessage) {
  switch (message.type) {
    case IFRAME_READY:
      bridgeReady = true;
      hideLoading();
      postToIframe({
        channel: BRIDGE_CHANNEL,
        type: HOST_READY,
        payload: { tabId: currentTabId }
      });
      dispatchPrefill();
      break;
    case PREFILL_REQUEST:
      requestPrefill();
      break;
    case OPEN_OPTIONS:
      chrome.runtime.openOptionsPage().catch(() => {});
      break;
    default:
      break;
  }
}

function dispatchPrefill() {
  if (!bridgeReady || !pendingPrefill) {
    return;
  }
  const { text, autoSend } = pendingPrefill;
  postToIframe({
    channel: BRIDGE_CHANNEL,
    type: PREFILL_EVENT,
    payload: { text, autoSend }
  });
  pendingPrefill = null;
}

function isRelevantPrefill(message: PrefillMessage): boolean {
  // 全局面板接受来自任何标签页的预填充消息
  return true;
}

function postToIframe(message: HostToIframeMessage) {
  if (!iframeEl!.contentWindow) {
    return;
  }
  const targetOrigin = iframeOrigin ?? '*';
  iframeEl!.contentWindow.postMessage(message, targetOrigin);
}

function requestPrefill() {
  chrome.runtime
    .sendMessage({ type: MSG_PREFILL_REQUEST, tabId: currentTabId })
    .catch(() => undefined);
}

function hideLoading() {
  loadingEl?.classList.add('hidden');
}

function safeGetOrigin(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

