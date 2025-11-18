/**
 * 登录页面组件
 * 
 * 使用 Zustand store 获取登录状态和方法
 */

import React from 'react';
import { useAuthStore } from '../auth/store';

export function Login() {
  // 从 Zustand store 获取登录相关状态和方法
  const { error, loading, getLoginUrl } = useAuthStore((state) => ({
    error: state.error,
    loading: state.loading,
    getLoginUrl: state.getLoginUrl
  }));

  /**
   * 处理登录按钮点击
   * 调用 getLoginUrl 获取登录地址并跳转
   */
  const handleLogin = async () => {
    try {
      await getLoginUrl();
      // 注意：getLoginUrl 会直接跳转页面，所以这里不需要处理成功状态
    } catch (error) {
      // 错误已由 store 处理，这里不需要额外操作
    }
  };

  return (
    <div className="login-container">
      <div className="login-content">
        <div className="login-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <h1 className="login-title">企业微信登录</h1>
        <p className="login-description">请使用企业微信账号登录</p>
        <button
          id="login-btn"
          className="login-button"
          type="button"
          onClick={handleLogin}
          disabled={loading}
        >
          <span className="login-button-text">
            {loading ? '正在跳转...' : '立即登录'}
          </span>
        </button>
        {/* 显示错误信息 */}
        {error && (
          <div id="login-error" className="login-error">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export function Loading() {
  return (
    <div className="loading-container">
      <div className="loading-content">
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
        <p className="loading-text">正在加载...</p>
      </div>
    </div>
  );
}

/**
 * 错误页面组件
 * 
 * @param message - 错误消息，如果不提供则从 window.loginErrorMessage 或默认消息获取
 */
export function Error({ message }: { message?: string }) {
  // 优先使用传入的 message，其次使用全局错误消息，最后使用默认消息
  const errorMessage = message || (window as any).loginErrorMessage || '请稍后重试';

  /**
   * 处理重试按钮点击
   * 重新加载页面
   */
  const handleRetry = () => {
    window.location.href = '/';
  };

  return (
    <div className="error-container">
      <div className="error-content">
        <div className="error-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="error-title">似乎遇到点问题</h2>
        <p className="error-message">{errorMessage}</p>
        <button id="retry-btn" className="error-button" type="button" onClick={handleRetry}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            width="16"
            height="16"
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          重新加载
        </button>
      </div>
    </div>
  );
}

