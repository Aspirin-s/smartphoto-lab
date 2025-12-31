import React, { useState, useMemo, useEffect } from 'react';
import { getApiUrl } from './utils/config';
import Navbar from './components/Navbar';
import Auth from './components/Auth';
import UploadModal from './components/UploadModal';
import PhotoEditor from './components/PhotoEditor';
import SmartSearch from './components/SmartSearch';
import Slideshow from './components/Slideshow';
import { Photo, User } from './types';
import { Plus, Search, MapPin, PlayCircle, CheckSquare, CheckCircle2, Trash2 } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('smartphoto_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null); // For Editor
  const [searchTerm, setSearchTerm] = useState('');
  const [aiFilteredIds, setAiFilteredIds] = useState<string[] | null>(null); // null means no AI filter active
  const [isAiSearchOpen, setIsAiSearchOpen] = useState(false);

  // New State for Selection & Slideshow
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSlideshowOpen, setIsSlideshowOpen] = useState(false);

  useEffect(() => {
    if (user && user.id) {
      const apiUrl = getApiUrl(`/api/photos?userId=${user.id}`);
      fetch(apiUrl)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        })
        .then(data => {
          if (Array.isArray(data)) {
            setPhotos(data);
          } else {
            console.error("API Error:", data);
            setPhotos([]);
          }
        })
        .catch(err => {
            console.error("Failed to load photos:", err);
            setPhotos([]);
        });
    }
  }, [user]);

  // --- Handlers ---
  const handleLogin = (user: User) => {
    setUser(user);
    localStorage.setItem('smartphoto_user', JSON.stringify(user));
  };
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('smartphoto_user');
  };

  const handleUpload = async (newPhoto: Photo, file: File) => {
    if (!user || !user.id) {
        console.error('Upload error: No user or user.id');
        return;
    }

    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('metadata', JSON.stringify(newPhoto));
      formData.append('userId', user.id.toString());

      const response = await fetch(getApiUrl('/api/upload'), {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const savedPhoto = await response.json();
        setPhotos(prev => [savedPhoto, ...prev]);
      } else {
        const errorText = await response.text();
        console.error("Upload failed:", response.status, errorText);
        alert('上传失败: ' + errorText);
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert('上传错误: ' + error);
    }
  };

  // --- 4. 修改: 删除逻辑对接后端 ---
  const handleDelete = async (id: string) => {
    try {
      await fetch(getApiUrl(`/api/photos/${id}`), {
        method: 'DELETE',
      });

      // 只有后端删除成功后，才更新前端状态
      setPhotos(prev => prev.filter(p => p.id !== id));
      if (selectedPhotoId === id) setSelectedPhotoId(null);
      if (selectedIds.has(id)) {
          const newSet = new Set(selectedIds);
          newSet.delete(id);
          setSelectedIds(newSet);
      }
    } catch (error) {
      console.error("Error deleting photo:", error);
    }
  };

  // 批量删除功能
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    
    const confirmMsg = `确定要删除选中的 ${selectedIds.size} 张照片吗？此操作不可恢复。`;
    if (!confirm(confirmMsg)) return;

    const idsToDelete = Array.from(selectedIds);
    let successCount = 0;
    
    for (const id of idsToDelete) {
      try {
        await fetch(getApiUrl(`/api/photos/${id}`), {
          method: 'DELETE',
        });
        successCount++;
      } catch (error) {
        console.error(`Error deleting photo ${id}:`, error);
      }
    }

    // 更新前端状态
    setPhotos(prev => prev.filter(p => !selectedIds.has(p.id)));
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

const handleUpdate = async (id: string, payload: Blob | { tags: string[] }) => {
    try {
      let response;

      if (payload instanceof Blob) {
        const formData = new FormData();
        const filename = `edited-${Date.now()}.png`; 
        formData.append('photo', payload, filename);

        response = await fetch(getApiUrl(`/api/photos/${id}`), {
          method: 'PUT',
          body: formData,
        });
      } else {
        response = await fetch(getApiUrl(`/api/photos/${id}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (response.ok) {
        const updatedPhoto = await response.json();
        
        // 更新本地状态
        setPhotos(prev => {
          const updated = prev.map(p => 
            p.id === id ? { 
                ...updatedPhoto, 
                url: payload instanceof Blob ? `${updatedPhoto.url}?t=${Date.now()}` : updatedPhoto.url 
            } : p
          );
          return updated;
        });
        
        // 如果是保存图片，稍等片刻让状态更新，然后关闭编辑器
        if (payload instanceof Blob) {
          setTimeout(() => {
            setSelectedPhotoId(null);
          }, 800);
        }
        
        console.log("Update successful");
      } else {
        const errData = await response.json();
        console.error("Failed to update:", errData);
        alert("Update failed: " + (errData.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error updating photo:", error);
      alert("Network error.");
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds(new Set()); // Clear selection when toggling
  };

  const togglePhotoSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
        newSet.delete(id);
    } else {
        newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // --- Derived State (Filtering) ---
  const filteredPhotos = useMemo(() => {
    let result = photos;

    // 1. Apply AI Filter (MCP)
    if (aiFilteredIds !== null) {
      result = result.filter(p => aiFilteredIds.includes(p.id));
    }

    // 2. Apply Text Filter (Simple Search)
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(lower) || 
        p.tags.some(t => t.toLowerCase().includes(lower)) ||
        p.description?.toLowerCase().includes(lower)
      );
    }
    
    return result;
  }, [photos, searchTerm, aiFilteredIds]);

  // Determine photos for slideshow
  const slideshowPhotos = useMemo(() => {
    if (selectedIds.size > 0) {
        // If items are manually selected, prioritize them (ordered by filtered list order)
        return filteredPhotos.filter(p => selectedIds.has(p.id));
    }
    // Otherwise play all visible photos
    return filteredPhotos;
  }, [filteredPhotos, selectedIds]);

  // --- Navigation for Editor (Lightbox) ---
  const currentPhotoIndex = filteredPhotos.findIndex(p => p.id === selectedPhotoId);
  
  const handleNext = () => {
    if (currentPhotoIndex < filteredPhotos.length - 1) {
        setSelectedPhotoId(filteredPhotos[currentPhotoIndex + 1].id);
    }
  };

  const handlePrev = () => {
    if (currentPhotoIndex > 0) {
        setSelectedPhotoId(filteredPhotos[currentPhotoIndex - 1].id);
    }
  };

  // --- Render ---
  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
      <div className="min-h-screen bg-slate-50 pb-20">
        <Navbar user={user} onLogout={handleLogout} />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Controls */}
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">我的相册</h1>
                <p className="text-slate-500 text-sm">
                    {isSelectionMode 
                        ? `已选择 ${selectedIds.size} 张` 
                        : `共 ${photos.length} 张照片`
                    }
                </p>
            </div>
            
            <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
                {/* Search Bar */}
                <div className="relative flex-1 md:w-64">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="按标签或名称搜索..."
                        className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        disabled={isSelectionMode}
                    />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    {/* 批量删除按钮 - 在选择模式下显示，未选中时禁用 */}
                    {isSelectionMode && (
                        <button
                            onClick={handleBatchDelete}
                            disabled={selectedIds.size === 0}
                            className={`inline-flex items-center px-3 py-2 border shadow-sm text-sm font-medium rounded-lg focus:outline-none ${
                                selectedIds.size > 0 
                                    ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100' 
                                    : 'border-slate-300 text-slate-400 bg-slate-50 cursor-not-allowed'
                            }`}
                            title={selectedIds.size > 0 ? `删除选中的 ${selectedIds.size} 张照片` : '请先选择照片'}
                        >
                            <Trash2 className="h-5 w-5 mr-2" />
                            删除{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
                        </button>
                    )}

                    <button
                        onClick={() => setIsSlideshowOpen(true)}
                        disabled={filteredPhotos.length === 0}
                        className="inline-flex items-center px-3 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
                        title="开始幻灯片"
                    >
                        <PlayCircle className="h-5 w-5 mr-2 text-purple-600" />
                        {selectedIds.size > 0 ? `播放 (${selectedIds.size})` : '幻灯片'}
                    </button>

                    <button
                        onClick={toggleSelectionMode}
                        className={`inline-flex items-center px-3 py-2 border text-sm font-medium rounded-lg shadow-sm focus:outline-none ${
                            isSelectionMode 
                            ? 'bg-slate-800 text-white border-transparent hover:bg-slate-900' 
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                    >
                        <CheckSquare className="h-5 w-5 mr-2" />
                        {isSelectionMode ? '完成' : '选择'}
                    </button>

                    <button
                        onClick={() => setIsUploadOpen(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-primary hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                    >
                        <Plus className="h-5 w-5 mr-2" />
                        上传
                    </button>
                </div>
            </div>
          </div>

          {/* Grid View */}
          {filteredPhotos.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl">
                <p className="text-slate-500 text-lg">未找到照片</p>
                {aiFilteredIds !== null && (
                    <button onClick={() => setAiFilteredIds(null)} className="mt-2 text-primary hover:underline">
                        清除 AI 筛选
                    </button>
                )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {filteredPhotos.map((photo) => {
                    const isSelected = selectedIds.has(photo.id);
                    return (
                        <div 
                            key={photo.id} 
                            className={`
                                group relative bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-all cursor-pointer aspect-square
                                ${isSelected ? 'ring-4 ring-primary border-primary' : 'border-slate-100'}
                                ${isSelectionMode ? 'hover:scale-95' : ''}
                            `}
                            onClick={() => {
                                if (isSelectionMode) {
                                    togglePhotoSelection(photo.id);
                                } else {
                                    setSelectedPhotoId(photo.id);
                                }
                            }}
                        >
                            <img 
                                src={photo.url} 
                                alt={photo.name} 
                                className={`w-full h-full object-cover transition-transform duration-300 ${!isSelectionMode && 'group-hover:scale-105'}`} 
                            />
                            
                            {/* Overlay for Details (Hover) */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 pointer-events-none">
                                <p className="text-white font-medium text-sm truncate">{photo.name}</p>
                                <div className="flex items-center text-white/80 text-xs">
                                    <MapPin className="h-3 w-3 mr-1" />
                                    {photo.exif.location || '未知'}
                                </div>
                            </div>

                            {/* Selection Overlay */}
                            {isSelectionMode && (
                                <div className={`absolute inset-0 bg-black/10 flex items-start justify-end p-2 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                    <div className={`
                                        h-6 w-6 rounded-md border-2 flex items-center justify-center transition-colors
                                        ${isSelected ? 'bg-primary border-primary' : 'bg-white/50 border-white'}
                                    `}>
                                        {isSelected && <CheckCircle2 className="h-4 w-4 text-white" />}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
          )}
        </main>

        {/* Modals */}
        {isUploadOpen && (
            <UploadModal 
                onClose={() => setIsUploadOpen(false)} 
                // @ts-ignore: Temporary ignore until UploadModal is updated
                onUpload={handleUpload} 
            />
        )}

        {selectedPhotoId && (
            <PhotoEditor 
                photo={photos.find(p => p.id === selectedPhotoId)!}
                onClose={() => setSelectedPhotoId(null)}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onNext={handleNext}
                onPrev={handlePrev}
            />
        )}

        {isSlideshowOpen && (
            <Slideshow 
                photos={slideshowPhotos}
                onClose={() => setIsSlideshowOpen(false)}
            />
        )}

        {/* AI Sidebar */}
        <SmartSearch 
            photos={photos} 
            onFilter={setAiFilteredIds} 
            isOpen={isAiSearchOpen}
            setIsOpen={setIsAiSearchOpen}
        />
      </div>
  );
};

export default App;