import React, { useState, useEffect } from 'react';
import { X, Clock, Bell, Volume2, Calendar, AlertCircle, Building2, Smartphone } from 'lucide-react';
import { TimedFollowUp } from '../../types/storage';
import { useStorage } from '../../context/StorageContext';
import { CariSelect } from '../common/CariSelect';

interface TimedFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: TimedFollowUp | null;
}

function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export const TimedFollowUpModal: React.FC<TimedFollowUpModalProps> = ({
  isOpen,
  onClose,
  initialData,
}) => {
  const { addTimedFollowUp, updateTimedFollowUp } = useStorage();

  const [cariName, setCariName] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [soundAlarm, setSoundAlarm] = useState(true);
  const [sendPush, setSendPush] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setCariName(initialData.cariName || '');
      setDescription(initialData.description || '');
      const d = initialData.snoozedUntil || initialData.dueDate;
      setDueDate(d ? toLocalDatetimeString(new Date(d)) : '');
      setSoundAlarm(initialData.soundAlarm !== false);
      setSendPush(initialData.sendPush !== false);
    } else {
      setCariName('');
      setDescription('');
      // Default: 1 hour from now
      const defaultTime = new Date(Date.now() + 60 * 60 * 1000);
      setDueDate(toLocalDatetimeString(defaultTime));
      setSoundAlarm(true);
      setSendPush(true);
    }
    setError('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const setPresetTime = (minutesOffset: number) => {
    const d = new Date(Date.now() + minutesOffset * 60 * 1000);
    setDueDate(toLocalDatetimeString(d));
  };

  const setTomorrowAt = (hour: number, minute: number = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(hour, minute, 0, 0);
    setDueDate(toLocalDatetimeString(d));
  };

  const setDaysLaterAt = (days: number, hour: number = 9) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    setDueDate(toLocalDatetimeString(d));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cariName.trim()) {
      setError('Lütfen bir cari seçiniz veya yazınız.');
      return;
    }
    if (!description.trim()) {
      setError('Lütfen takip / hatırlatma açıklamasını giriniz.');
      return;
    }
    if (!dueDate) {
      setError('Lütfen hatırlatma tarih ve saatini belirleyiniz.');
      return;
    }

    const targetTime = new Date(dueDate).getTime();
    if (isNaN(targetTime)) {
      setError('Geçersiz tarih veya saat formatı.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      if (initialData) {
        await updateTimedFollowUp(initialData.id, {
          cariName: cariName.trim(),
          description: description.trim(),
          dueDate,
          snoozedUntil: undefined,
          soundAlarm,
          sendPush,
          notified: false,
        });
      } else {
        await addTimedFollowUp({
          cariName: cariName.trim(),
          description: description.trim(),
          dueDate,
          soundAlarm,
          sendPush,
        });
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Kaydedilirken bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/40">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {initialData ? 'Süreli Takibi Düzenle' : 'Yeni Süreli Cari Takibi & Alarm'}
              </h3>
              <p className="text-xs text-slate-400">Yöneticilere özel zaman ayarlı hatırlatıcı ve sesli alarm</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Cari Seçimi */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              Takip Edilecek Cari <span className="text-red-400">*</span>
            </label>
            <CariSelect
              value={cariName}
              onChange={setCariName}
              placeholder="Cari arayın veya seçin..."
              className="w-full"
            />
          </div>

          {/* Açıklama */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              Takip Konusu & Açıklama <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Örn: Cari aranacak, son teslimat faturası kontrol edilecek, mutabakat sağlanacak..."
              className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition resize-none"
            />
          </div>

          {/* Tarih & Saat Seçimi */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              Hatırlatıcı Tarih & Saat <span className="text-red-400">*</span>
            </label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
            />

            {/* Hızlı Önayarlar */}
            <div className="mt-2.5">
              <div className="text-[11px] text-slate-400 mb-1.5 font-medium">Hızlı Süre Seçimi:</div>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                <button
                  type="button"
                  onClick={() => setPresetTime(30)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium transition active:scale-95"
                >
                  +30 Dk
                </button>
                <button
                  type="button"
                  onClick={() => setPresetTime(60)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium transition active:scale-95"
                >
                  +1 Saat
                </button>
                <button
                  type="button"
                  onClick={() => setPresetTime(180)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium transition active:scale-95"
                >
                  +3 Saat
                </button>
                <button
                  type="button"
                  onClick={() => setTomorrowAt(9, 0)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium transition active:scale-95"
                >
                  Yarın 09:00
                </button>
                <button
                  type="button"
                  onClick={() => setTomorrowAt(new Date().getHours(), new Date().getMinutes())}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium transition active:scale-95"
                >
                  Yarın Bu Saat
                </button>
                <button
                  type="button"
                  onClick={() => setDaysLaterAt(3, 9)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium transition active:scale-95"
                >
                  3 Gün Sonra
                </button>
              </div>
            </div>
          </div>

          {/* Alarm Seçenekleri */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-slate-800/50 transition">
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg ${soundAlarm ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-500'}`}>
                  <Volume2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-medium text-white">Sesli Melodi Alarmı</div>
                  <div className="text-[11px] text-slate-400">Vakti gelince susturulana kadar yüksek sesli dijital melodi çalar</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={soundAlarm}
                onChange={(e) => setSoundAlarm(e.target.checked)}
                className="w-4 h-4 text-amber-500 rounded border-slate-700 bg-slate-800 focus:ring-amber-500 focus:ring-offset-slate-900"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-slate-800/50 transition">
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg ${sendPush ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-medium text-white">Kilit Ekranı Bildirimi (Push)</div>
                  <div className="text-[11px] text-slate-400">Telefon kilitliyken OneSignal üzerinden anlık bildirim düşer</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={sendPush}
                onChange={(e) => setSendPush(e.target.checked)}
                className="w-4 h-4 text-amber-500 rounded border-slate-700 bg-slate-800 focus:ring-amber-500 focus:ring-offset-slate-900"
              />
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-amber-500/20 transition active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Kaydediliyor...' : initialData ? 'Değişiklikleri Kaydet' : 'Alarmı Kur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
