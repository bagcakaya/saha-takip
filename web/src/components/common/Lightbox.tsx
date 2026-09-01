import React, { useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';

interface LightboxProps {
  photoUrl: string | null;
  onClose: () => void;
  onDelete?: (photoUrl: string) => void;
}

export const Lightbox: React.FC<LightboxProps> = ({ photoUrl, onClose, onDelete }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (photoUrl) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [photoUrl, onClose]);

  if (!photoUrl) return null;

  return (
    <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 animate-in fade-in duration-200">
      {/* Top Bar */}
      <div className="w-full max-w-4xl flex items-center justify-end z-10">
        <button
          onClick={onClose}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Kapat"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Image Container */}
      <div className="flex-1 flex items-center justify-center max-w-4xl w-full my-4 overflow-hidden">
        <img
          src={photoUrl}
          alt="Büyük Görsel"
          className="max-h-full max-w-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
        />
      </div>

      {/* Bottom Bar */}
      <div className="w-full max-w-md flex justify-center pb-4 z-10">
        {onDelete && (
          <button
            onClick={() => {
              if (window.confirm('Bu fotoğrafı kalıcı olarak silmek istediğinize emin misiniz?')) {
                onDelete(photoUrl);
                onClose();
              }
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium shadow-lg transition-all active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            <span>Fotoğrafı Sil</span>
          </button>
        )}
      </div>
    </div>
  );
};
