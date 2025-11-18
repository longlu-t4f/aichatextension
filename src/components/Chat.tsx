/**
 * 聊天组件
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createChatCompletion } from '../services/chat';
import { copyToClipboard } from '../utils';
import { useIframeBridge } from '../hooks/useIframeBridge';

type ChatRole = 'user' | 'assistant';

type Message = {
  id: string;
  role: ChatRole;
  text: string;
};

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingController, setPendingController] = useState<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 处理发送
  const handleSend = useCallback(async (textToSend?: string) => {
    const text = textToSend ?? input;
    if (sending || !text.trim()) {
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text.trim()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSending(true);

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      text: '正在生成…'
    };
    setMessages((prev) => [...prev, assistantMessage]);

    const controller = new AbortController();
    setPendingController(controller);

    try {
      const { text } = await createChatCompletion(userMessage.text, {
        signal: controller.signal
      });
      setMessages((prev) =>
        prev.map((msg) => (msg.id === assistantMessage.id ? { ...msg, text } : msg))
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id ? { ...msg, text: '请求已取消' } : msg
          )
        );
      } else {
        const message = error instanceof Error ? error.message : String(error);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id ? { ...msg, text: `请求失败：${message}` } : msg
          )
        );
      }
    } finally {
      if (pendingController === controller) {
        setPendingController(null);
      }
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending]);

  // iframe bridge 通信
  const { openOptions } = useIframeBridge({
    onPrefill: useCallback(
      (text: string, autoSend?: boolean) => {
        if (autoSend && text.trim() && !sending) {
          handleSend(text);
        } else {
          setInput(text);
        }
      },
      [handleSend, sending]
    )
  });

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  // 复制消息
  const handleCopy = async (text: string) => {
    await copyToClipboard(text);
  };

  return (
    <div className="sp-container">
      <header className="sp-header">
        <div className="logo">AI Chat</div>
        <nav className="sp-nav">
          <button
            className="settings-button"
            type="button"
            aria-label="打开设置"
            title="设置"
            onClick={openOptions}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" />
              <path d="M20.25 12a8.26 8.26 0 0 0-.08-1.17l1.9-1.49a.75.75 0 0 0 .18-.96l-1.8-3.12a.75.75 0 0 0-.9-.34l-2.24.9a7.87 7.87 0 0 0-2.02-1.17l-.34-2.39A.75.75 0 0 0 13.27 2h-3.54a.75.75 0 0 0-.74.64l-.34 2.39a7.87 7.87 0 0 0-2.02 1.17l-2.24-.9a.75.75 0 0 0-.9.34l-1.8 3.12a.75.75 0 0 0 .18.96l1.9 1.49a8.26 8.26 0 0 0 0 2.34l-1.9 1.49a.75.75 0 0 0-.18.96l1.8 3.12a.75.75 0 0 0 .9.34l2.24-.9c.61.48 1.29.87 2.02 1.17l.34 2.39c.05.36.36.64.74.64h3.54c.38 0 .69-.28.74-.64l.34-2.39c.73-.3 1.41-.69 2.02-1.17l2.24.9a.75.75 0 0 0 .9-.34l1.8-3.12a.75.75 0 0 0-.18-.96l-1.9-1.49c.05-.39.08-.78.08-1.17Z" />
            </svg>
          </button>
        </nav>
      </header>
      <main className="sp-main">
        <section className="chat-area" aria-label="聊天对话">
          <div className="messages" aria-live="polite">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`message ${message.role === 'user' ? 'message-user' : 'message-ai'}`}
              >
                <div className="message-bubble">{message.text}</div>
                <div className="message-actions">
                  <button
                    className="message-action"
                    type="button"
                    aria-label="复制"
                    title="复制"
                    onClick={() => handleCopy(message.text)}
                  >
                    <svg
                      aria-hidden="true"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.25 5.25v-.75A2.25 2.25 0 0 1 10.5 2.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-.75m-6 3h-9A2.25 2.25 0 0 1 1.5 16.5v-9A2.25 2.25 0 0 1 3.75 5.25h9A2.25 2.25 0 0 1 15 7.5v9a2.25 2.25 0 0 1-2.25 2.25Z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </section>
        <section className="composer" aria-label="消息输入">
          <label htmlFor="input" className="sr-only">
            输入消息
          </label>
          <textarea
            id="input"
            ref={inputRef}
            rows={4}
            placeholder="在此输入消息，或等待页面选中文本注入…"
            autoComplete="off"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="composer-toolbar">
            <div className="composer-tools"></div>
            <button
              id="send"
              className="primary"
              type="button"
              onClick={() => handleSend()}
              disabled={sending}
            >
              发送
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

