import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  FlatList,
  Linking,
} from 'react-native';
import {
  X,
  Shield,
  RotateCcw,
  Bell,
  Zap,
  Building2,
  Calendar,
  Clock,
  Hash,
  Truck,
  Camera,
  Upload,
  Check,
  Search,
  ChevronDown,
  Trash2,
  MessageCircle,
} from 'lucide-react-native';
import { useStorage } from '../context/StorageContext';
import { useAppTheme } from '../context/ThemeContext';
import { ImageService } from '../services/imageService';

interface AddReturnWarrantyModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddReturnWarrantyModal({ visible, onClose, onSuccess }: AddReturnWarrantyModalProps) {
  const { cariler, addReturnWarranty } = useStorage();
  const { isDark } = useAppTheme();

  const [type, setType] = useState<'warranty' | 'return'>('warranty');
  const [cariName, setCariName] = useState('');
  const [companyName, setCompanyName] = useState('');

  // Default date and time
  const now = new Date();
  const defaultDateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
  const defaultTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const [sentDateStr, setSentDateStr] = useState(defaultDateStr);
  const [sentTimeStr, setSentTimeStr] = useState(defaultTimeStr);

  const [serialNumber, setSerialNumber] = useState('');
  const [serialNumberPhoto, setSerialNumberPhoto] = useState<string | undefined>();

  const [trackingCode, setTrackingCode] = useState('');
  const [trackingCodePhoto, setTrackingCodePhoto] = useState<string | undefined>();

  const [notes, setNotes] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cari Dropdown state
  const [showCariModal, setShowCariModal] = useState(false);
  const [cariSearch, setCariSearch] = useState('');

  const filteredCariler = useMemo(() => {
    return (cariler || []).filter((c) =>
      c.toLowerCase().includes(cariSearch.toLowerCase().trim())
    ).slice(0, 30);
  }, [cariler, cariSearch]);

  // One week later date string
  const oneWeekLaterStr = useMemo(() => {
    const target = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const months = [
      'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];
    return `${target.getDate()} ${months[target.getMonth()]} ${target.getFullYear()}`;
  }, []);

  const handleTakeSerialPhoto = async () => {
    const photo = await ImageService.takePhoto();
    if (photo) setSerialNumberPhoto(photo);
  };

  const handlePickSerialPhoto = async () => {
    const photo = await ImageService.pickImage();
    if (photo) setSerialNumberPhoto(photo);
  };

  const handleTakeTrackingPhoto = async () => {
    const photo = await ImageService.takePhoto();
    if (photo) setTrackingCodePhoto(photo);
  };

  const handlePickTrackingPhoto = async () => {
    const photo = await ImageService.pickImage();
    if (photo) setTrackingCodePhoto(photo);
  };

  const handleSubmit = async () => {
    if (!companyName.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen gönderilen firma ismini girin.');
      return;
    }

    setIsSubmitting(true);
    const combinedDate = `${sentDateStr} ${sentTimeStr}`;

    const res = await addReturnWarranty({
      type,
      companyName: companyName.trim(),
      cariName: cariName.trim() || undefined,
      sentDate: combinedDate,
      serialNumber: serialNumber.trim() || undefined,
      trackingCode: trackingCode.trim() || undefined,
      notes: notes.trim() || undefined,
      followUpNote: followUpNote.trim() || undefined,
      serialNumberPhoto,
      trackingCodePhoto,
    });
    setIsSubmitting(false);

    if (res.success) {
      if (sendWhatsApp) {
        const text = `*Yeni ${type === 'warranty' ? 'Garanti' : 'İade'} Kaydı*\nFirma: ${companyName}\nCari: ${cariName || '-'}\nSeri No: ${serialNumber || '-'}\nKargo: ${trackingCode || '-'}\nDetay: ${notes || '-'}`;
        Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`).catch(() => {});
      }

      setCompanyName('');
      setCariName('');
      setSerialNumber('');
      setTrackingCode('');
      setNotes('');
      setFollowUpNote('');
      setSerialNumberPhoto(undefined);
      setTrackingCodePhoto(undefined);
      onClose();
      if (onSuccess) onSuccess();
    } else {
      Alert.alert('Hata', res.message);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              borderColor: isDark ? '#1e293b' : '#e2e8f0',
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
              Yeni İade / Garanti Kaydı
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* 1. İŞLEM TÜRÜ (GARANTİ / İADE) */}
            <Text style={styles.sectionLabel}>İŞLEM TÜRÜ</Text>
            <View style={styles.typeSelectorRow}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  type === 'warranty'
                    ? styles.typeButtonActiveBlue
                    : [
                        styles.typeButtonInactive,
                        { backgroundColor: isDark ? '#1e293b' : '#f8fafc' },
                      ],
                ]}
                onPress={() => setType('warranty')}
                activeOpacity={0.8}
              >
                <Shield size={16} color={type === 'warranty' ? '#ffffff' : '#94a3b8'} />
                <Text
                  style={[
                    styles.typeButtonText,
                    type === 'warranty'
                      ? styles.typeButtonTextActive
                      : { color: isDark ? '#cbd5e1' : '#64748b' },
                  ]}
                >
                  GARANTİ
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeButton,
                  type === 'return'
                    ? styles.typeButtonActiveBlue
                    : [
                        styles.typeButtonInactive,
                        { backgroundColor: isDark ? '#1e293b' : '#f8fafc' },
                      ],
                ]}
                onPress={() => setType('return')}
                activeOpacity={0.8}
              >
                <RotateCcw size={16} color={type === 'return' ? '#ffffff' : '#94a3b8'} />
                <Text
                  style={[
                    styles.typeButtonText,
                    type === 'return'
                      ? styles.typeButtonTextActive
                      : { color: isDark ? '#cbd5e1' : '#64748b' },
                  ]}
                >
                  İADE
                </Text>
              </TouchableOpacity>
            </View>

            {/* 2. Hatırlatıcı & Bildirim Ayarı Card */}
            <View
              style={[
                styles.reminderCard,
                {
                  backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f1f5f9',
                  borderColor: isDark ? '#334155' : '#cbd5e1',
                },
              ]}
            >
              <View style={styles.reminderCardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Bell size={15} color="#3b82f6" />
                  <Text style={[styles.reminderCardTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                    Hatırlatıcı & Bildirim Ayarı
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.customReminderBtn}
                  onPress={() => Alert.alert('Bilgi', 'Varsayılan olarak 1 haftalık otomatik takip bildirimine ayarlandı.')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.customReminderBtnText}>+ Özel Hatırlatıcı Kur</Text>
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.reminderNoticeBox,
                  { backgroundColor: isDark ? '#0b1329' : '#ffffff' },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Zap size={14} color="#f59e0b" />
                  <Text style={styles.reminderNoticeTitle}>
                    Otomatik 1 Haftalık Takip Bildirimi:
                  </Text>
                </View>
                <Text style={styles.reminderNoticeText}>
                  Özel hatırlatıcı seçilmediğinde, gönderim tarihinden 1 hafta sonra (
                  <Text style={{ fontWeight: '800', color: '#60a5fa' }}>{oneWeekLaterStr}</Text>
                  ) tüm kullanıcılara otomatik durum sorgulama bildirimi düşecektir. Ürün 1 haftadan önce dönerse kart üzerindeki "İşlemi Tamamla" butonuna basılarak bildirim otomatik iptal edilir.
                </Text>
              </View>
            </View>

            {/* 3. İLGİLİ CARİ / MÜŞTERİ (İSTEĞE BAĞLI) */}
            <View style={{ marginTop: 14 }}>
              <Text style={styles.fieldLabel}>
                <Building2 size={13} color="#3b82f6" /> İLGİLİ CARİ / MÜŞTERİ (İSTEĞE BAĞLI)
              </Text>
              <TouchableOpacity
                style={[
                  styles.selectInput,
                  {
                    backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                    borderColor: isDark ? '#334155' : '#cbd5e1',
                  },
                ]}
                onPress={() => setShowCariModal(true)}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Building2 size={16} color={cariName ? '#3b82f6' : '#64748b'} />
                  <Text
                    style={{
                      color: cariName ? (isDark ? '#ffffff' : '#0f172a') : '#64748b',
                      fontSize: 13,
                      fontWeight: cariName ? '600' : '400',
                    }}
                    numberOfLines={1}
                  >
                    {cariName || 'Açılan listeden cari seçin veya arayın...'}
                  </Text>
                </View>
                <ChevronDown size={18} color="#64748b" />
              </TouchableOpacity>
              <Text style={styles.fieldHint}>
                💡 İsteğe bağlıdır. Cari seçilmezse boş geçilir; seçilirse personele en üstte gösterilir.
              </Text>
            </View>

            {/* 4. GÖNDERİLEN FİRMA İSMİ * */}
            <View style={{ marginTop: 14 }}>
              <Text style={styles.fieldLabel}>
                <Building2 size={13} color="#3b82f6" /> GÖNDERİLEN FİRMA İSMİ <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                    borderColor: isDark ? '#334155' : '#cbd5e1',
                    color: isDark ? '#ffffff' : '#0f172a',
                  },
                ]}
                placeholder="Örn: 12 YAZILIM, ADA CAFE, İNGENİCO SERVİS..."
                placeholderTextColor="#64748b"
                value={companyName}
                onChangeText={setCompanyName}
              />
            </View>

            {/* 5. GÖNDERİM TARİHİ & SAAT */}
            <View style={styles.dateRowContainer}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>
                  <Calendar size={13} color="#3b82f6" /> GÖNDERİM TARİHİ
                </Text>
                <View
                  style={[
                    styles.dateInputWrapper,
                    {
                      backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                      borderColor: isDark ? '#334155' : '#cbd5e1',
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.dateTextInput, { color: isDark ? '#ffffff' : '#0f172a' }]}
                    value={sentDateStr}
                    onChangeText={setSentDateStr}
                  />
                  <Calendar size={16} color="#64748b" />
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>
                  <Clock size={13} color="#3b82f6" /> SAAT
                </Text>
                <View
                  style={[
                    styles.dateInputWrapper,
                    {
                      backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                      borderColor: isDark ? '#334155' : '#cbd5e1',
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.dateTextInput, { color: isDark ? '#ffffff' : '#0f172a' }]}
                    value={sentTimeStr}
                    onChangeText={setSentTimeStr}
                  />
                  <Clock size={16} color="#64748b" />
                </View>
              </View>
            </View>

            {/* 6. 1. ÜRÜN SERİ NUMARASI & FOTOĞRAFI */}
            <View style={{ marginTop: 14 }}>
              <Text style={styles.fieldLabel}>
                <Hash size={13} color="#3b82f6" /> 1. ÜRÜN SERİ NUMARASI & FOTOĞRAFI
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                    borderColor: isDark ? '#334155' : '#cbd5e1',
                    color: isDark ? '#ffffff' : '#0f172a',
                  },
                ]}
                placeholder="Seri no yazın (isteğe bağlı)..."
                placeholderTextColor="#64748b"
                value={serialNumber}
                onChangeText={setSerialNumber}
              />
              <View style={styles.photoButtonsRow}>
                <TouchableOpacity
                  style={[
                    styles.photoBtnDashed,
                    { backgroundColor: isDark ? '#1e293b' : '#f8fafc' },
                  ]}
                  onPress={handleTakeSerialPhoto}
                  activeOpacity={0.8}
                >
                  <Camera size={15} color="#3b82f6" />
                  <Text style={styles.photoBtnText}>Kamera Çek</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.photoBtnSolid,
                    { backgroundColor: isDark ? '#1e293b' : '#f8fafc' },
                  ]}
                  onPress={handlePickSerialPhoto}
                  activeOpacity={0.8}
                >
                  <Upload size={15} color="#64748b" />
                  <Text style={[styles.photoBtnText, { color: isDark ? '#cbd5e1' : '#334155' }]}>
                    Galeriden Seç
                  </Text>
                </TouchableOpacity>
              </View>

              {serialNumberPhoto && (
                <View style={styles.photoPreviewBox}>
                  <Image source={{ uri: serialNumberPhoto }} style={styles.photoThumb} />
                  <TouchableOpacity
                    style={styles.photoRemoveBtn}
                    onPress={() => setSerialNumberPhoto(undefined)}
                  >
                    <Trash2 size={12} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* 7. 2. KARGO GÖNDERİM TAKİP KODU & FİŞ FOTOĞRAFI (Görsel-3) */}
            <View style={{ marginTop: 14 }}>
              <Text style={styles.fieldLabel}>
                <Truck size={13} color="#3b82f6" /> 2. KARGO GÖNDERİM TAKİP KODU & FİŞ FOTOĞRAFI
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                    borderColor: isDark ? '#334155' : '#cbd5e1',
                    color: isDark ? '#ffffff' : '#0f172a',
                  },
                ]}
                placeholder="Kargo takip kodu / fiş no yazın..."
                placeholderTextColor="#64748b"
                value={trackingCode}
                onChangeText={setTrackingCode}
              />
              <View style={styles.photoButtonsRow}>
                <TouchableOpacity
                  style={[
                    styles.photoBtnDashed,
                    { backgroundColor: isDark ? '#1e293b' : '#f8fafc' },
                  ]}
                  onPress={handleTakeTrackingPhoto}
                  activeOpacity={0.8}
                >
                  <Camera size={15} color="#3b82f6" />
                  <Text style={styles.photoBtnText}>Kamera Çek</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.photoBtnSolid,
                    { backgroundColor: isDark ? '#1e293b' : '#f8fafc' },
                  ]}
                  onPress={handlePickTrackingPhoto}
                  activeOpacity={0.8}
                >
                  <Upload size={15} color="#64748b" />
                  <Text style={[styles.photoBtnText, { color: isDark ? '#cbd5e1' : '#334155' }]}>
                    Galeriden Seç
                  </Text>
                </TouchableOpacity>
              </View>

              {trackingCodePhoto && (
                <View style={styles.photoPreviewBox}>
                  <Image source={{ uri: trackingCodePhoto }} style={styles.photoThumb} />
                  <TouchableOpacity
                    style={styles.photoRemoveBtn}
                    onPress={() => setTrackingCodePhoto(undefined)}
                  >
                    <Trash2 size={12} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* 8. AÇIKLAMA / ARIZA & İADE DETAYI */}
            <View style={{ marginTop: 14 }}>
              <Text style={styles.fieldLabel}>AÇIKLAMA / ARIZA & İADE DETAYI</Text>
              <TextInput
                style={[
                  styles.textArea,
                  {
                    backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                    borderColor: isDark ? '#334155' : '#cbd5e1',
                    color: isDark ? '#ffffff' : '#0f172a',
                  },
                ]}
                placeholder="Arıza nedeni, ürün modeli veya diğer detaylar..."
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
                textAlignVertical="top"
              />
            </View>

            {/* 9. SÜREÇ TAKİP / AŞAMA AÇIKLAMASI (7 GÜN SONU DURUMU) */}
            <View
              style={[
                styles.followUpCard,
                {
                  backgroundColor: isDark ? 'rgba(30, 27, 24, 0.6)' : '#fffbeb',
                  borderColor: 'rgba(245, 158, 11, 0.4)',
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Clock size={15} color="#f59e0b" />
                <Text style={styles.followUpTitle}>
                  SÜREÇ TAKİP / AŞAMA AÇIKLAMASI (7 GÜN SONU DURUMU)
                </Text>
              </View>
              <TextInput
                style={[
                  styles.textArea,
                  {
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: isDark ? '#334155' : '#fcd34d',
                    color: isDark ? '#ffffff' : '#0f172a',
                  },
                ]}
                placeholder="Takibin ne aşamada olduğuna dair açıklama (örn: Servisle görüşüldü, parça bekleniyor / kargoya verildi...)"
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={3}
                value={followUpNote}
                onChangeText={setFollowUpNote}
                textAlignVertical="top"
              />
              <Text style={styles.followUpHint}>
                💡 7 günlük takip süresi dolduğunda servisten veya firmadan aldığınız son aşama durumunu buraya kaydedebilirsiniz.
              </Text>
            </View>

            {/* 10. WhatsApp Checkbox */}
            <TouchableOpacity
              style={[
                styles.whatsappCard,
                {
                  backgroundColor: isDark ? '#0f2922' : '#f0fdf4',
                  borderColor: 'rgba(16, 185, 129, 0.4)',
                },
              ]}
              onPress={() => setSendWhatsApp(!sendWhatsApp)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.checkbox,
                  sendWhatsApp && styles.checkboxActiveGreen,
                  { borderColor: sendWhatsApp ? '#10b981' : '#64748b' },
                ]}
              >
                {sendWhatsApp && <Check size={13} color="#ffffff" />}
              </View>
              <MessageCircle size={16} color="#10b981" />
              <Text style={styles.whatsappText}>Kaydedildiğinde WhatsApp ile İlet</Text>
            </TouchableOpacity>

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Footer */}
          <View
            style={[
              styles.footer,
              { borderTopColor: isDark ? '#1e293b' : '#e2e8f0' },
            ]}
          >
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              <Text style={styles.submitBtnText}>Kaydet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Cari Dropdown Submodal */}
      {showCariModal && (
        <Modal visible={showCariModal} transparent animationType="fade">
          <View style={styles.subModalOverlay}>
            <View
              style={[
                styles.subModalBox,
                { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: isDark ? '#334155' : '#cbd5e1' },
              ]}
            >
              <View style={styles.subModalHeader}>
                <Text style={[styles.subModalTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                  İlgili Cari / Müşteri Seçin
                </Text>
                <TouchableOpacity onPress={() => setShowCariModal(false)}>
                  <X size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.searchBar,
                  { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderColor: isDark ? '#334155' : '#cbd5e1' },
                ]}
              >
                <Search size={16} color="#94a3b8" />
                <TextInput
                  style={[styles.searchInput, { color: isDark ? '#ffffff' : '#0f172a' }]}
                  placeholder="Cari adı yazın..."
                  placeholderTextColor="#94a3b8"
                  value={cariSearch}
                  onChangeText={setCariSearch}
                  autoFocus
                />
              </View>

              <FlatList
                data={filteredCariler}
                keyExtractor={(item, index) => `${item}_${index}`}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.cariItem,
                      { borderBottomColor: isDark ? '#1e293b' : '#f1f5f9' },
                    ]}
                    onPress={() => {
                      setCariName(item);
                      setShowCariModal(false);
                      setCariSearch('');
                    }}
                  >
                    <Building2 size={16} color="#3b82f6" style={{ marginRight: 10 }} />
                    <Text
                      style={[
                        styles.cariItemText,
                        { color: isDark ? '#f8fafc' : '#0f172a' },
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: '#64748b' }}>Eşleşen cari bulunamadı.</Text>
                  </View>
                }
              />
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 16,
  },
  container: {
    borderRadius: 20,
    borderWidth: 1,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  typeButtonActiveBlue: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  typeButtonInactive: {
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  typeButtonTextActive: {
    color: '#ffffff',
  },
  reminderCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  reminderCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  reminderCardTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  customReminderBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  customReminderBtnText: {
    color: '#3b82f6',
    fontSize: 10,
    fontWeight: '700',
  },
  reminderNoticeBox: {
    borderRadius: 10,
    padding: 10,
  },
  reminderNoticeTitle: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '800',
  },
  reminderNoticeText: {
    color: '#94a3b8',
    fontSize: 10,
    lineHeight: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  fieldHint: {
    fontSize: 10,
    color: '#eab308',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  dateRowContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  dateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  dateTextInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  photoButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  photoBtnDashed: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 9,
  },
  photoBtnSolid: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingVertical: 9,
  },
  photoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3b82f6',
  },
  photoPreviewBox: {
    marginTop: 8,
    position: 'relative',
    width: 60,
  },
  photoThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    minHeight: 70,
    lineHeight: 17,
  },
  followUpCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginTop: 14,
  },
  followUpTitle: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  followUpHint: {
    color: '#eab308',
    fontSize: 10,
    marginTop: 6,
    lineHeight: 14,
  },
  whatsappCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
  },
  whatsappText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '700',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActiveGreen: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  subModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  subModalBox: {
    borderRadius: 18,
    borderWidth: 1,
    maxHeight: '80%',
    padding: 16,
  },
  subModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subModalTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  cariItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  cariItemText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
});
