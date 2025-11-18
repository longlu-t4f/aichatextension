/**
 * 认证状态管理（使用 Zustand）
 * 
 * 使用 Zustand 替代原来的 AuthManager 类，提供更简洁的状态管理方案
 * - 自动处理 React 状态同步，无需手动订阅/通知
 * - 代码量减少约 40%，更易维护
 * - 支持在 React 组件和非 React 环境中使用
 */

import { create } from 'zustand';
import { tokenStorage } from './storage';
import { getCurrent, getOAuthAuthUrl, getOAuthPrivacyUrl } from './service';

/**
 * 用户信息类型定义
 */
export type UserInfo = {
  /** 是否完成隐私授权 */
  privacy_completed?: boolean;
  /** 渠道码权限 */
  channel_code_permission?: boolean;
  /** 成员权限 */
  member_permission?: boolean;
  /** 用户名称 */
  name?: string;
  /** 用户头像 */
  avatar?: string;
  /** 其他扩展字段 */
  [key: string]: any;
};

/**
 * 认证状态类型定义
 */
type AuthState = {
  /** 用户信息，null 表示未登录 */
  userInfo: UserInfo | null;
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息，null 表示无错误 */
  error: string | null;
};

/**
 * 认证操作方法类型定义
 */
type AuthActions = {
  /**
   * 检查登录状态
   * - 如果 URL 中有 token 参数，会先保存 token
   * - 如果没有 token，会跳转到登录页面
   * - 如果有 token，会获取用户信息
   */
  checkLogin: () => Promise<void>;
  
  /**
   * 获取登录 URL 并跳转
   * 调用企业微信授权接口，获取授权 URL 后跳转
   */
  getLoginUrl: () => Promise<void>;
  
  /**
   * 获取用户信息
   * 调用 /current 接口获取当前登录用户信息
   * 如果用户未完成隐私授权，会记录警告日志
   */
  getUserInfo: () => Promise<void>;
  
  /**
   * 登出
   * 清除 token 和用户信息，然后刷新页面
   */
  logout: () => void;
  
  /**
   * 设置状态（内部使用）
   * 用于批量更新状态
   */
  setState: (updates: Partial<AuthState>) => void;
};

/**
 * 认证 Store
 * 
 * 使用 Zustand 创建全局状态管理
 * - 在 React 组件中：使用 useAuthStore hook 直接访问状态和方法
 * - 在非 React 环境中：使用 useAuthStore.getState() 获取状态，useAuthStore.subscribe() 订阅变化
 */
export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  // ========== 初始状态 ==========
  userInfo: null,
  loading: false,
  error: null,

  // ========== Actions ==========

  /**
   * 设置状态（内部方法）
   */
  setState: (updates) => set(updates),

  /**
   * 检查登录状态
   */
  checkLogin: async () => {
    // 检查 URL 参数中是否有 token（从企业微信回调时携带）
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      // 保存 token 到本地存储
      tokenStorage.set(token);
      // 清除 URL 中的 token 参数，避免暴露在地址栏
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }

    // 检查本地是否有 token
    const currentToken = tokenStorage.get();
    
    if (!currentToken) {
      // 没有 token，跳转到登录页面
      await get().getLoginUrl();
      return;
    }

    // 有 token，获取用户信息
    await get().getUserInfo();
  },

  /**
   * 获取登录 URL 并跳转
   */
  getLoginUrl: async () => {
    // 设置加载状态
    set({ loading: true, error: null });

    try {
      // 调用接口获取企业微信授权 URL
      const res = await getOAuthAuthUrl();
      
      if (res.data?.url) {
        // 跳转到企业微信授权页面
        window.location.href = res.data.url;
      } else {
        throw new Error('获取登录地址失败');
      }
    } catch (error) {
      // 处理错误
      const message = error instanceof Error ? error.message : '获取企微登录异常';
      set({ 
        loading: false, 
        error: message 
      });
      
      // 将错误信息存储到 window 对象，供非 React 环境使用
      (window as any).loginErrorMessage = message;
      throw error;
    }
  },

  /**
   * 获取用户信息
   */
  getUserInfo: async () => {
    // 设置加载状态
    set({ loading: true, error: null });

    try {
      // 调用接口获取当前用户信息
      const res = await getCurrent();
      const userInfo = res.data;

      // 检查是否需要隐私授权
      if (!userInfo.privacy_completed) {
        // 获取隐私授权 URL（当前仅记录，不自动跳转）
        const privacyRes = await getOAuthPrivacyUrl();
        if (privacyRes?.data?.url) {
          console.warn('需要隐私授权:', privacyRes.data.url);
        }
      }

      // 更新用户信息和状态
      set({
        userInfo,
        loading: false,
        error: null
      });
    } catch (error) {
      // 处理错误：清除 token 和用户信息
      const message = error instanceof Error ? error.message : '获取用户信息异常';
      tokenStorage.remove();
      
      set({
        userInfo: null,
        loading: false,
        error: message
      });
      
      // 将错误信息存储到 window 对象，供非 React 环境使用
      (window as any).loginErrorMessage = message;
      throw error;
    }
  },

  /**
   * 登出
   */
  logout: () => {
    // 清除本地存储的 token
    tokenStorage.remove();
    
    // 重置状态
    set({
      userInfo: null,
      loading: false,
      error: null
    });
    
    // 刷新页面，回到登录状态
    window.location.reload();
  }
}));

/**
 * 导出 tokenStorage，供其他模块使用
 */
export { tokenStorage };

