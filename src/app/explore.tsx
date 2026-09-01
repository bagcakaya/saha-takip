import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { documentDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';
import { useStorage } from '@/hooks/useStorage';

export default function ExploreScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const {
    locations,
    standardTasks,
    addStandardTask,
    deleteStandardTask,
    resetStandardTasks,
    importBackupData,
    isLoading,
  } = useStorage();

  // Task Search and Input State
  const [searchQuery, setSearchQuery] = useState('');
  const [newTaskName, setNewTaskName] = useState('');

  // Filtered standard tasks
  const filteredTasks = useMemo(() => {
    return standardTasks.filter((task) =>
      task.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [standardTasks, searchQuery]);

  // Handle adding new standard task to template
  const handleAddTask = async () => {
    if (!newTaskName.trim()) {
      Alert.alert('Hata', 'Lütfen geçerli bir görev açıklaması girin.');
      return;
    }
    
    // Check if task already exists in template
    if (standardTasks.some((t) => t.toLowerCase() === newTaskName.trim().toLowerCase())) {
      Alert.alert('Hata', 'Bu görev zaten şablonda mevcut.');
      return;
    }

    await addStandardTask(newTaskName);
    setNewTaskName('');
  };

  // Handle deleting standard task from template
  const handleDeleteTask = (index: number, taskName: string) => {
    Alert.alert(
      'Görevi Şablondan Sil',
      `"${taskName}" görevini şablondan silmek istediğinize emin misiniz?\n\n*Bu işlem mevcut lokasyonlardaki görevleri etkilemez, sadece yeni oluşturulacak lokasyonları etkiler.`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Şablondan Sil',
          style: 'destructive',
          onPress: async () => {
            await deleteStandardTask(index);
          },
        },
      ]
    );
  };

  // Handle resetting tasks to template defaults
  const handleResetTemplate = () => {
    Alert.alert(
      'Varsayılana Sıfırla',
      'Şablon görev listesini ilk haline (12 adet varsayılan kurulum görevi) sıfırlamak istediğinize emin misiniz? Kendi eklediğiniz tüm şablon görevler silinecektir.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sıfırla',
          style: 'destructive',
          onPress: async () => {
            await resetStandardTasks();
          },
        },
      ]
    );
  };

  // Handle Export Backup (JSON Export)
  const handleExportBackup = async () => {
    try {
      const backupData = { locations, standardTasks };
      const backupString = JSON.stringify(backupData, null, 2);
      const fileUri = `${documentDirectory}gorev_tamamlama_yedek.json`;
      
      await writeAsStringAsync(fileUri, backupString, {
        encoding: 'utf8',
      });

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Kurulum Verilerini Yedekle',
        UTI: 'public.json',
      });
    } catch (error) {
      console.error('Yedek dışa aktarılırken hata oluştu:', error);
      Alert.alert('Hata', 'Yedek dosyası oluşturulurken bir sorun oluştu.');
    }
  };

  // Handle Import Backup (JSON Import)
  const handleImportBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileUri = result.assets[0].uri;
        const fileContent = await readAsStringAsync(fileUri, {
          encoding: 'utf8',
        });
        
        const parsedData = JSON.parse(fileContent);

        if (!parsedData.locations || !parsedData.standardTasks) {
          Alert.alert('Hata', 'Seçilen dosya geçerli bir yedek dosyası değil.');
          return;
        }

        Alert.alert(
          'Yedeği İçe Aktar',
          'Bu yedeği içe aktarmak, cihazınızdaki tüm mevcut kurulum kayıtlarını ve şablon görevleri silerek yedeğin üzerine yazacaktır. Devam etmek istiyor musunuz?',
          [
            { text: 'İptal', style: 'cancel' },
            {
              text: 'Yükle',
              style: 'destructive',
              onPress: async () => {
                await importBackupData(parsedData);
                Alert.alert('Başarılı', 'Yedek dosyasından veriler başarıyla geri yüklendi.');
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Yedek içe aktarılırken hata oluştu:', error);
      Alert.alert('Hata', 'Yedek yüklenirken bir sorun oluştu. Dosyanın geçerli bir JSON yedeği olduğundan emin olun.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={{ flex: 1 }}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Şablon Yönetimi</Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Standart Görevler</Text>
          </View>
          {standardTasks.length > 0 && (
            <TouchableOpacity
              style={[styles.resetButton, { borderColor: colors.danger }]}
              onPress={handleResetTemplate}
            >
              <Ionicons name="refresh-outline" size={16} color={colors.danger} />
              <Text style={[styles.resetButtonText, { color: colors.danger }]}>Sıfırla</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Info Card */}
          <View style={[styles.infoCard, { backgroundColor: colors.backgroundElement }]}>
            <Ionicons name="information-circle-outline" size={20} color={colors.primaryAccent} style={styles.infoIcon} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Burada tanımladığınız standart görev listesi, ekleyeceğiniz her yeni kurulum yeri için otomatik olarak kopyalanacaktır. Mevcut kurulum yerlerindeki görevler bu listeden etkilenmez.
            </Text>
          </View>

          {/* Backup Card */}
          <View style={[styles.backupCard, { backgroundColor: colors.backgroundElement }]}>
            <View style={styles.backupHeader}>
              <Ionicons name="cloud-done-outline" size={20} color={colors.primaryAccent} />
              <Text style={[styles.backupTitle, { color: colors.text }]}>Yedekleme ve Veri Taşıma</Text>
            </View>
            <Text style={[styles.backupDesc, { color: colors.textSecondary }]}>
              Tüm geçmiş kurulumlarınızı, görev durumlarını, adresleri ve notları JSON dosyası olarak yedekleyin veya başka bir telefona aktarın.
            </Text>
            <View style={styles.backupBtnRow}>
              <TouchableOpacity
                style={[styles.backupBtn, { backgroundColor: colors.primaryBg }]}
                onPress={handleExportBackup}
              >
                <Ionicons name="cloud-upload-outline" size={16} color={colors.text} />
                <Text style={[styles.backupBtnText, { color: colors.text }]}>Yedek Al</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.backupBtn, { backgroundColor: colors.primaryBg }]}
                onPress={handleImportBackup}
              >
                <Ionicons name="cloud-download-outline" size={16} color={colors.text} />
                <Text style={[styles.backupBtnText, { color: colors.text }]}>Yedek Yükle</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Input */}
          {standardTasks.length > 0 && (
            <View style={[styles.searchContainer, { backgroundColor: colors.backgroundElement }]}>
              <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Şablon görevlerde ara..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Task List */}
          {isLoading ? (
            <View style={styles.centered}>
              <Text style={{ color: colors.textSecondary }}>Yükleniyor...</Text>
            </View>
          ) : filteredTasks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconBg, { backgroundColor: colors.backgroundSelected }]}>
                <Ionicons name="list" size={48} color={colors.textSecondary} />
              </View>
              <Text style={[styles.emptyText, { color: colors.text }]}>
                {searchQuery ? 'Aramayla eşleşen şablon görev bulunamadı.' : 'Şablonda görev bulunmuyor.'}
              </Text>
              <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
                {searchQuery ? 'Lütfen arama teriminizi kontrol edin.' : 'Yeni kurulacak yerlere atanması için aşağıdaki alandan standart görev ekleyin.'}
              </Text>
              {!searchQuery && (
                <TouchableOpacity
                  style={[styles.resetTemplateBtn, { backgroundColor: colors.primaryBg, marginTop: Spacing.four }]}
                  onPress={handleResetTemplate}
                >
                  <Text style={{ color: colors.text, fontWeight: '600' }}>Varsayılan Şablonu Yükle</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.tasksListBlock}>
              {filteredTasks.map((task, idx) => {
                // Find actual index in standardTasks list for deletion
                const originalIndex = standardTasks.indexOf(task);
                return (
                  <View
                    key={`${task}-${idx}`}
                    style={[styles.taskCard, { backgroundColor: colors.backgroundElement }]}
                  >
                    <Text style={[styles.taskName, { color: colors.text }]}>
                      {task}
                    </Text>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteTask(originalIndex, task)}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Add Task Input Field */}
        <View style={[styles.addInputContainer, { borderTopColor: colors.backgroundSelected }]}>
          <TextInput
            style={[
              styles.addInput,
              { color: colors.text, borderColor: colors.backgroundSelected, backgroundColor: colors.backgroundElement },
            ]}
            placeholder="Yeni standart şablon görevi ekle..."
            placeholderTextColor={colors.textSecondary}
            value={newTaskName}
            onChangeText={setNewTaskName}
          />
          <TouchableOpacity
            style={[styles.addTaskBtn, { backgroundColor: colors.primary }]}
            onPress={handleAddTask}
          >
            <Ionicons name="add" size={24} color={scheme === 'dark' ? '#0F172A' : '#FFFFFF'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Spacing.two,
    gap: 4,
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: Spacing.five,
  },
  infoCard: {
    flexDirection: 'row',
    marginHorizontal: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.three,
  },
  infoIcon: {
    marginRight: Spacing.two,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  backupCard: {
    marginHorizontal: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  backupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  backupTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  backupDesc: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: Spacing.two,
  },
  backupBtnRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  backupBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 38,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  backupBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.three,
    paddingHorizontal: Spacing.three,
    height: 44,
    borderRadius: Spacing.three,
    marginBottom: Spacing.two,
  },
  searchIcon: {
    marginRight: Spacing.two,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    paddingVertical: 0,
  },
  centered: {
    paddingVertical: Spacing.five,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.four,
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
  },
  resetTemplateBtn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
  },
  tasksListBlock: {
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.three,
  },
  taskCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  taskName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    paddingRight: Spacing.two,
  },
  deleteButton: {
    padding: Spacing.one,
  },
  addInputContainer: {
    flexDirection: 'row',
    padding: Spacing.three,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  addInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 13,
    marginRight: Spacing.two,
    paddingVertical: 0,
  },
  addTaskBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
