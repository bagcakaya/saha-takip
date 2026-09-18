import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
} from 'react-native';
import {
  X,
  Building2,
  MapPin,
  Compass,
  FileText,
  Camera,
  ImageIcon,
  Check,
  ChevronDown,
  Search,
  MessageSquare,
} from 'lucide-react-native';
import { useStorage } from '../context/StorageContext';
import { useAppTheme } from '../context/ThemeContext';
import { LocationService } from '../services/locationService';
import { ImageService } from '../services/imageService';

interface AddServiceModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AddServiceModal({ visible, onClose }: AddServiceModalProps) {
  const { addService, cariler } = useStorage();
  const { isDark } = useAppTheme();

  const [companyName, setCompanyName] = useState('');
  const [selectedCari, setSelectedCari] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [workDone, setWorkDone] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);

  // Cari Picker Modal state
  const [isCariPickerOpen, setIsCariPickerOpen] = useState(false);
  const [cariSearch, setCariSearch] = useState('');

  const [loadingGps, setLoadingGps] = useState(false);
  const [saving, setSaving] = useState(false);

  const filteredCariler = React.useMemo(() => {
    if (!cariSearch.trim()) return cariler.slice(0, 50);
    const q = cariSearch.toLowerCase();
    return cariler.filter((c) => c.toLowerCase().includes(q)).slice(0, 50);
  }, [cariler, cariSearch]);

  const handleGetCurrentLocation = async () => {
    setLoadingGps(true);
    try {
      const pos = await LocationService.getCurrentPosition();
      setLatitude(pos.latitude);
      setLongitude(pos.longitude);
      if (pos.address) {
        setLocation(pos.address);
      } else {
        setLocation(`${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)}`);
      }
    } catch (e: any) {
      Alert.alert('Konum Hatası', e?.message || 'GPS konumu alınamadı.');
    } finally {
      setLoadingGps(false);
    }
  };

  const handleOpenMap = () => {
    if (latitude && longitude) {
      LocationService.openInMaps(location, latitude, longitude);
    } else if (location.trim()) {
      LocationService.openInMaps(location.trim());
    } else {
      Alert.alert('Bilgi', 'Haritada açmak için önce adres veya koordinat girin.');
    }
  };

  const handleTakePhoto = async () => {
    const photo = await ImageService.takePhoto();
    if (photo) {
      setPhotos((prev) => [...prev, photo]);
    }
  };

  const handlePickPhoto = async () => {
    const photo = await ImageService.pickImage();
    if (photo) {
      setPhotos((prev) => [...prev, photo]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setCompanyName('');
    setSelectedCari('');
    setLocation('');
    setLatitude(undefined);
    setLongitude(undefined);
    setWorkDone('');
    setPhotos([]);
    setNotifyWhatsApp(true);
    setCariSearch('');
  };

  const handleSave = async () => {
    if (!companyName.trim()) {
      Alert.alert('Eksik Alan', 'Lütfen Firma / Müşteri Adı girin.');
      return;
    }
    if (!workDone.trim()) {
      Alert.alert('Eksik Alan', 'Lütfen Yapılan İş / Servis Notu alanını doldurun.');
      return;
    }

    setSaving(true);
    try {
      const res = await addService({
        companyName: companyName.trim(),
        cariName: selectedCari.trim() || undefined,
        location: location.trim() || undefined,
        latitude,
        longitude,
        workDone: workDone.trim(),
        photos,
      });

      if (res.success) {
        if (notifyWhatsApp) {
          const dateStr = new Date().toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          });
          const message =
            `*TEKNİK SERVİS RAPORU*\n` +
            `🏢 *Firma:* ${companyName.trim()}\n` +
            (selectedCari ? `👤 *Cari:* ${selectedCari}\n` : '') +
            (location ? `📍 *Adres:* ${location.trim()}\n` : '') +
            `📅 *Tarih:* ${dateStr}\n` +
            `🛠️ *Yapılan İşlemler:*\n${workDone.trim()}\n\n` +
            `_İş Takip Portalı Üzerinden İletilmiştir._`;

          const encoded = encodeURIComponent(message);
          const waUrl = `whatsapp://send?text=${encoded}`;

          Linking.canOpenURL(waUrl)
            .then((supported) => {
              if (supported) {
                Linking.openURL(waUrl);
              } else {
                Linking.openURL(`https://api.whatsapp.com/send?text=${encoded}`);
              }
            })
            .catch(() => {});
        }

        resetForm();
        onClose();
      } else {
        Alert.alert('Hata', res.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Yeni Servis Ekle</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
            >
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* 1. İlgili Cari / Müşteri Card (Görsel-3) */}
            <View style={styles.cariCard}>
              <View style={styles.fieldHeaderRow}>
                <Building2 size={16} color="#3b82f6" />
                <Text style={styles.cariCardTitle}>İLGİLİ CARİ / MÜŞTERİ (İSTEĞE BAĞLI)</Text>
              </View>

              <TouchableOpacity
                style={styles.cariDropdown}
                onPress={() => setIsCariPickerOpen(true)}
                activeOpacity={0.8}
              >
                <View style={styles.cariIconBox}>
                  <Building2 size={18} color="#94a3b8" />
                </View>
                <Text
                  style={[
                    styles.cariDropdownText,
                    selectedCari ? styles.cariSelectedText : null,
                  ]}
                  numberOfLines={1}
                >
                  {selectedCari || 'Açılan listeden cari seçin veya arayın...'}
                </Text>
                <ChevronDown size={18} color="#94a3b8" />
              </TouchableOpacity>

              <Text style={styles.cariHelpText}>
                💡 İsteğe bağlıdır. Cari seçilmezse boş geçilir; seçilirse personele en üstte gösterilir.
              </Text>
            </View>

            {/* 2. Firma / Müşteri Adı (Görsel-3) */}
            <View style={styles.fieldSection}>
              <View style={styles.fieldHeaderRow}>
                <Building2 size={16} color="#f97316" />
                <Text style={styles.fieldTitle}>FİRMA / MÜŞTERİ ADI *</Text>
              </View>
              <TextInput
                style={styles.textInput}
                placeholder="Örn: 12 YAZILIM, ADA CAFE..."
                placeholderTextColor="#64748b"
                value={companyName}
                onChangeText={setCompanyName}
              />
            </View>

            {/* 3. Lokasyon / Adres (Görsel-3) */}
            <View style={styles.fieldSection}>
              <View style={styles.fieldHeaderRow}>
                <MapPin size={16} color="#f97316" />
                <Text style={styles.fieldTitle}>LOKASYON / ADRES</Text>
              </View>
              <View style={styles.locationRow}>
                <TextInput
                  style={[styles.textInput, styles.locationInput]}
                  placeholder="Firma / Kurulum adresi veya koordinatı..."
                  placeholderTextColor="#64748b"
                  value={location}
                  onChangeText={setLocation}
                />
                <TouchableOpacity
                  style={styles.gpsBtn}
                  onPress={handleGetCurrentLocation}
                  disabled={loadingGps}
                  activeOpacity={0.8}
                >
                  {loadingGps ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Compass size={18} color="#ffffff" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mapBtn}
                  onPress={handleOpenMap}
                  activeOpacity={0.8}
                >
                  <MapPin size={18} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>

            {/* 4. Yapılan İş / Servis Notu (Görsel-3) */}
            <View style={styles.fieldSection}>
              <View style={styles.fieldHeaderRow}>
                <FileText size={16} color="#f97316" />
                <Text style={styles.fieldTitle}>YAPILAN İŞ / SERVİS NOTU *</Text>
              </View>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Serviste yapılan işlemleri, değişen parçaları ve detayları buraya yazın..."
                placeholderTextColor="#64748b"
                value={workDone}
                onChangeText={setWorkDone}
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* 5. Servis Fotoğrafları (Görsel-3) */}
            <View style={styles.photosSection}>
              <Text style={styles.photosLabel}>
                SERVİS FOTOĞRAFLARI ({photos.length})
              </Text>
              <View style={styles.photoButtonsRow}>
                <TouchableOpacity
                  style={styles.cameraBtn}
                  onPress={handleTakePhoto}
                  activeOpacity={0.8}
                >
                  <Camera size={16} color="#f97316" />
                  <Text style={styles.cameraBtnText}>Kamera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.galleryBtn}
                  onPress={handlePickPhoto}
                  activeOpacity={0.8}
                >
                  <ImageIcon size={16} color="#94a3b8" />
                  <Text style={styles.galleryBtnText}>Galeri</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Photo Thumbnails */}
            {photos.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.thumbnailsScroll}
              >
                {photos.map((uri, index) => (
                  <View key={index} style={styles.thumbnailContainer}>
                    <Image source={{ uri }} style={styles.thumbnail} />
                    <TouchableOpacity
                      style={styles.removePhotoBtn}
                      onPress={() => handleRemovePhoto(index)}
                    >
                      <X size={12} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* 6. WhatsApp Onay Kutusu (Görsel-3) */}
            <TouchableOpacity
              style={styles.whatsappBox}
              onPress={() => setNotifyWhatsApp(!notifyWhatsApp)}
              activeOpacity={0.8}
            >
              <View style={[styles.customCheckbox, notifyWhatsApp && styles.checkboxActive]}>
                {notifyWhatsApp && <Check size={14} color="#ffffff" />}
              </View>
              <MessageSquare size={18} color="#10b981" style={{ marginLeft: 8 }} />
              <Text style={styles.whatsappText}>
                Kaydettikten sonra WhatsApp ile paylaşım ekranını aç
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Check size={17} color="#ffffff" />
                  <Text style={styles.saveText}>Kaydet</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Cari Picker Inner Modal */}
      <Modal
        visible={isCariPickerOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsCariPickerOpen(false)}
      >
        <View style={styles.innerBackdrop}>
          <View style={styles.innerCard}>
            <View style={styles.innerHeader}>
              <Text style={styles.innerTitle}>İlgili Cari Seçin</Text>
              <TouchableOpacity onPress={() => setIsCariPickerOpen(false)}>
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <View style={styles.innerSearchBox}>
              <Search size={16} color="#94a3b8" />
              <TextInput
                style={styles.innerSearchInput}
                placeholder="Cari adı veya vergi no ara..."
                placeholderTextColor="#64748b"
                value={cariSearch}
                onChangeText={setCariSearch}
                autoFocus
              />
            </View>

            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              {selectedCari ? (
                <TouchableOpacity
                  style={styles.clearCariItem}
                  onPress={() => {
                    setSelectedCari('');
                    setIsCariPickerOpen(false);
                  }}
                >
                  <Text style={styles.clearCariText}>✕ Cari Seçimini Kaldır</Text>
                </TouchableOpacity>
              ) : null}

              {filteredCariler.map((cari, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.cariItem,
                    selectedCari === cari && styles.selectedCariItem,
                  ]}
                  onPress={() => {
                    setSelectedCari(cari);
                    if (!companyName.trim()) {
                      setCompanyName(cari);
                    }
                    setIsCariPickerOpen(false);
                  }}
                >
                  <Building2 size={16} color={selectedCari === cari ? '#3b82f6' : '#94a3b8'} />
                  <Text
                    style={[
                      styles.cariItemText,
                      selectedCari === cari && styles.selectedCariItemText,
                    ]}
                  >
                    {cari}
                  </Text>
                </TouchableOpacity>
              ))}

              {filteredCariler.length === 0 && (
                <Text style={styles.emptyCarilerText}>Eşleşen cari bulunamadı.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0c152e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalBody: {
    paddingHorizontal: 18,
  },
  bodyContent: {
    paddingVertical: 16,
    gap: 16,
  },
  cariCard: {
    backgroundColor: 'rgba(30, 58, 138, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    borderRadius: 14,
    padding: 14,
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cariCardTitle: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cariDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a1024',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  cariIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cariDropdownText: {
    flex: 1,
    fontSize: 13,
    color: '#64748b',
  },
  cariSelectedText: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  cariHelpText: {
    marginTop: 8,
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
  },
  fieldSection: {
    gap: 6,
  },
  fieldTitle: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#080e21',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 14,
  },
  locationRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  locationInput: {
    flex: 1,
  },
  gpsBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textArea: {
    height: 95,
  },
  photosSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photosLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '800',
  },
  photoButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(234, 88, 12, 0.15)',
    borderWidth: 1,
    borderColor: '#ea580c',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  cameraBtnText: {
    color: '#ea580c',
    fontSize: 12,
    fontWeight: '800',
  },
  galleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  galleryBtnText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '800',
  },
  thumbnailsScroll: {
    flexDirection: 'row',
    marginTop: -6,
  },
  thumbnailContainer: {
    position: 'relative',
    marginRight: 10,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  customCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  checkboxActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  whatsappText: {
    marginLeft: 8,
    color: '#34d399',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#1e293b',
  },
  cancelText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#ea580c',
  },
  saveText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  innerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  innerCard: {
    backgroundColor: '#0c152e',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  innerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  innerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  innerSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#080e21',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 12,
  },
  innerSearchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
  },
  clearCariItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    marginBottom: 8,
  },
  clearCariText: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '700',
  },
  cariItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  selectedCariItem: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: 8,
  },
  cariItemText: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  selectedCariItemText: {
    color: '#60a5fa',
    fontWeight: '700',
  },
  emptyCarilerText: {
    color: '#64748b',
    textAlign: 'center',
    marginVertical: 20,
    fontSize: 13,
  },
});
