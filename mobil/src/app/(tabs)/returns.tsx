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
  Shield,
  RotateCcw,
  Clock,
  Package,
  Calendar,
  Barcode,
  Truck,
  CheckCircle2,
  Trash2,
  Building2,
} from 'lucide-react-native';
import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { ReturnWarrantyItem } from '../../types/storage';
import { AddReturnWarrantyModal } from '../../components/AddReturnWarrantyModal';
import { UserManagementModal } from '../../components/UserManagementModal';
import { CreateCompanyModal } from '../../components/CreateCompanyModal';
import { BranchManagementModal } from '../../components/BranchManagementModal';
import { NotificationListModal } from '../../components/NotificationListModal';

export default function ReturnsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useAppTheme();
  const {
    returnWarrantyItems,
    refreshData,
  } = useStorage();

  const isAdmin = user?.role === 'admin';

  // Management Modals
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);

  // New Return/Warranty Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'warranty' | 'return' | 'in_progress'>('all');
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

  // Filter counts (Görsel-1)
  const counts = useMemo(() => {
    const all = (returnWarrantyItems || []).length;
    const warranty = (returnWarrantyItems || []).filter((i) => i.type === 'warranty').length;
    const returnCount = (returnWarrantyItems || []).filter((i) => i.type === 'return').length;
    const inProgress = (returnWarrantyItems || []).filter((i) => i.status === 'pending').length;
    return { all, warranty, returnCount, inProgress };
  }, [returnWarrantyItems]);

  // Filtered items
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (returnWarrantyItems || []).filter((item) => {
      // Tab filter
      if (activeFilter === 'warranty' && item.type !== 'warranty') return false;
      if (activeFilter === 'return' && item.type !== 'return') return false;
      if (activeFilter === 'in_progress' && item.status !== 'pending') return false;

      // Text search
      if (q) {
        const inCompany = item.companyName?.toLowerCase().includes(q);
        const inCari = item.cariName?.toLowerCase().includes(q);
        const inSerial = item.serialNumber?.toLowerCase().includes(q);
        const inTracking = item.trackingCode?.toLowerCase().includes(q);
        const inNotes = item.notes?.toLowerCase().includes(q);
        const inStaff = item.createdByName?.toLowerCase().includes(q);
        return inCompany || inCari || inSerial || inTracking || inNotes || inStaff;
      }
      return true;
    });
  }, [returnWarrantyItems, activeFilter, searchQuery]);

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
        {/* Search Bar (Görsel-1) */}
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
            placeholder="Firma, seri no, kargo kodu veya personel adında ara..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Full-width Blue Button: + Yeni İade / Garanti Ekle (Görsel-1) */}
        <TouchableOpacity
          style={styles.primaryActionButton}
          onPress={() => setIsCreateModalOpen(true)}
          activeOpacity={0.85}
        >
          <Plus size={18} color="#ffffff" />
          <Text style={styles.primaryActionText}>Yeni İade / Garanti Ekle</Text>
        </TouchableOpacity>

        {/* 4 Filter Pills (Görsel-1): Tümü, Garantiler, İadeler, Süreçte */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filterRow}>
            {/* 1. Tümü */}
            <TouchableOpacity
              style={[
                styles.filterPill,
                activeFilter === 'all'
                  ? styles.filterPillActive
                  : [
                      styles.filterPillInactive,
                      { backgroundColor: isDark ? '#0f172a' : '#ffffff' },
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
                Tümü ({counts.all})
              </Text>
            </TouchableOpacity>

            {/* 2. Garantiler */}
            <TouchableOpacity
              style={[
                styles.filterPill,
                activeFilter === 'warranty'
                  ? styles.filterPillActive
                  : [
                      styles.filterPillInactive,
                      { backgroundColor: isDark ? '#0f172a' : '#ffffff' },
                    ],
              ]}
              onPress={() => setActiveFilter('warranty')}
              activeOpacity={0.8}
            >
              <Shield size={14} color={activeFilter === 'warranty' ? '#ffffff' : '#94a3b8'} />
              <Text
                style={[
                  styles.filterPillText,
                  activeFilter === 'warranty'
                    ? styles.filterPillTextActive
                    : { color: isDark ? '#cbd5e1' : '#64748b' },
                ]}
              >
                Garantiler ({counts.warranty})
              </Text>
            </TouchableOpacity>

            {/* 3. İadeler */}
            <TouchableOpacity
              style={[
                styles.filterPill,
                activeFilter === 'return'
                  ? styles.filterPillActive
                  : [
                      styles.filterPillInactive,
                      { backgroundColor: isDark ? '#0f172a' : '#ffffff' },
                    ],
              ]}
              onPress={() => setActiveFilter('return')}
              activeOpacity={0.8}
            >
              <RotateCcw size={14} color={activeFilter === 'return' ? '#ffffff' : '#94a3b8'} />
              <Text
                style={[
                  styles.filterPillText,
                  activeFilter === 'return'
                    ? styles.filterPillTextActive
                    : { color: isDark ? '#cbd5e1' : '#64748b' },
                ]}
              >
                İadeler ({counts.returnCount})
              </Text>
            </TouchableOpacity>

            {/* 4. Süreçte */}
            <TouchableOpacity
              style={[
                styles.filterPill,
                activeFilter === 'in_progress'
                  ? styles.filterPillActive
                  : [
                      styles.filterPillInactive,
                      { backgroundColor: isDark ? '#0f172a' : '#ffffff' },
                    ],
              ]}
              onPress={() => setActiveFilter('in_progress')}
              activeOpacity={0.8}
            >
              <Clock size={14} color={activeFilter === 'in_progress' ? '#ffffff' : '#94a3b8'} />
              <Text
                style={[
                  styles.filterPillText,
                  activeFilter === 'in_progress'
                    ? styles.filterPillTextActive
                    : { color: isDark ? '#cbd5e1' : '#64748b' },
                ]}
              >
                Süreçte ({counts.inProgress})
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Content Area (Görsel-1) */}
        {filteredItems.length === 0 ? (
          /* Görsel-1: Empty State Card */
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderColor: isDark ? '#1e293b' : '#e2e8f0',
              },
            ]}
          >
            <View style={styles.emptyIconCircle}>
              <Package size={36} color="#3b82f6" />
            </View>
            <Text style={[styles.emptyTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
              Henüz iade veya garanti kaydı eklenmedi
            </Text>
            <Text style={styles.emptySubtitle}>
              Garantiye veya iadeye gönderdiğiniz cihazların seri no ve kargo fişi fotoğraflarını ekleyerek kolayca takip edebilirsiniz.
            </Text>
            <TouchableOpacity
              style={[
                styles.emptyActionBtn,
                {
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  borderColor: isDark ? '#334155' : '#cbd5e1',
                },
              ]}
              onPress={() => setIsCreateModalOpen(true)}
              activeOpacity={0.8}
            >
              <Plus size={16} color="#3b82f6" />
              <Text style={styles.emptyActionBtnText}>İlk Kaydı Ekle</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cardsList}>
            {filteredItems.map((item: ReturnWarrantyItem) => {
              const isWarranty = item.type === 'warranty';
              const isCompleted = item.status === 'completed';

              return (
                <View
                  key={item.id}
                  style={[
                    styles.itemCard,
                    {
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      borderColor: isDark ? '#1e293b' : '#e2e8f0',
                    },
                  ]}
                >
                  <View style={styles.itemHeaderRow}>
                    <View
                      style={[
                        styles.badgeCapsule,
                        {
                          backgroundColor: isWarranty
                            ? 'rgba(59, 130, 246, 0.15)'
                            : 'rgba(168, 85, 247, 0.15)',
                        },
                      ]}
                    >
                      {isWarranty ? (
                        <Shield size={12} color="#3b82f6" />
                      ) : (
                        <RotateCcw size={12} color="#a855f7" />
                      )}
                      <Text
                        style={[
                          styles.badgeCapsuleText,
                          { color: isWarranty ? '#3b82f6' : '#a855f7' },
                        ]}
                      >
                        {isWarranty ? 'GARANTİ' : 'İADE'}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusCapsule,
                        {
                          backgroundColor: isCompleted
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'rgba(245, 158, 11, 0.15)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusCapsuleText,
                          { color: isCompleted ? '#10b981' : '#f59e0b' },
                        ]}
                      >
                        {isCompleted ? '✓ Tamamlandı' : '⏳ Süreçte'}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.cardTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                    {item.companyName}
                  </Text>

                  {item.cariName && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                      <Building2 size={13} color="#94a3b8" />
                      <Text style={{ fontSize: 12, color: '#94a3b8', fontWeight: '500' }}>
                        Cari: {item.cariName}
                      </Text>
                    </View>
                  )}

                  <View style={styles.metaRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Calendar size={12} color="#94a3b8" />
                      <Text style={styles.metaText}>{item.sentDate}</Text>
                    </View>

                    {item.serialNumber && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Barcode size={12} color="#94a3b8" />
                        <Text style={styles.metaText}>Seri: {item.serialNumber}</Text>
                      </View>
                    )}

                    {item.trackingCode && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Truck size={12} color="#94a3b8" />
                        <Text style={styles.metaText}>Kargo: {item.trackingCode}</Text>
                      </View>
                    )}
                  </View>

                  {item.notes && (
                    <Text
                      style={[styles.itemNotes, { color: isDark ? '#cbd5e1' : '#475569' }]}
                      numberOfLines={2}
                    >
                      {item.notes}
                    </Text>
                  )}

                  {/* Photos */}
                  {(item.serialNumberPhoto || item.trackingCodePhoto) && (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      {item.serialNumberPhoto && (
                        <Image source={{ uri: item.serialNumberPhoto }} style={styles.itemThumb} />
                      )}
                      {item.trackingCodePhoto && (
                        <Image source={{ uri: item.trackingCodePhoto }} style={styles.itemThumb} />
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Add Return / Warranty Modal (Görsel-2 & 3) */}
      <AddReturnWarrantyModal
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
    backgroundColor: '#2563eb',
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
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.25)',
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
    marginBottom: 18,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  emptyActionBtnText: {
    color: '#3b82f6',
    fontSize: 13,
    fontWeight: '700',
  },
  cardsList: {
    gap: 10,
  },
  itemCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgeCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeCapsuleText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusCapsule: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusCapsuleText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  metaText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  itemNotes: {
    fontSize: 12,
    lineHeight: 16,
  },
  itemThumb: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
});
