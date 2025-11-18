/**
 * 认证相关 API 服务
 */

import { apiPrefix } from '../config';
import { tokenStorage } from './storage';

type ResponseType<T = any> = {
  success: boolean;
  data: T;
  code: string;
  message: string;
  error?: string;
};

async function request<T>(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: unknown;
  } = {}
): Promise<ResponseType<T>> {
  const { method = 'GET', headers = {}, body } = options;
  const fullUrl = `${apiPrefix}${url}`;

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers
  };

  // 自动添加 token
  const token = tokenStorage.get();
  if (token) {
    finalHeaders.authorization = token;
  }

  const response = await fetch(fullUrl, {
    method,
    headers: finalHeaders,
    body: body == null ? undefined : JSON.stringify(body)
  });

  // 从响应头获取新的 token
  const authHeader = response.headers.get('authorization');
  if (authHeader) {
    tokenStorage.set(authHeader);
  }

  // 处理 401 未授权
  if (response.status === 401) {
    const resJson = await response.json().catch(() => ({}));
    tokenStorage.remove();
    throw new Error(resJson.error || '未授权，请重新登录');
  }

  const resJson = await response.json();

  if (resJson.code === 401) {
    tokenStorage.remove();
    throw new Error(resJson.error || '未授权，请重新登录');
  }

  if (!resJson.success) {
    throw new Error(resJson.error || resJson.message || '请求失败');
  }

  return resJson;
}

/**
 * 获取当前用户信息
 */
export async function getCurrent(): Promise<ResponseType<any>> {
  return request('/current', { method: 'GET' });
}

/**
 * 获取企业微信登录授权 URL
 */
export async function getOAuthAuthUrl(): Promise<ResponseType<{ url: string }>> {
  return request('/workweixin/auth/url', {
    method: 'POST',
    body: {
      state: 'login'
    }
  });
}

/**
 * 获取隐私授权 URL
 */
export async function getOAuthPrivacyUrl(): Promise<ResponseType<{ url: string }>> {
  return request('/workweixin/auth/oauth-url', {
    method: 'POST',
    body: {
      state: 'complete_profile'
    }
  });
}

