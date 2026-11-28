import React from 'react';
import { BellRing, CheckCircle2, Clock, VolumeX, Building2, Calendar, Repeat } from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import { formatRepeatIntervalLabel } from './AppointmentsModal';

export const AppointmentAlarmRingingModal: React.FC = () => {
  const {
    activeRingingAppointment,
    completeAppointment,
    snoozeAppointment,
    dismissAppointmentAlarm,
  } = useStorage();

  if (!activeRingingAppointment) return null;

  const isDueAlert = Boolean(activeRingingAppointment.dueNotified);

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-cyan-400/80 rounded-3xl max-w-md w-full shadow-2xl shadow-cyan-500/25 overflow-hidden text-center animate-in zoom-in-95 duration-200">
        {/* Top Animated Alarm Banner */}
        <div
          className={`p-6 relative overflow-hidden ${
            isDueAlert
              ? 'bg-gradient-to-r from-rose-600 via-amber-600 to-rose-600'
              : 'bg-gradient-to-r from-cyan-600 via-teal-600 to-indigo-700'
          }`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.25),transparent_70%)]" />
          <div className="relative flex flex-col items-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 shadow-lg ring-4 ring-white/30 animate-bounce">
              <BellRing className="w-8 h-8 text-white" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/35 text-white text-xs font-black uppercase tracking-wider backdrop-blur-sm mb-1.5">
              {isDueAlert ? '🔔 RANDEVU VAKTİ GELDİ!' : '⏰ PERİYODİK RANDEVU HATIRLATMASI'}
            </div>
            <div className="text-white text-sm font-extrabold flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>
                {activeRingingAppointment.appointmentDate} • Saat {activeRingingAppointment.appointmentTime}
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Cari Info */}
          <div className="p-4 bg-slate-800/90 border border-slate-700 rounded-2xl text-left">
            <div className="text-[11px] font-extrabold text-cyan-400 uppercase tracking-wider flex items-center justify-between mb-1">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                Randevu Carisi / Müşteri
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-900 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                <Repeat className="w-3 h-3" />
                {activeRingingAppointment.repeatLabel ||
                  formatRepeatIntervalLabel(activeRingingAppointment.repeatMinutes)}
              </span>
            </div>
            <div className="text-lg font-black text-white break-words">
              {activeRingingAppointment.cariName || 'Genel Randevu'}
            </div>
          </div>

          {/* Description */}
          <div className="p-4 bg-slate-800/50 border border-slate-800 rounded-2xl text-left">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Randevu Açıklaması & Konusu
            </div>
            <div className="text-sm text-slate-100 whitespace-pre-wrap leading-relaxed font-medium">
              {activeRingingAppointment.description}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 space-y-2.5">
            <button
              type="button"
              onClick={() => completeAppointment(activeRingingAppointment.id)}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Randevuyu Tamamla (Bildirimleri Durdur)</span>
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() =>
                  snoozeAppointment(
                    activeRingingAppointment.id,
                    activeRingingAppointment.repeatMinutes > 0
                      ? activeRingingAppointment.repeatMinutes
                      : 15
                  )
                }
                className="py-3 px-3 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-98 cursor-pointer"
              >
                <Clock className="w-4 h-4" />
                <span>
                  {activeRingingAppointment.repeatMinutes > 0
                    ? `${formatRepeatIntervalLabel(activeRingingAppointment.repeatMinutes)} Sonra`
                    : '15 Dk Ertele'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => dismissAppointmentAlarm()}
                className="py-3 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-98 cursor-pointer"
              >
                <VolumeX className="w-4 h-4" />
                <span>Sesi Kapat / Tamam</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
