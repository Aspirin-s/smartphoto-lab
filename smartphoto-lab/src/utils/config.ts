// API 配置
// 动态获取API基础URL，支持局域网访问
// 这个函数每次调用时都会重新计算，确保在运行时获取正确的hostname
export function getApiUrl(path: string = ''): string {
  if (typeof window === 'undefined') {
    return `http://localhost:3001${path}`;
  }
  
  const hostname = window.location.hostname;
  
  // 如果访问的主机名不是 localhost 或 127.0.0.1，使用当前主机名
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://localhost:3001${path}`;
  }
  
  // 手机或其他设备通过局域网IP访问时，使用相同的IP访问后端
  return `http://${hostname}:3001${path}`;
}
