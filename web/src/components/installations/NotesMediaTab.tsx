import React, { useRef, useState } from 'react';
import {
  MapPin,
  Compass,
  CheckCircle2,
  Camera,
  Image as ImageIcon,
  X,
  Loader2,
} from 'lucide-react';
import { LocationItem } from '../../types/storage';
import { LocationService } from '../../services/locationService';

interface NotesMediaTabProps {
  location: LocationItem;
  onUpdateDetails: (
    address: string,
    notes: string,
    lat?: number,
    lon?: number,
    name?: string
  ) => void;
  onAddPhoto: (photoDataUrl: string) => void;
  onDeletePhoto: (photoDataUrl: string) => void;
  onPreviewPhoto: (photoDataUrl: string) => void;
}

export const NotesMediaTab: React.FC<NotesMediaTabProps> = ({
  location,
  onUpdateDetails,
  onAddPhoto,
  onDeletePhoto,
  onPreviewPhoto,
}) => {
  const [nameText, setNameText] = useState(location.name || '');
  const [addressText, setAddressText] = useState(location.address || '');
  const [notesText, setNotesText] = useState(location.notes || '');
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Helper to save text metadata
  const saveDetails = () => {
    onUpdateDetails(
      addressText,
      notesText,
      location.latitude,
      location.longitude,
      nameText
    );
  };

  // GPS Location handler
  const handleGetLocation = async () => {
    try {
      setIsFetchingLocation(true);
      const res = await LocationService.getCurrentPosition();
      setAddressText(res.address || '');
      onUpdateDetails(
        res.address || '',
        notesText,
        res.latitude,
        res.longitude,
        nameText
      );
    } catch (err: any) {
      alert(err?.message || 'Konum alınamadı.');
    } finally {
      setIsFetchingLocation(false);
    }
  };

  // Google Maps handler
  const handleOpenMap = () => {
    LocationService.openInGoogleMaps(
      addressText,
      location.latitude,
      location.longitude
    );
  };

  // Image compressor and converter to base64
  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Scale down image max dimension to 1400px to keep storage light and fast
          const maxDim = 1400;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      try {
        const dataUrl = await processImageFile(files[i]);
        onAddPhoto(dataUrl);
      } catch (err) {
        console.error('Fotoğraf yüklenemedi:', err);
      }
    }
    // reset input
    e.target.value = '';
  };

  const photos = location.photos || [];

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      {/* 1. Location Name */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
          Firma / Lokasyon Adı
        </label>
        <input
          type="text"
          value={nameText}
          onChange={(e) => setNameText(e.target.value)}
          onBlur={saveDetails}
          placeholder="Firma veya Lokasyon adı girin..."
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm font-medium"
        />
      </div>

      {/* 2. Installation Address */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
          Kurulum Adresi
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
            onBlur={saveDetails}
            placeholder="Firma / Kurulum adresi veya koordinatı..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm font-medium"
          />

          {/* GPS Button */}
          <button
            type="button"
            onClick={handleGetLocation}
            disabled={isFetchingLocation}
            className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 transition-colors disabled:opacity-50 shrink-0"
            title="GPS ile Anlık Konumu Al"
            aria-label="Konum Al"
          >
            {isFetchingLocation ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Compass className="w-5 h-5" />
            )}
          </button>

          {/* Map Button */}
          <button
            type="button"
            onClick={handleOpenMap}
            disabled={!addressText.trim() && !location.latitude}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-40 shrink-0"
            title="Haritada Göster"
            aria-label="Haritada Göster"
          >
            <MapPin className="w-5 h-5" />
          </button>
        </div>

        {/* GPS Badge */}
        {location.latitude && location.longitude && (
          <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              Coğrafi konum işaretlendi ({location.latitude.toFixed(5)},{' '}
              {location.longitude.toFixed(5)})
            </span>
          </div>
        )}
      </div>

      {/* 3. Notes Section */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
          Müşteri ve Bağlantı Notları
        </label>
        <textarea
          rows={4}
          value={notesText}
          onChange={(e) => setNotesText(e.target.value)}
          onBlur={saveDetails}
          placeholder="Sunucu IP'leri, Wi-Fi şifreleri, yetkili kişi iletişim bilgileri ve diğer kurulum notları..."
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm font-medium resize-none"
        />
      </div>

      {/* 4. Photos Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Fotoğraflar
          </label>
          <span className="text-xs font-semibold text-slate-400">
            {photos.length} Adet
          </span>
        </div>

        {/* Hidden inputs */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={cameraInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          type="file"
          accept="image/*"
          multiple
          ref={galleryInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors"
          >
            <Camera className="w-4 h-4 text-blue-500" />
            <span>Fotoğraf Çek</span>
          </button>

          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors"
          >
            <ImageIcon className="w-4 h-4 text-emerald-500" />
            <span>Galeriden Seç</span>
          </button>
        </div>

        {/* Photos Grid */}
        {photos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photos.map((photoUri, idx) => (
              <div
                key={idx}
                className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group"
              >
                <img
                  src={photoUri}
                  alt={`Kurulum Fotoğrafı ${idx + 1}`}
                  onClick={() => onPreviewPhoto(photoUri)}
                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Bu fotoğrafı silmek istediğinize emin misiniz?')) {
                      onDeletePhoto(photoUri);
                    }
                  }}
                  className="absolute top-1 right-1 p-1 bg-red-600/90 text-white rounded-full opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-700"
                  title="Fotoğrafı Sil"
                  aria-label="Fotoğrafı Sil"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
