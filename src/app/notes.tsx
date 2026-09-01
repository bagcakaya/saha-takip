import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState, useMemo } from 'react';

import { requestNotificationPermission, scheduleLocalReminder, cancelLocalReminder } from '@/utils/notificationHelper';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';

interface GeneralNote {
  id: string;
  content: string;
  createdAt: number;
  reminderActive: boolean;
  reminderDate?: string; // ISO string representing reminder date & time
  notificationId?: string; // scheduled OS notification identifier
  notified?: boolean; // flags if reminder alert was already shown to user
}

const STORAGE_KEY_GENERAL_NOTES = '@gorev_tamamlama_general_notes';

export default function NotesScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [notes, setNotes] = useState<GeneralNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [reminderActive, setReminderActive] = useState(false);
  const [editingNote, setEditingNote] = useState<GeneralNote | null>(null);
  
  // Date & Time Picker States
  const [reminderDate, setReminderDate] = useState(new Date(Date.now() + 10 * 60 * 1000)); // default to 10 mins from now
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Load General Notes on Mount
  useEffect(() => {
    const initScreen = async () => {
      try {
        const storedNotes = await AsyncStorage.getItem(STORAGE_KEY_GENERAL_NOTES);
        if (storedNotes) {
          setNotes(JSON.parse(storedNotes));
        }
        
        // Request notifications permission safely
        await requestNotificationPermission();
      } catch (error) {
        console.error('Notlar yüklenirken hata oluştu:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initScreen();
  }, []);

  // Check reminders dynamically
  useEffect(() => {
    if (notes.length === 0) return;

    const checkReminders = async () => {
      const now = Date.now();
      let hasUpdates = false;

      const updatedNotes = notes.map((note) => {
        if (note.reminderActive && note.reminderDate && !note.notified) {
          const reminderTime = new Date(note.reminderDate).getTime();
          if (reminderTime <= now) {
            // Trigger in-app warning
            Alert.alert(
              '🔔 Hatırlatıcı Uyarısı',
              note.content,
              [{ text: 'Tamam', style: 'default' }]
            );
            hasUpdates = true;
            return { ...note, notified: true };
          }
        }
        return note;
      });

      if (hasUpdates) {
        await saveNotes(updatedNotes);
      }
    };

    const interval = setInterval(checkReminders, 4000);
    return () => clearInterval(interval);
  }, [notes]);

  // Save notes helper
  const saveNotes = async (newNotes: GeneralNote[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_GENERAL_NOTES, JSON.stringify(newNotes));
      setNotes(newNotes);
    } catch (error) {
      console.error('Notlar kaydedilemedi:', error);
    }
  };

  // Date and Time picker handlers
  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const updated = new Date(reminderDate);
      updated.setFullYear(selectedDate.getFullYear());
      updated.setMonth(selectedDate.getMonth());
      updated.setDate(selectedDate.getDate());
      setReminderDate(updated);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const updated = new Date(reminderDate);
      updated.setHours(selectedTime.getHours());
      updated.setMinutes(selectedTime.getMinutes());
      updated.setSeconds(0);
      setReminderDate(updated);
    }
  };

  const handleEditNote = (note: GeneralNote) => {
    setEditingNote(note);
    setNoteContent(note.content);
    setReminderActive(note.reminderActive);
    if (note.reminderActive && note.reminderDate) {
      setReminderDate(new Date(note.reminderDate));
    } else {
      setReminderDate(new Date(Date.now() + 10 * 60 * 1000));
    }
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setNoteContent('');
    setReminderActive(false);
    setReminderDate(new Date(Date.now() + 10 * 60 * 1000));
    setEditingNote(null);
  };

  // Add Note
  const handleSaveNote = async () => {
    if (!noteContent.trim()) {
      Alert.alert('Hata', 'Lütfen geçerli bir not içeriği girin.');
      return;
    }

    if (reminderActive) {
      if (reminderDate.getTime() <= Date.now()) {
        Alert.alert('Hata', 'Hatırlatıcı zamanı geçmişte olamaz. Lütfen ileri bir tarih ve saat seçin.');
        return;
      }
    }

    let notificationId: string | undefined;

    // If we are editing, cancel the old reminder notification if it exists
    if (editingNote && editingNote.notificationId) {
      try {
        await cancelLocalReminder(editingNote.notificationId);
      } catch (err) {
        console.error('Failed to cancel old reminder:', err);
      }
    }

    if (reminderActive) {
      try {
        notificationId = await scheduleLocalReminder(
          'Not Hatırlatıcısı',
          noteContent.length > 60 ? `${noteContent.substring(0, 60)}...` : noteContent,
          reminderDate
        );
      } catch (err) {
        console.error('Failed to schedule reminder:', err);
      }
    }

    const updatedNote: GeneralNote = {
      id: editingNote ? editingNote.id : Date.now().toString(36) + Math.random().toString(36).substring(2, 9),
      content: noteContent.trim(),
      createdAt: editingNote ? editingNote.createdAt : Date.now(),
      reminderActive,
      reminderDate: reminderActive ? reminderDate.toISOString() : undefined,
      notificationId,
      notified: false,
    };

    // 1. Close the modal first to prevent UI freezing/overlay stuck race condition
    setModalVisible(false);

    // 2. Perform the state updates and saving after a short delay (once transition finishes)
    setTimeout(async () => {
      let updatedNotes: GeneralNote[];
      if (editingNote) {
        updatedNotes = notes.map((n) => (n.id === editingNote.id ? updatedNote : n));
      } else {
        updatedNotes = [updatedNote, ...notes];
      }
      await saveNotes(updatedNotes);
      setNoteContent('');
      setReminderActive(false);
      setReminderDate(new Date(Date.now() + 10 * 60 * 1000));
      setEditingNote(null);
    }, 250);
  };

  // Delete Note
  const handleDeleteNote = (noteId: string, notifId?: string) => {
    Alert.alert(
      'Notu Sil',
      'Bu notu silmek istediğinize emin misiniz? Varsa hatırlatıcı bildirimi de iptal edilecektir.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            if (notifId) {
              try {
                await cancelLocalReminder(notifId);
              } catch (err) {
                console.error('Failed to cancel reminder on delete:', err);
              }
            }
            const updated = notes.filter((n) => n.id !== noteId);
            await saveNotes(updated);
          },
        },
      ]
    );
  };

  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => b.createdAt - a.createdAt);
  }, [notes]);

  const formattedDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Not Defteri</Text>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Notlar & Hatırlatıcılar</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={24} color={scheme === 'dark' ? '#0F172A' : '#FFFFFF'} />
        </TouchableOpacity>
      </View>

      {/* Info InfoCard */}
      {notes.length === 0 && !isLoading && (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconBg, { backgroundColor: colors.backgroundSelected }]}>
            <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
          </View>
          <Text style={[styles.emptyText, { color: colors.text }]}>Henüz bir not yok.</Text>
          <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
            Kendiniz için genel notlar ekleyebilir, tarih ve saat seçerek alarmlı hatırlatıcılar kurabilirsiniz.
          </Text>
          <TouchableOpacity
            style={[styles.emptyAddBtn, { backgroundColor: colors.primaryBg }]}
            onPress={() => setModalVisible(true)}
          >
            <Text style={{ color: colors.text, fontWeight: '600' }}>İlk Notu Ekle</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Notes List */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {notes.length > 0 && (
          <View style={styles.listContainer}>
            {sortedNotes.map((note) => {
              const isReminderPast = note.reminderDate
                ? new Date(note.reminderDate).getTime() < Date.now()
                : false;

              return (
                <View
                  key={note.id}
                  style={[styles.noteCard, { backgroundColor: colors.backgroundElement }]}
                >
                  <View style={styles.noteHeader}>
                    <Text style={[styles.noteDate, { color: colors.textSecondary }]}>
                      {new Date(note.createdAt).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TouchableOpacity
                        style={[styles.deleteBtnIcon, { marginRight: Spacing.two }]}
                        onPress={() => handleEditNote(note)}
                      >
                        <Ionicons name="create-outline" size={18} color={colors.primaryAccent} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteBtnIcon}
                        onPress={() => handleDeleteNote(note.id, note.notificationId)}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={[styles.noteContentText, { color: colors.text }]}>
                    {note.content}
                  </Text>

                  {/* Reminder Badge */}
                  {note.reminderActive && note.reminderDate && (
                    <View
                      style={[
                        styles.reminderBadge,
                        {
                          backgroundColor: isReminderPast
                            ? colors.backgroundSelected
                            : colors.statusPending + '15',
                          borderColor: isReminderPast ? colors.backgroundSelected : colors.statusPending + '40',
                        },
                      ]}
                    >
                      <Ionicons
                        name={isReminderPast ? 'alarm-outline' : 'alarm'}
                        size={14}
                        color={isReminderPast ? colors.textSecondary : colors.statusPending}
                      />
                      <Text
                        style={[
                          styles.reminderText,
                          { color: isReminderPast ? colors.textSecondary : colors.text },
                        ]}
                      >
                        {isReminderPast ? 'Hatırlatıldı: ' : 'Hatırlatıcı: '}
                        {formattedDateTime(note.reminderDate)}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Add Note Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.modalContent, { backgroundColor: colors.backgroundElement }]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingNote ? 'Notu Düzenle' : 'Yeni Not & Hatırlatıcı'}
              </Text>
              <TouchableOpacity onPress={handleCloseModal}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Content Input */}
            <TextInput
              style={[
                styles.modalInput,
                { color: colors.text, borderColor: colors.backgroundSelected, backgroundColor: colors.background },
              ]}
              placeholder="Notunuzu yazın..."
              placeholderTextColor={colors.textSecondary}
              value={noteContent}
              onChangeText={setNoteContent}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
            />

            {/* Reminder Switch */}
            <View style={[styles.switchRow, { borderTopColor: colors.backgroundSelected }]}>
              <View style={styles.switchLabelCol}>
                <Ionicons
                  name={reminderActive ? 'notifications' : 'notifications-off-outline'}
                  size={20}
                  color={reminderActive ? colors.primaryAccent : colors.textSecondary}
                />
                <Text style={[styles.switchLabel, { color: colors.text }]}>Hatırlatıcı Bildirimi Kur</Text>
              </View>
              <Switch
                value={reminderActive}
                onValueChange={setReminderActive}
                trackColor={{ false: colors.backgroundSelected, true: colors.primary }}
                thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
              />
            </View>

            {/* Date Time Picker Buttons */}
            {reminderActive && (
              <View style={styles.dateTimeContainer}>
                <Text style={[styles.dateTimeLabel, { color: colors.textSecondary }]}>
                  Zaman Seçimi:
                </Text>
                
                <View style={styles.dateTimeButtonsRow}>
                  <TouchableOpacity
                    style={[styles.dateTimeBtn, { backgroundColor: colors.background }]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={16} color={colors.primaryAccent} />
                    <Text style={[styles.dateTimeBtnText, { color: colors.text }]}>
                      {reminderDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dateTimeBtn, { backgroundColor: colors.background }]}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Ionicons name="time-outline" size={16} color={colors.primaryAccent} />
                    <Text style={[styles.dateTimeBtnText, { color: colors.text }]}>
                      {reminderDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* DateTimePicker Modals */}
                {showDatePicker && (
                  <DateTimePicker
                    value={reminderDate}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                  />
                )}

                {showTimePicker && (
                  <DateTimePicker
                    value={reminderDate}
                    mode="time"
                    display="default"
                    onChange={handleTimeChange}
                  />
                )}
              </View>
            )}

            {/* Modal Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel, { borderColor: colors.backgroundSelected }]}
                onPress={handleCloseModal}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveNote}
              >
                <Text style={[styles.modalBtnText, { color: scheme === 'dark' ? '#0F172A' : '#FFFFFF', fontWeight: 'bold' }]}>
                  {editingNote ? 'Güncelle' : 'Kaydet'}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: Spacing.five,
  },
  listContainer: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  noteCard: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  noteDate: {
    fontSize: 11,
  },
  deleteBtnIcon: {
    padding: Spacing.one,
  },
  noteContentText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: Spacing.two,
  },
  reminderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.one,
    borderWidth: 1,
    gap: 6,
    alignSelf: 'flex-start',
  },
  reminderText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.five,
  },
  emptyIconBg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.one,
  },
  emptySubText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.three,
  },
  emptyAddBtn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: Spacing.three,
    borderTopRightRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.four,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalInput: {
    height: 100,
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 14,
    marginBottom: Spacing.three,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
  },
  switchLabelCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  dateTimeContainer: {
    marginVertical: Spacing.two,
  },
  dateTimeLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: Spacing.one,
  },
  dateTimeButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  dateTimeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Spacing.two,
    gap: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  dateTimeBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnCancel: {
    borderWidth: 1,
  },
  modalBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
