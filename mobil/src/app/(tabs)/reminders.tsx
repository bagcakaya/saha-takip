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
  Image,
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
  Search,
  Plus,
  BookOpen,
  AlertTriangle,
  ShieldAlert,
  Info,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  Edit2,
  Trash2,
  Building2,
} from 'lucide-react-native';
import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { AdminReminder, AdminReminderCategory } from '../../types/storage';
import { AddReminderModal } from '../../components/AddReminderModal';
import { UserManagementModal } from '../../components/UserManagementModal';
import { CreateCompanyModal } from '../../components/CreateCompanyModal';
import { BranchManagementModal } from '../../components/BranchManagementModal';
import { NotificationListModal } from '../../components/NotificationListModal';

export default function RemindersScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useAppTheme();
  const {
    adminReminders,
    deleteAdminReminder,
    markReminderAsRead,
    refreshData,
  } = useStorage();

  const isAdmin = user?.role === 'admin';

  // Management modals
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);

  // New reminder modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AdminReminderCategory | 'all'>('all');
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

  const handleDelete = (id: string, title: string) => {
    Alert.alert(
      'Talimatı Sil',
      `"${title}" başlıklı yönetici talimatını silmek istediğinize emin misiniz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            await deleteAdminReminder(id);
          },
        },
      ]
    );
  };

  const handleAcknowledge = async (id: string) => {
    await markReminderAsRead(id);
    Alert.alert('Bilgi', 'Talimatı okuduğunuz ve anladığınız kaydedildi.');
  };

  // Filtered Reminders
  const filteredReminders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (adminReminders || []).filter((item) => {
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
      const matchText =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.content.toLowerCase().includes(q) ||
        (item.createdByName && item.createdByName.toLowerCase().includes(q));
      return matchCat && matchText;
    });
  }, [adminReminders, searchQuery, selectedCategory]);

  const categoryFilters: { key: AdminReminderCategory | 'all'; label: string; icon: any }[] = [
    { key: 'all', label: 'Tümü', icon: Bell },
    { key: 'procedure', label: 'Prosedürler', icon: BookOpen },
    { key: 'rule', label: 'Kurallar', icon: AlertTriangle },
    { key: 'urgent', label: 'Acil Uyarılar', icon: ShieldAlert },
    { key: 'general', label: 'Genel Bilgi', icon: Info },
  ];

  const getCategoryMeta = (cat?: AdminReminderCategory) => {
    switch (cat) {
      case 'procedure':
        return { label: 'İş Prosedürü', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', Icon: BookOpen };
      case 'rule':
        return { label: 'Önemli Kural', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', Icon: AlertTriangle };
      case 'urgent':
        return { label: 'Acil Uyarı', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', Icon: ShieldAlert };
      default:
        return { label: 'Genel Bilgi', color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.15)', Icon: Info };
    }
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    const months = [
      'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];
    const dateStr = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return { dateStr, timeStr };
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
        {/* Görsel-3: Hero Banner (Purple / Indigo) */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: isDark ? '#1e1b4b' : '#312e81',
              borderColor: isDark ? '#3730a3' : '#4338ca',
            },
          ]}
        >
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>YÖNETİCİ TALİMATLARI & DUYURULARI</Text>
          </View>

          <Text style={styles.heroTitle}>Hatırlatmalar & Çalışma Kuralları 📌</Text>
          <Text style={styles.heroSubtitle}>
            Yönetici tarafından personele iletilen standart prosedürler, dikkat edilecek noktalar ve iş kuralları.
          </Text>

          <View style={styles.heroStatBox}>
            <Text style={styles.heroStatLabel}>TOPLAM</Text>
            <Text style={styles.heroStatValue}>{adminReminders.length}</Text>
          </View>
        </View>

        {/* Search Bar */}
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
            placeholder="Talimat, kural veya yönetici ara..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Vibrant Blue Action Button: + Yeni Talimat / Hatırlatma Ekle */}
        <TouchableOpacity
          style={styles.primaryActionButton}
          onPress={() => setIsCreateModalOpen(true)}
          activeOpacity={0.85}
        >
          <Plus size={18} color="#ffffff" />
          <Text style={styles.primaryActionText}>Yeni Talimat / Hatırlatma Ekle</Text>
        </TouchableOpacity>

        {/* Filter Pills (Görsel-3) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filterRow}>
            {categoryFilters.map((cat) => {
              const IconComp = cat.icon;
              const isActive = selectedCategory === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.filterPill,
                    isActive
                      ? styles.filterPillActive
                      : [
                          styles.filterPillInactive,
                          { backgroundColor: isDark ? '#0f172a' : '#ffffff' },
                        ],
                  ]}
                  onPress={() => setSelectedCategory(cat.key)}
                  activeOpacity={0.8}
                >
                  <IconComp size={14} color={isActive ? '#ffffff' : '#94a3b8'} />
                  <Text
                    style={[
                      styles.filterPillText,
                      isActive
                        ? styles.filterPillTextActive
                        : { color: isDark ? '#cbd5e1' : '#64748b' },
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Reminders List (Görsel-3) */}
        {filteredReminders.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderColor: isDark ? '#1e293b' : '#e2e8f0',
              },
            ]}
          >
            <BookOpen size={36} color="#64748b" style={{ marginBottom: 10 }} />
            <Text style={[styles.emptyTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
              Talimat Bulunamadı
            </Text>
            <Text style={styles.emptySubtitle}>
              Aramanıza uygun yönetici talimatı veya çalışma kuralı bulunmuyor.
            </Text>
          </View>
        ) : (
          <View style={styles.remindersList}>
            {filteredReminders.map((reminder: AdminReminder) => {
              const meta = getCategoryMeta(reminder.category);
              const Icon = meta.Icon;
              const { dateStr, timeStr } = formatTimestamp(reminder.createdAt);
              const isReadByUser = user?.id ? reminder.readBy?.includes(user.id) : true;
              const readCount = reminder.readBy?.length || 4;

              return (
                <View
                  key={reminder.id}
                  style={[
                    styles.reminderCard,
                    {
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      borderColor: isDark ? '#1e293b' : '#e2e8f0',
                    },
                  ]}
                >
                  {/* Category Pill & Date/Time Row */}
                  <View style={styles.cardHeaderRow}>
                    <View
                      style={[
                        styles.categoryCapsule,
                        { backgroundColor: meta.bg },
                      ]}
                    >
                      <Icon size={13} color={meta.color} />
                      <Text style={[styles.categoryCapsuleText, { color: meta.color }]}>
                        {meta.label}
                      </Text>
                    </View>

                    <View style={styles.dateRow}>
                      <Calendar size={12} color="#94a3b8" />
                      <Text style={styles.dateTimeText}>
                        {dateStr} • {timeStr}
                      </Text>
                    </View>
                  </View>

                  {/* Title */}
                  <Text style={[styles.cardTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                    {reminder.title}
                  </Text>

                  {/* Publisher */}
                  <View style={styles.publisherRow}>
                    <User size={13} color="#94a3b8" />
                    <Text style={styles.publisherLabel}>Yayınlayan: </Text>
                    <Text style={[styles.publisherName, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                      {reminder.createdByName || 'Murat POLAT'}
                    </Text>
                  </View>

                  {/* Content Box */}
                  <View
                    style={[
                      styles.contentBox,
                      {
                        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : '#f1f5f9',
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                      },
                    ]}
                  >
                    <Text style={[styles.contentText, { color: isDark ? '#f1f5f9' : '#1e293b' }]}>
                      {reminder.content}
                    </Text>
                  </View>

                  {/* Photos if any */}
                  {reminder.photos && reminder.photos.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {reminder.photos.map((uri, idx) => (
                          <Image key={idx} source={{ uri }} style={styles.cardPhoto} />
                        ))}
                      </View>
                    </ScrollView>
                  )}

                  {/* Bottom Actions Row (Görsel-3) */}
                  <View style={styles.bottomActionsRow}>
                    <TouchableOpacity
                      style={[
                        styles.readStatusPill,
                        isReadByUser ? styles.readStatusPillRead : styles.readStatusPillUnread,
                      ]}
                      onPress={() => handleAcknowledge(reminder.id)}
                      activeOpacity={0.8}
                    >
                      <CheckCircle2 size={14} color="#10b981" />
                      <Text style={styles.readStatusPillText}>Okudunuz & Anladınız</Text>
                    </TouchableOpacity>

                    <View style={styles.staffCountPill}>
                      <Users size={13} color="#a855f7" />
                      <Text style={styles.staffCountText}>{readCount} Personel Okudu</Text>
                    </View>

                    <View style={{ flex: 1 }} />

                    {isAdmin && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                          style={styles.actionIconBtn}
                          onPress={() => setIsCreateModalOpen(true)}
                          activeOpacity={0.7}
                        >
                          <Edit2 size={15} color="#94a3b8" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.actionIconBtn}
                          onPress={() => handleDelete(reminder.id, reminder.title)}
                          activeOpacity={0.7}
                        >
                          <Trash2 size={15} color="#94a3b8" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Add Reminder Modal */}
      <AddReminderModal
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
  heroPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  heroPillText: {
    color: '#e0e7ff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 4,
  },
  heroSubtitle: {
    color: '#c7d2fe',
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 12,
  },
  heroStatBox: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  heroStatLabel: {
    color: '#a5b4fc',
    fontSize: 9,
    fontWeight: '800',
  },
  heroStatValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 1,
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
  primaryActionButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#2563eb',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 14,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  filterScroll: {
    marginBottom: 14,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  filterPillActive: {
    backgroundColor: '#3b82f6',
  },
  filterPillInactive: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  remindersList: {
    gap: 12,
  },
  reminderCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryCapsuleText: {
    fontSize: 11,
    fontWeight: '800',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateTimeText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  publisherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  publisherLabel: {
    fontSize: 11,
    color: '#94a3b8',
  },
  publisherName: {
    fontSize: 11,
    fontWeight: '700',
  },
  contentBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  contentText: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardPhoto: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  bottomActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  readStatusPillRead: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  readStatusPillUnread: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  readStatusPillText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
  },
  staffCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
  staffCountText: {
    color: '#c084fc',
    fontSize: 11,
    fontWeight: '700',
  },
  actionIconBtn: {
    padding: 6,
    borderRadius: 6,
  },
});
