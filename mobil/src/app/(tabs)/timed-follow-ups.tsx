import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Clock,
  ArrowLeft,
  Users,
  Store,
  Bell,
  Sun,
  Moon,
  LogOut,
  Plus,
  Building2,
  Calendar,
  Volume2,
  Smartphone,
  CheckCircle2,
  Trash2,
} from 'lucide-react-native';
import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { TimedFollowUpModal } from '../../components/TimedFollowUpModal';
import { UserManagementModal } from '../../components/UserManagementModal';
import { CreateCompanyModal } from '../../components/CreateCompanyModal';
import { BranchManagementModal } from '../../components/BranchManagementModal';
import { NotificationListModal } from '../../components/NotificationListModal';
import { TimedFollowUp } from '../../types/storage';

export default function TimedFollowUpsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useAppTheme();
  const {
    timedFollowUps,
    completeTimedFollowUp,
    deleteTimedFollowUp,
    refreshData,
  } = useStorage();

  const isAdmin = user?.role === 'admin';

  // Navigation modals
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);

  // New follow-up modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Filter: 'pending' | 'completed' | 'all'
  const [activeFilter, setActiveFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const counts = useMemo(() => {
    const pending = (timedFollowUps || []).filter((i) => i.status === 'pending').length;
    const completed = (timedFollowUps || []).filter((i) => i.status === 'completed').length;
    return {
      pending,
      completed,
      all: (timedFollowUps || []).length,
    };
  }, [timedFollowUps]);

  const filteredItems = useMemo(() => {
    return (timedFollowUps || []).filter((i) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'completed') return i.status === 'completed';
      return i.status === 'pending';
    });
  }, [timedFollowUps, activeFilter]);

  const handleLogout = () => {
    Alert.alert('Çıkış Yap', 'Hesabınızdan güvenli çıkış yapmak istediğinize emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleDelete = (id: string, cari: string) => {
    Alert.alert(
      'Takip Silinecek',
      `"${cari}" carisine ait süreli takibi silmek istediğinize emin misiniz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            await deleteTimedFollowUp(id);
          },
        },
      ]
    );
  };

  const handleComplete = async (id: string) => {
    await completeTimedFollowUp(id);
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
        {/* Görsel-1: Hero Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              borderColor: isDark ? '#1e293b' : '#e2e8f0',
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.clockIconBox}>
              <Clock size={22} color="#f59e0b" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.titleWithBadge}>
                <Text style={[styles.heroTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                  Süreli Cari Takipleri & Alarmlar
                </Text>
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>YÖNETİCİ ÖZEL</Text>
                </View>
              </View>
              <Text style={styles.heroSubtitle}>
                Cari bazlı randevu, ödeme ve iş hatırlatıcıları (günü gelince sesli alarm çalar)
              </Text>
            </View>
          </View>

          {/* Full Width Orange Button: + Yeni Takip / Alarm Kur */}
          <TouchableOpacity
            style={styles.primaryActionButton}
            onPress={() => setIsCreateModalOpen(true)}
            activeOpacity={0.85}
          >
            <Plus size={18} color="#ffffff" />
            <Text style={styles.primaryActionText}>Yeni Takip / Alarm Kur</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Pills (Görsel-1): Bekleyenler 0, Tamamlananlar 0, Tümü 0 */}
        <View style={styles.filterPillsRow}>
          <TouchableOpacity
            style={[
              styles.filterPill,
              activeFilter === 'pending'
                ? styles.filterPillActiveOrange
                : [
                    styles.filterPillInactive,
                    { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' },
                  ],
            ]}
            onPress={() => setActiveFilter('pending')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === 'pending'
                  ? styles.filterPillTextActive
                  : { color: isDark ? '#cbd5e1' : '#64748b' },
              ]}
            >
              Bekleyenler {counts.pending}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              activeFilter === 'completed'
                ? styles.filterPillActiveOrange
                : [
                    styles.filterPillInactive,
                    { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' },
                  ],
            ]}
            onPress={() => setActiveFilter('completed')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === 'completed'
                  ? styles.filterPillTextActive
                  : { color: isDark ? '#cbd5e1' : '#64748b' },
              ]}
            >
              Tamamlananlar {counts.completed}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              activeFilter === 'all'
                ? styles.filterPillActiveOrange
                : [
                    styles.filterPillInactive,
                    { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' },
                  ],
            ]}
            onPress={() => setActiveFilter('all')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === 'all'
                  ? styles.filterPillTextActive
                  : { color: isDark ? '#cbd5e1' : '#64748b' },
              ]}
            >
              Tümü {counts.all}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content Area */}
        {filteredItems.length === 0 ? (
          /* Görsel-1: Empty State */
          <View
            style={[
              styles.emptyStateCard,
              {
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderColor: isDark ? '#1e293b' : '#e2e8f0',
              },
            ]}
          >
            <View
              style={[
                styles.emptyClockCircle,
                { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' },
              ]}
            >
              <Clock size={36} color="#64748b" />
            </View>
            <Text style={[styles.emptyTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
              Planlanmış süreli cari takibi bulunmuyor.
            </Text>
            <Text style={styles.emptyDesc}>
              Carilerinizle ilgili görüşme, ödeme veya işlem hatırlatıcıları kurarak günü geldiğinde sesli alarm alabilirsiniz.
            </Text>
            <TouchableOpacity
              style={[
                styles.emptyActionButton,
                {
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  borderColor: isDark ? '#334155' : '#cbd5e1',
                },
              ]}
              onPress={() => setIsCreateModalOpen(true)}
              activeOpacity={0.8}
            >
              <Plus size={16} color="#f59e0b" />
              <Text style={styles.emptyActionText}>Takip Alarmı Oluştur</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* List of follow-ups */
          <View style={styles.itemsList}>
            {filteredItems.map((item: TimedFollowUp) => (
              <View
                key={item.id}
                style={[
                  styles.followUpCard,
                  {
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: isDark ? '#1e293b' : '#e2e8f0',
                  },
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Building2 size={16} color="#f59e0b" />
                    <Text
                      style={[styles.cardCariName, { color: isDark ? '#ffffff' : '#0f172a' }]}
                      numberOfLines={1}
                    >
                      {item.cariName}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      item.status === 'completed'
                        ? styles.statusBadgeCompleted
                        : styles.statusBadgePending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        item.status === 'completed'
                          ? { color: '#10b981' }
                          : { color: '#f59e0b' },
                      ]}
                    >
                      {item.status === 'completed' ? 'Tamamlandı' : 'Bekliyor'}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.cardDescription, { color: isDark ? '#cbd5e1' : '#334155' }]}>
                  {item.description}
                </Text>

                <View style={styles.cardMetaRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Calendar size={13} color="#94a3b8" />
                    <Text style={styles.metaText}>{item.dueDate}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {item.soundAlarm && (
                      <View style={styles.iconHap}>
                        <Volume2 size={12} color="#f59e0b" />
                        <Text style={styles.iconHapText}>Melodi</Text>
                      </View>
                    )}
                    {item.sendPush && (
                      <View style={styles.iconHap}>
                        <Smartphone size={12} color="#3b82f6" />
                        <Text style={styles.iconHapText}>Push</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Actions */}
                <View
                  style={[
                    styles.cardActionsRow,
                    { borderTopColor: isDark ? '#1e293b' : '#f1f5f9' },
                  ]}
                >
                  {item.status === 'pending' ? (
                    <TouchableOpacity
                      style={styles.completeBtn}
                      onPress={() => handleComplete(item.id)}
                      activeOpacity={0.8}
                    >
                      <CheckCircle2 size={14} color="#10b981" />
                      <Text style={styles.completeBtnText}>Tamamlandı İşaretle</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={{ fontSize: 11, color: '#64748b' }}>
                      {item.completedByName ? `${item.completedByName} tarafından tamamlandı` : 'Tamamlandı'}
                    </Text>
                  )}

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(item.id, item.cariName)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* New Timed Follow-up Modal */}
      <TimedFollowUpModal
        visible={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

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
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  clockIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  adminBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  adminBadgeText: {
    color: '#f59e0b',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 15,
  },
  primaryActionButton: {
    backgroundColor: '#ea580c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#ea580c',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  filterPillActiveOrange: {
    backgroundColor: '#f59e0b',
  },
  filterPillInactive: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: '#0f172a',
    fontWeight: '800',
  },
  emptyStateCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyClockCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
  emptyDesc: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 290,
    marginBottom: 18,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  emptyActionText: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '700',
  },
  itemsList: {
    gap: 10,
  },
  followUpCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardCariName: {
    fontSize: 14,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  statusBadgeCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  metaText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  iconHap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  iconHapText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  completeBtnText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 6,
  },
});
