import React, { useState, useEffect } from 'react';
import { X, XCircle, FileText, UserCheck, AlertTriangle } from 'lucide-react';
import { GeneralNote } from '../../types/storage';

interface RejectNoteModalProps {
  isOpen: boolean;
  note: GeneralNote | null;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export const RejectNoteModal: React.FC<RejectNoteModalProps> = ({
  isOpen,
  note,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setIsSubmitting(false);
    }
  }, [isOpen, note]);

  if (!isOpen || !note) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    onClose();
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      console.error('RejectNoteModal submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700 bg-rose-50/60 dark:bg-rose-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                İş Emrini Reddet
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                İşin tamamlanmadığını personele gerekçesiyle iletin.
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
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5" />
              <span>İş Emri</span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-3">
              {note.content}
            </p>

            {note.completedByName && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>
                  Tamamlayan:{' '}
                  <strong className="text-slate-900 dark:text-slate-100 font-bold">
                    {note.completedByName}
                  </strong>
                </span>
              </div>
            )}

            {note.completionNote && (
              <div className="p-2.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 text-xs text-emerald-800 dark:text-emerald-300">
                <span className="font-bold">Personel Notu: </span>
                {note.completionNote}
              </div>
            )}
          </div>

          {/* Rejection Reason Textarea */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              <span>Red Gerekçesi / Eksik Kalan Kısımlar</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Örn: Saha bağlantıları eksik yapılmış, montaj fotoğrafları sisteme yüklenmemiş..."
              rows={3}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
              autoFocus
            />
            <p className="text-[11px] text-slate-400">
              Bu gerekçe personele anında telefon bildirimi olarak gönderilecek ve iş kartında kırmızı uyarı olarak görüntülenecektir.
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
              disabled={isSubmitting || !reason.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md transition-all disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              <span>{isSubmitting ? 'İşleniyor...' : 'Reddet ve Personele Bildir'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
