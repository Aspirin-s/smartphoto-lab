import React, { useState } from 'react';
import { User } from '../types';
import { getApiUrl } from '../utils/config';

interface AuthProps {
  onLogin: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 基础验证
    if (username.length < 3) {
      setError('用户名至少 3 个字符');
      return;
    }
    if (password.length < 6) {
      setError('密码至少 6 个字符');
      return;
    }

    const endpoint = isRegister ? '/api/register' : '/api/login';
    const payload = isRegister 
      ? { username, email, password } 
      : { username, password }; // 登录时只需要用户名和密码

    try {
      const apiUrl = getApiUrl(endpoint);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '认证失败');
      }

      onLogin(data); 

    } catch (err: any) {
      console.error('Login/Register error:', err);
      setError(err.message || 'Network error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-center mb-6 text-slate-800">
          {isRegister ? '创建账户' : '欢迎回来'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">用户名</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20 p-2 border"
              placeholder="unique_user"
            />
          </div>

          {/* 注册时才需要填写邮箱 */}
          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-slate-700">邮箱</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20 p-2 border"
                placeholder="you@example.com"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700">密码</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20 p-2 border"
              placeholder="••••••"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            {isRegister ? '注册' : '登录'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError(''); // 切换时清空错误
            }}
            className="text-sm text-primary hover:text-blue-700"
          >
            {isRegister ? '已有账户？登录' : '需要账户？注册'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;