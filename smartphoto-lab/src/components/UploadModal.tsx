import React, { useState, useRef } from 'react';
import { Upload, X, Loader2, Wand2 } from 'lucide-react';
import { Photo } from '../types';
import { analyzeImageWithZhipu } from '../services/zhipuService';

// 兼容的UUID生成函数
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: 生成符合UUID v4格式的字符串
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

interface UploadModalProps {
  onClose: () => void;
  onUpload: (photo: Photo, file: File) => void;
}

const UploadModal: React.FC<UploadModalProps> = ({ onClose, onUpload }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiData, setAiData] = useState<{ tags: string[]; description: string; detectedLocation?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
        setAiData(null); // Reset AI data on new file
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!preview) return;
    setIsAnalyzing(true);
    
    // Extract base64 (remove data:image/xxx;base64, prefix)
    const base64 = preview.split(',')[1];
    const mimeType = selectedFile?.type || 'image/jpeg';
    
    const result = await analyzeImageWithZhipu(base64, mimeType);
    setAiData(result);
    setIsAnalyzing(false);
  };

  const handleConfirm = () => {
    console.log('[UPLOAD] handleConfirm called, selectedFile:', selectedFile?.name);
    if (!selectedFile || !preview) {
        console.error('[UPLOAD] Missing file or preview');
        return;
    }

    // Create Photo Object
    const img = new Image();
    img.onload = () => {
        console.log('[UPLOAD] Image loaded, dimensions:', img.width, 'x', img.height);
        const newPhoto: Photo = {
            id: generateUUID(),
            url: preview,
            name: selectedFile.name,
            size: selectedFile.size,
            type: selectedFile.type,
            timestamp: Date.now(),
            width: img.width,
            height: img.height,
            tags: aiData ? aiData.tags : ['Uploaded'],
            description: aiData?.description || '',
            exif: {
                dateTaken: new Date().toISOString().split('T')[0],
                location: aiData?.detectedLocation && aiData?.detectedLocation !== 'Unknown' ? aiData?.detectedLocation : 'Unknown Location',
                camera: 'Unknown',
                iso: 'Unknown',
                fStop: 'Unknown',
            }
        };
        console.log('[UPLOAD] Calling onUpload with photo:', newPhoto.id);
        onUpload(newPhoto, selectedFile);
        onClose();
    };
    img.onerror = (e) => {
      console.error('Image load error:', e);
        alert('图片加载失败,请重试');
    };
    img.src = preview;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-800">上传照片</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {!preview ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-xl h-64 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-slate-50 transition-colors"
            >
              <Upload className="h-12 w-12 text-slate-400 mb-2" />
              <p className="text-slate-600 font-medium">点击上传照片</p>
              <p className="text-xs text-slate-400 mt-1">支持 JPG、PNG</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileChange} 
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden bg-slate-100 flex justify-center">
                <img src={preview} alt="Preview" className="max-h-64 object-contain" />
              </div>

              <div className="flex flex-col gap-2">
                 {aiData ? (
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                        <div className="flex items-center gap-2 mb-2">
                             <Wand2 className="h-4 w-4 text-green-600" />
                             <span className="font-semibold text-green-800 text-sm">AI 分析完成</span>
                        </div>
                        <p className="text-sm text-slate-700 mb-2 italic">“{aiData.description}”</p>
                        <div className="flex flex-wrap gap-1">
                            {aiData.tags.map(tag => (
                                <span key={tag} className="px-2 py-0.5 bg-white text-green-700 border border-green-200 text-xs rounded-full">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                         {aiData.detectedLocation && aiData.detectedLocation !== 'Unknown' && (
                            <p className="text-xs text-slate-500 mt-2">📍 检测到的位置: {aiData.detectedLocation}</p>
                         )}
                    </div>
                 ) : (
                    <button 
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                        className="w-full py-3 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 flex items-center justify-center gap-2 transition-colors"
                    >
                        {isAnalyzing ? <Loader2 className="animate-spin h-5 w-5" /> : <Wand2 className="h-5 w-5" />}
                        {isAnalyzing ? '正在使用智谱AI分析...' : '使用 AI 分析（标签和位置）'}
                    </button>
                 )}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
          >
            取消
          </button>
          <button 
            disabled={!selectedFile}
            onClick={handleConfirm}
            className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            保存照片
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadModal;