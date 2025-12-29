import React, { useState, useRef } from 'react';
import { X, Trash2, ArrowLeft, ArrowRight, Crop, Check, RotateCcw, Save, Plus } from 'lucide-react';
import { Photo, PhotoFilter } from '../types';

interface PhotoEditorProps {
  photo: Photo;
  onClose: () => void;
  // 【修改】支持传输 Blob (图片) 或 对象 (标签更新)
  onUpdate: (id: string, payload: Blob | { tags: string[] }) => void; 
  onDelete: (id: string) => void;
  onNext: () => void;
  onPrev: () => void;
}

const PhotoEditor: React.FC<PhotoEditorProps> = ({ photo, onClose, onUpdate, onDelete, onNext, onPrev }) => {
  const [filters, setFilters] = useState<PhotoFilter>({
    brightness: 100, contrast: 100, saturation: 100, sepia: 0,
  });

  const [activeTab, setActiveTab] = useState<'info' | 'edit'>('info');
  const [isCropping, setIsCropping] = useState(false);
  
  // 【找回】标签管理状态
  const [newTag, setNewTag] = useState('');
  
  // 裁剪状态
  const [cropStart, setCropStart] = useState<{x: number, y: number} | null>(null);
  const [cropRect, setCropRect] = useState<{x: number, y: number, w: number, h: number} | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filterString = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) sepia(${filters.sepia}%)`;
  const filterStyle = { filter: filterString };

  // --- 【找回】标签管理功能 ---
  const handleAddTag = () => {
      if (!newTag.trim()) return;
      // 避免重复标签
      if (photo.tags && photo.tags.includes(newTag.trim())) {
          setNewTag('');
          return;
      }
      const updatedTags = [...(photo.tags || []), newTag.trim()];
      onUpdate(photo.id, { tags: updatedTags });
      setNewTag('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
      const updatedTags = photo.tags.filter(t => t !== tagToRemove);
      onUpdate(photo.id, { tags: updatedTags });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleAddTag();
  };

  // --- 鼠标事件处理 (裁剪框选) ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isCropping || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCropStart({ x, y });
    setCropRect({ x, y, w: 0, h: 0 });
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !cropStart || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let currentX = e.clientX - rect.left;
    let currentY = e.clientY - rect.top;
    
    currentX = Math.max(0, Math.min(currentX, rect.width));
    currentY = Math.max(0, Math.min(currentY, rect.height));

    const newX = Math.min(cropStart.x, currentX);
    const newY = Math.min(cropStart.y, currentY);
    const newW = Math.abs(currentX - cropStart.x);
    const newH = Math.abs(currentY - cropStart.y);

    setCropRect({ x: newX, y: newY, w: newW, h: newH });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (cropRect && (cropRect.w < 10 || cropRect.h < 10)) {
        setCropRect(null);
    }
  };

  // --- 核心功能：处理图片数据 (裁剪或保存滤镜) ---
  const processImage = (isCrop: boolean) => {
    if (!imgRef.current) {
      console.error('Editor error: Image ref is null');
      return;
    }

    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        const naturalWidth = imgRef.current.naturalWidth;
        const naturalHeight = imgRef.current.naturalHeight;

        if (isCrop && cropRect) {
            // --- 裁剪模式 ---
            const displayedWidth = imgRef.current.width;
            const displayedHeight = imgRef.current.height;
            const scaleX = naturalWidth / displayedWidth;
            const scaleY = naturalHeight / displayedHeight;
            
            const realCropX = cropRect.x * scaleX;
            const realCropY = cropRect.y * scaleY;
            const realCropW = cropRect.w * scaleX;
            const realCropH = cropRect.h * scaleY;

            canvas.width = realCropW;
            canvas.height = realCropH;

            ctx.drawImage(
              imgRef.current,
              realCropX, realCropY, realCropW, realCropH, 
              0, 0, realCropW, realCropH
            );
        } else {
            // --- 全图保存模式 (滤镜) ---
            canvas.width = naturalWidth;
            canvas.height = naturalHeight;
            
            ctx.drawImage(imgRef.current, 0, 0, naturalWidth, naturalHeight);
        }

        // 手动应用滤镜到像素数据
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        const brightness = filters.brightness / 100;
        const contrast = filters.contrast / 100;
        const saturation = filters.saturation / 100;
        const sepia = filters.sepia / 100;
        
        console.log('[EDITOR] Applying filters - brightness:', brightness, 'contrast:', contrast, 'saturation:', saturation, 'sepia:', sepia);
        
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // 应用亮度
            r *= brightness;
            g *= brightness;
            b *= brightness;
            
            // 应用对比度
            r = ((r / 255 - 0.5) * contrast + 0.5) * 255;
            g = ((g / 255 - 0.5) * contrast + 0.5) * 255;
            b = ((b / 255 - 0.5) * contrast + 0.5) * 255;
            
            // 应用饱和度
            const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
            r = gray + (r - gray) * saturation;
            g = gray + (g - gray) * saturation;
            b = gray + (b - gray) * saturation;
            
            // 应用复古效果
            if (sepia > 0) {
                const sr = (r * 0.393 + g * 0.769 + b * 0.189);
                const sg = (r * 0.349 + g * 0.686 + b * 0.168);
                const sb = (r * 0.272 + g * 0.534 + b * 0.131);
                r = r * (1 - sepia) + sr * sepia;
                g = g * (1 - sepia) + sg * sepia;
                b = b * (1 - sepia) + sb * sepia;
            }
            
            // 限制在0-255范围内
            data[i] = Math.max(0, Math.min(255, r));
            data[i + 1] = Math.max(0, Math.min(255, g));
            data[i + 2] = Math.max(0, Math.min(255, b));
        }
        
        ctx.putImageData(imageData, 0, 0);

        // 导出并上传
        canvas.toBlob((blob) => {
            if (blob) {
                console.log("[EDITOR] Image processed successfully, blob size:", blob.size, "uploading...");
                onUpdate(photo.id, blob);
                if (isCrop) {
                    setIsCropping(false);
                    setCropRect(null);
                }
                setFilters({ brightness: 100, contrast: 100, saturation: 100, sepia: 0 });
            } else {
                console.error("Canvas toBlob failed.");
                alert("Error: Unable to process image.");
            }
        }, 'image/png');
    } catch (e) {
        console.error("Error processing image:", e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col md:flex-row select-none" onMouseUp={handleMouseUp}>
      {/* --- 左侧：图片区域 --- */}
      <div className="flex-1 relative flex items-center justify-center bg-black/90 p-4 md:p-8 overflow-hidden">
        <button onClick={onClose} className="absolute top-4 left-4 text-white/70 hover:text-white z-10 p-2 rounded-full bg-black/20">
            <X className="h-6 w-6" />
        </button>

        {!isCropping && (
            <>
                <button onClick={onPrev} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-2 z-10"><ArrowLeft className="h-8 w-8" /></button>
                <button onClick={onNext} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-2 z-10"><ArrowRight className="h-8 w-8" /></button>
            </>
        )}

        <div 
            ref={containerRef}
            className={`relative flex items-center justify-center ${isCropping ? 'cursor-crosshair' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
        >
             <img 
                ref={imgRef}
                src={photo.url} 
                alt={photo.name} 
                draggable={false}
                style={filterStyle}
                crossOrigin="anonymous" // 配合后端 CORS 设置
                className="max-h-[80vh] max-w-full block shadow-2xl" 
            />
            {isCropping && <div className="absolute inset-0 bg-black/50 pointer-events-none"></div>}
            {isCropping && cropRect && (
                <div 
                    className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] pointer-events-none"
                    style={{ left: cropRect.x, top: cropRect.y, width: cropRect.w, height: cropRect.h }}
                >
                    <div className="w-full h-full grid grid-cols-3 grid-rows-3 opacity-50">
                        {[...Array(9)].map((_, i) => <div key={i} className="border-r border-b border-white/30 last:border-0"></div>)}
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* --- 右侧：控制面板 --- */}
      <div className="w-full md:w-80 bg-white border-l border-slate-200 flex flex-col h-[40vh] md:h-full overflow-hidden">
        <div className="flex border-b border-slate-200">
            <button className={`flex-1 py-3 text-sm font-medium ${activeTab === 'info' ? 'text-primary border-b-2 border-primary' : 'text-slate-500'}`} onClick={() => setActiveTab('info')}>信息 & EXIF</button>
            <button className={`flex-1 py-3 text-sm font-medium ${activeTab === 'edit' ? 'text-primary border-b-2 border-primary' : 'text-slate-500'}`} onClick={() => setActiveTab('edit')}>编辑</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'info' ? (
                <div className="space-y-6">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 mb-1 break-words">{photo.name}</h2>
                        <p className="text-sm text-slate-500">{new Date(photo.timestamp).toLocaleString()}</p>
                    </div>

                    <div className="space-y-3">
                        <h3 className="font-semibold text-sm text-slate-900 uppercase tracking-wider">详细信息</h3>
                        <div className="grid grid-cols-2 gap-y-2 text-sm text-slate-600">
                            <span>尺寸:</span>
                            <span className="text-right">{photo.width} x {photo.height}</span>
                            
                            <span>大小:</span>
                            <span className="text-right">{(photo.size ? photo.size / 1024 : 0).toFixed(1)} KB</span>
                            
                            <span>类型:</span>
                            <span className="text-right">{photo.type ? photo.type.split('/')[1].toUpperCase() : 'JPEG'}</span>
                        </div>
                    </div>
                    
                    <div className="space-y-3">
                        <h3 className="font-semibold text-sm text-slate-900 uppercase tracking-wider">EXIF 数据</h3>
                        <div className="bg-slate-50 p-3 rounded-lg text-sm space-y-2 border border-slate-100">
                            <div className="flex justify-between">
                                <span className="text-slate-500">相机</span>
                                <span>{photo.exif?.camera || '网页上传'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">光圈</span>
                                <span>{photo.exif?.fStop || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">ISO</span>
                                <span>{photo.exif?.iso || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">位置</span>
                                <span className="truncate max-w-[150px]" title={photo.exif?.location}>{photo.exif?.location || '未知位置'}</span>
                            </div>
                        </div>
                    </div>

                    {/* 【找回】Tags 管理区域 */}
                    <div>
                        <h3 className="font-semibold text-sm text-slate-900 uppercase tracking-wider mb-2">标签</h3>
                        
                        {/* 添加标签输入框 */}
                        <div className="flex gap-2 mb-3">
                            <input 
                                type="text" 
                                value={newTag} 
                                onChange={(e) => setNewTag(e.target.value)} 
                                onKeyDown={handleKeyDown}
                                placeholder="添加自定义标签..."
                                className="flex-1 border border-slate-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-primary"
                            />
                            <button 
                                onClick={handleAddTag}
                                disabled={!newTag.trim()}
                                className="bg-primary text-white p-1 rounded-md hover:bg-blue-600 disabled:opacity-50"
                            >
                                <Plus className="h-5 w-5" />
                            </button>
                        </div>

                        {/* 标签列表 */}
                        <div className="flex flex-wrap gap-2">
                             {photo.tags && photo.tags.length > 0 ? photo.tags.map(tag => (
                                <span key={tag} className="group flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-xs border border-slate-200">
                                    #{tag}
                                    <button 
                                        onClick={() => handleRemoveTag(tag)}
                                        className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="移除标签"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                             )) : <span className="text-xs text-slate-400">#已上传</span>}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                     <div className="bg-blue-50 p-3 rounded-md border border-blue-200 mb-4">
                        <p className="text-xs text-blue-800">{isCropping ? "拖动选择裁剪区域" : "调整参数或裁剪图片"}</p>
                     </div>

                    <div className={`space-y-4 ${isCropping ? 'opacity-50 pointer-events-none' : ''}`}>
                        {['亮度', '对比度', '饱和度'].map((label, idx) => {
                            const key = ['brightness', 'contrast', 'saturation'][idx] as keyof PhotoFilter;
                            return (
                                <div key={key}>
                                    <label className="block text-sm font-medium text-slate-700">{label} ({filters[key]}%)</label>
                                    <input 
                                        type="range" min="0" max="200" 
                                        value={filters[key]} 
                                        onChange={e => setFilters({...filters, [key]: Number(e.target.value)})} 
                                        className="w-full accent-primary"
                                    />
                                </div>
                            );
                        })}
                         <div>
                            <label className="block text-sm font-medium text-slate-700">复古 ({filters.sepia}%)</label>
                            <input type="range" min="0" max="100" value={filters.sepia} onChange={e => setFilters({...filters, sepia: Number(e.target.value)})} className="w-full accent-primary"/>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100">
                        {!isCropping ? (
                            <>
                                <button onClick={() => setIsCropping(true)} className="w-full mb-3 flex items-center justify-center px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50">
                                    <Crop className="mr-2 h-4 w-4" /> 裁剪图片
                                </button>
                                <button onClick={() => processImage(false)} className="w-full flex items-center justify-center px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-blue-600">
                                    <Save className="mr-2 h-4 w-4" /> 保存更改
                                </button>
                            </>
                        ) : (
                            <div className="flex gap-2">
                                <button onClick={() => { setIsCropping(false); setCropRect(null); }} className="flex-1 flex items-center justify-center px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"><X className="mr-2 h-4 w-4" /> 取消</button>
                                <button disabled={!cropRect} onClick={() => processImage(true)} className="flex-1 flex items-center justify-center px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-blue-600 disabled:opacity-50"><Check className="mr-2 h-4 w-4" /> 应用并保存</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
        <div className="p-4 border-t border-slate-200 bg-slate-50">
             <button onClick={() => { if(confirm('确定要删除吗？')) { onDelete(photo.id); onClose(); } }} className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100"><Trash2 className="mr-2 h-4 w-4" /> 删除照片</button>
        </div>
      </div>
    </div>
  );
};

export default PhotoEditor;