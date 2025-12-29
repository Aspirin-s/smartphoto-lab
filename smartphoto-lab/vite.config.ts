import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // 加载环境变量 (第三个参数 '' 表示加载所有变量，不仅限于 VITE_ 开头)
    const env = loadEnv(mode, '.', '');
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // 智谱 API 配置
        'process.env.ZHIPU_API_KEY': JSON.stringify(env.VITE_ZHIPU_API_KEY || env.ZHIPU_API_KEY || '10e8ecb1d6934864a0ad03ed907e7b37.8pzfF46df5MPiAAx')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});