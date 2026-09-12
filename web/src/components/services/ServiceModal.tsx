import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import {
  MessageCircle,
  Building2,
  MapPin,
  FileText,
  Compass,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { WhatsappService } from '../../services/whatsappService';
import { LocationService } from '../../services/locationService';
import { useAuth } from '../../context/AuthContext';
import { useStorage } from '../../context/StorageContext';
import { ServiceItem } from '../../types/storage';

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (serviceData: {
    companyName: string;
    location?: string;
    latitude?: number;
    longitude?: number;
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
  const { locations } = useStorage();
  const [companyName, setCompanyName] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [workDone, setWorkDone] = useState('');
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingService) {
      setCompanyName(editingService.companyName || '');
      setLocation(editingService.location || '');
      setLatitude(editingService.latitude);
      setLongitude(editingService.longitude);
      setWorkDone(editingService.workDone || '');
      setNotifyWhatsapp(false);
    } else {
      setCompanyName('');
      setLocation('');
      setLatitude(undefined);
      setLongitude(undefined);
      setWorkDone('');
      setNotifyWhatsapp(true);
    }
  }, [editingService, isOpen]);

  // GPS Location handler (Görsel-2'deki Pusula butonu gibi)
  const handleGetLocation = async () => {
    try {
      setIsFetchingLocation(true);
      const res = await LocationService.getCurrentPosition();
      setLocation(res.address || '');
      setLatitude(res.latitude);
      setLongitude(res.longitude);
    } catch (err: any) {
      alert(err?.message || 'Konum alınamadı.');
    } finally {
      setIsFetchingLocation(false);
    }
  };

  // Google Maps handler (Görsel-2'deki Harita butonu gibi)
  const handleOpenMap = () => {
    LocationService.openInGoogleMaps(location, latitude, longitude);
  };

  const handleLocationInputChange = (val: string) => {
    setLocation(val);
    // Kurulum lokasyonlarından eşleşme varsa koordinatlarını otomatik bağla
    const matched = locations.find((l) => l.address === val || l.name === val);
    if (matched && matched.latitude && matched.longitude) {
      setLatitude(matched.latitude);
      setLongitude(matched.longitude);
    }
  };

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
        latitude,
        longitude,
        workDone: wDone,
        date: editingService?.date || dateStr,
      });

      if (notifyWhatsapp && !editingService) {
        WhatsappService.shareService({
          companyName: cName,
          location: loc,
          latitude,
          longitude,
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

        {/* Lokasyon / Adres (Görsel-2 Stili: GPS + Harita + Coğrafi Konum Rozeti) */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            <MapPin className="w-3.5 h-3.5 text-orange-500" />
            <span>Lokasyon / Adres</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={location}
              onChange={(e) => handleLocationInputChange(e.target.value)}
              placeholder="Firma / Kurulum adresi veya koordinatı..."
              list="service-installation-locations"
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs sm:text-sm font-medium transition-all"
            />

            {/* GPS Butonu (Görsel-2'deki Pusula Butonu) */}
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={isFetchingLocation}
              className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
              title="GPS ile Anlık Konumu Al"
              aria-label="Konum Al"
            >
              {isFetchingLocation ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Compass className="w-5 h-5" />
              )}
            </button>

            {/* Haritada Göster Butonu (Görsel-2'deki Pin Butonu) */}
            <button
              type="button"
              onClick={handleOpenMap}
              disabled={!location.trim() && !latitude}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-40 shrink-0 cursor-pointer"
              title="Haritada Göster"
              aria-label="Haritada Göster"
            >
              <MapPin className="w-5 h-5" />
            </button>
          </div>

          {/* Kurulum Lokasyonlarından Hızlı Seçim Listesi */}
          {locations && locations.length > 0 && (
            <datalist id="service-installation-locations">
              {locations.map((loc) => (
                <option key={loc.id} value={loc.address || loc.name}>
                  {loc.name} {loc.address ? `(${loc.address})` : ''}
                </option>
              ))}
            </datalist>
          )}

          {/* Coğrafi Konum İşaretlendi Rozeti (Görsel-2 ile birebir aynı) */}
          {latitude && longitude && (
            <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                Coğrafi konum işaretlendi ({latitude.toFixed(5)}, {longitude.toFixed(5)})
              </span>
            </div>
          )}
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
