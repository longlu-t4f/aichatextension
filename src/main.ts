import './styles.css';

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
} from '../extension/src/common/iframeBridge';
import { createChatCompletion } from './service';
import { copyToClipboard } from './utils';

type ChatRole = 'user' | 'assistant';

type MessageHandle = {
  wrapper: HTMLDivElement;
  bubble: HTMLDivElement;
  setText: (text: string) => void;
};

const $ = <T extends HTMLElement>(selector: string) => document.querySelector(selector) as T;

const inputEl = $('#input') as HTMLTextAreaElement;
const sendBtn = $('#send') as HTMLButtonElement;
const messagesEl = $('#messages') as HTMLDivElement;
const settingsBtn = $('#open-settings') as HTMLButtonElement;

let hostOrigin: string | null = null;
let sending = false;
let pendingController: AbortController | null = null;

settingsBtn?.addEventListener('click', () => {
  // 在插件环境中打开设置页面，独立运行时此功能不可用
  if (isInIframe()) {
    emitToHost(OPEN_OPTIONS);
  }
});

sendBtn.addEventListener('click', () => {
  void performSend();
});

inputEl.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    void performSend();
  }
});

window.addEventListener('message', (event) => {
  if (event.source !== window.parent) {
    return;
  }
  if (!isBridgeMessage(event.data) || !isHostToIframeMessage(event.data)) {
    return;
  }
  if (hostOrigin && event.origin !== hostOrigin) {
    return;
  }
  hostOrigin = event.origin;
  handleHostMessage(event.data as HostToIframeMessage);
});

// 检测是否在 iframe 中运行
function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

// 只在 iframe 环境中通知 host
if (isInIframe()) {
  emitToHost(IFRAME_READY, { source: 'remote-ui' });
}

function handleHostMessage(message: HostToIframeMessage) {
  switch (message.type) {
    case HOST_READY:
      // Host 已准备好，请求预填充内容
      requestPrefill();
      break;
    case PREFILL_EVENT:
      applyPrefill(message.payload?.text ?? '', message.payload?.autoSend);
      break;
    default:
      break;
  }
}

function requestPrefill() {
  if (isInIframe()) {
    emitToHost(PREFILL_REQUEST);
  }
}

async function performSend() {
  if (sending) {
    return;
  }
  const value = inputEl.value.trim();
  if (!value) {
    return;
  }

  inputEl.value = '';
  appendMessage('user', value);

  sending = true;
  sendBtn.disabled = true;

  const controller = new AbortController();
  pendingController = controller;
  const assistantHandle = appendMessage('assistant', '正在生成…');

  try {
    const { text } = await createChatCompletion(value, { signal: controller.signal });
    assistantHandle.setText(text);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      assistantHandle.setText('请求已取消');
    } else {
      const message = error instanceof Error ? error.message : String(error);
      assistantHandle.setText(`请求失败：${message}`);
    }
  } finally {
    if (pendingController === controller) {
      pendingController = null;
    }
    sending = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

function applyPrefill(text: string, autoSend?: boolean) {
  inputEl.value = text ?? '';
  if (autoSend && text?.trim() && !sending) {
    void performSend();
  }
}

function appendMessage(role: ChatRole, text: string): MessageHandle {
  const wrapper = document.createElement('div');
  wrapper.classList.add('message', role === 'user' ? 'message-user' : 'message-ai');

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = text;
  wrapper.appendChild(bubble);

  const actions = document.createElement('div');
  actions.className = 'message-actions';

  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'message-action';
  copyButton.setAttribute('aria-label', '复制');
  copyButton.title = '复制';
  copyButton.innerHTML =
    '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M8.25 5.25v-.75A2.25 2.25 0 0 1 10.5 2.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-.75m-6 3h-9A2.25 2.25 0 0 1 1.5 16.5v-9A2.25 2.25 0 0 1 3.75 5.25h9A2.25 2.25 0 0 1 15 7.5v9a2.25 2.25 0 0 1-2.25 2.25Z"/></svg>';
  copyButton.addEventListener('click', async () => {
    await copyToClipboard(bubble.textContent ?? '');
  });

  actions.appendChild(copyButton);
  wrapper.appendChild(actions);
  messagesEl.appendChild(wrapper);
  scrollMessagesToBottom();

  return {
    wrapper,
    bubble,
    setText(value: string) {
      bubble.textContent = value;
    }
  };
}

function scrollMessagesToBottom() {
  const target = messagesEl;
  const scroll = () => target.scrollTo({ top: target.scrollHeight, behavior: 'smooth' });
  requestAnimationFrame(scroll);
}

function emitToHost<TType extends IframeToHostMessage['type']>(
  type: TType,
  payload?: Extract<IframeToHostMessage, { type: TType }>['payload']
) {
  const message = {
    channel: BRIDGE_CHANNEL,
    type,
    payload
  } as IframeToHostMessage;
  const targetOrigin = hostOrigin ?? '*';
  window.parent.postMessage(message, targetOrigin);
}

