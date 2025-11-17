import {
  MSG_PREFILL,
  MSG_PREFILL_REQUEST,
  isExtensionMessage,
  isPrefillMessage,
  isPrefillRequestMessage,
  type ExtensionMessage,
  type PrefillMessage,
  type PrefillRequestMessage
} from './common/messaging';

const pendingPrefill = new Map<number, PrefillMessage>();
const documentTabMap = new Map<string, number>();
const SIDE_PANEL_BASE_PATH = 'src/sidepanel/index.html';

// 安装扩展时配置点击扩展图标自动打开侧边栏
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.documentId) {
    documentTabMap.set(details.documentId, details.tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  pendingPrefill.delete(tabId);
  for (const [docId, mappedTabId] of documentTabMap.entries()) {
    if (mappedTabId === tabId) {
      documentTabMap.delete(docId);
    }
  }
});

// 统一处理前后台消息，负责缓存和派发预填充内容
chrome.runtime.onMessage.addListener((rawMessage: unknown, sender) => {
  if (!isExtensionMessage(rawMessage)) {
    return false;
  }
  if (isPrefillMessage(rawMessage)) {
    const message = rawMessage as PrefillMessage;
    const tabId = resolveTabId(message.tabId, sender);
    if (tabId == null) {
      // ignore invalid tab
      return false;
    }
    handlePrefill(message, tabId);
    return true;
  }
  if (isPrefillRequestMessage(rawMessage)) {
    const message = rawMessage as PrefillRequestMessage;
    const tabId = resolveTabId(message.tabId, sender);
    if (tabId == null) {
      // ignore invalid tab
      return false;
    }
    deliverPrefill(tabId, undefined, { dropAfterSend: true });
    return true;
  }
  return false;
});

function resolveTabId(
  explicitTabId: number | undefined,
  sender: chrome.runtime.MessageSender
): number | undefined {
  if (explicitTabId != null) return explicitTabId;
  if (sender.tab?.id != null) return sender.tab.id;
  if (sender.documentId) {
    const mapped = documentTabMap.get(sender.documentId);
    if (mapped != null) {
      return mapped;
    }
  }
  return undefined;
}

// 将页面发送过来的内容缓存，并触发侧边栏展示
function handlePrefill(msg: PrefillMessage, tabId: number) {
  const payload: PrefillMessage = { ...msg, tabId };
  pendingPrefill.set(tabId, payload);
  chrome.sidePanel
    .setOptions({
      tabId,
      path: buildSidePanelPath(tabId),
      enabled: true
    })
    .catch(() => {});
  chrome.sidePanel
    .open({ tabId })
    .catch(() => {});

  deliverPrefill(tabId, payload, { dropAfterSend: false });
}

// 向前端派发预填充内容；发送成功后清理缓存
function deliverPrefill(
  tabId: number,
  payload?: PrefillMessage,
  options?: { dropAfterSend?: boolean }
) {
  const message = payload ?? pendingPrefill.get(tabId);
  if (!message) return;
  const dropAfterSend = options?.dropAfterSend ?? true;
  chrome.runtime.sendMessage(message).then(
    () => {
      if (dropAfterSend && pendingPrefill.get(tabId) === message) {
        pendingPrefill.delete(tabId);
      }
    },
    (err) => {
      if (err && typeof err.message === 'string' && err.message.includes('Receiving end does not exist')) {
        return;
      }
    }
  );
}

// 构建侧边栏入口路径，附带当前标签页 ID
function buildSidePanelPath(tabId: number): string {
  return `${SIDE_PANEL_BASE_PATH}?tabId=${tabId}`;
}

export {};


