import React, { useState, useEffect } from 'react';
import { X, Play, Pause, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { Photo } from '../types';

interface SlideshowProps {
  photos: Photo[];
  onClose: () => void;
}

const Slideshow: React.FC<SlideshowProps> = ({ photos, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  // Auto-advance logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && photos.length > 0) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % photos.length);
      }, 3000); // 3 seconds per slide
    }
    return () => clearInterval(interval);
  }, [isPlaying, photos.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === ' ') {
        e.preventDefault(); // Prevent scrolling
        setIsPlaying(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
    setIsPlaying(false); // Pause interaction on manual nav
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    setIsPlaying(false);
  };

  if (photos.length === 0) return null;

  const currentPhoto = photos[currentIndex];

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center animate-in fade-in duration-200">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent">
        <div className="text-white/90 font-medium flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            <span>{currentIndex + 1} / {photos.length}</span>
        </div>
        <button 
            onClick={onClose} 
            className="text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
        >
            <X className="h-6 w-6" />
        </button>
      </div>

      {/* Main Image */}
      <div className="relative w-full h-full flex items-center justify-center p-4 md:p-12 overflow-hidden">
        <img 
            key={currentPhoto.id} // Key change triggers simple fade if CSS configured, otherwise instant
            src={currentPhoto.url} 
            alt={currentPhoto.name}
            className="max-h-full max-w-full object-contain shadow-2xl transition-opacity duration-300"
        />
      </div>

      {/* Navigation Controls (Side) */}
      <button 
        onClick={handlePrev}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors hidden md:block"
      >
        <ChevronLeft className="h-10 w-10" />
      </button>

      <button 
        onClick={handleNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors hidden md:block"
      >
        <ChevronRight className="h-10 w-10" />
      </button>

      {/* Bottom Controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-black/50 backdrop-blur-md px-6 py-3 rounded-full border border-white/10">
        <button 
            onClick={handlePrev} 
            className="text-white/80 hover:text-white md:hidden"
        >
            <ChevronLeft className="h-6 w-6" />
        </button>

        <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="text-white hover:text-primary transition-colors transform hover:scale-110"
        >
            {isPlaying ? (
                <Pause className="h-8 w-8 fill-current" />
            ) : (
                <Play className="h-8 w-8 fill-current ml-1" />
            )}
        </button>

        <button 
            onClick={handleNext} 
            className="text-white/80 hover:text-white md:hidden"
        >
            <ChevronRight className="h-6 w-6" />
        </button>
      </div>
      
      {/* Caption Overlay */}
      {currentPhoto.description && (
          <div className="absolute bottom-24 left-0 right-0 text-center pointer-events-none">
              <span className="inline-block bg-black/60 text-white/90 px-4 py-1.5 rounded-lg text-sm backdrop-blur-sm max-w-[80vw] truncate">
                  {currentPhoto.description}
              </span>
          </div>
      )}
    </div>
  );
};

export default Slideshow;