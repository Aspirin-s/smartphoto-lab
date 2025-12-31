import React, { useState } from 'react';
import { MessageSquare, Send, Sparkles, X, Search } from 'lucide-react';
import { Photo } from '../types';
import { searchPhotosWithZhipu } from '../services/zhipuService';

interface SmartSearchProps {
  photos: Photo[];
  onFilter: (ids: string[] | null) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const SmartSearch: React.FC<SmartSearchProps> = ({ photos, onFilter, isOpen, setIsOpen }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<{role: 'user' | 'assistant', content: string}[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userQuery = query;
    setQuery('');
    setHistory(prev => [...prev, { role: 'user', content: userQuery }]);
    setIsLoading(true);

    const result = await searchPhotosWithZhipu(userQuery, photos);
    
    setIsLoading(false);
    
    // Update Filter
    if (result.matchedPhotoIds.length > 0) {
        onFilter(result.matchedPhotoIds);
        setHistory(prev => [...prev, { 
            role: 'assistant', 
            content: `找到了 ${result.matchedPhotoIds.length} 张照片。${result.reasoning}` 
        }]);
    } else {
        onFilter([]);
        setHistory(prev => [...prev, { 
            role: 'assistant', 
            content: `没有找到匹配的照片。${result.reasoning}` 
        }]);
    }
  };

  const clearFilter = () => {
    onFilter(null);
    setHistory([]);
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-40 bg-gradient-to-r from-primary to-purple-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 ${isOpen ? 'hidden' : 'flex'}`}
      >
        <Sparkles className="h-6 w-6" />
      </button>

      {/* Slide-over Panel */}
      <div className={`fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="p-4 bg-gradient-to-r from-primary to-purple-600 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                <h2 className="font-semibold">AI 助手 (MCP)</h2>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {history.length === 0 && (
                <div className="text-center text-slate-500 mt-10">
                    <Sparkles className="h-12 w-12 mx-auto text-purple-300 mb-4" />
                    <p className="text-sm">试着用自然语言提问：</p>
                    <div className="mt-4 space-y-2 text-xs">
                        <p className="bg-white p-2 rounded shadow-sm border border-slate-100 cursor-pointer hover:border-primary" onClick={() => setQuery("找出动物的照片")}>"找出动物的照片"</p>
                        <p className="bg-white p-2 rounded shadow-sm border border-slate-100 cursor-pointer hover:border-primary" onClick={() => setQuery("显示上个月拍摄的照片")}>"显示上个月拍摄的照片"</p>
                        <p className="bg-white p-2 rounded shadow-sm border border-slate-100 cursor-pointer hover:border-primary" onClick={() => setQuery("高对比度的图片")}>"高对比度的图片"</p>
                    </div>
                </div>
            )}
            
            {history.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  msg.role === 'user' 
                    ? 'bg-primary text-white rounded-br-none' 
                    : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
               <div className="flex justify-start">
                   <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
                       <div className="flex space-x-1">
                           <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                           <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                           <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                       </div>
                   </div>
               </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-200 bg-white">
             {/* Normal Search Fallback visual */}
             <div className="mb-2 flex justify-between items-center text-xs text-slate-400">
                <span>模型: 智谱 GLM-4V-Flash</span>
                <button onClick={clearFilter} className="text-primary hover:underline">重置筛选</button>
             </div>
             
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="描述你想找的内容..."
                className="flex-1 rounded-lg border-slate-300 border focus:ring-2 focus:ring-primary/20 focus:border-primary px-3 py-2 text-sm"
              />
              <button 
                type="submit" 
                disabled={isLoading}
                className="bg-primary text-white p-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                <Send className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default SmartSearch;