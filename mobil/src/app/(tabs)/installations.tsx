import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  StyleSheet,
  Alert,
  Linking,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { LocationService } from '../../services/locationService';
import {
  Plus,
  Search,
  MapPin,
  CheckCircle2,
  Clock,
  ArrowLeft,
  MessageCircle,
  Trash2,
  Users,
  Store,
  Shield,
  Bell,
  Sun,
  Moon,
  LogOut,
  Calendar,
  User,
  ChevronRight,
  Camera,
  Hourglass,
  Check,
  Building2,
} from 'lucide-react-native';
import { LocationItem } from '../../types/storage';
import { AddLocationModal } from '../../components/AddLocationModal';
import { LocationDetailModal } from '../../components/LocationDetailModal';
import { NotificationListModal } from '../../components/NotificationListModal';
import { UserManagementModal } from '../../components/UserManagementModal';
import { CreateCompanyModal } from '../../components/CreateCompanyModal';
import { BranchManagementModal } from '../../components/BranchManagementModal';

export default function InstallationsScreen() {
  const { locations, refreshData, deleteLocation } = useStorage();
  const { user, users, logout } = useAuth();
  const { isDark, toggleTheme, colors } = useAppTheme();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [filter, setFilter] = useState<'all' | 'in_progress' | 'pending_approval' | 'approved'>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationItem | null>(null);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);

  const isAdmin = user?.role === 'admin';

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  // Filter counts for pills (Matches Görsel 3)
  const counts = useMemo(() => {
    let inProgress = 0;
    let pendingApproval = 0;
    let approved = 0;

    locations.forEach((loc) => {
      if (loc.status === 'pending_approval') {
        pendingApproval++;
      } else if (loc.status === 'approved' || loc.status === 'completed') {
        approved++;
      } else {
        inProgress++;
      }
    });

    return {
      all: locations.length,
      inProgress,
      pendingApproval,
      approved,
    };
  }, [locations]);

  // Filtered list
  const filteredLocations = useMemo(() => {
    return locations.filter((loc) => {
      // 1. Staff filter
      if (selectedStaff !== 'all') {
        if (loc.createdBy !== selectedStaff && loc.createdByName !== selectedStaff) {
          return false;
        }
      }

      // 2. Status filter
      if (filter === 'in_progress' && (loc.status === 'completed' || loc.status === 'approved')) {
        return false;
      }
      if (filter === 'pending_approval' && loc.status !== 'pending_approval') {
        return false;
      }
      if (filter === 'approved' && loc.status !== 'approved' && loc.status !== 'completed') {
        return false;
      }

      // 3. Search query
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        loc.name.toLowerCase().includes(q) ||
        (loc.cariName && loc.cariName.toLowerCase().includes(q)) ||
        (loc.address && loc.address.toLowerCase().includes(q)) ||
        (loc.createdByName && loc.createdByName.toLowerCase().includes(q))
      );
    });
  }, [locations, search, selectedStaff, filter]);

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Kurulumu Sil', `"${name}" kaydını silmek istediğinize emin misiniz?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await deleteLocation(id);
        },
      },
    ]);
  };

  const shareViaWhatsApp = (item: LocationItem) => {
    const tasks = item.tasks || [];
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const total = tasks.length || 12;

    const text =
      `*KURULUM RAPORU: ${item.name}*\n` +
      (item.cariName ? `🏢 Cari: ${item.cariName}\n` : '') +
      (item.address ? `📍 Adres: ${item.address}\n` : '') +
      `✅ Tamamlanan: ${completed}/${total}\n` +
      `👤 Yetkili: ${item.createdByName || user?.name || 'Saha Personeli'}\n\n` +
      `İş Takip Sistemi üzerinden iletilmiştir.`;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`).catch(() => {});
  };

  const renderItem = ({ item }: { item: LocationItem }) => {
    const tasks = item.tasks || [];
    const totalTasks = tasks.length || 12;
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const notPresentTasks = tasks.filter((t) => t.status === 'not_present').length;
    const percent = Math.round((completedTasks / totalTasks) * 100);
    const photoCount = item.photos?.length || 0;

    const dateStr = item.createdAt
      ? new Date(item.createdAt).toLocaleDateString('tr-TR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '11 Eyl 2026 14:58';

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? '#0c152e' : '#ffffff',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0',
          },
        ]}
      >
        {/* Top: Title & Status Badge (Matches Görsel 3) */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text
              style={[styles.cardTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            {item.cariName ? (
              <Text style={styles.cardCariName} numberOfLines={1}>
                {item.cariName}
              </Text>
            ) : null}
          </View>

          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>
              • %{percent} {percent === 100 ? 'Tamamlandı' : 'Devam Ediyor'}
            </Text>
          </View>
        </View>

        {/* Date & Staff */}
        <View style={styles.metaRow}>
          <Calendar size={13} color="#94a3b8" />
          <Text style={styles.metaText}>{dateStr}</Text>
          <Text style={styles.metaDot}>•</Text>
          <User size={13} color="#60a5fa" />
          <Text style={[styles.metaText, { color: '#60a5fa' }]}>
            {item.createdByName || 'Burak AĞCAKAYA'}
          </Text>
        </View>

        {/* Address */}
        {item.address ? (
          <View style={styles.addressRow}>
            <MapPin size={14} color="#94a3b8" />
            <Text style={styles.addressText} numberOfLines={2}>
              {item.address}
            </Text>
          </View>
        ) : null}

        {/* Photo count badge */}
        {photoCount > 0 ? (
          <View style={styles.photoBadgeRow}>
            <Camera size={13} color="#10b981" />
            <Text style={styles.photoBadgeText}>{photoCount} Fotoğraf</Text>
          </View>
        ) : null}

        {/* Progress Bar (Matches Görsel 3) */}
        <View style={styles.progressContainer}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressSuccessText}>
              ✅ {completedTasks} / {totalTasks} Görev Tamam
            </Text>
            <Text style={styles.progressWarningText}>
              {notPresentTasks} Mevcut Değil
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressBarGreen,
                { width: `${(completedTasks / totalTasks) * 100}%` },
              ]}
            />
            <View
              style={[
                styles.progressBarOrange,
                { width: `${(notPresentTasks / totalTasks) * 100}%` },
              ]}
            />
          </View>
        </View>

        {/* Action Row (Matches Görsel 3) */}
        <View style={styles.cardActionRow}>
          {/* Left: 📍 💬 🗑️ */}
          <View style={styles.iconButtonsGroup}>
            <TouchableOpacity
              style={[styles.iconCircleBtn, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}
              onPress={() => LocationService.openInMaps(item.address, item.latitude, item.longitude)}
            >
              <MapPin size={16} color="#3b82f6" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.iconCircleBtn, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}
              onPress={() => shareViaWhatsApp(item)}
            >
              <MessageCircle size={16} color="#10b981" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.iconCircleBtn, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}
              onPress={() => handleDelete(item.id, item.name)}
            >
              <Trash2 size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>

          {/* Right: Detaylar & Tutanak > */}
          <TouchableOpacity
            style={styles.detailLinkBtn}
            onPress={() => setSelectedLocation(item)}
          >
            <Text style={styles.detailLinkText}>Detaylar & Tutanak</Text>
            <ChevronRight size={15} color="#3b82f6" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 1. Top Navigation Bar (Matches Görsel 3) */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: colors.navBackground,
            borderBottomColor: colors.navBorder,
          },
        ]}
      >
        <View style={styles.topBarContainer}>
          {/* Ana Menü Button */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.push('/(tabs)')}
            activeOpacity={0.8}
          >
            <ArrowLeft size={16} color="#ffffff" />
            <Text style={styles.backBtnText}>Ana Menü</Text>
          </TouchableOpacity>

          {/* Right 5 Icon Buttons */}
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
              onPress={() => {
                Alert.alert('Çıkış Yap', 'Oturumu kapatmak istediğinize emin misiniz?', [
                  { text: 'Vazgeç', style: 'cancel' },
                  { text: 'Çıkış Yap', style: 'destructive', onPress: () => logout() },
                ]);
              }}
              activeOpacity={0.7}
            >
              <LogOut size={17} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 2. Search & Staff & Add Row (Matches Görsel 3) */}
      <View style={styles.searchSection}>
        <View style={styles.searchAndStaffRow}>
          {/* Search Input */}
          <View
            style={[
              styles.searchBox,
              {
                backgroundColor: isDark ? '#0c152e' : '#ffffff',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#cbd5e1',
              },
            ]}
          >
            <Search size={16} color="#94a3b8" />
            <TextInput
              style={[styles.searchInput, { color: isDark ? '#ffffff' : '#0f172a' }]}
              placeholder="Firma, ac..."
              placeholderTextColor="#64748b"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* Staff Select Trigger */}
          <View
            style={[
              styles.staffBox,
              {
                backgroundColor: isDark ? '#0c152e' : '#ffffff',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#cbd5e1',
              },
            ]}
          >
            <User size={14} color="#94a3b8" />
            <Text style={styles.staffBoxText} numberOfLines={1}>
              Tüm Personeller
            </Text>
          </View>

          {/* + Yeni Kurulum Ekle Button (Matches Görsel 3) */}
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setIsAddModalOpen(true)}
            activeOpacity={0.85}
          >
            <Plus size={16} color="#ffffff" />
            <Text style={styles.addBtnText}>+ Yeni Kurulum Ekle</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Pills Row (Matches Görsel 3) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsRow}
        >
          <TouchableOpacity
            style={[
              styles.filterPill,
              filter === 'all' && styles.filterPillActive,
            ]}
            onPress={() => setFilter('all')}
          >
            <Text style={styles.filterPillText}>Tümü ({counts.all})</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              filter === 'in_progress' && styles.filterPillActive,
            ]}
            onPress={() => setFilter('in_progress')}
          >
            <Clock size={13} color="#ffffff" />
            <Text style={styles.filterPillText}>Devam Edenler ({counts.inProgress})</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              filter === 'pending_approval' && styles.filterPillActive,
            ]}
            onPress={() => setFilter('pending_approval')}
          >
            <Hourglass size={13} color="#f59e0b" />
            <Text style={[styles.filterPillText, { color: '#f59e0b' }]}>
              Onay Bekleyenler ({counts.pendingApproval})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              filter === 'approved' && styles.filterPillActive,
            ]}
            onPress={() => setFilter('approved')}
          >
            <Check size={13} color="#10b981" />
            <Text style={[styles.filterPillText, { color: '#10b981' }]}>
              Onaylananlar ({counts.approved})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* 3. Installations FlatList (Matches Görsel 3) */}
      <FlatList
        data={filteredLocations}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Store size={44} color="#94a3b8" />
            <Text style={[styles.emptyTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
              Kurulum Bulunamadı
            </Text>
            <Text style={styles.emptySubtitle}>
              Yeni bir kurulum yeri eklemek için yukarıdaki "+ Yeni Kurulum Ekle" butonuna dokunabilirsiniz.
            </Text>
          </View>
        }
      />

      {/* Add Location Modal (Görsel 4) */}
      <AddLocationModal
        visible={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      {/* Location Detail & Checklist Modal (Görsel 3) */}
      <LocationDetailModal
        location={selectedLocation}
        visible={!!selectedLocation}
        onClose={() => setSelectedLocation(null)}
      />

      {/* Notification List Modal (Görsel 2) */}
      <NotificationListModal
        visible={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
      />

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingTop: Platform.OS === 'ios' ? 52 : 42,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  topBarScroll: {
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 11,
  },
  backBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  topBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
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
  searchSection: {
    padding: 14,
    gap: 10,
  },
  searchAndStaffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  staffBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  staffBoxText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '700',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563eb',
    height: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 2,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterPillActive: {
    backgroundColor: '#2563eb',
    borderColor: '#3b82f6',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 30,
    gap: 14,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  cardCariName: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '700',
    marginTop: 2,
  },
  statusPill: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#60a5fa',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  metaDot: {
    color: '#64748b',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addressText: {
    fontSize: 12,
    color: '#94a3b8',
    flex: 1,
  },
  photoBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  photoBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10b981',
  },
  progressContainer: {
    gap: 6,
    marginTop: 4,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressSuccessText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10b981',
  },
  progressWarningText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#f59e0b',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressBarGreen: {
    height: '100%',
    backgroundColor: '#10b981',
  },
  progressBarOrange: {
    height: '100%',
    backgroundColor: '#f59e0b',
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  iconButtonsGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  iconCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailLinkText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3b82f6',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 17,
  },
});
