import React from 'react';
import { Bell, X } from 'lucide-react';

interface ToastNotificationProps {
  toast: { title: string; body: string } | null;
  onClose: () => void;
  onClick?: () => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ toast, onClose, onClick }) => {
  if (!toast) return null;

  return (
    <div className="fixed top-5 left-4 right-4 sm:left-auto sm:right-5 sm:max-w-md z-50 animate-in slide-in-from-top-5 duration-300">
      <div
        onClick={onClick}
        className="bg-slate-900/95 dark:bg-slate-900/95 text-white p-4 rounded-2xl shadow-2xl border border-blue-500/50 backdrop-blur-xl flex items-start gap-3 cursor-pointer hover:border-blue-400 transition-all"
      >
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-md">
          <Bell className="w-5 h-5 text-white animate-bounce" />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-xs sm:text-sm font-black text-blue-400 truncate">
            {toast.title}
          </h4>
          <p className="text-xs font-medium text-slate-200 mt-0.5 line-clamp-2">
            {toast.body}
          </p>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="text-slate-400 hover:text-white p-1 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
