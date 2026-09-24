import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  RefreshControl,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Users,
  Store,
  Bell,
  Sun,
  Moon,
  LogOut,
  RotateCcw,
  Database,
  CloudUpload,
  CloudDownload,
  Building2,
  Eye,
  Download,
  Upload,
  Search,
  Plus,
  Trash2,
  X,
  Info,
} from 'lucide-react-native';
import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { UserManagementModal } from '../../components/UserManagementModal';
import { CreateCompanyModal } from '../../components/CreateCompanyModal';
import { BranchManagementModal } from '../../components/BranchManagementModal';
import { NotificationListModal } from '../../components/NotificationListModal';
import { CariListModal } from '../../components/CariListModal';
import carilerData from '../../data/cariler.json';

export default function TemplatesScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useAppTheme();
  const {
    standardTasks,
    addStandardTask,
    deleteStandardTask,
    resetStandardTasks,
    cariler,
    carilerUpdatedAt,
    carilerDatabase,
    importCarilerFromExcelBuffer,
    exportCarilerToExcel,
    locations,
    services,
    returnWarrantyItems,
    notes,
    refreshData,
  } = useStorage();

  const [isUploadingExcel, setIsUploadingExcel] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isPolatlar = (user?.companyCode || 'POLATLAR').toUpperCase() === 'POLATLAR';

  // Management Modals
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [isCariModalOpen, setIsCariModalOpen] = useState(false);

  // Search & New Task
  const [searchQuery, setSearchQuery] = useState('');
  const [newTaskName, setNewTaskName] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert('Çıkış Yap', 'Hesabınızdan güvenli çıkış yapmak istediğinize emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: () => logout() },
    ]);
  };

  // Reset standard tasks
  const handleResetTasks = () => {
    Alert.alert(
      'Varsayılana Sıfırla',
      'Şablon görev listesini ilk haline (15 adet varsayılan kurulum görevi) sıfırlamak istediğinize emin misiniz? Kendi eklediğiniz tüm şablon görevler silinecektir.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sıfırla',
          style: 'destructive',
          onPress: async () => {
            await resetStandardTasks();
            Alert.alert('Başarılı', 'Şablon görevleri varsayılan 15 göreve sıfırlandı.');
          },
        },
      ]
    );
  };

  // Export JSON Backup
  const handleExportBackup = async () => {
    try {
      const backupObj = {
        exportDate: new Date().toISOString(),
        companyCode: user?.companyCode || 'POLATLAR',
        standardTasks,
        locationsCount: locations.length,
        servicesCount: services.length,
        notesCount: notes.length,
        returnWarrantyCount: returnWarrantyItems.length,
        locations,
        services,
        notes,
        returnWarrantyItems,
      };

      const jsonString = JSON.stringify(backupObj, null, 2);
      await Share.share({
        title: `gorev_tamamlama_yedek_${new Date().toISOString().split('T')[0]}.json`,
        message: jsonString,
      });
    } catch {
      Alert.alert('Hata', 'Yedek dosyası dışa aktarılamadı.');
    }
  };

  // Import Backup Info
  const handleImportBackupInfo = () => {
    Alert.alert(
      'Yedek Yükle',
      'Tam veri yedeğini JSON dosyasından geri yüklemek için web yönetim panelini kullanabilirsiniz.',
      [{ text: 'Tamam' }]
    );
  };

  // Export Cariler to Excel (.xlsx)
  const handleExportCariler = async () => {
    try {
      if (cariler.length === 0) {
        Alert.alert('Uyarı', 'Dışa aktarılacak cari hesap bulunamadı.');
        return;
      }
      await exportCarilerToExcel('Cariler.xlsx');
      Alert.alert('Başarılı', `${cariler.length} adet cari Cariler.xlsx olarak indirildi.`);
    } catch {
      Alert.alert('Hata', 'Cari listesi Excel olarak dışa aktarılamadı.');
    }
  };

  // Upload Excel file (.xlsx)
  const handleExcelUpload = () => {
    if (typeof document === 'undefined') {
      Alert.alert(
        'Excel Cari Entegrasyonu',
        'SSMS veritabanındaki yeni carileri güncellemek için masaüstünüzdeki Cari_Guncelle.bat dosyasını çift tıklayabilir veya web yönetim panelinden Excel yükleyebilirsiniz.',
        [{ text: 'Tamam' }]
      );
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = async (e: any) => {
      try {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingExcel(true);
        const buffer = await file.arrayBuffer();
        const res = await importCarilerFromExcelBuffer(buffer, file.name);
        setIsUploadingExcel(false);

        if (res.success) {
          Alert.alert(
            'Excel Yüklendi 🎉',
            `"${file.name}" dosyasından ${res.total} adet cari başarıyla sisteme aktarıldı ve buluta kaydedildi.`
          );
        } else {
          Alert.alert('Yükleme Hatası', res.message);
        }
      } catch (err: any) {
        setIsUploadingExcel(false);
        Alert.alert('Hata', err?.message || 'Excel dosyası okunurken hata oluştu.');
      } finally {
        if (document.body.contains(input)) {
          document.body.removeChild(input);
        }
      }
    };

    input.click();
  };

  // Add Task
  const handleAddTask = async () => {
    const trimmed = newTaskName.trim();
    if (!trimmed) return;

    if (standardTasks.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert('Uyarı', 'Bu görev zaten şablonda mevcut.');
      return;
    }

    const res = await addStandardTask(trimmed);
    if (res.success) {
      setNewTaskName('');
    } else {
      Alert.alert('Hata', res.message);
    }
  };

  // Delete Task
  const handleDeleteTask = (index: number, taskName: string) => {
    Alert.alert(
      'Görevi Sil',
      `"${taskName}" görevini şablondan silmek istediğinize emin misiniz?\n\n*Bu işlem mevcut kurulumlardaki görevleri etkilemez, sadece yeni oluşturulacak yerleri etkiler.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            await deleteStandardTask(index);
          },
        },
      ]
    );
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return standardTasks;
    return standardTasks.filter((t) => t.toLowerCase().includes(q));
  }, [standardTasks, searchQuery]);

  // Formatted date from carilerData or carilerUpdatedAt
  const formattedCarilerDate = useMemo(() => {
    const raw = carilerUpdatedAt || (carilerData as any)?.updatedAt;
    if (raw) {
      try {
        const d = new Date(raw);
        return d.toLocaleDateString('tr-TR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return '17.09.2026 13:34';
      }
    }
    return '17.09.2026 13:34';
  }, [carilerUpdatedAt]);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#020617' : '#f8fafc' }]}>
      {/* 1. Top Navigation Bar (Squircle Buttons) */}
      <View
        style={[
          styles.navBar,
          {
            backgroundColor: isDark ? '#0b1329' : '#ffffff',
            borderBottomColor: isDark ? '#1e293b' : '#e2e8f0',
          },
        ]}
      >
        <View style={styles.topBarContainer}>
          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => router.push('/(tabs)')}
            activeOpacity={0.8}
          >
            <ArrowLeft size={16} color="#ffffff" />
            <Text style={styles.homeBtnText}>Ana Menü</Text>
          </TouchableOpacity>

          <View style={styles.topBarIconsRow}>
            {isAdmin && (
              <TouchableOpacity
                style={styles.topIconBtnUsers}
                onPress={() => setIsUserModalOpen(true)}
                activeOpacity={0.7}
              >
                <Users size={17} color="#f59e0b" />
              </TouchableOpacity>
            )}

            {isAdmin && (
              <TouchableOpacity
                style={styles.topIconBtnBranch}
                onPress={() => setIsCreateCompanyOpen(true)}
                activeOpacity={0.7}
              >
                <Building2 size={17} color="#3b82f6" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.topIconBtnNotif}
              onPress={() => setIsNotifModalOpen(true)}
              activeOpacity={0.7}
            >
              <Bell size={17} color="#10b981" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.topIconBtnTheme}
              onPress={toggleTheme}
              activeOpacity={0.7}
            >
              {isDark ? (
                <Sun size={17} color="#f59e0b" />
              ) : (
                <Moon size={17} color="#6366f1" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.topIconBtnLogout}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <LogOut size={17} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={{ paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Görsel-4: Card 1 - Standart Şablon Yönetimi Header Card */}
        <View
          style={[
            styles.headerCard,
            {
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              borderColor: isDark ? '#1e293b' : '#e2e8f0',
            },
          ]}
        >
          <View style={styles.headerCardLeft}>
            <Text
              style={[
                styles.headerCardTitle,
                { color: isDark ? '#f8fafc' : '#0f172a' },
              ]}
            >
              Standart Şablon Yönetimi
            </Text>
            <Text
              style={[
                styles.headerCardSubtitle,
                { color: isDark ? '#94a3b8' : '#64748b' },
              ]}
            >
              Yeni açılacak kurulumlar için toplam {standardTasks.length} adet otomatik tanımlı görev
            </Text>
          </View>

          {isPolatlar && (
            <TouchableOpacity
              style={[
                styles.resetBtn,
                {
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2',
                  borderColor: 'rgba(239, 68, 68, 0.35)',
                },
              ]}
              onPress={handleResetTasks}
              activeOpacity={0.8}
            >
              <RotateCcw size={13} color="#ef4444" />
              <Text style={styles.resetBtnText}>Varsayılana Sıfırla</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Görsel-4: Card 2 - Yedekleme ve Veri Taşıma */}
        <View
          style={[
            styles.cardBox,
            {
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              borderColor: isDark ? '#1e293b' : '#e2e8f0',
            },
          ]}
        >
          {/* Header */}
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconContainer, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff' }]}>
              <Database size={18} color="#3b82f6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                Yedekleme ve Veri Taşıma
              </Text>
              <Text style={[styles.cardSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                JSON formatında tam veri yedekleme
              </Text>
            </View>
          </View>

          <Text style={[styles.cardDesc, { color: isDark ? '#94a3b8' : '#64748b' }]}>
            Tüm geçmiş kurulumlarınızı, görev durumlarını, adresleri, fotoğrafları ve iş emirlerini JSON dosyası olarak yedekleyin veya başka bir cihaza/tarayıcıya aktarın.
          </Text>

          {/* Action Buttons Grid (2 cols) */}
          <View style={styles.gridTwoCols}>
            <TouchableOpacity
              style={[
                styles.gridBtn,
                {
                  backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                },
              ]}
              onPress={handleExportBackup}
              activeOpacity={0.8}
            >
              <CloudUpload size={16} color="#3b82f6" />
              <Text style={[styles.gridBtnText, { color: isDark ? '#f8fafc' : '#1e293b' }]}>
                Yedek Al
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.gridBtn,
                {
                  backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                },
              ]}
              onPress={handleImportBackupInfo}
              activeOpacity={0.8}
            >
              <CloudDownload size={16} color="#10b981" />
              <Text style={[styles.gridBtnText, { color: isDark ? '#f8fafc' : '#1e293b' }]}>
                Yedek Yükle
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Görsel-4: Card 3 - Cari Hesap Veritabanı */}
        <View
          style={[
            styles.cardBox,
            {
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              borderColor: isDark ? '#1e293b' : '#e2e8f0',
            },
          ]}
        >
          {/* Header with 370 Cari badge */}
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconContainer, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff' }]}>
              <Building2 size={18} color="#3b82f6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                Cari Hesap Veritabanı
              </Text>
              <Text style={[styles.cardSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                {isPolatlar ? 'POLATLAR2025 & Excel Entegrasyonu' : `${user?.companyCode || 'Kurum'} Cari Entegrasyonu`}
              </Text>
            </View>
            <View style={styles.cariBadgePill}>
              <Text style={styles.cariBadgeText}>{cariler.length} Cari</Text>
            </View>
          </View>

          <Text style={[styles.cardDesc, { color: isDark ? '#94a3b8' : '#64748b' }]}>
            {isPolatlar ? (
              <>
                SSMS üzerindeki <Text style={{ fontWeight: '800', color: isDark ? '#e2e8f0' : '#334155' }}>POLATLAR2025</Text> veritabanından çekilen cari listesi. Masaüstünüzdeki{' '}
                <Text style={{ fontWeight: '800', color: '#2563eb' }}>Cari_Guncelle.bat</Text> dosyasını çalıştırarak veya Excel yükleyerek veritabanındaki yeni carileri uygulamaya tek tıkla senkronize edebilirsiniz.
              </>
            ) : (
              'Kurumunuza ait cari hesap listesi. Excel dosyasını yükleyerek İş Emirleri, Servisler ve Kurulum modüllerinde carilerinizi kullanabilirsiniz.'
            )}
          </Text>

          {/* Son Güncelleme */}
          <View style={styles.lastUpdateRow}>
            <Database size={13} color="#3b82f6" />
            <Text style={[styles.lastUpdateText, { color: isDark ? '#64748b' : '#94a3b8' }]}>
              Son Güncelleme: {formattedCarilerDate}
            </Text>
          </View>

          {/* Action Buttons (3 stacked) */}
          <View style={styles.cariActionsGroup}>
            {/* Primary Blue Button */}
            <TouchableOpacity
              style={styles.primaryBlueBtn}
              onPress={() => setIsCariModalOpen(true)}
              activeOpacity={0.85}
            >
              <Eye size={16} color="#ffffff" />
              <Text style={styles.primaryBlueBtnText}>Listeyi İncele / Ara</Text>
            </TouchableOpacity>

            {/* Secondary Button */}
            <TouchableOpacity
              style={[
                styles.secondaryBtn,
                {
                  backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                },
              ]}
              onPress={handleExportCariler}
              activeOpacity={0.8}
            >
              <Download size={16} color="#10b981" />
              <Text style={[styles.secondaryBtnText, { color: isDark ? '#f8fafc' : '#1e293b' }]}>
                Excel İndir (.xlsx)
              </Text>
            </TouchableOpacity>

            {/* Dashed Button */}
            <TouchableOpacity
              style={[
                styles.dashedBtn,
                {
                  borderColor: isDark ? '#334155' : '#cbd5e1',
                  opacity: isUploadingExcel ? 0.6 : 1,
                },
              ]}
              onPress={handleExcelUpload}
              disabled={isUploadingExcel}
              activeOpacity={0.8}
            >
              <Upload size={14} color="#3b82f6" />
              <Text style={[styles.dashedBtnText, { color: isDark ? '#94a3b8' : '#475569' }]}>
                {isUploadingExcel ? 'Excel Yükleniyor...' : 'Farklı Bir Excel Dosyası Yükle (.xlsx)'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Görsel-5: Standart Kontrol Listesi Görevleri Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
            Standart Kontrol Listesi Görevleri
          </Text>
          <Text style={[styles.sectionBadge, { color: isDark ? '#94a3b8' : '#64748b' }]}>
            {standardTasks.length} Görev
          </Text>
        </View>

        {/* Info Box */}
        <View
          style={[
            styles.infoBox,
            {
              backgroundColor: isDark ? 'rgba(37, 99, 235, 0.1)' : '#eff6ff',
              borderColor: isDark ? 'rgba(37, 99, 235, 0.25)' : '#bfdbfe',
            },
          ]}
        >
          <Info size={16} color="#3b82f6" style={{ marginTop: 2 }} />
          <Text style={[styles.infoBoxText, { color: isDark ? '#93c5fd' : '#1e40af' }]}>
            Burada tanımladığınız standart görev listesi, ekleyeceğiniz her yeni kurulum yeri için otomatik olarak kopyalanacaktır. Mevcut kurulum yerlerindeki görevler bu listeden etkilenmez.
          </Text>
        </View>

        {/* Search Input for Tasks */}
        {standardTasks.length > 5 && (
          <View
            style={[
              styles.taskSearchBar,
              {
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderColor: isDark ? '#1e293b' : '#cbd5e1',
              },
            ]}
          >
            <Search size={15} color="#94a3b8" />
            <TextInput
              style={[
                styles.taskSearchInput,
                { color: isDark ? '#f8fafc' : '#0f172a' },
              ]}
              placeholder="Şablon görevlerde ara..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={14} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Görsel-5: Task Cards List */}
        <View style={styles.tasksListContainer}>
          {filteredTasks.length === 0 ? (
            <View
              style={[
                styles.emptyTasksCard,
                {
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  borderColor: isDark ? '#1e293b' : '#e2e8f0',
                },
              ]}
            >
              <Text style={[styles.emptyTasksTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                {searchQuery ? 'Aramayla eşleşen şablon görev bulunamadı.' : 'Şablonda görev bulunmuyor.'}
              </Text>
              {!searchQuery && isPolatlar && (
                <TouchableOpacity
                  style={styles.loadDefaultsBtn}
                  onPress={resetStandardTasks}
                  activeOpacity={0.8}
                >
                  <Text style={styles.loadDefaultsBtnText}>Varsayılan 15 Görevi Yükle</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredTasks.map((task) => {
              const originalIndex = standardTasks.indexOf(task);
              return (
                <View
                  key={`${task}-${originalIndex}`}
                  style={[
                    styles.taskItemCard,
                    {
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      borderColor: isDark ? '#1e293b' : '#e2e8f0',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.taskItemText,
                      { color: isDark ? '#f8fafc' : '#0f172a' },
                    ]}
                  >
                    {task}
                  </Text>

                  <TouchableOpacity
                    style={styles.taskDeleteBtn}
                    onPress={() => handleDeleteTask(originalIndex, task)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Trash2 size={16} color={isDark ? '#64748b' : '#94a3b8'} />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        {/* Görsel-5: Add Standard Task Input Bar */}
        <View style={styles.addTaskBar}>
          <TextInput
            style={[
              styles.addTaskInput,
              {
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderColor: isDark ? '#1e293b' : '#cbd5e1',
                color: isDark ? '#f8fafc' : '#0f172a',
              },
            ]}
            placeholder="Yeni standart şablon görevi ekle..."
            placeholderTextColor="#64748b"
            value={newTaskName}
            onChangeText={setNewTaskName}
            onSubmitEditing={handleAddTask}
            returnKeyType="done"
          />

          <TouchableOpacity
            style={[
              styles.addTaskBtn,
              { opacity: newTaskName.trim() ? 1 : 0.6 },
            ]}
            onPress={handleAddTask}
            disabled={!newTaskName.trim()}
            activeOpacity={0.8}
          >
            <Plus size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Top Bar Modals */}
      <UserManagementModal
        visible={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
      />

      <CreateCompanyModal
        visible={isCreateCompanyOpen}
        onClose={() => setIsCreateCompanyOpen(false)}
      />

      <BranchManagementModal
        visible={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
      />

      <NotificationListModal
        visible={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
        onNavigateToTab={(tab) => router.push(tab as any)}
      />

      {/* Cari List Modal */}
      <CariListModal
        visible={isCariModalOpen}
        onClose={() => setIsCariModalOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navBar: {
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  topBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 14,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  homeBtnText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
  },
  topBarIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topIconBtnUsers: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconBtnBranch: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconBtnNotif: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconBtnTheme: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconBtnLogout: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
  },

  // Görsel-4: Card 1 (Header Card)
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    gap: 10,
  },
  headerCardLeft: {
    flex: 1,
    gap: 3,
  },
  headerCardTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  headerCardSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  resetBtnText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '800',
  },

  // Görsel-4: Generic Card Box
  cardBox: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  cardSubtitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  cardDesc: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '400',
  },
  gridTwoCols: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  gridBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    borderRadius: 12,
  },
  gridBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Görsel-4: Cari Card Elements
  cariBadgePill: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  cariBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  lastUpdateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -2,
  },
  lastUpdateText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cariActionsGroup: {
    gap: 8,
    marginTop: 4,
  },
  primaryBlueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 11,
    borderRadius: 12,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryBlueBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
  },
  secondaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dashedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  dashedBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Görsel-5: Section Header & Info
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  sectionBadge: {
    fontSize: 11,
    fontWeight: '700',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  infoBoxText: {
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  taskSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    gap: 8,
  },
  taskSearchInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    paddingVertical: 0,
  },

  // Görsel-5: Task Cards List
  tasksListContainer: {
    gap: 8,
  },
  taskItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  taskItemText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    flex: 1,
  },
  taskDeleteBtn: {
    padding: 4,
  },
  emptyTasksCard: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyTasksTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  loadDefaultsBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  loadDefaultsBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },

  // Görsel-5: Add Standard Task Input Bar
  addTaskBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  addTaskInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 12,
    fontWeight: '500',
  },
  addTaskBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
