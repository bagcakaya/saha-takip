import React, { useEffect, useState, useMemo } from 'react';
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react';

export interface ImageLightboxModalProps {
  isOpen: boolean;
  imageUrl?: string | null;
  images?: string[];
  initialIndex?: number;
  title?: string;
  onClose: () => void;
  onDelete?: (photoUrl: string, index: number) => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  imageUrl,
  images,
  initialIndex = 0,
  title,
  onClose,
  onDelete,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);

  // Consolidate images into a unified list
  const imageList = useMemo(() => {
    if (images && images.length > 0) {
      return images.filter(Boolean);
    }
    if (imageUrl) {
      return [imageUrl];
    }
    return [];
  }, [images, imageUrl]);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Keep currentIndex updated when modal opens or initialIndex/images change
  useEffect(() => {
    if (isOpen) {
      setZoomLevel(1);
      if (initialIndex >= 0 && initialIndex < imageList.length) {
        setCurrentIndex(initialIndex);
      } else if (imageUrl && imageList.length > 0) {
        const found = imageList.indexOf(imageUrl);
        setCurrentIndex(found >= 0 ? found : 0);
      } else {
        setCurrentIndex(0);
      }
    }
  }, [isOpen, initialIndex, imageUrl, imageList]);

  const hasMultiple = imageList.length > 1;
  const currentPhoto = imageList[currentIndex] || imageUrl || null;

  const handlePrev = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!hasMultiple) return;
    setZoomLevel(1);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : imageList.length - 1));
  };

  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!hasMultiple) return;
    setZoomLevel(1);
    setCurrentIndex((prev) => (prev < imageList.length - 1 ? prev + 1 : 0));
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        if (hasMultiple) {
          setZoomLevel(1);
          setCurrentIndex((prev) => (prev > 0 ? prev - 1 : imageList.length - 1));
        }
      } else if (e.key === 'ArrowRight') {
        if (hasMultiple) {
          setZoomLevel(1);
          setCurrentIndex((prev) => (prev < imageList.length - 1 ? prev + 1 : 0));
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, hasMultiple, imageList.length]);

  // Touch Swipe for mobile devices
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  const minSwipeDistance = 45;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEndX(null);
    setTouchStartX(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (touchStartX === null || touchEndX === null || !hasMultiple) return;
    const distance = touchStartX - touchEndX;
    if (distance > minSwipeDistance) {
      handleNext();
    } else if (distance < -minSwipeDistance) {
      handlePrev();
    }
  };

  if (!isOpen || !currentPhoto) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = currentPhoto;
    link.download = `saha-foto-${currentIndex + 1}-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = () => {
    if (!onDelete || !currentPhoto) return;
    if (window.confirm('Bu fotoğrafı silmek istediğinize emin misiniz?')) {
      onDelete(currentPhoto, currentIndex);
      if (imageList.length <= 1) {
        onClose();
      } else {
        setCurrentIndex((prev) => Math.max(0, Math.min(prev, imageList.length - 2)));
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200 p-2 sm:p-4 select-none"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Top Toolbar */}
      <div
        className="absolute top-3 left-3 right-3 sm:top-5 sm:left-6 sm:right-6 flex items-center justify-between z-30 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 max-w-[60%]">
          <span className="text-white text-xs sm:text-sm font-black truncate drop-shadow-md">
            {title || 'Fotoğraf Önizleme'}
          </span>
          {hasMultiple && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-white/20 text-white border border-white/25 backdrop-blur-md shrink-0 shadow-sm">
              {currentIndex + 1} / {imageList.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Zoom Out */}
          <button
            type="button"
            onClick={() => setZoomLevel((prev) => Math.max(0.7, prev - 0.25))}
            className="p-2 sm:p-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white backdrop-blur-md transition-colors cursor-pointer"
            title="Uzaklaştır"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* Zoom In */}
          <button
            type="button"
            onClick={() => setZoomLevel((prev) => Math.min(2.5, prev + 0.25))}
            className="p-2 sm:p-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white backdrop-blur-md transition-colors cursor-pointer"
            title="Yakınlaştır"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* Download */}
          <button
            type="button"
            onClick={handleDownload}
            className="p-2 sm:p-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white backdrop-blur-md transition-colors cursor-pointer"
            title="Fotoğrafı İndir"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Optional Delete */}
          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="p-2 sm:p-2.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white backdrop-blur-md transition-colors cursor-pointer"
              title="Fotoğrafı Sil"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-xl bg-red-600/90 hover:bg-red-600 text-white backdrop-blur-md transition-colors cursor-pointer ml-1"
            title="Kapat (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Previous Arrow Button */}
      {hasMultiple && (
        <button
          type="button"
          onClick={handlePrev}
          className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-30 w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md flex items-center justify-center border border-white/20 transition-all hover:scale-110 active:scale-95 shadow-2xl cursor-pointer group"
          title="Önceki Fotoğraf (Sol Ok)"
          aria-label="Önceki Fotoğraf"
        >
          <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8 group-hover:-translate-x-0.5 transition-transform" />
        </button>
      )}

      {/* Floating Next Arrow Button */}
      {hasMultiple && (
        <button
          type="button"
          onClick={handleNext}
          className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-30 w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md flex items-center justify-center border border-white/20 transition-all hover:scale-110 active:scale-95 shadow-2xl cursor-pointer group"
          title="Sonraki Fotoğraf (Sağ Ok)"
          aria-label="Sonraki Fotoğraf"
        >
          <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8 group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}

      {/* Main Image Container */}
      <div
        className="relative max-w-full max-h-[75vh] sm:max-h-[80vh] flex items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          key={currentPhoto}
          src={currentPhoto}
          alt={title || `Fotoğraf ${currentIndex + 1}`}
          style={{ transform: `scale(${zoomLevel})` }}
          className="max-w-full max-h-[75vh] sm:max-h-[80vh] object-contain rounded-xl shadow-2xl transition-all duration-200 cursor-grab active:cursor-grabbing animate-in zoom-in-95"
        />
      </div>

      {/* Bottom Thumbnail Navigation Strip */}
      {hasMultiple && (
        <div
          className="absolute bottom-3 left-0 right-0 z-30 flex items-center justify-center px-4 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-2xl bg-black/70 backdrop-blur-md border border-white/15 max-w-[90vw] overflow-x-auto scrollbar-none shadow-2xl">
            {imageList.map((img, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setZoomLevel(1);
                  setCurrentIndex(idx);
                }}
                className={`relative w-10 h-10 sm:w-13 sm:h-13 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                  idx === currentIndex
                    ? 'border-blue-500 scale-105 shadow-lg shadow-blue-500/50 opacity-100 ring-2 ring-blue-400'
                    : 'border-white/20 opacity-40 hover:opacity-90 hover:scale-100'
                }`}
                title={`Fotoğraf ${idx + 1}`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
                <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] font-black text-white text-center py-0.5">
                  {idx + 1}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
