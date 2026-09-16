import React from 'react';
import {
  MapPin,
  Trash2,
  ChevronRight,
  Calendar,
  Image as ImageIcon,
  CheckCircle2,
  FileText,
  User as UserIcon,
  MessageCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { LocationItem } from '../../types/storage';
import { ProgressBar } from '../common/ProgressBar';
import { LocationService } from '../../services/locationService';
import { WhatsappService } from '../../services/whatsappService';
import { useAuth } from '../../context/AuthContext';
import { isUserAdmin } from '../../types/auth';

interface LocationCardProps {
  location: LocationItem;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

export const LocationCard: React.FC<LocationCardProps> = ({
  location,
  onClick,
  onDelete,
}) => {
  const { user } = useAuth();
  const isAdmin = isUserAdmin(user);

  const total = location.tasks.length;
  const completed = location.tasks.filter((t) => t.status === 'completed').length;
  const notPresent = location.tasks.filter((t) => t.status === 'not_present').length;

  const completedPct = total > 0 ? (completed / total) * 100 : 0;
  const notPresentPct = total > 0 ? (notPresent / total) * 100 : 0;

  const hasLocation = Boolean(
    location.address?.trim() || (location.latitude && location.longitude)
  );

  const photos = location.photos || [];

  const handleMapClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasLocation) {
      LocationService.openInGoogleMaps(
        location.address,
        location.latitude,
        location.longitude
      );
    } else {
      alert(
        'Bu firmaya ait henüz adres veya koordinat bilgisi girilmemiştir. Firma detaylarındaki "Notlar & Medya" sekmesinden konum ekleyebilirsiniz.'
      );
    }
  };

  const formattedDate = new Date(location.createdAt).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Status Badge Helper
  const getStatusBadge = () => {
    if (location.status === 'approved') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          Onaylandı
        </span>
      );
    }
    if (location.status === 'pending_approval') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse">
          <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          Onay Bekliyor
        </span>
      );
    }
    if (location.status === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          Reddedildi
        </span>
      );
    }
    if (total > 0 && completed + notPresent === total) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Görevler Bitti
        </span>
      );
    }
    if (completed > 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          %{Math.round(completedPct)} Devam Ediyor
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        Başlanmadı
      </span>
    );
  };

  const cardBorderClass = () => {
    if (location.status === 'approved') {
      return 'border-emerald-300/80 dark:border-emerald-800/80 ring-1 ring-emerald-500/20';
    }
    if (location.status === 'pending_approval') {
      return 'border-amber-300/80 dark:border-amber-800/80 ring-1 ring-amber-500/20';
    }
    if (location.status === 'rejected') {
      return 'border-rose-300/80 dark:border-rose-800/80 ring-1 ring-rose-500/20';
    }
    return 'border-slate-200/80 dark:border-slate-700/80';
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-800/95 rounded-2xl p-5 shadow-xs hover:shadow-lg border cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99] group flex flex-col justify-between max-w-full overflow-hidden ${cardBorderClass()}`}
    >
      {/* Top Section */}
      <div className="space-y-3 min-w-0 w-full">
        {/* Header with Name and Status Badge */}
        <div className="flex items-start justify-between gap-2.5 min-w-0 w-full">
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-50 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {location.name}
            </h3>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 dark:text-slate-500 font-medium truncate min-w-0">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span className="shrink-0">{formattedDate}</span>
              {isAdmin && location.createdByName && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold truncate min-w-0">
                    <UserIcon className="w-3 h-3 shrink-0" />
                    <span className="truncate">{location.createdByName}</span>
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="shrink-0">{getStatusBadge()}</div>
        </div>

        {/* Address or Location Snippet */}
        {location.address ? (
          <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5 truncate min-w-0 max-w-full">
            <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="truncate min-w-0 flex-1">{location.address}</span>
          </p>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500 italic flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
            <span>Adres girilmemiş</span>
          </p>
        )}

        {/* Rejection Alert Box */}
        {location.status === 'rejected' && location.rejectionReason && (
          <div className="p-2.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-xs text-rose-800 dark:text-rose-300">
            <span className="font-bold">Red Gerekçesi: </span>
            {location.rejectionReason}
          </div>
        )}

        {/* Media / Notes Badges row */}
        <div className="flex items-center gap-2 pt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          {photos.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300">
              <ImageIcon className="w-3 h-3 text-emerald-500" />
              {photos.length} Fotoğraf
            </span>
          )}

          {location.notes && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 truncate max-w-[160px]">
              <FileText className="w-3 h-3 text-blue-500" />
              Not var
            </span>
          )}
        </div>

        {/* Progress Bar & Breakdown */}
        <div className="space-y-1.5 pt-2">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              {completed} / {total} Görev Tamam
            </span>
            {notPresent > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                {notPresent} Mevcut Değil
              </span>
            )}
          </div>
          <ProgressBar completedPct={completedPct} notPresentPct={notPresentPct} height="h-2" />
        </div>
      </div>

      {/* Footer Action Strip */}
      <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={handleMapClick}
            className={`p-2 rounded-xl transition-colors ${
              hasLocation
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                : 'text-slate-400 hover:text-slate-600 bg-slate-100 dark:bg-slate-700/40'
            }`}
            title={hasLocation ? 'Google Haritalar' : 'Konum Girilmemiş'}
            aria-label="Haritada Göster"
          >
            <MapPin className="w-4 h-4" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              WhatsappService.shareLocation({
                locationName: location.name,
                staffName: location.createdByName || 'Saha Yetkilisi',
              });
            }}
            className="p-2 rounded-xl text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
            title="WhatsApp ile Paylaş / Yöneticiye Bildir"
            aria-label="WhatsApp ile Paylaş"
          >
            <MessageCircle className="w-4 h-4" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e);
            }}
            className="p-2 rounded-xl text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
            title="Kurulumu Sil"
            aria-label="Kurulumu Sil"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform">
          <span>Detaylar & Tutanak</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};
