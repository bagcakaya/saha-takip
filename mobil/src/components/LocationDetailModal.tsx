import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  X,
  CheckCircle2,
  Clock,
  MapPin,
  Camera,
  Trash2,
  Check,
  Ban,
  User,
  Navigation,
} from 'lucide-react-native';
import { LocationItem, TaskStatus } from '../types/storage';
import { useStorage } from '../context/StorageContext';
import { useAppTheme } from '../context/ThemeContext';
import { ImageService } from '../services/imageService';
import { LocationService } from '../services/locationService';

interface LocationDetailModalProps {
  location: LocationItem | null;
  visible: boolean;
  onClose: () => void;
}

export const LocationDetailModal: React.FC<LocationDetailModalProps> = ({
  location,
  visible,
  onClose,
}) => {
  if (!location) return null;

  const { completeLocation } = useStorage();
  const { isDark } = useAppTheme();

  const [tasks, setTasks] = useState(location.tasks || []);
  const [photos, setPhotos] = useState<string[]>(location.photos || []);
  const [completionNote, setCompletionNote] = useState(location.completionNote || '');
  const [submitting, setSubmitting] = useState(false);

  const toggleTaskStatus = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const nextStatus: TaskStatus =
            t.status === 'completed'
              ? 'not_present'
              : t.status === 'not_present'
              ? 'pending'
              : 'completed';
          return { ...t, status: nextStatus };
        }
        return t;
      })
    );
  };

  const handleAddPhoto = async () => {
    Alert.alert('Fotoğraf Ekle', 'Fotoğraf kaynağını seçin:', [
      {
        text: 'Kamera',
        onPress: async () => {
          const uri = await ImageService.takePhoto();
          if (uri) setPhotos((prev) => [...prev, uri]);
        },
      },
      {
        text: 'Galeri',
        onPress: async () => {
          const uri = await ImageService.pickImage();
          if (uri) setPhotos((prev) => [...prev, uri]);
        },
      },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  };

  const handleSave = async () => {
    setSubmitting(true);
    await completeLocation(location.id, completionNote, photos);
    setSubmitting(false);
    Alert.alert('Başarılı', 'Kurulum detayları ve tutanak kaydedildi.');
    onClose();
  };

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const notPresentCount = tasks.filter((t) => t.status === 'not_present').length;
  const totalTasks = tasks.length || 12;
  const percent = Math.round((completedCount / totalTasks) * 100);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalCard,
            { backgroundColor: isDark ? '#0b1329' : '#ffffff' },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                {location.name}
              </Text>
              {location.cariName ? (
                <Text style={styles.cariText}>🏢 {location.cariName}</Text>
              ) : null}
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={18} color={isDark ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {/* Progress Bar Summary */}
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: isDark ? '#020617' : '#f8fafc' },
              ]}
            >
              <View style={styles.progressRow}>
                <Text style={styles.progressText}>
                  ✅ {completedCount} / {totalTasks} Görev Tamam
                </Text>
                <Text style={styles.notPresentText}>
                  {notPresentCount} Mevcut Değil (%{percent})
                </Text>
              </View>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${(completedCount / totalTasks) * 100}%` },
                  ]}
                />
                <View
                  style={[
                    styles.progressBarOrange,
                    { width: `${(notPresentCount / totalTasks) * 100}%` },
                  ]}
                />
              </View>
            </View>

            {/* Address */}
            {location.address ? (
              <View style={styles.addressBox}>
                <MapPin size={15} color="#94a3b8" />
                <Text style={[styles.addressText, { color: isDark ? '#cbd5e1' : '#475569' }]}>
                  {location.address}
                </Text>
              </View>
            ) : null}

            {/* Checklist Tasks */}
            <Text style={[styles.sectionTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
              Kontrol Listesi Görevleri ({tasks.length})
            </Text>
            <View style={styles.tasksList}>
              {tasks.map((t) => {
                const isDone = t.status === 'completed';
                const isNotPresent = t.status === 'not_present';

                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.taskRow,
                      {
                        backgroundColor: isDark ? '#0c152e' : '#f8fafc',
                        borderColor: isDone
                          ? '#10b981'
                          : isNotPresent
                          ? '#f59e0b'
                          : isDark
                          ? '#1e293b'
                          : '#e2e8f0',
                      },
                    ]}
                    onPress={() => toggleTaskStatus(t.id)}
                  >
                    <View
                      style={[
                        styles.taskIconCircle,
                        {
                          backgroundColor: isDone
                            ? '#10b98120'
                            : isNotPresent
                            ? '#f59e0b20'
                            : 'rgba(148, 163, 184, 0.1)',
                        },
                      ]}
                    >
                      {isDone ? (
                        <Check size={14} color="#10b981" />
                      ) : isNotPresent ? (
                        <Ban size={14} color="#f59e0b" />
                      ) : (
                        <Clock size={14} color="#94a3b8" />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.taskName,
                        {
                          color: isDark ? '#ffffff' : '#0f172a',
                          textDecorationLine: isDone ? 'line-through' : 'none',
                        },
                      ]}
                    >
                      {t.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Photos */}
            <View style={styles.photoHeaderRow}>
              <Text style={[styles.sectionTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                Saha Fotoğrafları ({photos.length})
              </Text>
              <TouchableOpacity style={styles.addPhotoBtn} onPress={handleAddPhoto}>
                <Camera size={14} color="#ffffff" />
                <Text style={styles.addPhotoText}>+ Fotoğraf Ekle</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 8 }}>
              {photos.map((p, i) => (
                <View key={i} style={styles.photoThumbWrapper}>
                  <Image source={{ uri: p }} style={styles.photoThumb} />
                  <TouchableOpacity
                    style={styles.delPhotoBtn}
                    onPress={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 size={12} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            {/* Completion Note */}
            <Text style={[styles.sectionTitle, { color: isDark ? '#ffffff' : '#0f172a', marginTop: 12 }]}>
              Montaj ve Tamamlama Notu
            </Text>
            <TextInput
              style={[
                styles.noteInput,
                {
                  backgroundColor: isDark ? '#020617' : '#f8fafc',
                  borderColor: isDark ? '#334155' : '#cbd5e1',
                  color: isDark ? '#ffffff' : '#0f172a',
                },
              ]}
              placeholder="Montaj veya eksiklikler hakkında not girin..."
              placeholderTextColor="#64748b"
              value={completionNote}
              onChangeText={setCompletionNote}
              multiline
              numberOfLines={3}
            />

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <CheckCircle2 size={18} color="#ffffff" />
                  <Text style={styles.saveBtnText}>Tutanak ve Detayları Kaydet</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
  },
  cariText: {
    fontSize: 12,
    color: '#60a5fa',
    fontWeight: '700',
    marginTop: 2,
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
    padding: 18,
    gap: 12,
  },
  summaryCard: {
    padding: 12,
    borderRadius: 14,
    gap: 8,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#10b981',
  },
  notPresentText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#f59e0b',
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#334155',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10b981',
  },
  progressBarOrange: {
    height: '100%',
    backgroundColor: '#f59e0b',
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  addressText: {
    fontSize: 12,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 6,
  },
  tasksList: {
    gap: 8,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  taskIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskName: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  photoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  addPhotoText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  photoThumbWrapper: {
    position: 'relative',
    marginRight: 8,
  },
  photoThumb: {
    width: 70,
    height: 70,
    borderRadius: 10,
  },
  delPhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    borderRadius: 8,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    height: 70,
    textAlignVertical: 'top',
    fontSize: 13,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    height: 48,
    borderRadius: 14,
    marginTop: 10,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
});
