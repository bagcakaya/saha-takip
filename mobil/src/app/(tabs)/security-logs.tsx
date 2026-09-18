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
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ShieldAlert,
  ShieldCheck,
  ArrowLeft,
  Users,
  Store,
  Bell,
  Sun,
  Moon,
  LogOut,
  Search,
  CheckCheck,
  Trash2,
  Smartphone,
  User,
  Clock,
  AlertTriangle,
  Building2,
} from 'lucide-react-native';
import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { SecurityLogItem } from '../../types/storage';
import { UserManagementModal } from '../../components/UserManagementModal';
import { CreateCompanyModal } from '../../components/CreateCompanyModal';
import { BranchManagementModal } from '../../components/BranchManagementModal';
import { NotificationListModal } from '../../components/NotificationListModal';

export default function SecurityLogsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useAppTheme();
  const {
    securityLogs,
    deleteSecurityLog,
    clearAllSecurityLogs,
    markSecurityLogsAsRead,
    refreshData,
  } = useStorage();

  const isAdmin = user?.role === 'admin';

  // Management modals
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'cross_device'>('all');
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

  // Stats calculation (Görsel-5)
  const stats = useMemo(() => {
    const total = (securityLogs || []).length;
    const unread = (securityLogs || []).filter((l) => !l.read).length;
    const crossDevice = (securityLogs || []).filter((l) => l.boundUserId).length;

    // Find top offender
    const counts: Record<string, { count: number; name: string }> = {};
    (securityLogs || []).forEach((l) => {
      const key = l.attemptedUsername || 'Bilinmeyen';
      const name = l.attemptedName || l.attemptedUsername;
      if (!counts[key]) counts[key] = { count: 0, name };
      counts[key].count++;
    });

    let topName = '—';
    let maxCount = 0;
    for (const key of Object.keys(counts)) {
      if (counts[key].count > maxCount) {
        maxCount = counts[key].count;
        topName = counts[key].name;
      }
    }

    return {
      total,
      unread,
      crossDevice,
      topOffender: maxCount > 0 ? topName : '—',
    };
  }, [securityLogs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (securityLogs || []).filter((log) => {
      if (filterType === 'unread' && log.read) return false;
      if (filterType === 'cross_device' && !log.boundUserId) return false;

      if (q) {
        const matchAttempted =
          log.attemptedUsername?.toLowerCase().includes(q) ||
          log.attemptedName?.toLowerCase().includes(q);
        const matchOwner =
          log.boundUserName?.toLowerCase().includes(q) ||
          log.boundUserId?.toLowerCase().includes(q);
        const matchDevice =
          log.deviceId?.toLowerCase().includes(q) ||
          log.deviceName?.toLowerCase().includes(q);
        const matchMsg = log.message?.toLowerCase().includes(q);
        return matchAttempted || matchOwner || matchDevice || matchMsg;
      }
      return true;
    });
  }, [securityLogs, filterType, searchQuery]);

  const handleClearAll = () => {
    if (securityLogs.length === 0) return;
    Alert.alert(
      'Logları Temizle',
      'Tüm güvenlik log kayıtlarını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Temizle',
          style: 'destructive',
          onPress: async () => {
            await clearAllSecurityLogs();
          },
        },
      ]
    );
  };

  const handleDeleteSingle = (id: string) => {
    Alert.alert('Kaydı Sil', 'Bu log kaydını silmek istediğinize emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await deleteSecurityLog(id);
        },
      },
    ]);
  };

  const handleMarkAllRead = async () => {
    await markSecurityLogsAsRead();
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#020617' : '#f8fafc' }]}>
      {/* 1. Top Navigation Bar */}
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
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Görsel-5: Hero Banner (Dark Red / Crimson Gradient) */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: isDark ? '#3b0712' : '#881337',
              borderColor: isDark ? '#4c0519' : '#9f1239',
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.shieldIconBox}>
              <ShieldAlert size={24} color="#f43f5e" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={styles.heroTitle}>Güvenlik & Log Kayıtları</Text>
                {stats.unread > 0 && (
                  <View style={styles.unreadPulseBadge}>
                    <Text style={styles.unreadPulseText}>{stats.unread} Yeni İhlal</Text>
                  </View>
                )}
              </View>
              <Text style={styles.heroSubtitle}>
                Personel hesaplarının yetkisiz veya başka personellere ait cihazlarla giriş yapma girişimleri burada anlık olarak kayıt altına alınır.
              </Text>
            </View>
          </View>

          {/* Quick Header Actions if logs exist */}
          {securityLogs.length > 0 && (
            <View style={styles.heroActionsRow}>
              {stats.unread > 0 && (
                <TouchableOpacity
                  style={styles.heroActionBtn}
                  onPress={handleMarkAllRead}
                  activeOpacity={0.8}
                >
                  <CheckCheck size={14} color="#10b981" />
                  <Text style={styles.heroActionBtnText}>Tümünü Okundu Say</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.heroActionBtn, { borderColor: 'rgba(239, 68, 68, 0.4)' }]}
                onPress={handleClearAll}
                activeOpacity={0.8}
              >
                <Trash2 size={14} color="#f43f5e" />
                <Text style={[styles.heroActionBtnText, { color: '#fca5a5' }]}>Logları Temizle</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Görsel-5: 4 Stat KPI Cards (2x2 Grid) */}
        <View style={styles.kpiGrid}>
          {/* Box 1: TOPLAM İHLAL KAYDI */}
          <View
            style={[
              styles.kpiCard,
              {
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderColor: isDark ? '#1e293b' : '#e2e8f0',
              },
            ]}
          >
            <Text style={styles.kpiLabel}>TOPLAM İHLAL KAYDI</Text>
            <Text style={[styles.kpiValue, { color: isDark ? '#ffffff' : '#0f172a' }]}>
              {stats.total}
            </Text>
            <Text style={styles.kpiSub}>Kayıtlı tüm denemeler</Text>
          </View>

          {/* Box 2: OKUNMAMIŞ İHLALLER */}
          <View
            style={[
              styles.kpiCard,
              {
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderColor: isDark ? '#1e293b' : '#e2e8f0',
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { color: '#f43f5e' }]}>OKUNMAMIŞ İHLALLER</Text>
            <Text style={[styles.kpiValue, { color: '#f43f5e' }]}>
              {stats.unread}
            </Text>
            <Text style={styles.kpiSub}>İnceleme bekleyen kayıtlar</Text>
          </View>

          {/* Box 3: BAŞKA PERSONEL TELEFONU */}
          <View
            style={[
              styles.kpiCard,
              {
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderColor: isDark ? '#1e293b' : '#e2e8f0',
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { color: '#f59e0b' }]}>BAŞKA PERSONEL TELEFONU</Text>
            <Text style={[styles.kpiValue, { color: '#f59e0b' }]}>
              {stats.crossDevice}
            </Text>
            <Text style={styles.kpiSub}>Cihaz çakışması denemesi</Text>
          </View>

          {/* Box 4: EN ÇOK DENEYEN */}
          <View
            style={[
              styles.kpiCard,
              {
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderColor: isDark ? '#1e293b' : '#e2e8f0',
              },
            ]}
          >
            <Text style={styles.kpiLabel}>EN ÇOK DENEYEN</Text>
            <Text
              style={[styles.kpiValue, { color: isDark ? '#ffffff' : '#0f172a' }]}
              numberOfLines={1}
            >
              {stats.topOffender}
            </Text>
            <Text style={styles.kpiSub}>İhlal kaydı yok</Text>
          </View>
        </View>

        {/* Filter & Search Bar (Görsel-5) */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              borderColor: isDark ? '#1e293b' : '#cbd5e1',
            },
          ]}
        >
          <Search size={16} color="#94a3b8" />
          <TextInput
            style={[styles.searchInput, { color: isDark ? '#ffffff' : '#0f172a' }]}
            placeholder="Personel adı, cihaz ID veya metin ile filtrele..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filter Pills (Görsel-5) */}
        <View style={styles.filterPillsRow}>
          <TouchableOpacity
            style={[
              styles.filterPill,
              filterType === 'all'
                ? styles.filterPillActive
                : [
                    styles.filterPillInactive,
                    { backgroundColor: isDark ? '#0f172a' : '#ffffff' },
                  ],
            ]}
            onPress={() => setFilterType('all')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterPillText,
                filterType === 'all'
                  ? styles.filterPillTextActive
                  : { color: isDark ? '#cbd5e1' : '#64748b' },
              ]}
            >
              Tümü ({stats.total})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              filterType === 'unread'
                ? styles.filterPillActive
                : [
                    styles.filterPillInactive,
                    { backgroundColor: isDark ? '#0f172a' : '#ffffff' },
                  ],
            ]}
            onPress={() => setFilterType('unread')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterPillText,
                filterType === 'unread'
                  ? styles.filterPillTextActive
                  : { color: isDark ? '#cbd5e1' : '#64748b' },
              ]}
            >
              Okunmamış ({stats.unread})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              filterType === 'cross_device'
                ? styles.filterPillActive
                : [
                    styles.filterPillInactive,
                    { backgroundColor: isDark ? '#0f172a' : '#ffffff' },
                  ],
            ]}
            onPress={() => setFilterType('cross_device')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterPillText,
                filterType === 'cross_device'
                  ? styles.filterPillTextActive
                  : { color: isDark ? '#cbd5e1' : '#64748b' },
              ]}
            >
              Başka Personel Telefonu ({stats.crossDevice})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Görsel-5: Empty State or Log List */}
        {filteredLogs.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderColor: isDark ? '#1e293b' : '#e2e8f0',
              },
            ]}
          >
            <View style={styles.emptyShieldCircle}>
              <ShieldCheck size={36} color="#10b981" />
            </View>
            <Text style={[styles.emptyTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
              Her Şey Güvende! İhlal Kaydı Bulunmuyor
            </Text>
            <Text style={styles.emptySubtitle}>
              Personelleriniz yalnızca kendi kayıtlı cihazlarından giriş yapmaktadır. Herhangi bir yetkisiz telefon veya uyuşmazlık denemesi tespit edilmedi.
            </Text>
          </View>
        ) : (
          <View style={styles.logsList}>
            {filteredLogs.map((log: SecurityLogItem) => (
              <View
                key={log.id}
                style={[
                  styles.logCard,
                  {
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: isDark ? '#1e293b' : '#e2e8f0',
                  },
                ]}
              >
                <View style={styles.logHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={15} color="#ef4444" />
                    <Text style={[styles.logUserName, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                      {log.attemptedName || log.attemptedUsername}
                    </Text>
                  </View>
                  <View style={styles.logStatusBadge}>
                    <Text style={styles.logStatusText}>
                      {log.status === 'danger' ? 'Tehlike' : 'Uyarı'}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.logMessage, { color: isDark ? '#f1f5f9' : '#1e293b' }]}>
                  {log.message}
                </Text>

                <View style={styles.logMetaRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Smartphone size={12} color="#94a3b8" />
                    <Text style={styles.logMetaText}>
                      {log.deviceName || 'Mobil Cihaz'} ({log.deviceId?.slice(0, 8)}...)
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteSingle(log.id)}
                    style={{ padding: 4 }}
                  >
                    <Trash2 size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Standard Management Modals */}
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navBar: {
    paddingTop: 48,
    paddingBottom: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  topBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  homeBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  topBarIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  topIconBtnUsers: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconBtnBranch: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconBtnNotif: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconBtnTheme: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconBtnLogout: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flex: 1,
    padding: 12,
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    gap: 12,
  },
  shieldIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: '#fecdd3',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
  unreadPulseBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadPulseText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  heroActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  heroActionBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  kpiCard: {
    width: '48%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '900',
    marginVertical: 4,
  },
  kpiSub: {
    fontSize: 10,
    color: '#64748b',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  filterPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  filterPillInactive: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyShieldCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 300,
  },
  logsList: {
    gap: 10,
  },
  logCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  logHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  logUserName: {
    fontSize: 14,
    fontWeight: '800',
  },
  logStatusBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  logStatusText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '700',
  },
  logMessage: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  logMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  logMetaText: {
    fontSize: 11,
    color: '#94a3b8',
  },
});
