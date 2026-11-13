import React, { useState } from 'react';
import {
  Building2,
  MapPin,
  FileText,
  Calendar,
  Clock,
  User,
  MessageCircle,
  Pencil,
  Trash2,
  Camera,
  CheckSquare,
  ZoomIn,
  ChevronDown,
} from 'lucide-react';
import { ServiceItem } from '../../types/storage';
import { useAuth } from '../../context/AuthContext';
import { isUserAdmin } from '../../types/auth';
import { WhatsappService } from '../../services/whatsappService';
import { LocationService } from '../../services/locationService';
import { ImageLightboxModal } from '../common/ImageLightboxModal';

interface ServiceCardProps {
  service: ServiceItem;
  onEdit: (service: ServiceItem) => void;
  onDelete: (id: string) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  onEdit,
  onDelete,
}) => {
  const { user } = useAuth();
  const isAdmin = isUserAdmin(user);
  const isCreator = user?.id === service.createdBy;
  const canModify = isAdmin || isCreator;
  const [isOpen, setIsOpen] = useState(false);
  const [lightboxData, setLightboxData] = useState<{
    images: string[];
    initialIndex: number;
    title: string;
  } | null>(null);

  const displayCariName = (service.cariName || service.companyName || 'Cari Belirtilmedi').trim();

  const validPhotos = Array.isArray(service.photos)
    ? service.photos.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    : [];

  const validCompletionPhotos = Array.isArray(service.completionPhotos)
    ? service.completionPhotos.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    : [];

  // Format date
  const dateObj = service.date ? new Date(service.date) : new Date(service.createdAt);
  const formattedDate = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';
  const formattedTime = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const handleShareWhatsapp = () => {
    WhatsappService.shareService({
      companyName: service.companyName,
      location: service.location,
      latitude: service.latitude,
      longitude: service.longitude,
      workDone: service.workDone,
      date: service.date,
      staffName: service.createdByName || 'Saha Personeli',
    });
  };

  return (
    <>
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-3.5 sm:p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group max-w-full overflow-hidden">
        {/* Cari / Müşteri Çekmece Başlığı (Tıklayınca Detaylar Alta Doğru Açılır) */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 hover:from-blue-500/15 hover:to-indigo-500/15 dark:from-blue-500/20 dark:to-indigo-500/20 border border-blue-200/80 dark:border-blue-800/60 text-xs sm:text-sm font-black text-blue-900 dark:text-blue-200 cursor-pointer transition-all text-left select-none"
        >
          <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="truncate flex-1">{displayCariName}</span>
          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider shrink-0 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-md">
            CARİ
          </span>
          <ChevronDown
            className={`w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Çekmece İçeriği (Açılınca Tüm Detaylar Alta Doğru Gösterilir) */}
        {isOpen && (
          <div className="pt-3.5 mt-3.5 border-t border-slate-100 dark:border-slate-800/80 space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Top Row: Company Name & Date */}
            <div className="flex items-start justify-between gap-2.5 min-w-0 w-full">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <div className="w-8 h-8 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight truncate min-w-0">
                    {service.companyName}
                  </h3>
                </div>

                {service.location && (
                  <button
                    type="button"
                    onClick={() => LocationService.openInGoogleMaps(service.location, service.latitude, service.longitude)}
                    className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 font-medium text-left cursor-pointer transition-colors group/loc min-w-0 max-w-full w-full"
                    title="Haritada Göster"
                  >
                    <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5 group-hover/loc:scale-110 transition-transform" />
                    <span className="line-clamp-2 break-words group-hover/loc:underline underline-offset-2 min-w-0 flex-1 leading-snug">
                      {service.location}
                    </span>
                    {service.latitude && service.longitude && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md shrink-0 mt-0.5">
                        GPS
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* Date & Time Badge */}
              <div className="flex flex-col items-end shrink-0 text-[11px] font-bold text-slate-400 dark:text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{formattedDate}</span>
                </span>
                {formattedTime && (
                  <span className="flex items-center gap-1 text-[10px]">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{formattedTime}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Middle Box: Yapılan İş / Servis Notu */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 space-y-1 min-w-0 max-w-full overflow-hidden">
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                <FileText className="w-3 h-3" />
                <span>Yapılan İş / Servis Notu</span>
              </div>
              <p className="text-xs sm:text-sm font-medium whitespace-pre-wrap leading-relaxed break-words">
                {service.workDone}
              </p>
            </div>

            {/* Servis Fotoğrafları Galerisi */}
            {validPhotos.length > 0 && (
              <div className="space-y-2 w-full">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Servis Fotoğrafları ({validPhotos.length})</span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                    Büyütmek için dokunun
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 w-full">
                  {validPhotos.map((photo, pIdx) => (
                    <div
                      key={pIdx}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setLightboxData({
                          images: validPhotos,
                          initialIndex: pIdx,
                          title: `${service.companyName || 'Servis'} Fotoğrafları`,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setLightboxData({
                            images: validPhotos,
                            initialIndex: pIdx,
                            title: `${service.companyName || 'Servis'} Fotoğrafları`,
                          });
                        }
                      }}
                      className="relative w-full aspect-square min-h-[88px] sm:min-h-[96px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 group/simg cursor-pointer hover:border-orange-400 dark:hover:border-orange-500 transition-all shadow-xs"
                    >
                      <img
                        src={photo}
                        alt={`Servis Görseli ${pIdx + 1}`}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover group-hover/simg:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute bottom-1.5 right-1.5 p-1 rounded-lg bg-black/55 text-white backdrop-blur-xs opacity-85 group-hover/simg:opacity-100 transition-opacity pointer-events-none">
                        <ZoomIn className="w-3 h-3" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completion Proof & Note Box */}
            {(service.completionNote || validCompletionPhotos.length > 0) && (
              <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/60 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 text-[11px]">
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Tamamlama Detayı ({service.completedByName || 'Personel'})</span>
                  </span>
                  {service.completedAt && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      {new Date(service.completedAt).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
                {service.completionNote && (
                  <div className="text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                    <span className="font-bold text-slate-900 dark:text-slate-100">Personel Açıklaması: </span>
                    {service.completionNote}
                  </div>
                )}
                {validCompletionPhotos.length > 0 && (
                  <div className="space-y-1.5 pt-1 w-full">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                      Tamamlama Fotoğrafları ({validCompletionPhotos.length})
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 w-full">
                      {validCompletionPhotos.map((photo, cIdx) => (
                        <div
                          key={cIdx}
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            setLightboxData({
                              images: validCompletionPhotos,
                              initialIndex: cIdx,
                              title: `${service.companyName || 'Servis'} - Tamamlama Fotoğrafları`,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setLightboxData({
                                images: validCompletionPhotos,
                                initialIndex: cIdx,
                                title: `${service.companyName || 'Servis'} - Tamamlama Fotoğrafları`,
                              });
                            }
                          }}
                          className="relative w-full aspect-square min-h-[84px] rounded-xl overflow-hidden border border-emerald-200 dark:border-emerald-800 bg-slate-100 dark:bg-slate-800 group/cimg cursor-pointer hover:opacity-90 transition-all shadow-xs"
                        >
                          <img
                            src={photo}
                            alt={`Tamamlama Kanıtı ${cIdx + 1}`}
                            loading="lazy"
                            className="absolute inset-0 w-full h-full object-cover group-hover/cimg:scale-105 transition-transform"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Row: Staff Name & Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/60 min-w-0 w-full gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-semibold truncate min-w-0 flex-1">
                <div className="w-5 h-5 rounded-md bg-slate-200/70 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                  <User className="w-3 h-3" />
                </div>
                <span className="truncate min-w-0 flex-1">{service.createdByName || 'Saha Personeli'}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* WhatsApp Share Button */}
                <button
                  type="button"
                  onClick={handleShareWhatsapp}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-xs font-bold transition-colors cursor-pointer"
                  title="WhatsApp ile Paylaş"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Paylaş</span>
                </button>

                {/* Edit Button */}
                {canModify && (
                  <button
                    type="button"
                    onClick={() => onEdit(service)}
                    className="p-1.5 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                    title="Düzenle"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}

                {/* Delete Button */}
                {canModify && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`"${service.companyName}" servis kaydını silmek istediğinize emin misiniz?`)) {
                        onDelete(service.id);
                      }
                    }}
                    className="p-1.5 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                    title="Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      <ImageLightboxModal
        isOpen={Boolean(lightboxData)}
        images={lightboxData?.images || []}
        initialIndex={lightboxData?.initialIndex || 0}
        title={lightboxData?.title || `${service.companyName} - Servis Fotoğrafı`}
        onClose={() => setLightboxData(null)}
      />

    </>
  );
};
