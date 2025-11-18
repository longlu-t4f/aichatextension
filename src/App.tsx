/**
 * 主应用组件
 * 
 * 使用 Zustand store 管理认证状态
 */

import React, { useEffect } from 'react';
import { useAuthStore } from './auth/store';
import { Login, Loading, Error } from './components/Login';
import { Chat } from './components/Chat';

export function App() {
  // 从 Zustand store 获取认证状态和方法
  const { userInfo, loading, error, checkLogin } = useAuthStore((state) => ({
    userInfo: state.userInfo,
    loading: state.loading,
    error: state.error,
    checkLogin: state.checkLogin
  }));

  // 组件挂载时检查登录状态
  useEffect(() => {
    checkLogin();
  }, [checkLogin]);

  // 加载中状态：显示加载组件
  if (loading) {
    return <Loading />;
  }

  // 错误状态：显示错误组件（仅在未登录时显示错误）
  if (error && !userInfo) {
    return <Error message={error} />;
  }

  // 未登录状态：显示登录组件
  if (!userInfo) {
    return <Login />;
  }

  // 已登录状态：显示主应用（聊天界面）
  return <Chat />;
}

