# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 生产阶段
FROM node:20-alpine

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 只安装生产依赖（实际上只需要 Node.js 运行时，但保留 package.json 以便运行脚本）
RUN npm ci --omit=dev || true

# 从构建阶段复制构建产物和服务器目录
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

# 暴露端口
EXPOSE 4173

# 设置环境变量默认值（可在 docker-compose 中覆盖）
ENV PORT=4173

# 启动服务器
CMD ["node", "server/index.js"]

