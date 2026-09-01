import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { GeneralNote } from '../../types/storage';
import { Bell, Calendar, Clock, Users } from 'lucide-react';
import { NotificationService } from '../../services/notificationService';
import { useAuth } from '../../context/AuthContext';

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingNote: GeneralNote | null;
  onSave: (
    content: string,
    reminderActive: boolean,
    reminderDate?: string,
    targetUserId?: string,
    targetUserName?: string
  ) => Promise<void>;
}

export const NoteModal: React.FC<NoteModalProps> = ({
  isOpen,
  onClose,
  editingNote,
  onSave,
}) => {
  const { user: currentUser, users } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [content, setContent] = useState('');
  const [reminderActive, setReminderActive] = useState(false);
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [targetUserId, setTargetUserId] = useState<string>('self');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingNote) {
      setContent(editingNote.content);
      setReminderActive(editingNote.reminderActive);
      setTargetUserId(editingNote.targetUserId || 'self');

      if (editingNote.reminderDate) {
        const d = new Date(editingNote.reminderDate);
        setDateStr(d.toISOString().split('T')[0]);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        setTimeStr(`${hh}:${mm}`);
      } else {
        setDefaultDateTime();
      }
    } else {
      setContent('');
      setReminderActive(false);
      setTargetUserId('self');
      setDefaultDateTime();
    }
  }, [editingNote, isOpen]);

  const setDefaultDateTime = () => {
    const future = new Date(Date.now() + 10 * 60 * 1000);
    setDateStr(future.toISOString().split('T')[0]);
    const hh = String(future.getHours()).padStart(2, '0');
    const mm = String(future.getMinutes()).padStart(2, '0');
    setTimeStr(`${hh}:${mm}`);
  };

  const handleToggleReminder = async (checked: boolean) => {
    setReminderActive(checked);
    if (checked) {
      await NotificationService.requestPermission();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    let reminderIso: string | undefined = undefined;

    if (reminderActive) {
      if (!dateStr || !timeStr) {
        alert('Lütfen geçerli bir tarih ve saat seçin.');
        return;
      }
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hours, minutes] = timeStr.split(':').map(Number);
      const combinedDate = new Date(year, month - 1, day, hours, minutes, 0);

      if (combinedDate.getTime() <= Date.now()) {
        alert('Hatırlatıcı zamanı geçmişte olamaz. Lütfen ileri bir tarih ve saat seçin.');
        return;
      }
      reminderIso = combinedDate.toISOString();
    }

    // Determine human-readable target user name
    let targetUserName = 'Sadece Kendim';
    if (targetUserId === 'all') {
      targetUserName = 'Tüm Personeller';
    } else if (targetUserId !== 'self') {
      const targetAccount = users.find((u) => u.id === targetUserId);
      if (targetAccount) {
        targetUserName = targetAccount.name;
      }
    }

    try {
      setIsSubmitting(true);
      await onSave(content.trim(), reminderActive, reminderIso, targetUserId, targetUserName);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingNote ? 'Notu Düzenle' : 'Yeni Not & Hatırlatıcı'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Target User / Visibility Selector for Admin */}
        {isAdmin && (
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-500" />
              <span>Not Kiminle Paylaşılsın?</span>
            </label>

            <select
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="self">🔒 Sadece Kendim (Gizli Not)</option>
              <option value="all">📢 Tüm Kullanıcılar (Genel Duyuru)</option>
              <optgroup label="👤 Belirli Bir Personele Özel:">
                {users
                  .filter((u) => u.id !== currentUser?.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      👤 {u.name} (@{u.username}) {u.role === 'admin' ? '• Yönetici' : '• Saha Yetkilisi'}
                    </option>
                  ))}
              </optgroup>
            </select>

            <span className="text-[11px] text-slate-400 block">
              {targetUserId === 'self'
                ? 'Bu notu sadece siz görebilirsiniz.'
                : targetUserId === 'all'
                ? 'Bu not tüm saha ekibine ve yöneticilere açık olacaktır.'
                : 'Bu not yalnızca seçtiğiniz kullanıcıya özel olarak iletilecektir.'}
            </span>
          </div>
        )}

        {/* Textarea */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Not İçeriği
          </label>
          <textarea
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Notunuzu yazın..."
            autoFocus
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm font-medium resize-none"
          />
        </div>

        {/* Reminder Toggle */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80">
          <div className="flex items-center gap-2.5">
            <Bell
              className={`w-5 h-5 ${
                reminderActive ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500'
              }`}
            />
            <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
              Hatırlatıcı Bildirimi Kur
            </span>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={reminderActive}
              onChange={(e) => handleToggleReminder(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Date and Time Pickers */}
        {reminderActive && (
          <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 space-y-3 animate-in fade-in duration-200">
            <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Hatırlatma Zamanı:
            </span>

            <div className="grid grid-cols-2 gap-2">
              {/* Date Input */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  <span>Tarih</span>
                </label>
                <input
                  type="date"
                  value={dateStr}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Time Input */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  <span>Saat</span>
                </label>
                <input
                  type="time"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-xs sm:text-sm font-semibold transition-colors"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={!content.trim() || isSubmitting}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-md disabled:opacity-50 transition-all"
          >
            {isSubmitting ? 'Kaydediliyor...' : editingNote ? 'Güncelle' : 'Kaydet'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
