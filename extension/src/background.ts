import {
  MSG_PREFILL,
  MSG_PREFILL_REQUEST,
  MSG_PANEL_OPENED,
  MSG_TOGGLE_PANEL,
  PORT_PANEL_CLOSED,
  isExtensionMessage,
  isPrefillMessage,
  isPrefillRequestMessage,
  isPanelOpenedMessage,
  isTogglePanelMessage,
  type ExtensionMessage,
  type PrefillMessage,
  type PrefillRequestMessage
} from './common/messaging';

const pendingPrefill = new Map<number, PrefillMessage>();
const documentTabMap = new Map<string, number>();
const SIDE_PANEL_BASE_PATH = 'src/sidepanel/index.html';

// 全局面板状态跟踪
let panelOpened = false;

// 当前窗口 ID 跟踪
let currentWindowId: number | undefined;

// 更新当前窗口 ID
function updateCurrentWindowId() {
  chrome.windows.getCurrent({ populate: true }, (currentWindow) => {
    currentWindowId = currentWindow.id;
  });
}

// 关闭所有窗口的侧边栏面板
function closePanel() {
  chrome.sidePanel.setOptions({ enabled: false }).then(() => {
    chrome.sidePanel.setOptions({ enabled: true }).catch(() => {});
  }).catch(() => {});
}

// 打开侧边栏面板
async function openPanel(windowId: number | undefined) {
  if (windowId === undefined) {
    windowId = currentWindowId;
  }
  if (windowId) {
    // 为所有窗口打开面板
    chrome.sidePanel.open({ windowId }).catch(() => {});
  }
}

// 切换面板显示状态
function changePanelShowStatus() {
  panelOpened = !panelOpened;
  
  if (panelOpened) {
    openPanel(undefined);
  } else {
    closePanel();
  }
}

// 初始化当前窗口 ID
updateCurrentWindowId();

// 监听窗口焦点变化
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    currentWindowId = windowId;
  }
});

// 监听窗口创建
chrome.windows.onCreated.addListener(() => {
  updateCurrentWindowId();
});

// 监听窗口移除
chrome.windows.onRemoved.addListener(() => {
  updateCurrentWindowId();
});

// 安装扩展时配置点击扩展图标自动打开侧边栏
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// 点击扩展图标时切换面板状态
chrome.action.onClicked.addListener(() => {
  changePanelShowStatus();
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
  if (isPanelOpenedMessage(rawMessage)) {
    // 面板已打开通知
    panelOpened = true;
    return true;
  }
  if (isTogglePanelMessage(rawMessage)) {
    // 切换面板状态
    changePanelShowStatus();
    return true;
  }
  return false;
});

// 监听端口连接，用于跟踪面板关闭
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === PORT_PANEL_CLOSED) {
    port.onDisconnect.addListener(() => {
      panelOpened = false;
    });
  }
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
  
  // 如果面板还没打开，则打开面板
  if (!panelOpened) {
    changePanelShowStatus();
  }
  
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

export {};


