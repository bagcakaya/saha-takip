import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  X,
  Search,
  MapPin,
  Compass,
  Check,
  Loader2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { LocationService } from '../../services/locationService';

export interface MapPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLat?: number | '';
  initialLon?: number | '';
  initialAddress?: string;
  autoSearchOnOpen?: boolean;
  onSelectLocation: (lat: number, lon: number, resolvedAddress?: string) => void;
}

type TileType = 'google_roadmap' | 'google_satellite' | 'osm';

const TILE_LAYERS: Record<
  TileType,
  { name: string; url: string; maxZoom: number; attribution: string }
> = {
  google_roadmap: {
    name: 'Google Harita',
    url: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    maxZoom: 20,
    attribution: '&copy; Google Maps',
  },
  google_satellite: {
    name: 'Google Uydu',
    url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    maxZoom: 20,
    attribution: '&copy; Google Maps',
  },
  osm: {
    name: 'Açık Harita (OSM)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  },
};

// Create a custom SVG pin icon
const createPinIcon = () => {
  return L.divIcon({
    className: 'custom-leaflet-pin',
    html: `
      <div style="position: relative; width: 40px; height: 40px; transform: translate(-20px, -40px); cursor: grab;">
        <svg viewBox="0 0 24 24" width="40" height="40" style="filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));">
          <path fill="#ef4444" stroke="#ffffff" stroke-width="1.6" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="3" fill="#ffffff"/>
        </svg>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });
};

export const MapPickerModal: React.FC<MapPickerModalProps> = ({
  isOpen,
  onClose,
  initialLat,
  initialLon,
  initialAddress,
  autoSearchOnOpen,
  onSelectLocation,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  // States
  const [selectedTile, setSelectedTile] = useState<TileType>('google_roadmap');
  const [currentLat, setCurrentLat] = useState<number | null>(
    typeof initialLat === 'number' && !isNaN(initialLat) ? initialLat : null
  );
  const [currentLon, setCurrentLon] = useState<number | null>(
    typeof initialLon === 'number' && !isNaN(initialLon) ? initialLon : null
  );
  const [currentAddress, setCurrentAddress] = useState<string>(initialAddress || '');
  const [searchQuery, setSearchQuery] = useState<string>(initialAddress || '');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Initial location fallback (default to Turkey center if not provided)
  const defaultLat = 39.925533;
  const defaultLon = 32.866287;
  const defaultZoom = currentLat && currentLon ? 18 : 6;

  // Handle address search inside map modal
  const executeSearch = async (queryText: string) => {
    const q = queryText.trim();
    if (!q || q.length < 2) return;

    try {
      setIsSearching(true);
      setSearchError('');
      const results = await LocationService.searchAddress(q);
      if (results && results.length > 0) {
        const best = results[0];
        updatePinnedLocation(best.latitude, best.longitude, best.displayName, true);
      } else {
        setSearchError('Adres koordinatı bulunamadı. Lütfen cadde/mahalle ve ilçe adını kontrol edin.');
      }
    } catch {
      setSearchError('Harita arama servisine ulaşılamadı.');
    } finally {
      setIsSearching(false);
    }
  };

  // Get current user GPS location
  const handleGetGps = async () => {
    try {
      setIsLocating(true);
      setSearchError('');
      const pos = await LocationService.getCurrentPosition();
      updatePinnedLocation(pos.latitude, pos.longitude, pos.address, true);
    } catch (err: any) {
      setSearchError(err?.message || 'GPS konumu alınamadı.');
    } finally {
      setIsLocating(false);
    }
  };

  // Reverse geocode when pin moves
  const fetchAddressForCoordinates = async (lat: number, lon: number) => {
    try {
      setIsReverseGeocoding(true);
      const addr = await LocationService.reverseGeocode(lat, lon);
      if (addr) {
        setCurrentAddress(addr);
      }
    } catch {
      // ignore
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  // Central function to update pin, circle and map position
  const updatePinnedLocation = (
    lat: number,
    lon: number,
    addressText?: string,
    panMap: boolean = true
  ) => {
    setCurrentLat(lat);
    setCurrentLon(lon);
    if (addressText) {
      setCurrentAddress(addressText);
    } else {
      fetchAddressForCoordinates(lat, lon);
    }

    if (mapInstanceRef.current) {
      if (panMap) {
        mapInstanceRef.current.setView([lat, lon], 18, { animate: true });
        mapInstanceRef.current.invalidateSize();
      }

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lon]);
      } else {
        const marker = L.marker([lat, lon], {
          icon: createPinIcon(),
          draggable: true,
        }).addTo(mapInstanceRef.current);

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          updatePinnedLocation(pos.lat, pos.lng, undefined, false);
        });

        markerRef.current = marker;
      }

      // 20 Meter radius perimeter visual circle
      if (circleRef.current) {
        circleRef.current.setLatLng([lat, lon]);
      } else {
        const circle = L.circle([lat, lon], {
          radius: 20,
          color: '#0284c7',
          fillColor: '#38bdf8',
          fillOpacity: 0.25,
          weight: 2,
          dashArray: '4, 6',
        }).addTo(mapInstanceRef.current);
        circleRef.current = circle;
      }
    }
  };

  // Change tile layer (Google Maps / Google Satellite / OSM)
  const switchTileLayer = (type: TileType) => {
    setSelectedTile(type);
    if (mapInstanceRef.current) {
      if (currentTileLayerRef.current) {
        mapInstanceRef.current.removeLayer(currentTileLayerRef.current);
      }
      const provider = TILE_LAYERS[type];
      const newLayer = L.tileLayer(provider.url, {
        maxZoom: provider.maxZoom,
        attribution: provider.attribution,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      }).addTo(mapInstanceRef.current);
      currentTileLayerRef.current = newLayer;
    }
  };

  // Map Initialization
  useEffect(() => {
    if (!isOpen) return;

    const startLat = currentLat || defaultLat;
    const startLon = currentLon || defaultLon;
    const zoom = currentLat && currentLon ? 18 : defaultZoom;

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      // Clean up previous instance if any
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {
          // ignore
        }
        mapInstanceRef.current = null;
      }

      // Clear leaflet id if container was previously assigned
      if (mapContainerRef.current && (mapContainerRef.current as any)._leaflet_id) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }

      let map: L.Map;
      try {
        map = L.map(mapContainerRef.current, {
          center: [startLat, startLon],
          zoom: zoom,
          zoomControl: false,
        });
      } catch (err) {
        console.error('Leaflet map initialization error:', err);
        return;
      }

      // Custom zoom control in bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Tile layer
      const provider = TILE_LAYERS[selectedTile];
      const tileLayer = L.tileLayer(provider.url, {
        maxZoom: provider.maxZoom,
        attribution: provider.attribution,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      });
      tileLayer.addTo(map);

      currentTileLayerRef.current = tileLayer;
      mapInstanceRef.current = map;

      // Map Click Handler: Click anywhere to move the pin!
      map.on('click', (e: L.LeafletMouseEvent) => {
        updatePinnedLocation(e.latlng.lat, e.latlng.lng, undefined, false);
      });

      // If autoSearchOnOpen is active and address exists, search address immediately
      if (autoSearchOnOpen && initialAddress && initialAddress.trim().length > 2) {
        executeSearch(initialAddress);
      } else if (currentLat && currentLon) {
        // If initial coordinates exist, place pin and circle
        const marker = L.marker([currentLat, currentLon], {
          icon: createPinIcon(),
          draggable: true,
        }).addTo(map);

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          updatePinnedLocation(pos.lat, pos.lng, undefined, false);
        });

        markerRef.current = marker;

        const circle = L.circle([currentLat, currentLon], {
          radius: 20,
          color: '#0284c7',
          fillColor: '#38bdf8',
          fillOpacity: 0.25,
          weight: 2,
          dashArray: '4, 6',
        }).addTo(map);

        circleRef.current = circle;
      } else if (initialAddress && initialAddress.trim().length > 2) {
        // Auto-search initial address if no coordinates
        executeSearch(initialAddress);
      }

      // Invalidate size in multiple stages to guarantee full rendering on mobile
      map.invalidateSize();
      setTimeout(() => map.invalidateSize(), 150);
      setTimeout(() => map.invalidateSize(), 400);
      setTimeout(() => map.invalidateSize(), 800);
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {
          // ignore
        }
        mapInstanceRef.current = null;
      }
      markerRef.current = null;
      circleRef.current = null;
      currentTileLayerRef.current = null;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!currentLat || !currentLon) {
      alert('Lütfen önce haritaya tıklayarak veya arama yaparak bir konum pinleyin.');
      return;
    }
    onSelectLocation(currentLat, currentLon, currentAddress);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-blue-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white truncate flex items-center gap-2">
                <span>Google Harita ile Şube Konumu Pinleme</span>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Canlı 20m Geofence
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Adres arayın veya haritada şubenin giriş kapısını tıklayarak pinleyin
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Action Bar */}
        <div className="p-3 sm:p-4 bg-slate-900/95 border-b border-slate-800 space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              executeSearch(searchQuery);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cadde, sokak, mahalle, ilçe veya koordinat yazın..."
                className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>Haritada Bul</span>
            </button>

            <button
              type="button"
              onClick={handleGetGps}
              disabled={isLocating}
              className="px-3 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 active:scale-95 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              title="Cihazınızın anlık GPS konumuna git"
            >
              {isLocating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Compass className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Mevcut Konumum</span>
            </button>
          </form>

          {searchError && (
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-400 bg-rose-950/40 p-2 rounded-xl border border-rose-900/50">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}
        </div>

        {/* Map Container Area */}
        <div
          className="relative w-full bg-slate-900 overflow-hidden"
          style={{ height: '400px', minHeight: '380px' }}
        >
          <div
            ref={mapContainerRef}
            className="w-full h-full z-10"
            style={{
              height: '400px',
              minHeight: '380px',
              width: '100%',
              position: 'relative',
              backgroundColor: '#e2e8f0',
            }}
          />

          {/* Floating Map Layer Switcher (Top Right) */}
          <div
            className="absolute top-3 right-3 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-2xl border border-slate-700/80 shadow-lg text-[11px] font-bold"
            style={{ zIndex: 1000 }}
          >
            <button
              type="button"
              onClick={() => switchTileLayer('google_roadmap')}
              className={`px-2.5 py-1.5 rounded-xl transition-all ${
                selectedTile === 'google_roadmap'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              🗺️ Google Harita
            </button>
            <button
              type="button"
              onClick={() => switchTileLayer('google_satellite')}
              className={`px-2.5 py-1.5 rounded-xl transition-all ${
                selectedTile === 'google_satellite'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              🛰️ Google Uydu
            </button>
            <button
              type="button"
              onClick={() => switchTileLayer('osm')}
              className={`px-2.5 py-1.5 rounded-xl transition-all ${
                selectedTile === 'osm'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              🌐 OSM
            </button>
          </div>

          {/* Floating Tip Badge (Top Left) */}
          <div className="absolute top-3 left-3 z-20 hidden sm:flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-700/80 text-[11px] text-slate-300 shadow-md">
            <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
            <span>Pini sürükleyin veya haritada istediğiniz binaya tıklayın</span>
          </div>
        </div>

        {/* Footer Info & Actions Bar */}
        <div className="p-3.5 sm:p-5 bg-slate-900 border-t border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            {/* Selected Coordinates & 20m Radius Badge */}
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-white flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  Pinlenen Koordinat:
                </span>
                {currentLat && currentLon ? (
                  <span className="font-mono font-bold text-blue-400 bg-blue-950/60 px-2.5 py-0.5 rounded-lg border border-blue-900/60">
                    {currentLat.toFixed(6)}, {currentLon.toFixed(6)}
                  </span>
                ) : (
                  <span className="text-amber-400 font-semibold italic">
                    Henüz haritada nokta seçilmedi
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-md font-black bg-blue-600/30 text-blue-300 border border-blue-500/40 text-[10px]">
                  Çap: 20 Metre
                </span>
              </div>

              {/* Resolved Address text */}
              <div className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                {isReverseGeocoding ? (
                  <span className="inline-flex items-center gap-1 text-slate-400">
                    <Loader2 className="w-3 h-3 animate-spin" /> Adres tespit ediliyor...
                  </span>
                ) : (
                  <span>
                    Adres: <strong className="text-slate-200">{currentAddress || 'Haritada bir noktaya tıklayın'}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
              >
                İptal
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={!currentLat || !currentLon}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>Bu Konumu Seç & Koordinatları Aktar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
