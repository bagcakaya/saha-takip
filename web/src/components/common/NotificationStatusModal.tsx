import React from 'react';
import { X } from 'lucide-react';
import { NotificationStatusCard } from './NotificationStatusCard';

interface NotificationStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationStatusModal: React.FC<NotificationStatusModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-full max-w-lg bg-white dark:bg-slate-850 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-6 animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Bildirim Yönetim Paneli
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: The Card */}
        <div className="p-4 max-h-[80vh] overflow-y-auto">
          <NotificationStatusCard isEmbedded={false} className="border-0 shadow-none p-0 bg-transparent dark:bg-transparent" />
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white font-bold text-xs shadow-xs active:scale-95 transition-all"
          >
            Tamam / Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
