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
  Camera,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { WhatsappService } from '../../services/whatsappService';
import { LocationService } from '../../services/locationService';
import { useAuth } from '../../context/AuthContext';
import { isUserAdmin } from '../../types/auth';
import { useStorage } from '../../context/StorageContext';
import { ServiceItem, ApprovalStatus } from '../../types/storage';
import { compressImage } from '../../utils/imageUtils';
import { CariSelect } from '../common/CariSelect';

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (serviceData: {
    companyName: string;
    cariName?: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    workDone: string;
    date?: string;
    photos?: string[];
    status?: ApprovalStatus;
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
  const isAdmin = isUserAdmin(user);
  const { locations } = useStorage();
  const [companyName, setCompanyName] = useState('');
  const [cariName, setCariName] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [workDone, setWorkDone] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(true);
  const [directApprove, setDirectApprove] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingService) {
      setCompanyName(editingService.companyName || '');
      setCariName(editingService.cariName || editingService.companyName || '');
      setLocation(editingService.location || '');
      setLatitude(editingService.latitude);
      setLongitude(editingService.longitude);
      setWorkDone(editingService.workDone || '');
      setPhotos(editingService.photos || []);
      setNotifyWhatsapp(false);
      setDirectApprove(editingService.status === 'approved');
    } else {
      setCompanyName('');
      setCariName('');
      setLocation('');
      setLatitude(undefined);
      setLongitude(undefined);
      setWorkDone('');
      setPhotos([]);
      setNotifyWhatsapp(true);
      setDirectApprove(false);
    }
  }, [editingService, isOpen]);

  // GPS Location handler
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

  // Google Maps handler
  const handleOpenMap = () => {
    LocationService.openInGoogleMaps(location, latitude, longitude);
  };

  const handleLocationInputChange = (val: string) => {
    setLocation(val);
    const matched = locations.find((l) => l.address === val || l.name === val);
    if (matched && matched.latitude && matched.longitude) {
      setLatitude(matched.latitude);
      setLongitude(matched.longitude);
    }
  };

  // Image Upload handler with Compression
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsProcessingPhoto(true);
      const compressedPhotos: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        const compressed = await compressImage(file, 1200, 0.75);
        compressedPhotos.push(compressed);
      }

      setPhotos((prev) => [...prev, ...compressedPhotos]);
    } catch (err) {
      console.error('Fotoğraf işleme hatası:', err);
      alert('Fotoğraflar işlenirken bir hata oluştu.');
    } finally {
      setIsProcessingPhoto(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cName = companyName.trim();
    const wDone = workDone.trim();

    if (!cName) {
      alert('Lütfen firma / müşteri adını girin.');
      return;
    }
    if (!wDone) {
      alert('Lütfen yapılan iş / servis notunu girin.');
      return;
    }

    try {
      setIsSubmitting(true);

      await onSave({
        companyName: cName,
        cariName: cariName.trim() || undefined,
        location: location.trim() || undefined,
        latitude,
        longitude,
        workDone: wDone,
        date: editingService?.date || new Date().toISOString(),
        photos,
        status: editingService
          ? editingService.status
          : directApprove
          ? 'approved'
          : 'pending_approval',
      });

      // Optional WhatsApp Share
      if (notifyWhatsapp && !editingService) {
        WhatsappService.shareService({
          companyName: cName,
          location: location.trim() || undefined,
          latitude,
          longitude,
          workDone: wDone,
          staffName: user?.name || user?.username || 'Saha Personeli',
        });
      }

      onClose();
    } catch (err) {
      console.error(err);
      alert('Servis kaydı kaydedilirken bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingService ? 'Servis Kaydını Düzenle' : 'Yeni Servis Ekle'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Cari Selection (Optional) with Integrated Search in Dropdown - Görsel 2 */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-blue-500" />
            <span>İlgili Cari / Müşteri (İsteğe Bağlı)</span>
          </label>

          <CariSelect
            value={cariName}
            onChange={(val) => {
              setCariName(val);
              if (!companyName.trim() || companyName === cariName) {
                setCompanyName(val);
              }
            }}
            placeholder="Açılan listeden cari seçin veya arayın..."
          />

          <span className="block text-[11px] text-slate-400">
            💡 İsteğe bağlıdır. Cari seçilmezse boş geçilir; seçilirse personele en üstte gösterilir.
          </span>
        </div>

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
            placeholder="Örn: 12 YAZILIM, ADA CAFE..."
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-medium transition-all"
          />
        </div>

        {/* Lokasyon / Adres */}
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

            {/* GPS Butonu */}
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

            {/* Haritada Göster Butonu */}
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

          {locations && locations.length > 0 && (
            <datalist id="service-installation-locations">
              {locations.map((loc) => (
                <option key={loc.id} value={loc.address || loc.name}>
                  {loc.name} {loc.address ? `(${loc.address})` : ''}
                </option>
              ))}
            </datalist>
          )}

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
            rows={3}
            placeholder="Serviste yapılan işlemleri, değişen parçaları ve detayları buraya yazın..."
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-medium transition-all resize-none"
          />
        </div>

        {/* Fotoğraf Ekleme Bölümü */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Servis Fotoğrafları ({photos.length})
            </label>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 text-xs font-bold cursor-pointer hover:bg-orange-100 transition-colors">
                <Camera className="w-3.5 h-3.5" />
                <span>Kamera</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={isProcessingPhoto}
                />
              </label>
              <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer hover:bg-slate-200 transition-colors">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Galeri</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={isProcessingPhoto}
                />
              </label>
            </div>
          </div>

          {isProcessingPhoto && (
            <div className="flex items-center justify-center p-2 text-xs text-orange-600 dark:text-orange-400 gap-2 bg-orange-50/50 dark:bg-orange-950/20 rounded-xl">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Fotoğraf işleniyor...</span>
            </div>
          )}

          {photos.length > 0 && (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 pt-1">
              {photos.map((photo, idx) => (
                <div
                  key={idx}
                  className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
                >
                  <img
                    src={photo}
                    alt={`Servis Fotoğrafı ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 transition-colors cursor-pointer"
                    title="Sil"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* WhatsApp ile Bildir */}
        {!editingService && (
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/60 text-emerald-950 dark:text-emerald-200 cursor-pointer select-none transition-colors">
            <input
              type="checkbox"
              checked={notifyWhatsapp}
              onChange={(e) => setNotifyWhatsapp(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 dark:focus:ring-offset-slate-900"
            />
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Kaydettikten sonra WhatsApp ile paylaşım ekranını aç</span>
            </div>
          </label>
        )}

        {/* Yönetici Doğrudan Onay Checkbox (Yalnızca Yönetici için) */}
        {isAdmin && !editingService && (
          <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={directApprove}
              onChange={(e) => setDirectApprove(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <span className="text-xs font-bold">
              Yönetici Yetkisi: Direkt Onaylandı olarak kaydet (Onay beklemeden)
            </span>
          </label>
        )}

        {/* Alt Butonlar */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !companyName.trim() || !workDone.trim()}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Kaydediliyor...</span>
              </>
            ) : editingService ? (
              <span>Güncelle</span>
            ) : directApprove ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Kaydet ve Onayla</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Kaydet ve Onaya Gönder</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
