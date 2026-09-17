import React, { useState, useMemo } from 'react';
import {
  Clock,
  Plus,
  Building2,
  Volume2,
  Smartphone,
  Trash2,
  Edit2,
  AlertCircle,
  Calendar,
  Check,
  RotateCcw,
} from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import { TimedFollowUp } from '../../types/storage';
import { TimedFollowUpModal } from './TimedFollowUpModal';

export const TimedFollowUpsSection: React.FC = () => {
  const {
    timedFollowUps,
    completeTimedFollowUp,
    deleteTimedFollowUp,
    snoozeTimedFollowUp,
  } = useStorage();

  const [activeFilter, setActiveFilter] = useState<'pending' | 'due' | 'completed' | 'all'>('pending');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TimedFollowUp | null>(null);

  const now = Date.now();

  const counts = useMemo(() => {
    let pending = 0;
    let due = 0;
    let completed = 0;

    timedFollowUps.forEach((item) => {
      if (item.status === 'completed') {
        completed++;
      } else {
        const targetTime = new Date(item.snoozedUntil || item.dueDate).getTime();
        if (targetTime <= now) {
          due++;
        } else {
          pending++;
        }
      }
    });

    return { pending, due, completed, all: timedFollowUps.length };
  }, [timedFollowUps, now]);

  const filteredItems = useMemo(() => {
    return timedFollowUps.filter((item) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'completed') return item.status === 'completed';
      if (item.status === 'completed') return false;

      const targetTime = new Date(item.snoozedUntil || item.dueDate).getTime();
      if (activeFilter === 'due') return targetTime <= now;
      if (activeFilter === 'pending') return targetTime > now;
      return true;
    }).sort((a, b) => {
      // Pending / due first, sorted by target time ascending
      if (a.status !== b.status) {
        return a.status === 'pending' ? -1 : 1;
      }
      const timeA = new Date(a.snoozedUntil || a.dueDate).getTime();
      const timeB = new Date(b.snoozedUntil || b.dueDate).getTime();
      return timeA - timeB;
    });
  }, [timedFollowUps, activeFilter, now]);

  const getTimeRemainingText = (item: TimedFollowUp) => {
    if (item.status === 'completed') {
      return { text: 'Tamamlandı', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    }

    const targetTime = new Date(item.snoozedUntil || item.dueDate).getTime();
    const diffMs = targetTime - now;

    if (diffMs <= 0) {
      const minutesAgo = Math.floor(Math.abs(diffMs) / 60000);
      if (minutesAgo < 60) {
        return { text: `${minutesAgo || 1} dk önce doldu`, color: 'text-red-400 bg-red-500/10 border-red-500/30 font-bold animate-pulse' };
      }
      const hoursAgo = Math.floor(minutesAgo / 60);
      return { text: `${hoursAgo} sa önce doldu`, color: 'text-red-400 bg-red-500/10 border-red-500/30 font-bold' };
    }

    const minutesLeft = Math.floor(diffMs / 60000);
    if (minutesLeft < 60) {
      return { text: `${minutesLeft} dk kaldı`, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    }
    const hoursLeft = Math.floor(minutesLeft / 60);
    if (hoursLeft < 24) {
      return { text: `${hoursLeft} sa ${minutesLeft % 60} dk kaldı`, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
    }
    const daysLeft = Math.floor(hoursLeft / 24);
    return { text: `${daysLeft} gün kaldı`, color: 'text-slate-400 bg-slate-800/80 border-slate-700' };
  };

  const handleDelete = (id: string, cari: string) => {
    if (window.confirm(`"${cari}" carisine ait süreli takibi silmek istediğinize emin misiniz?`)) {
      deleteTimedFollowUp(id);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
      {/* Background Accent */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20 shadow-sm">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Süreli Cari Takipleri & Alarmlar
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Yönetici Özel
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Cari bazlı randevu, ödeme ve iş hatırlatıcıları (günü gelince sesli alarm çalar)
            </p>
          </div>
        </div>

        {/* New Alarm Button */}
        <button
          onClick={() => {
            setEditingItem(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-amber-500/20 transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Yeni Takip / Alarm Kur</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 pt-4 pb-3 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveFilter('pending')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap ${
            activeFilter === 'pending'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
          }`}
        >
          <span>Bekleyenler</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeFilter === 'pending' ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-700 text-slate-300'}`}>
            {counts.pending}
          </span>
        </button>

        {counts.due > 0 && (
          <button
            onClick={() => setActiveFilter('due')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap ${
              activeFilter === 'due'
                ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
                : 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Vakti Dolanlar</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-600 text-white font-bold">
              {counts.due}
            </span>
          </button>
        )}

        <button
          onClick={() => setActiveFilter('completed')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap ${
            activeFilter === 'completed'
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
          }`}
        >
          <span>Tamamlananlar</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeFilter === 'completed' ? 'bg-slate-950/30 text-white' : 'bg-slate-700 text-slate-300'}`}>
            {counts.completed}
          </span>
        </button>

        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap ${
            activeFilter === 'all'
              ? 'bg-slate-200 text-slate-900 shadow-md'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
          }`}
        >
          <span>Tümü</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-700 text-slate-300">
            {counts.all}
          </span>
        </button>
      </div>

      {/* Items List */}
      <div className="space-y-3 mt-1">
        {filteredItems.length === 0 ? (
          <div className="py-8 px-4 text-center rounded-xl bg-slate-800/30 border border-dashed border-slate-800">
            <Clock className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-300">
              {activeFilter === 'due'
                ? 'Vakti dolan süreli cari takibi yok.'
                : activeFilter === 'completed'
                ? 'Henüz tamamlanmış bir cari takibi yok.'
                : 'Planlanmış süreli cari takibi bulunmuyor.'}
            </div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-3">
              Carilerinizle ilgili görüşme, ödeme veya işlem hatırlatıcıları kurarak günü geldiğinde sesli alarm alabilirsiniz.
            </p>
            {activeFilter !== 'completed' && (
              <button
                onClick={() => {
                  setEditingItem(null);
                  setIsModalOpen(true);
                }}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold rounded-lg border border-slate-700 transition"
              >
                + Takip Alarmı Oluştur
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredItems.map((item) => {
              const remaining = getTimeRemainingText(item);
              const isCompleted = item.status === 'completed';
              const targetDate = new Date(item.snoozedUntil || item.dueDate);

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition flex flex-col justify-between ${
                    isCompleted
                      ? 'bg-slate-800/30 border-slate-800/60 opacity-80'
                      : remaining.text.includes('doldu')
                      ? 'bg-red-500/5 border-red-500/30 shadow-sm shadow-red-500/10'
                      : 'bg-slate-800/60 border-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  <div>
                    {/* Top Row: Cari Name & Remaining Badge */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="font-bold text-white text-sm truncate" title={item.cariName}>
                          {item.cariName}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[11px] border shrink-0 font-medium ${remaining.color}`}>
                        {remaining.text}
                      </span>
                    </div>

                    {/* Description */}
                    <p className={`text-xs text-slate-300 whitespace-pre-wrap line-clamp-3 mb-3 ${isCompleted ? 'line-through text-slate-500' : ''}`}>
                      {item.description}
                    </p>
                  </div>

                  {/* Bottom Row: Date & Actions */}
                  <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                    {/* Date / Time */}
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          {targetDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} •{' '}
                          {targetDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {item.soundAlarm && (
                        <span title="Sesli alarm devrede" className="text-amber-400">
                          <Volume2 className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {item.sendPush && (
                        <span title="Kilit ekranı bildirimi devrede" className="text-blue-400">
                          <Smartphone className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 ml-auto">
                      {!isCompleted && (
                        <>
                          <button
                            onClick={() => completeTimedFollowUp(item.id)}
                            title="Görevi Tamamla"
                            className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg transition active:scale-95 flex items-center gap-1 text-[11px] font-semibold"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Tamamla</span>
                          </button>

                          <button
                            onClick={() => snoozeTimedFollowUp(item.id, 15)}
                            title="15 Dk Ertele"
                            className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg transition active:scale-95 text-[11px] flex items-center gap-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">15 Dk</span>
                          </button>

                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setIsModalOpen(true);
                            }}
                            title="Düzenle"
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handleDelete(item.id, item.cariName)}
                        title="Sil"
                        className="p-1.5 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal for Add / Edit */}
      {isModalOpen && (
        <TimedFollowUpModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingItem(null);
          }}
          initialData={editingItem}
        />
      )}
    </div>
  );
};
