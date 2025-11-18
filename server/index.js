/**
 * 生产环境服务器
 * 使用 Koa 框架，在运行时注入 Docker 环境变量到 HTML 中
 */

import Koa from 'koa';
import serve from 'koa-static';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = process.env.PORT || 4173;
const DIST_DIR = join(__dirname, '..', 'dist');

// 从环境变量读取配置
function getAppConfig() {
  const config = {
    API_HOST: process.env.API_HOST || '',
    API_PREFIX: process.env.API_PREFIX || '/api',
    VITE_CHAT_API_BASE_URL: process.env.VITE_CHAT_API_BASE_URL || '',
    VITE_CHAT_API_KEY: process.env.VITE_CHAT_API_KEY || '',
    VITE_CHAT_MODEL: process.env.VITE_CHAT_MODEL || '',
    VITE_API_PREFIX: process.env.VITE_API_PREFIX || '',
  };

  // 过滤掉空值
  return Object.fromEntries(
    Object.entries(config).filter(([_, value]) => value !== '')
  );
}

// 生成配置注入脚本
function generateConfigScript(config) {
  const configJson = JSON.stringify(config).replace(/</g, '\\u003c');
  return `
    <script>
      window.APP_CONFIG = ${configJson};
    </script>
  `;
}

const app = new Koa();

// 中间件：处理 HTML 文件并注入配置
app.use(async (ctx, next) => {
  const urlPath = ctx.path === '/' ? 'index.html' : ctx.path.replace(/^\/+/, '');
  
  // 安全检查：防止路径遍历攻击
  if (urlPath.includes('..') || urlPath.includes('\0')) {
    ctx.status = 403;
    ctx.body = 'Forbidden';
    return;
  }

  const filePath = join(DIST_DIR, urlPath);

  // 确保文件路径在 dist 目录内
  if (!filePath.startsWith(DIST_DIR)) {
    ctx.status = 403;
    ctx.body = 'Forbidden';
    return;
  }

  // 如果是 HTML 文件且存在，直接读取并注入配置
  if (extname(filePath) === '.html' && existsSync(filePath)) {
    try {
      let html = readFileSync(filePath, 'utf-8');
      const config = getAppConfig();

      // 在 </head> 标签前注入配置脚本
      if (html.includes('</head>')) {
        html = html.replace('</head>', `${generateConfigScript(config)}\n</head>`);
      } else if (html.includes('<body>')) {
        // 如果没有 </head>，在 <body> 前注入
        html = html.replace('<body>', `${generateConfigScript(config)}\n<body>`);
      }

      ctx.type = 'text/html';
      ctx.body = html;
      return;
    } catch (error) {
      console.error('Error reading HTML file:', error);
    }
  }

  // 其他文件使用静态服务
  await next();
});

// 静态文件服务
app.use(serve(DIST_DIR, {
  gzip: true,
}));

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
  console.log(`📦 Serving files from: ${DIST_DIR}`);
  const config = getAppConfig();
  if (Object.keys(config).length > 0) {
    console.log(`⚙️  Injected config:`, config);
  } else {
    console.log(`⚠️  No environment variables found, using defaults`);
  }
});

