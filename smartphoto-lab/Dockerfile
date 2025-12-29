# 构建阶段
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# 注入智谱 API Key (构建时需要)
ARG VITE_ZHIPU_API_KEY
ENV VITE_ZHIPU_API_KEY=$VITE_ZHIPU_API_KEY
RUN npm run build

# 运行阶段 (使用 Nginx)
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]