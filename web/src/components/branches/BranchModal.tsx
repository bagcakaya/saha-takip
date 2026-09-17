import React, { useState, useEffect } from 'react';
import {
  MapPin,
  X,
  Compass,
  Search,
  Users,
  Check,
  Loader2,
  ExternalLink,
  Info,
  Building2,
  Phone,
} from 'lucide-react';
import { Branch } from '../../types/storage';
import { useAuth } from '../../context/AuthContext';
import { Company } from '../../types/auth';
import { CompanyService } from '../../services/companyService';
import { LocationService } from '../../services/locationService';
import { MapPickerModal } from '../common/MapPickerModal';

interface BranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchToEdit?: Branch | null;
  onSave: (branchData: Omit<Branch, 'id' | 'createdAt' | 'updatedAt'> & { companyCode?: string }) => Promise<void>;
}

export const BranchModal: React.FC<BranchModalProps> = ({
  isOpen,
  onClose,
  branchToEdit,
  onSave,
}) => {
  const { users, user: currentUser } = useAuth();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | ''>('');
  const [longitude, setLongitude] = useState<number | ''>('');
  const [radiusMeters, setRadiusMeters] = useState<number>(20);
  const [phone, setPhone] = useState('');
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [targetCompanyCode, setTargetCompanyCode] = useState<string>(
    () => branchToEdit?.companyCode || currentUser?.companyCode || 'POLATLAR'
  );
  const [companies, setCompanies] = useState<Company[]>([]);

  // Map picker modal state
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [mapPickerAutoSearch, setMapPickerAutoSearch] = useState(false);

  // Geocoding & GPS states
  const [isGettingGps, setIsGettingGps] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    CompanyService.fetchCompanies().then(setCompanies).catch(() => {});
  }, []);

  // Filter users for the target company
  const companyUsers = React.useMemo(() => {
    const code = (targetCompanyCode || currentUser?.companyCode || 'POLATLAR').toUpperCase();
    return users.filter(
      (u) => (u.companyCode || 'POLATLAR').toUpperCase() === code
    );
  }, [users, targetCompanyCode, currentUser]);

  useEffect(() => {
    if (branchToEdit) {
      setTargetCompanyCode(branchToEdit.companyCode || currentUser?.companyCode || 'POLATLAR');
      setName(branchToEdit.name || '');
      setAddress(branchToEdit.address || '');
      setLatitude(branchToEdit.latitude ?? '');
      setLongitude(branchToEdit.longitude ?? '');
      setRadiusMeters(branchToEdit.radiusMeters || 20);
      setPhone(branchToEdit.phone || '');
      setAssignedUserIds(branchToEdit.assignedUserIds || []);
    } else {
      setTargetCompanyCode(currentUser?.companyCode || 'POLATLAR');
      setName('');
      setAddress('');
      setLatitude('');
      setLongitude('');
      setRadiusMeters(20);
      setPhone('');
      setAssignedUserIds([]);
    }
    setErrorMsg('');
  }, [branchToEdit, isOpen, currentUser?.companyCode]);

  if (!isOpen) return null;

  // Open interactive map picker modal
  const handleOpenMapPicker = (autoSearch: boolean = false) => {
    setMapPickerAutoSearch(autoSearch);
    setIsMapPickerOpen(true);
  };

  // Callback when a location is picked on the map
  const handleLocationPicked = (lat: number, lon: number, resolvedAddr?: string) => {
    setLatitude(lat);
    setLongitude(lon);
    if (resolvedAddr && (!address || address.trim().length < 5)) {
      setAddress(resolvedAddr);
    }
    setErrorMsg('');
  };

  // Handle GPS location acquisition
  const handleGetGpsLocation = async () => {
    try {
      setIsGettingGps(true);
      setErrorMsg('');
      const pos = await LocationService.getCurrentPosition();
      setLatitude(pos.latitude);
      setLongitude(pos.longitude);
      if (pos.address && !address) {
        setAddress(pos.address);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Cihazınızdan GPS konumu alınamadı.');
    } finally {
      setIsGettingGps(false);
    }
  };

  // Toggle user assignment
  const handleToggleUser = (userId: string) => {
    setAssignedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Lütfen şube adını girin.');
      return;
    }
    if (latitude === '' || longitude === '') {
      setErrorMsg('Lütfen "Mevcut Konumu Pinle" veya "Adresten Konum Bul" butonu ile şube koordinatlarını belirleyin.');
      return;
    }

    try {
      setIsSaving(true);
      await onSave({
        name: name.trim(),
        address: address.trim(),
        latitude: Number(latitude),
        longitude: Number(longitude),
        radiusMeters: Number(radiusMeters) || 20,
        phone: phone.trim() || undefined,
        assignedUserIds,
        companyCode: targetCompanyCode,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Şube kaydedilirken bir hata oluştu.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-50/50 via-indigo-50/30 to-transparent dark:from-slate-800/50 dark:to-transparent shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                {branchToEdit ? 'Şubeyi Düzenle' : 'Yeni Şube Ekle'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lokasyon pini, 20m mesai alanı ve personel ataması
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 0. Firma / Kurum Seçimi (POLATLAR Yöneticileri için) */}
          {companies.length > 1 && (
            <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60 space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Şubenin Tanımlanacağı Firma / Kurum</span>
              </label>
              <select
                value={targetCompanyCode}
                onChange={(e) => setTargetCompanyCode(e.target.value)}
                disabled={!!branchToEdit}
                className="w-full px-3.5 py-2.5 rounded-xl border border-blue-200 dark:border-blue-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
              >
                {companies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
              <span className="block text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                💡 POLATLAR yöneticisi (admin / murat) olarak diğer firmalar adına da şube tanımlayabilirsiniz.
              </span>
            </div>
          )}

          {/* 1. Şube Adı */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Şube Adı <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Merkez Şube, Kadıköy Şubesi, İkitelli Lojistik Depo"
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-hidden transition-all"
            />
          </div>

          {/* 2. Açık Adres ve Konum Bulma */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Açık Adres & Konum Belirleme
              </label>
              <span className="text-[11px] text-slate-400 font-medium">
                GPS pini veya adres araması ile
              </span>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleOpenMapPicker(true);
                    }
                  }}
                  placeholder="Cadde, sokak, mahalle, ilçe, il..."
                  className="w-full pl-4 pr-24 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-hidden transition-all"
                />
                <button
                  type="button"
                  onClick={() => handleOpenMapPicker(true)}
                  className="absolute right-2 top-2 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title="Google Haritada Aç ve Pinle"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Ara</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                💡 <strong>Google Harita ile Pinleme:</strong> Adres yazıp <strong>Ara</strong>'ya bastığınızda veya <strong>Haritada Seç ve Pinle</strong> butonuna tıkladığınızda interaktif Google Maps haritası açılır; binanın girişini tıklayarak enlem ve boylamı anında kaydedebilirsiniz.
              </p>

              {/* Quick Action Buttons: Google Maps Pin & GPS */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleOpenMapPicker(Boolean(address && address.trim().length > 2))}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all active:scale-95 shadow-xs cursor-pointer"
                >
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span>🗺️ Haritada Seç ve Pinle (Google Maps)</span>
                </button>

                <button
                  type="button"
                  onClick={handleGetGpsLocation}
                  disabled={isGettingGps}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all active:scale-95 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isGettingGps ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  ) : (
                    <Compass className="w-4 h-4 text-emerald-600" />
                  )}
                  <span>🧭 Mevcut Konumumu Pinle (GPS)</span>
                </button>

                {latitude !== '' && longitude !== '' && (
                  <button
                    type="button"
                    onClick={() => LocationService.openInGoogleMaps(address, Number(latitude), Number(longitude))}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Haritada Aç</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 3. Koordinatlar & 20 Metre Mesai Sınırı */}
          <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-slate-800/50 border border-blue-100 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-blue-600" />
                Şube Lokasyon Koordinatları
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-600 text-white shadow-xs flex items-center gap-1">
                20 Metre Mesai Alanı
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Enlem (Latitude) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="Örn: 41.0082"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold font-mono text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Boylam (Longitude) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="Örn: 28.9784"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold font-mono text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Koordinat Belirlendi Bildirimi */}
            {latitude !== '' && longitude !== '' && (
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold">
                    Konum İşaretlendi: <span className="font-mono">{latitude}, {longitude}</span>
                  </span>
                </div>
                <span className="text-[10px] bg-emerald-600 text-white font-black px-2 py-0.5 rounded-md shadow-xs">
                  20 Metre Mesai Alanı Aktif
                </span>
              </div>
            )}

            <div className="flex items-start gap-2 pt-1 text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <span>
                Personel, yalnızca bu koordinatın <strong>20 metre</strong> yarıçapına girdiğinde doğrudan mesaiye başlayabilir. Başka şubede veya dışarıda ise yönetici onayına yönlendirilir.
              </span>
            </div>
          </div>

          {/* 4. Telefon (Opsiyonel) */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Şube Telefonu (Opsiyonel)
            </label>
            <div className="relative">
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Örn: 0212 555 00 00"
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
          </div>

          {/* 5. Personel Atama Bölümü */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" />
                Bu Şubeye Personel Ata ({assignedUserIds.length} Personel Seçildi)
              </label>
              <button
                type="button"
                onClick={() => {
                  if (assignedUserIds.length === companyUsers.length) {
                    setAssignedUserIds([]);
                  } else {
                    setAssignedUserIds(companyUsers.map((u) => u.id));
                  }
                }}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer"
              >
                {assignedUserIds.length === companyUsers.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto space-y-1.5">
              {companyUsers.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">Firma personeli bulunamadı.</p>
              ) : (
                companyUsers.map((u) => {
                  const isSelected = assignedUserIds.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => handleToggleUser(u.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600 dark:bg-slate-700 dark:text-blue-400'
                          }`}
                        >
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold leading-tight">{u.name}</p>
                          <p className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                            @{u.username} • {u.role === 'admin' ? 'Yönetici' : 'Saha Yetkilisi'}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all ${
                          isSelected
                            ? 'bg-white text-blue-600 border-white'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-black transition-all shadow-md shadow-blue-500/25 active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Kaydediliyor...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{branchToEdit ? 'Değişiklikleri Kaydet' : 'Şubeyi Oluştur'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Google Maps Interactive Picker Modal */}
      {isMapPickerOpen && (
        <MapPickerModal
          isOpen={isMapPickerOpen}
          onClose={() => setIsMapPickerOpen(false)}
          initialLat={latitude}
          initialLon={longitude}
          initialAddress={address}
          autoSearchOnOpen={mapPickerAutoSearch}
          onSelectLocation={handleLocationPicked}
        />
      )}
    </div>
  );
};
