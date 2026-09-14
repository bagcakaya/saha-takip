import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, FileText, Send } from 'lucide-react';
import { GeneralNote } from '../../types/storage';

interface CompleteNoteModalProps {
  isOpen: boolean;
  note: GeneralNote | null;
  onClose: () => void;
  onConfirm: (completionNote: string) => Promise<void>;
}

export const CompleteNoteModal: React.FC<CompleteNoteModalProps> = ({
  isOpen,
  note,
  onClose,
  onConfirm,
}) => {
  const [completionNote, setCompletionNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCompletionNote(note?.completionNote || '');
      setIsSubmitting(false);
    }
  }, [isOpen, note]);

  if (!isOpen || !note) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onConfirm(completionNote.trim());
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700 bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                {note.status === 'rejected' ? 'Eksikleri Gider / Tekrar Tamamla' : 'İş Emrini Tamamla'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tamamlama notunuz yöneticiye bildirim olarak iletilecektir.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Note summary */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5" />
              <span>İş Emri</span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-3">
              {note.content}
            </p>
          </div>

          {/* If previously rejected, show previous rejection reason */}
          {note.status === 'rejected' && note.rejectionReason && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300">
              <span className="font-bold">Yönetici Red Gerekçesi: </span>
              {note.rejectionReason}
            </div>
          )}

          {/* Personnel Explanation Textarea */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Tamamlama Açıklaması / Yapılan İş Notu
            </label>
            <textarea
              value={completionNote}
              onChange={(e) => setCompletionNote(e.target.value)}
              placeholder="Örn: Cihaz bağlantıları yapıldı, kontroller sağlandı ve çalışır vaziyette teslim edildi..."
              rows={4}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              autoFocus
            />
            <p className="text-[11px] text-slate-400">
              Bu açıklama yöneticinin onay ekranında ve iş emri kartında görüntülenecektir.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Gönderiliyor...' : 'Tamamla ve Onaya Gönder'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
