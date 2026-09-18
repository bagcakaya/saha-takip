import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  FlatList,
} from 'react-native';
import {
  Clock,
  X,
  Building2,
  Bell,
  Calendar,
  Volume2,
  Smartphone,
  ChevronDown,
  Check,
  Search,
} from 'lucide-react-native';
import { useStorage } from '../context/StorageContext';
import { useAppTheme } from '../context/ThemeContext';

interface TimedFollowUpModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TimedFollowUpModal({ visible, onClose, onSuccess }: TimedFollowUpModalProps) {
  const { cariler, addTimedFollowUp } = useStorage();
  const { isDark } = useAppTheme();

  const [cariName, setCariName] = useState('');
  const [description, setDescription] = useState('');
  
  // Format current date + 1 hour as default string DD.MM.YYYY HH:mm
  const getDefaultDateTime = () => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  };

  const [dueDateTime, setDueDateTime] = useState(getDefaultDateTime());
  const [soundAlarm, setSoundAlarm] = useState(true);
  const [sendPush, setSendPush] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cari selector dropdown modal / search
  const [showCariDropdown, setShowCariDropdown] = useState(false);
  const [cariSearch, setCariSearch] = useState('');

  const filteredCariler = (cariler || []).filter((c) =>
    c.toLowerCase().includes(cariSearch.toLowerCase().trim())
  ).slice(0, 30);

  // Helper for quick time selection
  const applyQuickTime = (type: string) => {
    const now = new Date();
    let target = new Date();

    if (type === '30m') {
      target = new Date(now.getTime() + 30 * 60 * 1000);
    } else if (type === '1h') {
      target = new Date(now.getTime() + 60 * 60 * 1000);
    } else if (type === '3h') {
      target = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    } else if (type === 'tomorrow_9') {
      target.setDate(now.getDate() + 1);
      target.setHours(9, 0, 0, 0);
    } else if (type === 'tomorrow_same') {
      target.setDate(now.getDate() + 1);
    } else if (type === '3d') {
      target.setDate(now.getDate() + 3);
    }

    const day = String(target.getDate()).padStart(2, '0');
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const year = target.getFullYear();
    const hours = String(target.getHours()).padStart(2, '0');
    const minutes = String(target.getMinutes()).padStart(2, '0');
    setDueDateTime(`${day}.${month}.${year} ${hours}:${minutes}`);
  };

  const handleSubmit = async () => {
    if (!cariName.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen takip edilecek bir cari seçin.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen takip konusu ve açıklama girin.');
      return;
    }

    setIsSubmitting(true);
    const res = await addTimedFollowUp({
      cariName: cariName.trim(),
      description: description.trim(),
      dueDate: dueDateTime,
      soundAlarm,
      sendPush,
    });
    setIsSubmitting(false);

    if (res.success) {
      setCariName('');
      setDescription('');
      setDueDateTime(getDefaultDateTime());
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
            { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: isDark ? '#1e293b' : '#e2e8f0' },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.clockIconBox}>
                <Clock size={20} color="#f59e0b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                  Yeni Süreli Cari Takibi & Alarm
                </Text>
                <Text style={styles.subtitle}>
                  Yöneticilere özel zaman ayarlı hatırlatıcı ve sesli alarm
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Field 1: Cari Selection */}
            <Text style={styles.label}>
              <Building2 size={13} color="#f59e0b" /> TAKİP EDİLECEK CARİ <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            <TouchableOpacity
              style={[
                styles.selectButton,
                {
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  borderColor: isDark ? '#334155' : '#cbd5e1',
                },
              ]}
              onPress={() => setShowCariDropdown(true)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Building2 size={16} color={cariName ? '#f59e0b' : '#64748b'} />
                <Text
                  style={{
                    color: cariName ? (isDark ? '#ffffff' : '#0f172a') : '#64748b',
                    fontSize: 14,
                    fontWeight: cariName ? '600' : '400',
                  }}
                  numberOfLines={1}
                >
                  {cariName || 'Cari arayın veya seçin...'}
                </Text>
              </View>
              <ChevronDown size={18} color="#64748b" />
            </TouchableOpacity>

            {/* Field 2: Description */}
            <Text style={[styles.label, { marginTop: 16 }]}>
              <Bell size={13} color="#f59e0b" /> TAKİP KONUSU & AÇIKLAMA <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  borderColor: isDark ? '#334155' : '#cbd5e1',
                  color: isDark ? '#f8fafc' : '#0f172a',
                },
              ]}
              placeholder="Örn: Cari aranacak, son teslimat faturası kontrol edilecek, mutabakat sağlanacak..."
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
              textAlignVertical="top"
            />

            {/* Field 3: Date & Time */}
            <Text style={[styles.label, { marginTop: 16 }]}>
              <Calendar size={13} color="#f59e0b" /> HATIRLATICI TARİH & SAAT <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            <View
              style={[
                styles.dateInputRow,
                {
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  borderColor: isDark ? '#334155' : '#cbd5e1',
                },
              ]}
            >
              <TextInput
                style={[
                  styles.dateInput,
                  { color: isDark ? '#f8fafc' : '#0f172a' },
                ]}
                value={dueDateTime}
                onChangeText={setDueDateTime}
                placeholder="GG.AA.YYYY SS:dd"
                placeholderTextColor="#64748b"
              />
              <Calendar size={18} color="#64748b" />
            </View>

            {/* Quick time selection pills */}
            <Text style={styles.quickLabel}>Hızlı Süre Seçimi:</Text>
            <View style={styles.quickGrid}>
              <TouchableOpacity
                style={[styles.quickPill, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}
                onPress={() => applyQuickTime('30m')}
                activeOpacity={0.7}
              >
                <Text style={styles.quickPillText}>+30 Dk</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickPill, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}
                onPress={() => applyQuickTime('1h')}
                activeOpacity={0.7}
              >
                <Text style={styles.quickPillText}>+1 Saat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickPill, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}
                onPress={() => applyQuickTime('3h')}
                activeOpacity={0.7}
              >
                <Text style={styles.quickPillText}>+3 Saat</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.quickGrid, { marginTop: 6 }]}>
              <TouchableOpacity
                style={[styles.quickPill, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}
                onPress={() => applyQuickTime('tomorrow_9')}
                activeOpacity={0.7}
              >
                <Text style={styles.quickPillText}>Yarın 09:00</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickPill, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}
                onPress={() => applyQuickTime('tomorrow_same')}
                activeOpacity={0.7}
              >
                <Text style={styles.quickPillText}>Yarın Bu Saat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickPill, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}
                onPress={() => applyQuickTime('3d')}
                activeOpacity={0.7}
              >
                <Text style={styles.quickPillText}>3 Gün Sonra</Text>
              </TouchableOpacity>
            </View>

            {/* Checkbox 1: Sound Alarm */}
            <TouchableOpacity
              style={[
                styles.optionCard,
                {
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  borderColor: isDark ? '#334155' : '#e2e8f0',
                },
              ]}
              onPress={() => setSoundAlarm(!soundAlarm)}
              activeOpacity={0.8}
            >
              <View style={styles.optionLeft}>
                <View style={styles.optionIconSquircle}>
                  <Volume2 size={18} color="#f59e0b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                    Sesli Melodi Alarmı
                  </Text>
                  <Text style={styles.optionDesc}>
                    Vakti gelince susturulana kadar yüksek sesli dijital melodi çalar
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.checkbox,
                  soundAlarm && styles.checkboxActive,
                  { borderColor: soundAlarm ? '#f59e0b' : '#64748b' },
                ]}
              >
                {soundAlarm && <Check size={14} color="#ffffff" />}
              </View>
            </TouchableOpacity>

            {/* Checkbox 2: Push Notification */}
            <TouchableOpacity
              style={[
                styles.optionCard,
                {
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  borderColor: isDark ? '#334155' : '#e2e8f0',
                  marginTop: 10,
                },
              ]}
              onPress={() => setSendPush(!sendPush)}
              activeOpacity={0.8}
            >
              <View style={styles.optionLeft}>
                <View style={styles.optionIconSquircle}>
                  <Smartphone size={18} color="#3b82f6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                    Kilit Ekranı Bildirimi (Push)
                  </Text>
                  <Text style={styles.optionDesc}>
                    Telefon kilitliyken OneSignal üzerinden anlık bildirim düşer
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.checkbox,
                  sendPush && styles.checkboxActiveBlue,
                  { borderColor: sendPush ? '#3b82f6' : '#64748b' },
                ]}
              >
                {sendPush && <Check size={14} color="#ffffff" />}
              </View>
            </TouchableOpacity>

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Footer Actions */}
          <View
            style={[
              styles.footer,
              {
                borderTopColor: isDark ? '#1e293b' : '#e2e8f0',
              },
            ]}
          >
            <TouchableOpacity onPress={onClose} style={styles.cancelButton} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              <Text style={styles.submitText}>Alarmı Kur</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Cari Dropdown / Selector Submodal */}
      {showCariDropdown && (
        <Modal visible={showCariDropdown} transparent animationType="fade">
          <View style={styles.subModalOverlay}>
            <View
              style={[
                styles.subModalBox,
                { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: isDark ? '#334155' : '#cbd5e1' },
              ]}
            >
              <View style={styles.subModalHeader}>
                <Text style={[styles.subModalTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                  Takip Edilecek Cariyi Seçin
                </Text>
                <TouchableOpacity onPress={() => setShowCariDropdown(false)}>
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
                      setShowCariDropdown(false);
                      setCariSearch('');
                    }}
                  >
                    <Building2 size={16} color="#f59e0b" style={{ marginRight: 10 }} />
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
    maxHeight: '90%',
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  clockIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    minHeight: 80,
    lineHeight: 18,
  },
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dateInput: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  quickLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 10,
    marginBottom: 6,
    fontWeight: '600',
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  quickPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  quickPillText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 16,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  optionIconSquircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  optionDesc: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
    lineHeight: 13,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  checkboxActiveBlue: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
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
  cancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cancelText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: '#ea580c',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: '#ea580c',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  submitText: {
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
