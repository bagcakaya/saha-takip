import React, { useState, useRef } from 'react';
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
  Modal,
  Animated,
  TouchableWithoutFeedback,
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
  X,
} from 'lucide-react-native';
import { UserManagementModal } from '../../components/UserManagementModal';
import { CreateCompanyModal } from '../../components/CreateCompanyModal';
import { BranchManagementModal } from '../../components/BranchManagementModal';
import { NotificationListModal } from '../../components/NotificationListModal';
import { NotificationStatusModal } from '../../components/NotificationStatusModal';
import { LicenseManagementModal } from '../../components/LicenseManagementModal';
import { canUserManageLicenses, canUserManageInstitutionsAndBranches } from '../../types/auth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = 16;
const ITEM_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2) / 3;

interface HomeModule {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: any;
  color: string;
  glowColor: string;
  badgeText: string;
  activeCount?: number;
  action: () => void;
  visible: boolean;
}

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
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);

  // Enlarged Card Pop-up state (Görsel-2 on tap with blurred backdrop)
  const [selectedModule, setSelectedModule] = useState<HomeModule | null>(null);
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const canManageLicenses = canUserManageLicenses(user);
  const canManageInstitutionsAndBranches = canUserManageInstitutionsAndBranches(user);
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

  // Open the enlarged card modal with smooth spring animation
  const handleOpenModule = (module: HomeModule) => {
    setSelectedModule(module);
    scaleAnim.setValue(0.75);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 65,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Close the enlarged card modal
  const handleCloseModule = (onDone?: () => void) => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSelectedModule(null);
      if (onDone) onDone();
    });
  };

  // Trigger the module's action when user clicks the enlarged card
  const handleExecuteAction = () => {
    if (!selectedModule) return;
    const actionToRun = selectedModule.action;
    handleCloseModule(() => {
      setTimeout(() => {
        actionToRun();
      }, 50);
    });
  };

  // All 12 system modules list (Görsel-1 layout)
  const modules: HomeModule[] = [
    {
      id: 'branches',
      title: 'Kurum ve Şubeler',
      shortTitle: 'Kurum & Şube',
      description: 'Kurumlar, şubeler, konumlar ve personel atamaları',
      icon: Store,
      color: '#0d9488',
      glowColor: '#2dd4bf',
      badgeText: `${branches.length} Şube`,
      activeCount: branches.length,
      action: () => setIsBranchModalOpen(true),
      visible: canManageInstitutionsAndBranches,
    },
    {
      id: 'installations',
      title: 'Kurulumlar',
      shortTitle: 'Kurulumlar',
      description: 'Saha montajları, müşteri adresleri ve kontrol listeleri',
      icon: Building2,
      color: '#1d4ed8',
      glowColor: '#60a5fa',
      badgeText: `${activeInstallationsCount} Bekleyen`,
      activeCount: activeInstallationsCount,
      action: () => router.push('/(tabs)/installations'),
      visible: true,
    },
    {
      id: 'services',
      title: 'Servisler',
      shortTitle: 'Servisler',
      description: 'Müşteri servis müdahaleleri, parça ve arıza kayıtları',
      icon: Wrench,
      color: '#ea580c',
      glowColor: '#fb923c',
      badgeText: `${services.length} Bekleyen`,
      activeCount: services.length,
      action: () => router.push('/(tabs)/services'),
      visible: true,
    },
    {
      id: 'work-orders',
      title: 'İş Emirleri',
      shortTitle: 'İş Takip',
      description: 'Personele görev atama, alarmlar ve anlık iş emirleri',
      icon: ClipboardList,
      color: '#7e22ce',
      glowColor: '#c084fc',
      badgeText: `${notes.length} Bekleyen`,
      activeCount: notes.length,
      action: () => router.push('/(tabs)/work-orders'),
      visible: true,
    },
    {
      id: 'attendance',
      title: 'Personel Takibi',
      shortTitle: 'Personel Takip',
      description: 'Lokasyon doğrulamalı ve yönetici onaylı işe giriş-çıkış takibi',
      icon: UserCheck,
      color: '#047857',
      glowColor: '#34d399',
      badgeText: `${activeAttendanceCount} Aktif`,
      activeCount: activeAttendanceCount,
      action: () => router.push('/(tabs)/attendance'),
      visible: true,
    },
    {
      id: 'timed-follow-ups',
      title: 'Süreli Takipler',
      shortTitle: 'Süreli Takip',
      description: 'Cari bazlı alarmlar, randevu ve zaman ayarlı iş hatırlatıcıları',
      icon: Clock,
      color: '#d97706',
      glowColor: '#fbbf24',
      badgeText: `${pendingFollowUpsCount} Bekleyen`,
      activeCount: pendingFollowUpsCount,
      action: () => router.push('/(tabs)/timed-follow-ups'),
      visible: isAdmin,
    },
    {
      id: 'reminders',
      title: 'Hatırlatmalar',
      shortTitle: 'Hatırlatma',
      description: 'Yönetici çalışma talimatları, kurallar ve şirket prosedürleri',
      icon: Megaphone,
      color: '#4338ca',
      glowColor: '#818cf8',
      badgeText: `${adminRemindersCount || 1} Talimat`,
      activeCount: adminRemindersCount,
      action: () => router.push('/(tabs)/reminders'),
      visible: true,
    },
    {
      id: 'returns',
      title: 'İade / Garanti',
      shortTitle: 'İade & Garanti',
      description: 'Seri no, kargo fişi ve 1 haftalık otomatik durum takibi',
      icon: RotateCcw,
      color: '#dc2626',
      glowColor: '#f87171',
      badgeText: `${activeReturnsCount} Süreçte`,
      activeCount: activeReturnsCount,
      action: () => router.push('/(tabs)/returns'),
      visible: true,
    },
    {
      id: 'security-logs',
      title: 'Log Kayıtları',
      shortTitle: 'Log Kayıtları',
      description: 'Cihaz uyuşmazlığı ve yetkisiz giriş denemeleri güvenlik kayıtları',
      icon: ShieldAlert,
      color: '#991b1b',
      glowColor: '#ef4444',
      badgeText: `${securityLogsCount} Kayıt`,
      activeCount: securityLogsCount,
      action: () => router.push('/(tabs)/security-logs'),
      visible: isAdmin,
    },
    {
      id: 'templates',
      title: 'Şablon',
      shortTitle: 'Şablonlar',
      description: 'Standart kontrol listesi görevleri & tam veri seti yönetimi',
      icon: ListTodo,
      color: '#0f766e',
      glowColor: '#2dd4bf',
      badgeText: `${(standardTasks || []).length || 15} Görev`,
      action: () => router.push('/(tabs)/templates'),
      visible: true,
    },
    {
      id: 'notification-settings',
      title: 'Bildirim Ayarları',
      shortTitle: 'Bildirimler',
      description: 'Kilit ekranı izni, test gönderimi ve OneSignal cihaz kontrolü',
      icon: Settings,
      color: '#312e81',
      glowColor: '#a5b4fc',
      badgeText: 'Canlı Durum',
      action: handleNotificationSettings,
      visible: true,
    },
    {
      id: 'licensing',
      title: 'Lisanslama',
      shortTitle: 'Lisanslama',
      description: 'Kurum lisans süreleri, dondurma ve abonelik kontrolü',
      icon: Sparkles,
      color: '#1e1b4b',
      glowColor: '#c084fc',
      badgeText: 'SaaS Masası',
      action: () => setIsLicenseModalOpen(true),
      visible: canManageLicenses,
    },
  ];

  const visibleModules = modules.filter((m) => m.visible);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 1. Top Navigation Bar */}
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

          {/* Right 4 Icon Buttons */}
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
        {/* 2. Compact Profile & Greeting Bar (Single-screen optimization) */}
        <View
          style={[
            styles.compactHeroBar,
            {
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              borderColor: isDark ? '#1e293b' : '#e2e8f0',
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.compactHeroName, { color: colors.text }]} numberOfLines={1}>
                {user?.name || 'Yetkili'} 👋
              </Text>
              <View style={styles.compactRolePill}>
                <Text style={styles.compactRolePillText}>
                  {isAdmin ? 'YÖNETİCİ' : 'SAHA'}
                </Text>
              </View>
            </View>
            <Text style={[styles.compactHeroSub, { color: colors.subtext }]} numberOfLines={1}>
              {turkishDate} • {locations.length} Kurulum • {services.length} Servis
            </Text>
          </View>
        </View>

        {/* 3. Görsel-1: 3-Column Circular App Launcher Grid (Tek Ekrana Sığan Düzen) */}
        <View style={styles.launcherGrid}>
          {visibleModules.map((mod) => {
            const IconComponent = mod.icon;
            return (
              <TouchableOpacity
                key={mod.id}
                style={styles.launcherItem}
                onPress={() => handleOpenModule(mod)}
                activeOpacity={0.75}
              >
                {/* Glowing Circular App Icon */}
                <View
                  style={[
                    styles.launcherCircle,
                    {
                      borderColor: mod.glowColor + '55',
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      shadowColor: mod.glowColor,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.launcherIconInner,
                      { backgroundColor: mod.glowColor + '18' },
                    ]}
                  >
                    <IconComponent size={28} color={mod.glowColor} />
                  </View>

                  {/* Active Badge Dot / Count */}
                  {mod.activeCount !== undefined && mod.activeCount > 0 && (
                    <View
                      style={[
                        styles.launcherBadge,
                        { backgroundColor: mod.glowColor },
                      ]}
                    >
                      <Text style={styles.launcherBadgeText}>
                        {mod.activeCount > 99 ? '99+' : mod.activeCount}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Module Title Below Icon */}
                <Text
                  style={[
                    styles.launcherLabel,
                    { color: isDark ? '#f8fafc' : '#0f172a' },
                  ]}
                  numberOfLines={2}
                >
                  {mod.shortTitle}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* 4. Görsel-2: Enlarged Card Pop-up with Blurred Flu Backdrop */}
      <Modal
        visible={!!selectedModule}
        transparent
        animationType="none"
        onRequestClose={() => handleCloseModule()}
      >
        <TouchableWithoutFeedback onPress={() => handleCloseModule()}>
          <Animated.View
            style={[
              styles.modalBackdrop,
              {
                opacity: opacityAnim,
              },
            ]}
          >
            {/* Modal Inner Container - Stops Propagation */}
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.enlargedCardContainer,
                  {
                    transform: [{ scale: scaleAnim }],
                  },
                ]}
              >
                {selectedModule && (
                  <View
                    style={[
                      styles.enlargedCard,
                      {
                        backgroundColor: selectedModule.color,
                        borderColor: selectedModule.glowColor + '70',
                      },
                    ]}
                  >
                    {/* Top Row: Squircle Icon & Badge */}
                    <View style={styles.enlargedTopRow}>
                      <View style={styles.enlargedSquircleIcon}>
                        <selectedModule.icon size={26} color="#ffffff" />
                      </View>

                      <View style={styles.enlargedBadgePill}>
                        <Text style={styles.enlargedBadgeText}>
                          {selectedModule.badgeText}
                        </Text>
                      </View>
                    </View>

                    {/* Middle: Title with Arrow & Full Description */}
                    <View style={styles.enlargedContentBox}>
                      <View style={styles.enlargedTitleRow}>
                        <Text style={styles.enlargedTitle} numberOfLines={1}>
                          {selectedModule.title}
                        </Text>
                        <ArrowRight size={20} color="#ffffff" />
                      </View>

                      <Text style={styles.enlargedDesc} numberOfLines={3}>
                        {selectedModule.description}
                      </Text>
                    </View>

                    {/* Bottom CTA Action Button */}
                    <TouchableOpacity
                      style={styles.enlargedActionBtn}
                      onPress={handleExecuteAction}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.enlargedActionBtnText}>Bölüme Giriş Yap</Text>
                      <ArrowRight size={16} color="#ffffff" />
                    </TouchableOpacity>

                    {/* Close 'X' Button at Top Right corner of the card */}
                    <TouchableOpacity
                      style={styles.enlargedCloseBtn}
                      onPress={() => handleCloseModule()}
                      activeOpacity={0.8}
                    >
                      <X size={16} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                )}
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* User Management Modal */}
      <UserManagementModal
        visible={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
      />

      {/* Create Company Modal */}
      <CreateCompanyModal
        visible={isCreateCompanyOpen}
        onClose={() => setIsCreateCompanyOpen(false)}
      />

      {/* Branch Management Modal */}
      {canManageInstitutionsAndBranches && (
        <BranchManagementModal
          visible={isBranchModalOpen}
          onClose={() => setIsBranchModalOpen(false)}
        />
      )}

      {/* Notification List Modal */}
      <NotificationListModal
        visible={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
      />

      {/* Notification Status & Device Management Modal */}
      <NotificationStatusModal
        visible={isNotificationSettingsOpen}
        onClose={() => setIsNotificationSettingsOpen(false)}
      />

      {/* SaaS License Management Modal (Super Admin) */}
      {canManageLicenses && (
        <LicenseManagementModal
          visible={isLicenseModalOpen}
          onClose={() => setIsLicenseModalOpen(false)}
        />
      )}
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
    paddingHorizontal: GRID_PADDING,
    paddingTop: 12,
    paddingBottom: 30,
  },
  compactHeroBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  compactHeroName: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  compactRolePill: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
  },
  compactRolePillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#60a5fa',
    letterSpacing: 0.5,
  },
  compactHeroSub: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },

  // Görsel-1: 3-Column Launcher Grid
  launcherGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    rowGap: 18,
  },
  launcherItem: {
    width: ITEM_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 4,
  },
  launcherCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    position: 'relative',
  },
  launcherIconInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  launcherBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#0f172a',
  },
  launcherBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ffffff',
  },
  launcherLabel: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 15,
    letterSpacing: -0.2,
  },

  // Görsel-2: Enlarged Card Pop-up with Blurred Backdrop
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  enlargedCardContainer: {
    width: '100%',
    maxWidth: 360,
  },
  enlargedCard: {
    borderRadius: 26,
    padding: 20,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 12,
    position: 'relative',
  },
  enlargedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  enlargedSquircleIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enlargedBadgePill: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  enlargedBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  enlargedContentBox: {
    marginBottom: 20,
  },
  enlargedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  enlargedTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  enlargedDesc: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 18,
    fontWeight: '500',
  },
  enlargedActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  enlargedActionBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  enlargedCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
