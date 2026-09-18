import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useStorage } from '../../context/StorageContext';
import { useAppTheme } from '../../context/ThemeContext';
import {
  Building2,
  Wrench,
  ClipboardList,
  UserCheck,
  RotateCcw,
  Store,
  Calendar,
  Bell,
  Sparkles,
  ArrowRight,
  Sun,
  Moon,
  LogOut,
  Users,
  Clock,
  ShieldAlert,
  ListTodo,
  Megaphone,
  Settings,
  Shield,
} from 'lucide-react-native';
import { UserManagementModal } from '../../components/UserManagementModal';
import { CreateCompanyModal } from '../../components/CreateCompanyModal';
import { BranchManagementModal } from '../../components/BranchManagementModal';
import { NotificationListModal } from '../../components/NotificationListModal';
import { NotificationStatusModal } from '../../components/NotificationStatusModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - 32 - CARD_GAP) / 2;

export default function HomeDashboardScreen() {
  const { user, logout } = useAuth();
  const {
    locations,
    services,
    returnWarrantyItems,
    attendanceRecords,
    notes,
    branches,
    timedFollowUps,
    adminReminders,
    securityLogs,
    standardTasks,
  } = useStorage();
  const { isDark, toggleTheme, colors } = useAppTheme();
  const router = useRouter();

  // Modals state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);

  const isAdmin = user?.role === 'admin';
  const todayStr = new Date().toISOString().split('T')[0];
  const activeReturnsCount = returnWarrantyItems.filter((i) => i.status === 'pending').length;
  const activeInstallationsCount = locations.filter((l) => l.status !== 'completed').length;
  const activeAttendanceCount = attendanceRecords.filter(
    (r) => r.date === todayStr && (r.status === 'checked_in' || r.status === 'completed')
  ).length;
  const pendingFollowUpsCount = (timedFollowUps || []).filter((f) => f.status === 'pending').length;
  const adminRemindersCount = (adminReminders || []).length;
  const securityLogsCount = (securityLogs || []).filter((l) => !l.read).length;

  const turkishDate = new Date().toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleLogout = () => {
    Alert.alert('Çıkış Yap', 'Hesabınızdan çıkış yapmak istediğinize emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleNotificationSettings = () => {
    setIsNotificationSettingsOpen(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 1. Top Navigation Bar (Matches Görsel 1 & 2) */}
      <View
        style={[
          styles.navBar,
          {
            backgroundColor: colors.navBackground,
            borderBottomColor: colors.navBorder,
          },
        ]}
      >
        <View style={styles.topBarContainer}>
          {/* Left Side: 3D App Icon + Title */}
          <View style={styles.navLeft}>
            <Image
              source={require('../../../assets/images/app-logo.png')}
              style={styles.logoCircle}
              resizeMode="cover"
            />
            <View>
              <Text style={styles.brandSubtitle}>İŞ TAKİP PORTALİ</Text>
              <Text style={[styles.brandTitle, { color: colors.text }]}>Ana Menü</Text>
            </View>
          </View>

          {/* Right 5 Icon Buttons (Matches Görsel 1 & 2) */}
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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Welcome Hero Banner */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          {/* Top Line: Role Badge + Date */}
          <View style={styles.heroTopRow}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {isAdmin ? 'SİSTEM YÖNETİCİSİ' : 'SAHA YETKİLİSİ'}
              </Text>
            </View>
            <Text style={[styles.dateText, { color: colors.subtext }]}>{turkishDate}</Text>
          </View>

          {/* Welcome Heading */}
          <Text style={[styles.welcomeTitle, { color: colors.text }]}>
            Hoş Geldiniz, {user?.name || 'Yetkili'} 👋
          </Text>
          <Text style={[styles.welcomeSubtitle, { color: colors.subtext }]}>
            İşlem yapmak istediğiniz bölüme aşağıdaki kare kutulardan doğrudan giriş yapabilirsiniz.
          </Text>

          {/* 3 Stat Boxes Row */}
          <View style={styles.statsRow}>
            <View
              style={[
                styles.statBox,
                {
                  backgroundColor: colors.statBoxBg,
                  borderColor: colors.statBoxBorder,
                },
              ]}
            >
              <Text style={[styles.statLabel, { color: colors.subtext }]}>AKTİF KURULUM</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{locations.length}</Text>
            </View>
            <View
              style={[
                styles.statBox,
                {
                  backgroundColor: colors.statBoxBg,
                  borderColor: colors.statBoxBorder,
                },
              ]}
            >
              <Text style={[styles.statLabel, { color: colors.subtext }]}>SERVİSLER</Text>
              <Text style={[styles.statValue, { color: '#fb923c' }]}>{services.length}</Text>
            </View>
            <View
              style={[
                styles.statBox,
                {
                  backgroundColor: colors.statBoxBg,
                  borderColor: colors.statBoxBorder,
                },
              ]}
            >
              <Text style={[styles.statLabel, { color: colors.subtext }]}>İADE / GARANTİ</Text>
              <Text style={[styles.statValue, { color: '#fbbf24' }]}>{activeReturnsCount}</Text>
            </View>
          </View>
        </View>

        {/* 3. Section Title */}
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Sparkles size={18} color="#f59e0b" />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Hızlı Erişim Modülleri</Text>
          </View>
          <Text style={[styles.sectionCount, { color: colors.subtext }]}>
            {isAdmin ? '11 Ana Bölüm' : '8 Ana Bölüm'}
          </Text>
        </View>

        {/* 4. 2-Column Square Module Cards Grid (Exact Matches for Görsel 1) */}
        <View style={styles.gridContainer}>
          {/* Card 1: Şubeler (Cyan / Teal) */}
          {isAdmin && (
            <TouchableOpacity
              style={[styles.moduleCard, { backgroundColor: '#0d9488', borderColor: 'rgba(45, 212, 191, 0.4)' }]}
              onPress={() => setIsBranchModalOpen(true)}
              activeOpacity={0.85}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardIconCircle}>
                  <Store size={20} color="#ffffff" />
                </View>
                <View style={styles.badgeColumn}>
                  <View style={styles.solidPillBadge}>
                    <Text style={styles.solidPillText}>{branches.length} Şube</Text>
                  </View>
                </View>
              </View>
              <View style={styles.cardBottom}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>Şubeler</Text>
                  <ArrowRight size={15} color="#ffffff" />
                </View>
                <Text style={styles.cardDesc} numberOfLines={2}>
                  Şube lokasyonları, 20m mesai alanı ve personel...
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Card 2: Kurulumlar (Royal Blue) */}
          <TouchableOpacity
            style={[styles.moduleCard, { backgroundColor: '#1d4ed8', borderColor: 'rgba(96, 165, 250, 0.4)' }]}
            onPress={() => router.push('/(tabs)/installations')}
            activeOpacity={0.85}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardIconCircle}>
                <Building2 size={20} color="#ffffff" />
              </View>
              <View style={styles.badgeColumn}>
                <View style={styles.badgeRow}>
                  <View style={styles.translucentBadge}>
                    <Text style={styles.translucentBadgeText}>0 Onay</Text>
                  </View>
                  <View style={styles.solidPillBadge}>
                    <Text style={styles.solidPillText}>{activeInstallationsCount} Bekleyen</Text>
                  </View>
                </View>
                <Text style={styles.totalBadgeText}>{locations.length} Toplam</Text>
              </View>
            </View>
            <View style={styles.cardBottom}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Kurulumlar</Text>
                <ArrowRight size={15} color="#ffffff" />
              </View>
              <Text style={styles.cardDesc} numberOfLines={2}>
                Saha montajları, müşteri adresleri ve kontrol listeleri
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 3: Servisler (Orange) */}
          <TouchableOpacity
            style={[styles.moduleCard, { backgroundColor: '#ea580c', borderColor: 'rgba(251, 146, 60, 0.4)' }]}
            onPress={() => router.push('/(tabs)/services')}
            activeOpacity={0.85}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardIconCircle}>
                <Wrench size={20} color="#ffffff" />
              </View>
              <View style={styles.badgeColumn}>
                <View style={styles.badgeRow}>
                  <View style={styles.translucentBadge}>
                    <Text style={styles.translucentBadgeText}>0 Onay</Text>
                  </View>
                  <View style={styles.solidPillBadge}>
                    <Text style={styles.solidPillText}>{services.length} Bekleyen</Text>
                  </View>
                </View>
                <Text style={styles.totalBadgeText}>{services.length} Toplam</Text>
              </View>
            </View>
            <View style={styles.cardBottom}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Servisler</Text>
                <ArrowRight size={15} color="#ffffff" />
              </View>
              <Text style={styles.cardDesc} numberOfLines={2}>
                Müşteri servis müdahaleleri, parça ve...
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 4: İş Emirleri (Violet / Purple) */}
          <TouchableOpacity
            style={[styles.moduleCard, { backgroundColor: '#7e22ce', borderColor: 'rgba(192, 132, 252, 0.4)' }]}
            onPress={() => router.push('/(tabs)/work-orders')}
            activeOpacity={0.85}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardIconCircle}>
                <ClipboardList size={20} color="#ffffff" />
              </View>
              <View style={styles.badgeColumn}>
                <View style={styles.badgeRow}>
                  <View style={styles.translucentBadge}>
                    <Text style={styles.translucentBadgeText}>0 Onay</Text>
                  </View>
                  <View style={styles.solidPillBadge}>
                    <Text style={styles.solidPillText}>{notes.length} Bekleyen</Text>
                  </View>
                </View>
                <Text style={styles.totalBadgeText}>{notes.length + locations.length} Toplam</Text>
              </View>
            </View>
            <View style={styles.cardBottom}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>İş Emirleri</Text>
                <ArrowRight size={15} color="#ffffff" />
              </View>
              <Text style={styles.cardDesc} numberOfLines={2}>
                Personele görev atama, alarmlar ve anlık iş emirleri
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 5: Personel Takibi (Emerald Green) */}
          <TouchableOpacity
            style={[styles.moduleCard, { backgroundColor: '#047857', borderColor: 'rgba(52, 211, 153, 0.4)' }]}
            onPress={() => router.push('/(tabs)/attendance')}
            activeOpacity={0.85}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardIconCircle}>
                <UserCheck size={20} color="#ffffff" />
              </View>
              <View style={styles.solidPillBadge}>
                <Text style={styles.solidPillText}>Takip</Text>
              </View>
            </View>
            <View style={styles.cardBottom}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Personel Takibi</Text>
                <ArrowRight size={15} color="#ffffff" />
              </View>
              <Text style={styles.cardDesc} numberOfLines={2}>
                Lokasyon doğrulamalı ve yönetici onaylı işe giriş-...
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 6: Süreli Takipler (Amber / Orange) */}
          {isAdmin && (
            <TouchableOpacity
              style={[styles.moduleCard, { backgroundColor: '#d97706', borderColor: 'rgba(251, 191, 36, 0.4)' }]}
              onPress={() => router.push('/(tabs)/timed-follow-ups')}
              activeOpacity={0.85}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardIconCircle}>
                  <Clock size={20} color="#ffffff" />
                </View>
                <View style={styles.solidPillBadge}>
                  <Text style={styles.solidPillText}>{pendingFollowUpsCount} Bekleyen</Text>
                </View>
              </View>
              <View style={styles.cardBottom}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>Süreli Takipler</Text>
                  <ArrowRight size={15} color="#ffffff" />
                </View>
                <Text style={styles.cardDesc} numberOfLines={2}>
                  Cari bazlı alarmlar, randevu ve zaman ayarlı iş...
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Card 7: Hatırlatmalar (Deep Indigo) */}
          <TouchableOpacity
            style={[styles.moduleCard, { backgroundColor: '#4338ca', borderColor: 'rgba(165, 180, 252, 0.4)' }]}
            onPress={() => router.push('/(tabs)/reminders')}
            activeOpacity={0.85}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardIconCircle}>
                <Megaphone size={20} color="#ffffff" />
              </View>
              <View style={styles.solidPillBadge}>
                <Text style={styles.solidPillText}>{adminRemindersCount || 1} Talimat</Text>
              </View>
            </View>
            <View style={styles.cardBottom}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Hatırlatmalar</Text>
                <ArrowRight size={15} color="#ffffff" />
              </View>
              <Text style={styles.cardDesc} numberOfLines={2}>
                Yönetici çalışma talimatları, kurallar ve prosedürler
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 8: İade / Garanti (Red / Rose) */}
          <TouchableOpacity
            style={[styles.moduleCard, { backgroundColor: '#dc2626', borderColor: 'rgba(248, 113, 113, 0.4)' }]}
            onPress={() => router.push('/(tabs)/returns')}
            activeOpacity={0.85}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardIconCircle}>
                <RotateCcw size={20} color="#ffffff" />
              </View>
              <View style={styles.solidPillBadge}>
                <Text style={styles.solidPillText}>{activeReturnsCount} Süreçte</Text>
              </View>
            </View>
            <View style={styles.cardBottom}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>İade / Garanti</Text>
                <ArrowRight size={15} color="#ffffff" />
              </View>
              <Text style={styles.cardDesc} numberOfLines={2}>
                Seri no, kargo fişi ve 1 haftalık otomatik durum...
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 9: Log Kayıtları (Dark Rose / Brown) */}
          {isAdmin && (
            <TouchableOpacity
              style={[styles.moduleCard, { backgroundColor: '#991b1b', borderColor: 'rgba(239, 68, 68, 0.4)' }]}
              onPress={() => router.push('/(tabs)/security-logs')}
              activeOpacity={0.85}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardIconCircle}>
                  <ShieldAlert size={20} color="#ffffff" />
                </View>
                <View style={styles.solidPillBadge}>
                  <Text style={styles.solidPillText}>{securityLogsCount} Kayıt</Text>
                </View>
              </View>
              <View style={styles.cardBottom}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>Log Kayıtları</Text>
                  <ArrowRight size={15} color="#ffffff" />
                </View>
                <Text style={styles.cardDesc} numberOfLines={2}>
                  Cihaz uyuşmazlığı ve yetkisiz giriş denemeleri...
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Card 10: Şablon (Teal / Emerald) */}
          <TouchableOpacity
            style={[styles.moduleCard, { backgroundColor: '#0f766e', borderColor: 'rgba(45, 212, 191, 0.4)' }]}
            onPress={() => router.push('/(tabs)/templates')}
            activeOpacity={0.85}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardIconCircle}>
                <ListTodo size={20} color="#ffffff" />
              </View>
              <View style={styles.solidPillBadge}>
                <Text style={styles.solidPillText}>{(standardTasks || []).length || 15} Görev</Text>
              </View>
            </View>
            <View style={styles.cardBottom}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Şablon</Text>
                <ArrowRight size={15} color="#ffffff" />
              </View>
              <Text style={styles.cardDesc} numberOfLines={2}>
                Standart kontrol listesi görevleri & tam veri...
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 11: Bildirim Ayarları (Purple / Slate) (Matches Görsel 1) */}
          <TouchableOpacity
            style={[styles.moduleCard, { backgroundColor: '#312e81', borderColor: 'rgba(129, 140, 248, 0.4)' }]}
            onPress={handleNotificationSettings}
            activeOpacity={0.85}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardIconCircle}>
                <Settings size={20} color="#ffffff" />
              </View>
              <View style={styles.solidPillBadge}>
                <Text style={styles.solidPillText}>Canlı Durum</Text>
              </View>
            </View>
            <View style={styles.cardBottom}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Bildirim Ayarları</Text>
                <ArrowRight size={15} color="#ffffff" />
              </View>
              <Text style={styles.cardDesc} numberOfLines={2}>
                Kilit ekranı izni, test gönderimi ve cihaz kontrolü
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* User Management Modal */}
      <UserManagementModal
        visible={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
      />

      {/* Create Company Modal (Görsel 1 & 2) */}
      <CreateCompanyModal
        visible={isCreateCompanyOpen}
        onClose={() => setIsCreateCompanyOpen(false)}
      />

      {/* Branch Management Modal */}
      <BranchManagementModal
        visible={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
      />

      {/* Notification List Modal (Görsel 2) */}
      <NotificationListModal
        visible={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
      />

      {/* Notification Status & Device Management Modal (Görseller 1-4) */}
      <NotificationStatusModal
        visible={isNotificationSettingsOpen}
        onClose={() => setIsNotificationSettingsOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navBar: {
    paddingTop: Platform.OS === 'ios' ? 52 : 42,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  topBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 0.5,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  topBarIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topIconBtnUsers: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1.2,
    borderColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconBtnBranch: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1.2,
    borderColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconBtnNotif: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1.2,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconBtnTheme: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconBtnLogout: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1.2,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  roleBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#60a5fa',
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: 11,
    fontWeight: '600',
  },
  welcomeTitle: {
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  welcomeSubtitle: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  statBox: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  moduleCard: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.05,
    borderRadius: 22,
    padding: 14,
    justifyContent: 'space-between',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeColumn: {
    alignItems: 'flex-end',
    gap: 3,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 3,
  },
  translucentBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  translucentBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
  },
  solidPillBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  solidPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
  },
  totalBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  cardBottom: {
    gap: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#ffffff',
  },
  cardDesc: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 14,
    fontWeight: '500',
  },
});
