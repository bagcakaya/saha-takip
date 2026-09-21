import React from 'react';
import { Bell, CheckCircle2, Clock, VolumeX, Building2, AlertTriangle } from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import { parseDueDateTime } from '../../utils/dateUtils';

export const CariAlarmRingingModal: React.FC = () => {
  const { activeRingingAlarm, completeTimedFollowUp, snoozeTimedFollowUp, dismissAlarm } = useStorage();

  if (!activeRingingAlarm) return null;

  const parsedDate = parseDueDateTime(activeRingingAlarm.snoozedUntil || activeRingingAlarm.dueDate);

  const formattedTime = parsedDate
    ? parsedDate.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const formattedDate = parsedDate
    ? parsedDate.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
      })
    : '';

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-red-500/80 rounded-3xl max-w-md w-full shadow-2xl shadow-red-500/20 overflow-hidden text-center animate-in zoom-in-95 duration-200">
        {/* Animated Alarm Top Banner */}
        <div className="bg-gradient-to-r from-red-600 via-amber-600 to-red-600 p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.2),transparent_70%)]" />
          <div className="relative flex flex-col items-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 shadow-lg ring-4 ring-white/30 animate-bounce">
              <Bell className="w-8 h-8 text-white fill-white" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/30 text-white text-xs font-bold uppercase tracking-wider backdrop-blur-sm mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
              {activeRingingAlarm.currentMilestoneLabel || 'Süreli Cari Alarmı Çalıyor'}
            </div>
            <div className="text-white/90 text-sm font-medium">
              {formattedDate} • {formattedTime}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {/* Cari Name Card */}
          <div className="p-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl text-left">
            <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1 mb-1">
              <Building2 className="w-3.5 h-3.5" />
              Takip Edilen Cari
            </div>
            <div className="text-lg font-black text-white break-words">
              {activeRingingAlarm.cariName}
            </div>
          </div>

          {/* Description Card */}
          <div className="p-4 bg-slate-800/50 border border-slate-800 rounded-2xl text-left">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Takip Konusu & Açıklama
            </div>
            <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
              {activeRingingAlarm.description}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2.5">
            {/* Complete Task */}
            <button
              onClick={() => completeTimedFollowUp(activeRingingAlarm.id)}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition active:scale-98"
            >
              <CheckCircle2 className="w-5 h-5" />
              Görevi / Takibi Tamamla
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Snooze 15 Min */}
              <button
                onClick={() => snoozeTimedFollowUp(activeRingingAlarm.id, 15)}
                className="py-3 px-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-98"
              >
                <Clock className="w-4 h-4" />
                15 Dk Ertele
              </button>

              {/* Dismiss / Silence */}
              <button
                onClick={() => dismissAlarm()}
                className="py-3 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-98"
              >
                <VolumeX className="w-4 h-4" />
                Alarmı Sustur
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
