import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import {
  X,
  Building2,
  MessageCircle,
  Search,
  Check,
  ChevronDown,
} from 'lucide-react-native';
import { useStorage } from '../context/StorageContext';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';

interface AddLocationModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AddLocationModal: React.FC<AddLocationModalProps> = ({
  visible,
  onClose,
}) => {
  const { addLocation, cariler } = useStorage();
  const { user } = useAuth();
  const { isDark } = useAppTheme();

  const [name, setName] = useState('');
  const [cariName, setCariName] = useState('');
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Cari Picker Modal state
  const [isCariPickerOpen, setIsCariPickerOpen] = useState(false);
  const [cariSearch, setCariSearch] = useState('');

  const filteredCariler = cariler.filter((c) =>
    c.toLowerCase().includes(cariSearch.toLowerCase())
  );

  const handleSubmit = async () => {
    const locName = name.trim() || cariName.trim();
    if (!locName) {
      Alert.alert('Eksik Bilgi', 'Lütfen firma / lokasyon adı veya cari seçin.');
      return;
    }

    setSubmitting(true);
    const res = await addLocation({
      name: locName,
      cariName: cariName.trim() || undefined,
    });
    setSubmitting(false);

    if (res.success) {
      if (notifyWhatsapp) {
        const text = `📢 *YENİ KURULUM OLUŞTURULDU*\n\n` +
          `🏢 *Lokasyon:* ${locName}\n` +
          (cariName ? `👤 *Cari:* ${cariName}\n` : '') +
          `👤 *Yetkili:* ${user?.name || 'Saha Yetkilisi'}\n\n` +
          `Lütfen saha montaj ve kontrol listesini tamamlayınız.`;
        Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`).catch(() => {});
      }

      setName('');
      setCariName('');
      onClose();
      Alert.alert('Başarılı', `"${locName}" kurulum listesine eklendi.`);
    } else {
      Alert.alert('Hata', res.message || 'Kurulum yeri eklenemedi.');
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalCard,
            { backgroundColor: isDark ? '#0b1329' : '#ffffff' },
          ]}
        >
          {/* Header (Matches Görsel 4) */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
              Yeni Kurulum Yeri
            </Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={18} color={isDark ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {/* 1. İlgili Cari / Müşteri (İsteğe Bağlı) (Matches Görsel 4) */}
            <View
              style={[
                styles.cariSection,
                {
                  backgroundColor: isDark ? '#020617' : '#f8fafc',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                },
              ]}
            >
              <View style={styles.cariHeaderRow}>
                <Building2 size={15} color="#3b82f6" />
                <Text style={styles.cariLabel}>İLGİLİ CARİ / MÜŞTERİ (İSTEĞE BAĞLI)</Text>
              </View>

              {/* Cari Dropdown Trigger */}
              <TouchableOpacity
                style={[
                  styles.cariPickerTrigger,
                  {
                    backgroundColor: isDark ? '#0c152e' : '#ffffff',
                    borderColor: isDark ? '#334155' : '#cbd5e1',
                  },
                ]}
                onPress={() => setIsCariPickerOpen(true)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Building2 size={16} color="#94a3b8" />
                  <Text
                    style={[
                      styles.cariSelectedText,
                      { color: cariName ? (isDark ? '#ffffff' : '#0f172a') : '#94a3b8' },
                    ]}
                    numberOfLines={1}
                  >
                    {cariName || 'Açılan listeden cari seçin veya arayın...'}
                  </Text>
                </View>
                <ChevronDown size={16} color="#94a3b8" />
              </TouchableOpacity>

              <Text style={styles.cariHintText}>
                💡 İsteğe bağlıdır. Cari seçilmezse boş geçilir; seçilirse personele en üstte gösterilir.
              </Text>
            </View>

            {/* 2. Firma / Lokasyon Adı * (Matches Görsel 4) */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: isDark ? '#cbd5e1' : '#475569' }]}>
                FİRMA / LOKASYON ADI *
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: isDark ? '#020617' : '#ffffff',
                    borderColor: isDark ? '#334155' : '#cbd5e1',
                    color: isDark ? '#ffffff' : '#0f172a',
                  },
                ]}
                placeholder="Örn: 12 YAZILIM, ADA CAFE..."
                placeholderTextColor="#64748b"
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* 3. WhatsApp Bildirimi Checkbox (Matches Görsel 4) */}
            <TouchableOpacity
              style={[
                styles.whatsappCheckRow,
                {
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5',
                  borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#a7f3d0',
                },
              ]}
              onPress={() => setNotifyWhatsapp(!notifyWhatsapp)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.checkbox,
                  notifyWhatsapp && styles.checkboxActive,
                ]}
              >
                {notifyWhatsapp && <Check size={12} color="#ffffff" />}
              </View>
              <MessageCircle size={17} color="#10b981" />
              <Text style={styles.whatsappCheckText}>
                Eklendiğinde WhatsApp ile Bildir
              </Text>
            </TouchableOpacity>

            {/* 4. Action Buttons (Matches Görsel 4) */}
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[
                  styles.cancelBtn,
                  { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' },
                ]}
                onPress={onClose}
              >
                <Text style={[styles.cancelBtnText, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                  İptal
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <MessageCircle size={16} color="#ffffff" />
                    <Text style={styles.submitBtnText}>Kaydet & Gönder</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Cari Picker Inner Modal */}
      <Modal visible={isCariPickerOpen} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View
            style={[
              styles.cariPickerModalCard,
              { backgroundColor: isDark ? '#0b1329' : '#ffffff' },
            ]}
          >
            <View style={styles.cariPickerHeader}>
              <Text style={[styles.cariPickerTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                Cari / Müşteri Seç
              </Text>
              <TouchableOpacity onPress={() => setIsCariPickerOpen(false)}>
                <X size={20} color={isDark ? '#94a3b8' : '#64748b'} />
              </TouchableOpacity>
            </View>

            <View style={[styles.cariSearchBox, { backgroundColor: isDark ? '#020617' : '#f1f5f9' }]}>
              <Search size={16} color="#94a3b8" />
              <TextInput
                style={[styles.cariSearchInput, { color: isDark ? '#ffffff' : '#0f172a' }]}
                placeholder="Cari adı ile ara..."
                placeholderTextColor="#64748b"
                value={cariSearch}
                onChangeText={setCariSearch}
              />
            </View>

            <ScrollView style={{ maxHeight: 340 }}>
              <TouchableOpacity
                style={styles.cariItemRow}
                onPress={() => {
                  setCariName('');
                  setIsCariPickerOpen(false);
                }}
              >
                <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 13 }}>
                  • Cari Seçimi Temizle (Boş Bırak)
                </Text>
              </TouchableOpacity>

              {filteredCariler.slice(0, 50).map((c, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.cariItemRow,
                    { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#e2e8f0' },
                  ]}
                  onPress={() => {
                    setCariName(c);
                    if (!name.trim()) setName(c);
                    setIsCariPickerOpen(false);
                  }}
                >
                  <Building2 size={15} color="#3b82f6" />
                  <Text style={[styles.cariItemText, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 20,
    gap: 16,
  },
  cariSection: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
  },
  cariHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cariLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#3b82f6',
    letterSpacing: 0.5,
  },
  cariPickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  cariSelectedText: {
    fontSize: 13,
    fontWeight: '700',
  },
  cariHintText: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 15,
  },
  formGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  textInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '700',
  },
  whatsappCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#10b981',
  },
  whatsappCheckText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#10b981',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  submitBtn: {
    flex: 1.4,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  cariPickerModalCard: {
    borderRadius: 20,
    padding: 18,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  cariPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cariPickerTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  cariSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    marginBottom: 10,
  },
  cariSearchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  cariItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  cariItemText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
});
