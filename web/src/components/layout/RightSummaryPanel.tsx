import React from 'react';
import {
  MapPin,
  ExternalLink,
  ChevronRight,
  Users,
  Image as ImageIcon,
  Bell,
} from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';
import { CircularProgress } from '../common/CircularProgress';
import { LocationItem } from '../../types/storage';
import { LocationService } from '../../services/locationService';

interface RightSummaryPanelProps {
  selectedLocation: LocationItem | null;
  onOpenDetailModal: (location: LocationItem) => void;
}

export const RightSummaryPanel: React.FC<RightSummaryPanelProps> = ({
  selectedLocation,
  onOpenDetailModal,
}) => {
  const { locations, notes } = useStorage();
  const { user, users } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Target preview location: explicitly selected, or fallback to first/latest location
  const activeLocation = selectedLocation || locations[0] || null;

  // Stats calculation
  let totalTasks = 0;
  let completedTasks = 0;
  let notPresentTasks = 0;

  locations.forEach((loc) => {
    loc.tasks.forEach((t) => {
      totalTasks++;
      if (t.status === 'completed') completedTasks++;
      if (t.status === 'not_present') notPresentTasks++;
    });
  });

  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Upcoming reminders
  const upcomingReminders = notes
    .filter((n) => n.reminderActive && n.reminderDate)
    .sort((a, b) => new Date(a.reminderDate!).getTime() - new Date(b.reminderDate!).getTime())
    .slice(0, 3);

  // Staff activity breakdown (for Admin)
  const staffStats = users.map((u) => {
    const userLocs = locations.filter((l) => l.createdBy === u.id);
    return {
      name: u.name,
      role: u.role,
      count: userLocs.length,
    };
  });

  const handleOpenMap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeLocation) return;
    LocationService.openInGoogleMaps(
      activeLocation.address,
      activeLocation.latitude,
      activeLocation.longitude
    );
  };

  return (
    <aside className="hidden xl:flex flex-col w-80 2xl:w-96 bg-white dark:bg-slate-900 border-l border-slate-200/80 dark:border-slate-800 p-5 h-screen sticky top-0 shrink-0 select-none overflow-y-auto space-y-6 transition-colors z-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
            Canlı Saha Özeti
          </h3>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
          Anlık Bilgi
        </span>
      </div>

      {/* 1. Active / Selected Location Card & Map Preview */}
      {activeLocation ? (
        <div className="bg-slate-50 dark:bg-slate-800/70 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-700/80 space-y-3 shadow-xs">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
                {selectedLocation ? 'Seçili Kurulum' : 'Son İşlem'}
              </span>
              <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 truncate max-w-[180px]">
                {activeLocation.name}
              </h4>
            </div>

            <button
              onClick={() => onOpenDetailModal(activeLocation)}
              className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
            >
              <span>Aç</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Map Preview Box */}
          <div
            onClick={handleOpenMap}
            className="relative h-32 rounded-2xl bg-slate-200 dark:bg-slate-700 overflow-hidden border border-slate-300 dark:border-slate-600 cursor-pointer group flex items-center justify-center"
            title="Haritada Aç"
          >
            {/* Visual map pattern or iframe */}
            <div className="absolute inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(#475569_1px,transparent_1px)] opacity-60" />

            <div className="relative z-10 text-center p-3 space-y-1">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-md group-hover:scale-110 transition-transform">
                <MapPin className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block truncate max-w-[200px]">
                {activeLocation.address || 'Haritada Görüntüle'}
              </span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-extrabold inline-flex items-center gap-1">
                <span>Google Maps'te Aç</span>
                <ExternalLink className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Photos count */}
          {activeLocation.photos && activeLocation.photos.length > 0 && (
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 font-semibold text-[11px]">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                <span>Fotoğraflar</span>
              </span>
              <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300">
                {activeLocation.photos.length} Adet
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-6 text-xs text-slate-400 italic">
          Henüz kayıtlı kurulum bulunmuyor.
        </div>
      )}

      {/* 2. Circular Overall Completion Progress Ring */}
      <div className="bg-slate-50 dark:bg-slate-800/70 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-700/80 space-y-3 text-center shadow-xs">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
          Genel Görev Başarısı
        </span>

        <CircularProgress
          percentage={completionRate}
          size={110}
          strokeWidth={9}
          completedText={`${completedTasks} / ${totalTasks} Görev`}
          subText={notPresentTasks > 0 ? `${notPresentTasks} görev mevcut değil / muaf` : undefined}
        />
      </div>

      {/* 3. Upcoming Reminders Widget */}
      {upcomingReminders.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-800/70 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-700/80 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Bell className="w-3.5 h-3.5" />
              <span>Yaklaşan Alarmlar</span>
            </span>
          </div>

          <div className="space-y-2">
            {upcomingReminders.map((note) => {
              const date = new Date(note.reminderDate!);
              return (
                <div
                  key={note.id}
                  className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 space-y-1"
                >
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {note.content}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>
                      {date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Staff Activity Breakdown (Admin Only) */}
      {isAdmin && staffStats.length > 1 && (
        <div className="bg-slate-50 dark:bg-slate-800/70 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-700/80 space-y-3 shadow-xs">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-blue-500" />
            <span>Personel Dağılımı</span>
          </span>

          <div className="space-y-1.5">
            {staffStats.map((staff, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs font-semibold py-1 border-b border-slate-200/50 dark:border-slate-700/50 last:border-0"
              >
                <span className="text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                  {staff.name}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-extrabold">
                  {staff.count} Kurulum
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
