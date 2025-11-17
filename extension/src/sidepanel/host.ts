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

const searchParams = new URLSearchParams(window.location.search);
const tabIdParam = Number(searchParams.get('tabId') ?? '');
const currentTabId = Number.isFinite(tabIdParam) ? tabIdParam : undefined;

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

requestPrefill();

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
  if (!currentTabId) return true;
  return message.tabId == null || message.tabId === currentTabId;
}

function postToIframe(message: HostToIframeMessage) {
  if (!iframeEl.contentWindow) {
    return;
  }
  const targetOrigin = iframeOrigin ?? '*';
  iframeEl.contentWindow.postMessage(message, targetOrigin);
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

