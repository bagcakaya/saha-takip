import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { X, Package, Save, Edit2, AlertCircle, Building2, FileText } from 'lucide-react-native';
import { GeneralNote } from '../types/storage';
import { useStorage } from '../context/StorageContext';
import { useAppTheme } from '../context/ThemeContext';

interface UsedMaterialsModalProps {
  isOpen: boolean;
  note: GeneralNote | null;
  onClose: () => void;
  isAdmin?: boolean;
}

export default function UsedMaterialsModal({
  isOpen,
  note,
  onClose,
  isAdmin = false,
}: UsedMaterialsModalProps) {
  const { updateNoteMaterials } = useStorage();
  const { isDark } = useAppTheme();
  const [materials, setMaterials] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(!isAdmin);

  useEffect(() => {
    if (isOpen && note) {
      setMaterials(note.usedMaterials || '');
      setIsEditing(!isAdmin);
      setIsSaving(false);
    }
  }, [isOpen, note, isAdmin]);

  if (!isOpen || !note) return null;

  const hasMaterials = Boolean(note.usedMaterials && note.usedMaterials.trim().length > 0);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await updateNoteMaterials(note.id, materials.trim());
      onClose();
    } catch {
      Alert.alert('Hata', 'Malzemeler kaydedilirken bir sorun oluştu.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          <View style={[styles.modalBox, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
              <View style={styles.headerLeft}>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: hasMaterials ? 'rgba(16, 185, 129, 0.15)' : 'rgba(225, 29, 72, 0.15)' },
                  ]}
                >
                  <Package size={20} color={hasMaterials ? '#10b981' : '#e11d48'} />
                </View>
                <View>
                  <View style={styles.titleRow}>
                    <Text style={[styles.title, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                      Kullanılan Malzemeler
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: hasMaterials ? 'rgba(16, 185, 129, 0.15)' : 'rgba(225, 29, 72, 0.15)' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: hasMaterials ? '#10b981' : '#e11d48' },
                        ]}
                      >
                        {hasMaterials ? 'Kayıtlı (Yeşil)' : 'Kayıt Yok (Kırmızı)'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.subtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                    {isAdmin
                      ? hasMaterials
                        ? 'Personelin kaydettiği malzemeler'
                        : 'Personel henüz malzeme kaydı yapmadı'
                      : 'İş emrinde kullanılan malzemeleri kaydediniz'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <X size={20} color={isDark ? '#94a3b8' : '#64748b'} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              {/* Note Content Context */}
              <View style={[styles.noteContextBox, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }]}>
                {note.cariName ? (
                  <View style={styles.cariRow}>
                    <Building2 size={13} color="#3b82f6" />
                    <Text style={styles.cariNameText}>{note.cariName}</Text>
                  </View>
                ) : null}
                <View style={styles.contentHeader}>
                  <FileText size={12} color="#94a3b8" />
                  <Text style={styles.contentLabel}>İŞ EMRİ AÇIKLAMASI</Text>
                </View>
                <Text style={[styles.noteContentText, { color: isDark ? '#cbd5e1' : '#334155' }]} numberOfLines={3}>
                  {note.content}
                </Text>
              </View>

              {/* Admin View Mode */}
              {isAdmin && !isEditing ? (
                <View style={styles.managerViewBox}>
                  <View style={styles.managerLabelRow}>
                    <Text style={[styles.sectionLabel, { color: isDark ? '#cbd5e1' : '#334155' }]}>
                      {hasMaterials ? 'GİRİLEN MALZEMELER:' : 'MALZEME KAYIT DURUMU:'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setIsEditing(true)}
                      style={styles.editBtn}
                      activeOpacity={0.7}
                    >
                      <Edit2 size={13} color="#3b82f6" />
                      <Text style={styles.editBtnText}>
                        {hasMaterials ? 'Düzenle' : 'El İle Malzeme Ekle'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {hasMaterials ? (
                    <View style={[styles.materialsDisplayBox, { backgroundColor: isDark ? '#062d1f' : '#ecfdf5', borderColor: isDark ? '#047857' : '#a7f3d0' }]}>
                      <Text style={[styles.materialsDisplayText, { color: isDark ? '#a7f3d0' : '#065f46' }]}>
                        {note.usedMaterials}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.emptyAlertBox, { backgroundColor: isDark ? '#311019' : '#fff1f2', borderColor: isDark ? '#9f1239' : '#fecdd3' }]}>
                      <AlertCircle size={18} color="#e11d48" style={{ marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.emptyAlertTitle, { color: isDark ? '#fda4af' : '#9f1239' }]}>
                          Personel henüz malzeme kaydı yapmadı.
                        </Text>
                        <Text style={[styles.emptyAlertDesc, { color: isDark ? '#fb7185' : '#be123c' }]}>
                          Personel malzeme girmeden veya kaydet demeden işi gönderdiğinde buton kırmızı renkte kalır.
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                /* Edit / Input Mode */
                <View style={styles.formBox}>
                  <Text style={[styles.sectionLabel, { color: isDark ? '#cbd5e1' : '#334155' }]}>
                    KULLANILAN MALZEME LİSTESİ / DETAY
                  </Text>
                  <TextInput
                    style={[
                      styles.textArea,
                      {
                        backgroundColor: isDark ? '#020617' : '#f8fafc',
                        color: isDark ? '#f8fafc' : '#0f172a',
                        borderColor: isDark ? '#334155' : '#cbd5e1',
                      },
                    ]}
                    placeholder="Bu iş emrinde kullanılan malzemeleri ve adetlerini yazınız...&#10;Örn:&#10;• 1 Adet Güç Kaynağı&#10;• 15 Metre Cat6 Kablo"
                    placeholderTextColor="#64748b"
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                    value={materials}
                    onChangeText={setMaterials}
                    autoFocus
                  />
                  <Text style={styles.hintText}>
                    {materials.trim().length > 0
                      ? 'Kaydettiğinizde buton Yeşil renge dönecek ve yöneticiye iletilecektir.'
                      : 'Boş bırakırsanız veya kaydetmezseniz buton Kırmızı renkte kalacaktır.'}
                  </Text>

                  <View style={styles.btnRow}>
                    <TouchableOpacity
                      style={[styles.cancelBtn, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}
                      onPress={onClose}
                      disabled={isSaving}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.cancelBtnText, { color: isDark ? '#cbd5e1' : '#475569' }]}>Vazgeç</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.saveBtn}
                      onPress={handleSave}
                      disabled={isSaving}
                      activeOpacity={0.8}
                    >
                      <Save size={15} color="#ffffff" />
                      <Text style={styles.saveBtnText}>
                        {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Close Button in Manager View */}
              {isAdmin && !isEditing && (
                <View style={styles.footerRow}>
                  <TouchableOpacity
                    style={[styles.fullCloseBtn, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}
                    onPress={onClose}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.fullCloseBtnText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>Kapat</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  keyboardContainer: {
    width: '100%',
    maxWidth: 480,
  },
  modalBox: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 10,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  noteContextBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  cariRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  cariNameText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3b82f6',
  },
  contentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contentLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  noteContentText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  managerViewBox: {
    gap: 10,
  },
  managerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3b82f6',
  },
  materialsDisplayBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 80,
  },
  materialsDisplayText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  emptyAlertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  emptyAlertTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  emptyAlertDesc: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
    fontWeight: '500',
  },
  formBox: {
    gap: 10,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    minHeight: 110,
    lineHeight: 20,
  },
  hintText: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  footerRow: {
    paddingTop: 6,
  },
  fullCloseBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  fullCloseBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
