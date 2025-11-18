/**
 * 应用配置
 * 优先级：window.APP_CONFIG > import.meta.env > 默认值
 */

// 获取运行时配置
function getRuntimeConfig(key: string): string | undefined {
  if (typeof window !== 'undefined' && (window as any).APP_CONFIG) {
    return (window as any).APP_CONFIG[key];
  }
  return undefined;
}

// API 基础配置 - 可以通过环境变量或 window.APP_CONFIG 配置
// 优先级：window.APP_CONFIG.VITE_API_PREFIX > window.APP_CONFIG(API_HOST+API_PREFIX) > import.meta.env > 默认值
export const apiPrefix =
  getRuntimeConfig('VITE_API_PREFIX') ||
  (typeof window !== 'undefined' && (window as any).APP_CONFIG
    ? `${(window as any).APP_CONFIG.API_HOST || ''}${(window as any).APP_CONFIG.API_PREFIX || '/api'}`
    : undefined) ||
  (import.meta.env.VITE_API_PREFIX as string | undefined) ||
  '/api';

