import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { MessageCircle, Building2, MapPin, FileText } from 'lucide-react';
import { WhatsappService } from '../../services/whatsappService';
import { useAuth } from '../../context/AuthContext';
import { ServiceItem } from '../../types/storage';

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (serviceData: {
    companyName: string;
    location?: string;
    workDone: string;
    date?: string;
  }) => Promise<void>;
  editingService?: ServiceItem | null;
}

export const ServiceModal: React.FC<ServiceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingService,
}) => {
  const { user } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [location, setLocation] = useState('');
  const [workDone, setWorkDone] = useState('');
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingService) {
      setCompanyName(editingService.companyName || '');
      setLocation(editingService.location || '');
      setWorkDone(editingService.workDone || '');
      setNotifyWhatsapp(false);
    } else {
      setCompanyName('');
      setLocation('');
      setWorkDone('');
      setNotifyWhatsapp(true);
    }
  }, [editingService, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cName = companyName.trim();
    const wDone = workDone.trim();
    const loc = location.trim();

    if (!cName) {
      alert('Lütfen firma / müşteri adını girin.');
      return;
    }
    if (!wDone) {
      alert('Lütfen yapılan iş / servis notunu yazın.');
      return;
    }

    try {
      setIsSubmitting(true);
      const now = new Date();
      const dateStr = now.toISOString();

      await onSave({
        companyName: cName,
        location: loc || undefined,
        workDone: wDone,
        date: editingService?.date || dateStr,
      });

      if (notifyWhatsapp && !editingService) {
        WhatsappService.shareService({
          companyName: cName,
          location: loc,
          workDone: wDone,
          date: dateStr,
          staffName: user?.name || user?.username || 'Saha Yetkilisi',
        });
      }

      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingService ? 'Servis Kaydını Düzenle' : 'Yeni Servis Kaydı'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Firma / Müşteri Adı */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            <Building2 className="w-3.5 h-3.5 text-orange-500" />
            <span>Firma / Müşteri Adı *</span>
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Örn: Merkez Ofis, X Restoran, Y Plaza"
            autoFocus
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-medium transition-all"
          />
        </div>

        {/* Lokasyon / Adres */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            <MapPin className="w-3.5 h-3.5 text-orange-500" />
            <span>Lokasyon / Adres</span>
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Örn: Kadıköy / İstanbul, 2. Kat No:4"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-medium transition-all"
          />
        </div>

        {/* Yapılan İş / Servis Notu */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            <FileText className="w-3.5 h-3.5 text-orange-500" />
            <span>Yapılan İş / Servis Notu *</span>
          </label>
          <textarea
            value={workDone}
            onChange={(e) => setWorkDone(e.target.value)}
            rows={4}
            placeholder="Serviste yapılan işlemleri, değişen parçaları ve detayları buraya yazın..."
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-medium transition-all resize-none"
          />
        </div>

        {/* WhatsApp ile Bildir (Görsel-2 Stili) */}
        {!editingService && (
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80 cursor-pointer transition-colors hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40">
            <input
              type="checkbox"
              checked={notifyWhatsapp}
              onChange={(e) => setNotifyWhatsapp(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
            <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
              Eklendiğinde WhatsApp ile Bildir
            </span>
          </label>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold transition-colors"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={!companyName.trim() || !workDone.trim() || isSubmitting}
            className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isSubmitting ? (
              'Kaydediliyor...'
            ) : editingService ? (
              'Güncelle'
            ) : (
              <>
                {notifyWhatsapp && <MessageCircle className="w-4 h-4" />}
                <span>Kaydet {notifyWhatsapp ? '& Gönder' : ''}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
