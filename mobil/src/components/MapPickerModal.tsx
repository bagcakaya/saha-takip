import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import {
  X,
  MapPin,
  Search,
  Compass,
  Check,
  Building2,
} from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { LocationService } from '../services/locationService';
import { useAppTheme } from '../context/ThemeContext';

export interface MapPickerLocation {
  latitude: number;
  longitude: number;
  address: string;
}

interface MapPickerModalProps {
  visible: boolean;
  onClose: () => void;
  initialLatitude?: number | string;
  initialLongitude?: number | string;
  initialAddress?: string;
  onSelectLocation: (loc: MapPickerLocation) => void;
}

export const MapPickerModal: React.FC<MapPickerModalProps> = ({
  visible,
  onClose,
  initialLatitude,
  initialLongitude,
  initialAddress,
  onSelectLocation,
}) => {
  const { isDark } = useAppTheme();

  const parsedLat = parseFloat(String(initialLatitude || ''));
  const parsedLon = parseFloat(String(initialLongitude || ''));

  const defaultLat = !isNaN(parsedLat) && parsedLat !== 0 ? parsedLat : 41.0082; // İstanbul default
  const defaultLon = !isNaN(parsedLon) && parsedLon !== 0 ? parsedLon : 28.9784;

  const [selectedLat, setSelectedLat] = useState<number>(defaultLat);
  const [selectedLon, setSelectedLon] = useState<number>(defaultLon);
  const [selectedAddress, setSelectedAddress] = useState<string>(initialAddress || '');
  const [searchQuery, setSearchQuery] = useState<string>(initialAddress || '');
  const [isSearching, setIsSearching] = useState(false);
  const [isGettingGps, setIsGettingGps] = useState(false);
  const iframeRef = useRef<any>(null);
  const webViewRef = useRef<any>(null);

  // Sync initial props on open
  useEffect(() => {
    if (visible) {
      const lat = !isNaN(parsedLat) && parsedLat !== 0 ? parsedLat : 41.0082;
      const lon = !isNaN(parsedLon) && parsedLon !== 0 ? parsedLon : 28.9784;
      setSelectedLat(lat);
      setSelectedLon(lon);
      setSelectedAddress(initialAddress || '');
      setSearchQuery(initialAddress || '');
    }
  }, [visible, initialLatitude, initialLongitude, initialAddress]);

  // Helper to send commands into Leaflet map (works on both web iframe and native WebView)
  const sendMapCommand = (lat: number, lon: number, address?: string) => {
    const payload = {
      type: 'SET_MAP_VIEW',
      lat,
      lon,
      address,
    };
    if (Platform.OS === 'web') {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(payload, '*');
      }
    } else {
      if (webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify(payload));
      }
    }
  };

  // Listen to postMessage from embedded Leaflet map (Web iframe)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const raw = event.data;
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (data && data.type === 'MAP_PIN_SELECTED') {
          const lat = Number(data.lat);
          const lon = Number(data.lon);
          if (!isNaN(lat) && !isNaN(lon)) {
            setSelectedLat(lat);
            setSelectedLon(lon);
          }
          if (data.address) {
            setSelectedAddress(data.address);
            setSearchQuery(data.address);
          }
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Handle messages from native WebView (iOS / Android / Expo Go)
  const handleWebViewMessage = (event: any) => {
    try {
      const raw = event.nativeEvent?.data;
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (data && data.type === 'MAP_PIN_SELECTED') {
        const lat = Number(data.lat);
        const lon = Number(data.lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          setSelectedLat(lat);
          setSelectedLon(lon);
        }
        if (data.address) {
          setSelectedAddress(data.address);
          setSearchQuery(data.address);
        }
      }
    } catch (err) {
      console.warn('Map WebView message parse error:', err);
    }
  };

  // Search Address
  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q || q.length < 2) return;

    try {
      setIsSearching(true);
      const results = await LocationService.searchAddress(q);
      if (results && results.length > 0) {
        const best = results[0];
        setSelectedLat(best.latitude);
        setSelectedLon(best.longitude);
        setSelectedAddress(best.displayName);

        // Send to map
        sendMapCommand(best.latitude, best.longitude, best.displayName);
      } else {
        Alert.alert('Bulunamadı', 'Girilen adres haritada bulunamadı. Lütfen cadde, ilçe veya il adını kontrol edin.');
      }
    } catch {
      Alert.alert('Hata', 'Harita arama servisine bağlanılamadı.');
    } finally {
      setIsSearching(false);
    }
  };

  // Get current GPS position
  const handleGetGps = async () => {
    try {
      setIsGettingGps(true);
      const pos = await LocationService.getCurrentPosition();
      setSelectedLat(pos.latitude);
      setSelectedLon(pos.longitude);
      if (pos.address) {
        setSelectedAddress(pos.address);
        setSearchQuery(pos.address);
      }

      // Send to map
      sendMapCommand(pos.latitude, pos.longitude, pos.address);
    } catch (err: any) {
      Alert.alert('GPS Hatası', err?.message || 'Cihaz GPS konumu alınamadı.');
    } finally {
      setIsGettingGps(false);
    }
  };

  // Confirm selection
  const handleConfirm = () => {
    onSelectLocation({
      latitude: selectedLat,
      longitude: selectedLon,
      address: selectedAddress || `${selectedLat.toFixed(6)}, ${selectedLon.toFixed(6)}`,
    });
    onClose();
  };

  // HTML content for isolated Leaflet map inside iframe
  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body, #map { width: 100%; height: 100%; background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .leaflet-container { background: #1e293b !important; }
        .custom-pin {
          position: relative;
          width: 38px;
          height: 38px;
          cursor: grab;
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5));
        }
        .layer-selector {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 1000;
          background: rgba(15, 23, 42, 0.9);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          padding: 4px;
          display: flex;
          gap: 4px;
        }
        .layer-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 11px;
          font-weight: 700;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .layer-btn.active {
          background: #2563eb;
          color: #ffffff;
        }
        .info-pill {
          position: absolute;
          bottom: 14px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;
          background: rgba(15, 23, 42, 0.88);
          color: #ffffff;
          font-size: 11px;
          font-weight: 600;
          padding: 6px 14px;
          border-radius: 20px;
          border: 1px solid rgba(59, 130, 246, 0.4);
          pointer-events: none;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <div class="layer-selector">
        <button class="layer-btn active" id="btn-road" onclick="switchLayer('road')">Google Harita</button>
        <button class="layer-btn" id="btn-sat" onclick="switchLayer('sat')">Google Uydu</button>
        <button class="layer-btn" id="btn-osm" onclick="switchLayer('osm')">Açık Harita</button>
      </div>
      <div class="info-pill">📍 Haritaya dokunarak pin bırakabilirsiniz (20m Mesai Çemberi)</div>

      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        var initialLat = ${selectedLat};
        var initialLon = ${selectedLon};

        var layers = {
          road: L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
          }),
          sat: L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
          }),
          osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
          })
        };

        var map = L.map('map', {
          center: [initialLat, initialLon],
          zoom: 17,
          zoomControl: false
        });

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        var currentLayer = layers.road;
        currentLayer.addTo(map);

        function switchLayer(name) {
          map.removeLayer(currentLayer);
          currentLayer = layers[name];
          currentLayer.addTo(map);
          document.querySelectorAll('.layer-btn').forEach(function(b) { b.classList.remove('active'); });
          document.getElementById('btn-' + name).classList.add('active');
        }

        var pinIcon = L.divIcon({
          className: 'custom-pin-wrapper',
          html: '<div class="custom-pin"><svg viewBox="0 0 24 24" width="38" height="38"><path fill="#ef4444" stroke="#ffffff" stroke-width="1.8" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="3.2" fill="#ffffff"/></svg></div>',
          iconSize: [38, 38],
          iconAnchor: [19, 38]
        });

        var marker = L.marker([initialLat, initialLon], {
          icon: pinIcon,
          draggable: true
        }).addTo(map);

        var circle = L.circle([initialLat, initialLon], {
          radius: 20,
          color: '#3b82f6',
          fillColor: '#60a5fa',
          fillOpacity: 0.25,
          weight: 2.5,
          dashArray: '5, 5'
        }).addTo(map);

        function reverseGeocode(lat, lon, callback) {
          fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lon + '&addressdetails=1', {
            headers: { 'Accept-Language': 'tr' }
          })
          .then(function(res) { return res.json(); })
          .then(function(data) {
            if (data && (data.address || data.display_name)) {
              var a = data.address || {};
              var disp = data.display_name || '';
              var dispParts = disp.split(',').map(function(s) { return s.trim(); });

              // 1. Search for official administrative mahalle ending in Mahallesi/Mah./Mh.
              var officialMahalle = '';
              for (var i = 0; i < dispParts.length; i++) {
                if (/(?:mahallesi|mah\.|mh\.)$/i.test(dispParts[i])) {
                  officialMahalle = dispParts[i];
                  break;
                }
              }

              // 2. Road / Street
              var road = a.road || a.pedestrian || a.street || '';
              if (!road && dispParts.length > 0) {
                var first = dispParts[0];
                if (first && !/(?:mahallesi|mah\.|mh\.|türkiye|erzurum|palandöken|yakutiye)$/i.test(first) && first !== a.suburb && first !== a.town && first !== a.city) {
                  road = first;
                }
              }

              // 3. Mahalle (Prefer official administrative Mahalle if present)
              var mahalle = officialMahalle || a.neighbourhood || a.suburb || a.quarter || '';
              if (officialMahalle) {
                mahalle = officialMahalle;
              }
              // Erzurum Palandöken rule: if suburb returned Müftü Solakzade but area is Hüseyin Avni Ulaş
              if (mahalle.indexOf('Müftü Solakzade') !== -1 && disp.indexOf('Hüseyin Avni Ulaş') !== -1) {
                mahalle = 'Hüseyin Avni Ulaş Mahallesi';
              }

              // 4. District / İlçe
              var district = a.district || a.town || a.county || a.subregion || '';

              // 5. Province / City
              var city = a.province || a.city || a.state || '';

              var parts = [];
              [road, mahalle, district, city].forEach(function(p) {
                if (p && !parts.some(function(e) { return e.toLowerCase() === p.toLowerCase(); })) {
                  parts.push(p);
                }
              });

              callback(parts.length > 0 ? parts.join(', ') : (disp || ''));
            } else {
              callback('');
            }
          })
          .catch(function() { callback(''); });
        }

        function notifyHost(lat, lon, addr) {
          var payload = {
            type: 'MAP_PIN_SELECTED',
            lat: lat,
            lon: lon,
            address: addr || (lat.toFixed(6) + ', ' + lon.toFixed(6))
          };
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          }
          if (window.parent && window.parent.postMessage) {
            window.parent.postMessage(payload, '*');
          }
        }

        function updatePin(lat, lon, explicitAddress, pan) {
          marker.setLatLng([lat, lon]);
          circle.setLatLng([lat, lon]);
          if (pan) {
            map.setView([lat, lon], 17, { animate: true });
          }

          if (explicitAddress) {
            notifyHost(lat, lon, explicitAddress);
          } else {
            reverseGeocode(lat, lon, function(addr) {
              notifyHost(lat, lon, addr);
            });
          }
        }

        map.on('click', function(e) {
          updatePin(e.latlng.lat, e.latlng.lng, null, false);
        });

        marker.on('dragend', function() {
          var p = marker.getLatLng();
          updatePin(p.lat, p.lng, null, false);
        });

        function handleIncomingMessage(raw) {
          var data = raw;
          if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch(e){}
          }
          if (data && data.type === 'SET_MAP_VIEW') {
            updatePin(data.lat, data.lon, data.address, true);
          }
        }

        window.addEventListener('message', function(event) {
          handleIncomingMessage(event.data);
        });
        document.addEventListener('message', function(event) {
          handleIncomingMessage(event.data);
        });
      </script>
    </body>
    </html>
  `;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: isDark ? '#0b1329' : '#ffffff' },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIconCircle, { backgroundColor: '#2563eb' }]}>
                <MapPin size={20} color="#ffffff" />
              </View>
              <View>
                <Text style={[styles.title, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                  Haritada Konum Seç ve Pinle
                </Text>
                <Text style={styles.subtitle}>
                  Haritaya dokunarak şube merkezini ve 20m mesai alanını belirleyin
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={20} color={isDark ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
          </View>

          {/* Search & GPS Bar */}
          <View style={[styles.searchBarRow, { backgroundColor: isDark ? '#080d1a' : '#f8fafc' }]}>
            <View style={[styles.searchInputContainer, { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: isDark ? '#1e293b' : '#cbd5e1' }]}>
              <Search size={16} color="#64748b" />
              <TextInput
                style={[styles.searchInput, { color: isDark ? '#ffffff' : '#0f172a' }]}
                placeholder="Adres, cadde, mahalle veya ilçe ara..."
                placeholderTextColor="#64748b"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              <TouchableOpacity
                style={styles.searchActionBtn}
                onPress={handleSearch}
                disabled={isSearching}
                activeOpacity={0.8}
              >
                {isSearching ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.searchActionBtnText}>Ara</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.gpsBtn}
              onPress={handleGetGps}
              disabled={isGettingGps}
              activeOpacity={0.8}
            >
              {isGettingGps ? (
                <ActivityIndicator size="small" color="#10b981" />
              ) : (
                <>
                  <Compass size={16} color="#10b981" />
                  <Text style={styles.gpsBtnText}>GPS Konumum</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Interactive Map Area */}
          <View style={styles.mapContainer}>
            {Platform.OS === 'web' ? (
              <iframe
                ref={iframeRef}
                srcDoc={mapHtml}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
                title="Harita Seçici"
              />
            ) : (
              <WebView
                ref={webViewRef}
                source={{ html: mapHtml }}
                style={styles.webView}
                onMessage={handleWebViewMessage}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                originWhitelist={['*']}
                mixedContentMode="always"
                allowFileAccess={true}
                scalesPageToFit={false}
              />
            )}
          </View>

          {/* Bottom Info & Action Bar */}
          <View
            style={[
              styles.footer,
              {
                backgroundColor: isDark ? '#080d1a' : '#f8fafc',
                borderTopColor: isDark ? '#1e293b' : '#e2e8f0',
              },
            ]}
          >
            {/* Selected Address Display */}
            <View
              style={[
                styles.selectedCard,
                {
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  borderColor: isDark ? '#1e293b' : '#cbd5e1',
                },
              ]}
            >
              <View style={styles.selectedHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, flex: 1 }}>
                  <MapPin size={16} color="#ef4444" style={{ marginTop: 2 }} />
                  <TextInput
                    style={[
                      styles.selectedAddressInput,
                      { color: isDark ? '#ffffff' : '#0f172a' },
                    ]}
                    value={selectedAddress}
                    onChangeText={(val) => {
                      setSelectedAddress(val);
                      setSearchQuery(val);
                    }}
                    placeholder="Haritada bir nokta seçin veya adresi düzenleyin..."
                    placeholderTextColor="#64748b"
                    multiline
                  />
                </View>
                <View style={styles.radiusPill}>
                  <Text style={styles.radiusPillText}>20m Mesai Alanı</Text>
                </View>
              </View>

              <View style={styles.coordsRow}>
                <Text style={styles.coordsText}>
                  <Text style={{ fontWeight: '700', color: '#60a5fa' }}>Enlem: </Text>
                  {selectedLat.toFixed(6)}
                </Text>
                <Text style={styles.coordsText}>
                  <Text style={{ fontWeight: '700', color: '#60a5fa' }}>Boylam: </Text>
                  {selectedLon.toFixed(6)}
                </Text>
              </View>
            </View>

            {/* Buttons */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[
                  styles.cancelBtn,
                  { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' },
                ]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelBtnText, { color: isDark ? '#cbd5e1' : '#475569' }]}>
                  Vazgeç
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirm}
                activeOpacity={0.85}
              >
                <Check size={18} color="#ffffff" />
                <Text style={styles.confirmBtnText}>Bu Konumu Seç ve Şubeye Aktar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  modalContent: {
    width: '100%',
    maxWidth: 700,
    height: '92%',
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(100, 116, 139, 0.12)',
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    flexWrap: 'wrap',
  },
  searchInputContainer: {
    flex: 1,
    minWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: 10,
    paddingRight: 4,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  searchActionBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchActionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
  },
  gpsBtnText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '800',
  },
  mapContainer: {
    flex: 1,
    width: '100%',
    position: 'relative',
    backgroundColor: '#0f172a',
  },
  webView: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#0f172a',
  },
  fallbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  fallbackText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 360,
  },
  footer: {
    padding: 14,
    borderTopWidth: 1,
    gap: 10,
  },
  selectedCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  selectedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  selectedAddressText: {
    fontSize: 13,
    fontWeight: '700',
  },
  selectedAddressInput: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    padding: 0,
    margin: 0,
  },
  radiusPill: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  radiusPillText: {
    color: '#3b82f6',
    fontSize: 10,
    fontWeight: '800',
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 2,
  },
  coordsText: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
});
