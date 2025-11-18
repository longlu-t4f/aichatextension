/**
 * Token 存储工具
 * 使用 localStorage 存储认证 token
 */

const KEY_TOKEN = 'uda-platform-fe_token';

export const tokenStorage = {
  get(): string {
    return localStorage.getItem(KEY_TOKEN) || '';
  },

  set(value: string): void {
    localStorage.setItem(KEY_TOKEN, value);
  },

  remove(): void {
    localStorage.removeItem(KEY_TOKEN);
  }
};

