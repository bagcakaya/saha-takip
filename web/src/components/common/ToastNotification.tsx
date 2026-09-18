import React, { useEffect, useState } from 'react';
import { Bell, X, ArrowRight } from 'lucide-react';

interface ToastNotificationProps {
  toast: { title: string; body: string; tab?: string; filter?: string } | null;
  onClose: () => void;
  onClick?: () => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ toast, onClose, onClick }) => {
  const [isPaused, setIsPaused] = useState(false);

  // 6-second auto-dismiss with pause on hover/touch
  useEffect(() => {
    if (!toast || isPaused) return;

    const timer = setTimeout(() => {
      onClose();
    }, 6000);

    return () => clearTimeout(timer);
  }, [toast, isPaused, onClose]);

  if (!toast) return null;

  return (
    <div
      className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+74px)] left-3.5 right-3.5 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      <div
        onClick={onClick}
        className="relative overflow-hidden bg-slate-900/95 dark:bg-slate-900/95 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-blue-500/50 backdrop-blur-xl flex items-center gap-3 cursor-pointer hover:border-blue-400 active:scale-[0.98] transition-all"
      >
        {/* Bell Icon Badge */}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30">
          <Bell className="w-5 h-5 text-white animate-bounce" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <h4 className="text-xs sm:text-sm font-black text-blue-300 truncate">
              {toast.title}
            </h4>
          </div>
          <p className="text-xs font-medium text-slate-200 mt-0.5 line-clamp-2 leading-snug">
            {toast.body}
          </p>
          <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-blue-400/90">
            <span>Açmak için dokunun</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Large touch target close button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-white active:bg-white/10 rounded-xl p-1.5 transition-colors cursor-pointer shrink-0"
          title="Bildirimi Kapat"
          aria-label="Kapat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
