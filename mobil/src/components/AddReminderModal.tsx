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
  Image,
} from 'react-native';
import {
  X,
  BookOpen,
  AlertTriangle,
  ShieldAlert,
  Info,
  Camera,
  ImageIcon,
  Pin,
  Bell,
  Check,
  Send,
  Trash2,
} from 'lucide-react-native';
import { useStorage } from '../context/StorageContext';
import { useAppTheme } from '../context/ThemeContext';
import { AdminReminderCategory } from '../types/storage';
import { ImageService } from '../services/imageService';

interface AddReminderModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddReminderModal({ visible, onClose, onSuccess }: AddReminderModalProps) {
  const { addAdminReminder } = useStorage();
  const { isDark } = useAppTheme();

  const [category, setCategory] = useState<AdminReminderCategory>('procedure');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [sendPush, setSendPush] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTakePhoto = async () => {
    const photo = await ImageService.takePhoto();
    if (photo) {
      setPhotos((prev) => [...prev, photo]);
    }
  };

  const handlePickImage = async () => {
    const photo = await ImageService.pickImage();
    if (photo) {
      setPhotos((prev) => [...prev, photo]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen talimat başlığını girin.');
      return;
    }
    if (!content.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen talimat ve açıklama metnini girin.');
      return;
    }

    setIsSubmitting(true);
    const res = await addAdminReminder({
      title: title.trim(),
      content: content.trim(),
      category,
      isPinned,
      photos,
      sendPush,
    });
    setIsSubmitting(false);

    if (res.success) {
      setTitle('');
      setContent('');
      setCategory('procedure');
      setPhotos([]);
      setIsPinned(false);
      setSendPush(true);
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
              Yeni Yönetici Hatırlatması & Talimatı
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Category Selector 2x2 */}
            <Text style={styles.label}>Talimat Kategorisi</Text>
            <View style={styles.categoryGrid}>
              <TouchableOpacity
                style={[
                  styles.categoryCard,
                  category === 'procedure' && styles.categoryCardActive,
                  {
                    backgroundColor: category === 'procedure'
                      ? (isDark ? 'rgba(37, 99, 235, 0.2)' : 'rgba(37, 99, 235, 0.1)')
                      : (isDark ? '#1e293b' : '#f8fafc'),
                    borderColor: category === 'procedure' ? '#2563eb' : (isDark ? '#334155' : '#cbd5e1'),
                  },
                ]}
                onPress={() => setCategory('procedure')}
                activeOpacity={0.8}
              >
                <BookOpen size={16} color={category === 'procedure' ? '#3b82f6' : '#94a3b8'} />
                <Text
                  style={[
                    styles.categoryText,
                    { color: category === 'procedure' ? '#3b82f6' : (isDark ? '#cbd5e1' : '#475569') },
                  ]}
                >
                  İş Prosedürü
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.categoryCard,
                  category === 'rule' && styles.categoryCardActive,
                  {
                    backgroundColor: category === 'rule'
                      ? (isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.1)')
                      : (isDark ? '#1e293b' : '#f8fafc'),
                    borderColor: category === 'rule' ? '#f59e0b' : (isDark ? '#334155' : '#cbd5e1'),
                  },
                ]}
                onPress={() => setCategory('rule')}
                activeOpacity={0.8}
              >
                <AlertTriangle size={16} color={category === 'rule' ? '#f59e0b' : '#94a3b8'} />
                <Text
                  style={[
                    styles.categoryText,
                    { color: category === 'rule' ? '#f59e0b' : (isDark ? '#cbd5e1' : '#475569') },
                  ]}
                >
                  Önemli Kural
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.categoryCard,
                  category === 'urgent' && styles.categoryCardActive,
                  {
                    backgroundColor: category === 'urgent'
                      ? (isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)')
                      : (isDark ? '#1e293b' : '#f8fafc'),
                    borderColor: category === 'urgent' ? '#ef4444' : (isDark ? '#334155' : '#cbd5e1'),
                  },
                ]}
                onPress={() => setCategory('urgent')}
                activeOpacity={0.8}
              >
                <ShieldAlert size={16} color={category === 'urgent' ? '#ef4444' : '#94a3b8'} />
                <Text
                  style={[
                    styles.categoryText,
                    { color: category === 'urgent' ? '#ef4444' : (isDark ? '#cbd5e1' : '#475569') },
                  ]}
                >
                  Acil Uyarı
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.categoryCard,
                  category === 'general' && styles.categoryCardActive,
                  {
                    backgroundColor: category === 'general'
                      ? (isDark ? 'rgba(14, 165, 233, 0.2)' : 'rgba(14, 165, 233, 0.1)')
                      : (isDark ? '#1e293b' : '#f8fafc'),
                    borderColor: category === 'general' ? '#0ea5e9' : (isDark ? '#334155' : '#cbd5e1'),
                  },
                ]}
                onPress={() => setCategory('general')}
                activeOpacity={0.8}
              >
                <Info size={16} color={category === 'general' ? '#0ea5e9' : '#94a3b8'} />
                <Text
                  style={[
                    styles.categoryText,
                    { color: category === 'general' ? '#0ea5e9' : (isDark ? '#cbd5e1' : '#475569') },
                  ]}
                >
                  Genel Bilgi
                </Text>
              </TouchableOpacity>
            </View>

            {/* Title */}
            <Text style={[styles.label, { marginTop: 14 }]}>
              Başlık <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  borderColor: isDark ? '#334155' : '#cbd5e1',
                  color: isDark ? '#f8fafc' : '#0f172a',
                },
              ]}
              placeholder="Örn: Cihaz Montajında Dikkat Edilecek Yeni Kural"
              placeholderTextColor="#64748b"
              value={title}
              onChangeText={setTitle}
            />

            {/* Content Textarea */}
            <Text style={[styles.label, { marginTop: 14 }]}>
              Talimat / Açıklama Metni <Text style={{ color: '#ef4444' }}>*</Text>
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
              placeholder="Personele aktarılacak talimatı detaylıca yazın (Örn: Bundan sonra müşteri ziyaretlerinde cihaz teslim formu imzalatılıp sisteme fotoğrafı yüklenecektir...)"
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={4}
              value={content}
              onChangeText={setContent}
              textAlignVertical="top"
            />

            {/* Photos & Documents */}
            <View style={styles.photoHeaderRow}>
              <Text style={styles.label}>Fotoğraf / Belge Ekle ({photos.length})</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[
                    styles.attachButton,
                    { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' },
                  ]}
                  onPress={handleTakePhoto}
                  activeOpacity={0.8}
                >
                  <Camera size={14} color="#3b82f6" />
                  <Text style={styles.attachButtonText}>Kamera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.attachButton,
                    { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' },
                  ]}
                  onPress={handlePickImage}
                  activeOpacity={0.8}
                >
                  <ImageIcon size={14} color="#3b82f6" />
                  <Text style={styles.attachButtonText}>Galeri</Text>
                </TouchableOpacity>
              </View>
            </View>

            {photos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {photos.map((uri, idx) => (
                    <View key={idx} style={styles.photoThumbWrapper}>
                      <Image source={{ uri }} style={styles.photoThumb} />
                      <TouchableOpacity
                        style={styles.photoRemoveBtn}
                        onPress={() => handleRemovePhoto(idx)}
                      >
                        <Trash2 size={12} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}

            {/* Checkbox 1: Pin to Top */}
            <TouchableOpacity
              style={[
                styles.optionCard,
                {
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  borderColor: isDark ? '#334155' : '#e2e8f0',
                  marginTop: 16,
                },
              ]}
              onPress={() => setIsPinned(!isPinned)}
              activeOpacity={0.8}
            >
              <View style={styles.optionLeft}>
                <View style={styles.optionIconSquircle}>
                  <Pin size={16} color="#94a3b8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                    En Üste Sabitle
                  </Text>
                  <Text style={styles.optionDesc}>
                    Önemli talimatlar listenin en başında görünür
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.checkbox,
                  isPinned && styles.checkboxActiveIndigo,
                  { borderColor: isPinned ? '#4f46e5' : '#64748b' },
                ]}
              >
                {isPinned && <Check size={14} color="#ffffff" />}
              </View>
            </TouchableOpacity>

            {/* Checkbox 2: Send Push Notification */}
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
                <View style={[styles.optionIconSquircle, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                  <Bell size={16} color="#3b82f6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                    Personele Kilit Ekranı Bildirimi Gönder
                  </Text>
                  <Text style={styles.optionDesc}>
                    Tüm personellerin telefonuna anlık sesli bildirim gider
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
              { borderTopColor: isDark ? '#1e293b' : '#e2e8f0' },
            ]}
          >
            <TouchableOpacity onPress={onClose} style={styles.cancelButton} activeOpacity={0.7}>
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              <Send size={15} color="#ffffff" />
              <Text style={styles.submitText}>Talimatı Yayınla</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
    flex: 1,
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
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  categoryCardActive: {
    borderWidth: 1.5,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    minHeight: 84,
    lineHeight: 18,
  },
  photoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  attachButtonText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '700',
  },
  photoThumbWrapper: {
    position: 'relative',
    marginRight: 6,
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
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
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
  checkboxActiveIndigo: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4f46e5',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: '#4f46e5',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
