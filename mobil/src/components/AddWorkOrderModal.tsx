import React, { useState, useMemo } from 'react';
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
  Switch,
  Linking,
  Platform,
} from 'react-native';
import {
  X,
  Users,
  Building2,
  Camera,
  ImageIcon,
  Bell,
  MessageSquare,
  Check,
  ChevronDown,
  Search,
  Lock,
  Megaphone,
  UserCheck,
} from 'lucide-react-native';
import { useStorage } from '../context/StorageContext';
import { useAuth } from '../context/AuthContext';
import { ImageService } from '../services/imageService';

interface AddWorkOrderModalProps {
  visible: boolean;
  onClose: () => void;
}

const DEFAULT_STAFF = [
  { id: 'usr_burak', name: 'Burak AĞCAKAYA', role: 'Saha Yetkilisi' },
  { id: 'usr_murat', name: 'Murat POLAT', role: 'Teknik Servis' },
  { id: 'usr_sedat', name: 'Sedat POLAT', role: 'Sistem Yöneticisi' },
  { id: 'usr_fatih', name: 'Fatih AĞCAKAYA', role: 'Montaj Ekibi' },
];

export default function AddWorkOrderModal({ visible, onClose }: AddWorkOrderModalProps) {
  const { addNote, cariler } = useStorage();
  const { user } = useAuth();

  // Target Mode: 'all' | 'self' | 'custom'
  const [targetMode, setTargetMode] = useState<'all' | 'self' | 'custom'>('all');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);

  const [selectedCari, setSelectedCari] = useState('');
  const [content, setContent] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [reminderActive, setReminderActive] = useState(false);
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(false);

  // Cari Picker
  const [isCariPickerOpen, setIsCariPickerOpen] = useState(false);
  const [cariSearch, setCariSearch] = useState('');

  const [saving, setSaving] = useState(false);

  const filteredCariler = useMemo(() => {
    if (!cariSearch.trim()) return cariler.slice(0, 50);
    const q = cariSearch.toLowerCase();
    return cariler.filter((c) => c.toLowerCase().includes(q)).slice(0, 50);
  }, [cariler, cariSearch]);

  const toggleStaffSelection = (id: string) => {
    if (selectedStaffIds.includes(id)) {
      setSelectedStaffIds(selectedStaffIds.filter((item) => item !== id));
    } else {
      setSelectedStaffIds([...selectedStaffIds, id]);
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
    setTargetMode('all');
    setSelectedStaffIds([]);
    setSelectedCari('');
    setContent('');
    setPhotos([]);
    setReminderActive(false);
    setNotifyWhatsApp(false);
    setCariSearch('');
  };

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert('Eksik Alan', 'Lütfen iş emri detaylarını yazın.');
      return;
    }

    if (targetMode === 'custom' && selectedStaffIds.length === 0) {
      Alert.alert('Eksik Alan', 'Lütfen en az bir personel seçin.');
      return;
    }

    setSaving(true);
    try {
      const selectedNames = DEFAULT_STAFF.filter((s) =>
        selectedStaffIds.includes(s.id)
      ).map((s) => s.name);

      const res = await addNote({
        content: content.trim(),
        cariName: selectedCari.trim() || undefined,
        targetMode,
        targetUserIds: targetMode === 'custom' ? selectedStaffIds : [],
        targetUserNames: targetMode === 'custom' ? selectedNames : [],
        reminderActive,
        photos,
      });

      if (res.success) {
        if (notifyWhatsApp) {
          const dateStr = new Date().toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          });
          const targetDesc =
            targetMode === 'all'
              ? 'Tüm Saha Ekibi'
              : targetMode === 'self'
              ? user?.name || 'Sadece Kendim'
              : selectedNames.join(', ');

          const message =
            `*YENİ İŞ EMRİ & DUYURU*\n` +
            `👥 *Kime:* ${targetDesc}\n` +
            (selectedCari ? `🏢 *Cari:* ${selectedCari}\n` : '') +
            `📅 *Tarih:* ${dateStr}\n` +
            `📋 *İş Emri Detayları:*\n${content.trim()}\n\n` +
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

  const getTargetHelpText = () => {
    switch (targetMode) {
      case 'all':
        return 'Bu iş emri tüm saha ekibine ve yöneticilere açık duyuru olacaktır.';
      case 'self':
        return 'Bu iş emri yalnızca sizin takviminizde ve listenizde görünecektir.';
      case 'custom':
        return 'Seçilen personellere bildirim ve görev olarak iletilecektir.';
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
            <Text style={styles.headerTitle}>Yeni İş Emri & Hatırlatıcı</Text>
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
            {/* 1. KİMLE PAYLAŞILSIN? (Görsel-5) */}
            <View style={styles.segmentCard}>
              <View style={styles.fieldHeaderRow}>
                <Users size={16} color="#3b82f6" />
                <Text style={styles.segmentTitle}>İŞ EMRİ KİMİNLE PAYLAŞILSIN?</Text>
              </View>

              {/* 3 Buttons Row */}
              <View style={styles.segmentRow}>
                {/* Sadece Kendim */}
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    targetMode === 'self' && styles.segmentBtnActive,
                  ]}
                  onPress={() => setTargetMode('self')}
                  activeOpacity={0.8}
                >
                  <Lock
                    size={14}
                    color={targetMode === 'self' ? '#ffffff' : '#94a3b8'}
                  />
                  <Text
                    style={[
                      styles.segmentBtnText,
                      targetMode === 'self' && styles.segmentBtnTextActive,
                    ]}
                  >
                    Sadece Kendim
                  </Text>
                </TouchableOpacity>

                {/* Tüm Personel */}
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    targetMode === 'all' && styles.segmentBtnActive,
                  ]}
                  onPress={() => setTargetMode('all')}
                  activeOpacity={0.8}
                >
                  <Megaphone
                    size={14}
                    color={targetMode === 'all' ? '#ffffff' : '#94a3b8'}
                  />
                  <Text
                    style={[
                      styles.segmentBtnText,
                      targetMode === 'all' && styles.segmentBtnTextActive,
                    ]}
                  >
                    Tüm Personel
                  </Text>
                </TouchableOpacity>

                {/* Kişi(leri) Seç */}
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    targetMode === 'custom' && styles.segmentBtnActive,
                  ]}
                  onPress={() => setTargetMode('custom')}
                  activeOpacity={0.8}
                >
                  <UserCheck
                    size={14}
                    color={targetMode === 'custom' ? '#ffffff' : '#94a3b8'}
                  />
                  <Text
                    style={[
                      styles.segmentBtnText,
                      targetMode === 'custom' && styles.segmentBtnTextActive,
                    ]}
                  >
                    Kişi(leri) Seç
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.segmentHelpText}>{getTargetHelpText()}</Text>

              {/* Personel Seçim Listesi (Kişi Seç Aktifse) */}
              {targetMode === 'custom' && (
                <View style={styles.staffSelectList}>
                  <Text style={styles.staffSelectLabel}>
                    Atanacak Personelleri Seçin:
                  </Text>
                  <View style={styles.staffChipsRow}>
                    {DEFAULT_STAFF.map((s) => {
                      const isSelected = selectedStaffIds.includes(s.id);
                      return (
                        <TouchableOpacity
                          key={s.id}
                          style={[
                            styles.staffChip,
                            isSelected && styles.staffChipSelected,
                          ]}
                          onPress={() => toggleStaffSelection(s.id)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.staffChipText,
                              isSelected && styles.staffChipTextSelected,
                            ]}
                          >
                            {isSelected ? '✓ ' : '+ '}
                            {s.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>

            {/* 2. İlgili Cari / Müşteri (Görsel-5) */}
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

            {/* 3. İş Emri Detayları (Görsel-5) */}
            <View style={styles.fieldSection}>
              <Text style={styles.fieldTitle}>İŞ EMRİ DETAYLARI</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="İş emri detaylarını yazın..."
                placeholderTextColor="#64748b"
                value={content}
                onChangeText={setContent}
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* 4. Fotoğraf Ekle (Görsel-5) */}
            <View style={styles.photosSection}>
              <Text style={styles.photosLabel}>
                FOTOĞRAF EKLE ({photos.length})
              </Text>
              <View style={styles.photoButtonsRow}>
                <TouchableOpacity
                  style={styles.cameraBtn}
                  onPress={handleTakePhoto}
                  activeOpacity={0.8}
                >
                  <Camera size={16} color="#3b82f6" />
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

            {/* 5. Hatırlatıcı Bildirimi Kur (Switch - Görsel-5) */}
            <View style={styles.reminderRow}>
              <View style={styles.reminderLeft}>
                <Bell size={18} color="#94a3b8" />
                <Text style={styles.reminderText}>Hatırlatıcı Bildirimi Kur</Text>
              </View>
              <Switch
                value={reminderActive}
                onValueChange={setReminderActive}
                thumbColor={reminderActive ? '#ffffff' : '#94a3b8'}
                trackColor={{ false: '#334155', true: '#2563eb' }}
              />
            </View>

            {/* 6. WhatsApp ile İlet Onay Kutusu (Görsel-5) */}
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
                Kaydedildiğinde WhatsApp ile İlet
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
                <Text style={styles.saveText}>Kaydet</Text>
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
  segmentCard: {
    backgroundColor: 'rgba(30, 58, 138, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  segmentTitle: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 6,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#0a1024',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  segmentBtnActive: {
    backgroundColor: '#1e293b',
    borderColor: '#3b82f6',
  },
  segmentBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  segmentBtnTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  segmentHelpText: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
  },
  staffSelectList: {
    marginTop: 6,
    gap: 6,
  },
  staffSelectLabel: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
  },
  staffChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  staffChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#0a1024',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  staffChipSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    borderColor: '#3b82f6',
  },
  staffChipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  staffChipTextSelected: {
    color: '#60a5fa',
    fontWeight: '800',
  },
  cariCard: {
    backgroundColor: 'rgba(30, 58, 138, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    borderRadius: 14,
    padding: 14,
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
    marginTop: 8,
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
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#080e21',
    borderWidth: 1.5,
    borderColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 14,
  },
  textArea: {
    height: 100,
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
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  cameraBtnText: {
    color: '#60a5fa',
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
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#080e21',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  reminderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reminderText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#2563eb',
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
