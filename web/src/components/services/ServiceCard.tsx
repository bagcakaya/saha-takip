import React from 'react';
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
} from 'lucide-react';
import { ServiceItem } from '../../types/storage';
import { useAuth } from '../../context/AuthContext';
import { WhatsappService } from '../../services/whatsappService';

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
  const isAdmin = user?.role === 'admin';
  const isCreator = user?.id === service.createdBy;
  const canModify = isAdmin || isCreator;

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
      workDone: service.workDone,
      date: service.date,
      staffName: service.createdByName || 'Saha Personeli',
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3.5 group">
      {/* Top Row: Company Name & Location Badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight truncate">
              {service.companyName}
            </h3>
          </div>

          {service.location && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium pl-10 truncate">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{service.location}</span>
            </div>
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
      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 space-y-1">
        <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-orange-600 dark:text-orange-400">
          <FileText className="w-3 h-3" />
          <span>Yapılan İş / Servis Notu</span>
        </div>
        <p className="text-xs sm:text-sm font-medium whitespace-pre-wrap leading-relaxed">
          {service.workDone}
        </p>
      </div>

      {/* Bottom Row: Staff Name & Actions */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-semibold truncate">
          <div className="w-5 h-5 rounded-md bg-slate-200/70 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
            <User className="w-3 h-3" />
          </div>
          <span className="truncate">{service.createdByName || 'Saha Personeli'}</span>
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
  );
};
