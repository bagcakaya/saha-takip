import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  StyleSheet,
  Linking,
  Alert,
  Platform,
  Image,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useStorage } from '../../context/StorageContext';
import { useAppTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { LocationService } from '../../services/locationService';
import {
  Search,
  Wrench,
  MapPin,
  Calendar,
  Navigation,
  X,
  User,
  Trash2,
  Share2,
  ArrowLeft,
  Users,
  Store,
  Bell,
  Sun,
  Moon,
  LogOut,
  Plus,
  Building2,
} from 'lucide-react-native';
import { ServiceItem } from '../../types/storage';
import AddServiceModal from '../../components/AddServiceModal';
import { UserManagementModal } from '../../components/UserManagementModal';
import { CreateCompanyModal } from '../../components/CreateCompanyModal';
import { BranchManagementModal } from '../../components/BranchManagementModal';
import { NotificationListModal } from '../../components/NotificationListModal';

export default function ServicesScreen() {
  const { services, refreshData, deleteService } = useStorage();
  const { isDark, toggleTheme, colors } = useAppTheme();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Top bar modal states
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert('Çıkış Yap', 'Oturumu kapatmak istediğinize emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const filteredServices = useMemo(() => {
    if (!search.trim()) return services;
    const q = search.toLowerCase();
    return services.filter((s) => {
      const inComp = (s.companyName || '').toLowerCase().includes(q);
      const inCari = (s.cariName || '').toLowerCase().includes(q);
      const inLoc = (s.location || '').toLowerCase().includes(q);
      const inWork = (s.workDone || '').toLowerCase().includes(q);
      const inUser = (s.createdByName || '').toLowerCase().includes(q);
      return inComp || inCari || inLoc || inWork || inUser;
    });
  }, [services, search]);

  const shareViaWhatsApp = (item: ServiceItem) => {
    const text =
      `*TEKNİK SERVİS RAPORU*\n` +
      `🏢 Firma: ${item.companyName}\n` +
      (item.cariName ? `👤 Cari: ${item.cariName}\n` : '') +
      (item.location ? `📍 Konum: ${item.location}\n` : '') +
      `📅 Tarih: ${item.date || new Date(item.createdAt).toLocaleDateString('tr-TR')}\n` +
      `🛠️ Yapılan İş:\n${item.workDone}\n` +
      `\n_İş Takip Portalı Üzerinden İletilmiştir._`;

    const encoded = encodeURIComponent(text);
    const url = `whatsapp://send?text=${encoded}`;

    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(`https://api.whatsapp.com/send?text=${encoded}`).catch(() => {
          Alert.alert('Hata', 'WhatsApp uygulaması açılamadı.');
        });
      }
    });
  };

  const handleDelete = (item: ServiceItem) => {
    Alert.alert(
      'Servis Kaydını Sil',
      `"${item.companyName}" servis kaydını silmek istediğinize emin misiniz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteService(item.id);
            if (!res.success) {
              Alert.alert('Hata', res.message);
            }
          },
        },
      ]
    );
  };

  const renderServiceCard = ({ item }: { item: ServiceItem }) => {
    return (
      <View
        style={[
          styles.serviceCard,
          {
            backgroundColor: isDark ? '#0c152e' : '#ffffff',
            borderColor: isDark ? '#1e293b' : '#e2e8f0',
          },
        ]}
      >
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            {item.cariName ? (
              <Text style={styles.cariNameBadge} numberOfLines={1}>
                {item.cariName}
              </Text>
            ) : null}
            <Text
              style={[
                styles.companyNameText,
                { color: isDark ? '#f8fafc' : '#0f172a' },
              ]}
            >
              {item.companyName}
            </Text>
          </View>
          <View style={styles.dateBadge}>
            <Calendar size={12} color="#f97316" />
            <Text style={styles.dateText}>
              {item.date || new Date(item.createdAt).toLocaleDateString('tr-TR')}
            </Text>
          </View>
        </View>

        {/* Location Row */}
        {item.location ? (
          <View style={styles.locRow}>
            <MapPin size={14} color="#94a3b8" />
            <Text
              style={[styles.locText, { color: isDark ? '#94a3b8' : '#64748b' }]}
              numberOfLines={2}
            >
              {item.location}
            </Text>
            <TouchableOpacity
              style={styles.mapActionBtn}
              onPress={() => LocationService.openInMaps(item.location, item.latitude, item.longitude)}
              activeOpacity={0.7}
            >
              <Navigation size={12} color="#3b82f6" />
              <Text style={styles.mapActionText}>Harita</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Work Done Box */}
        <View
          style={[
            styles.workBox,
            { backgroundColor: isDark ? '#080e21' : '#f8fafc' },
          ]}
        >
          <Text style={styles.workLabel}>Yapılan İşlemler:</Text>
          <Text
            style={[
              styles.workText,
              { color: isDark ? '#e2e8f0' : '#1e293b' },
            ]}
          >
            {item.workDone}
          </Text>
        </View>

        {/* Photos Preview */}
        {item.photos && item.photos.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.photosScroll}
          >
            {item.photos.map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={styles.cardPhoto} />
            ))}
          </ScrollView>
        ) : null}

        {/* Card Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.creatorRow}>
            <User size={13} color="#94a3b8" />
            <Text style={styles.creatorText}>{item.createdByName || 'Teknisyen'}</Text>
          </View>

          <View style={styles.footerActions}>
            <TouchableOpacity
              style={styles.whatsappActionBtn}
              onPress={() => shareViaWhatsApp(item)}
              activeOpacity={0.8}
            >
              <Share2 size={13} color="#10b981" />
              <Text style={styles.whatsappActionText}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteActionBtn}
              onPress={() => handleDelete(item)}
              activeOpacity={0.8}
            >
              <Trash2 size={13} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#020617' : '#f8fafc' }]}>
      {/* 1. Header Bar (Consistent with Görsel-1) */}
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
          {/* Back to Home Button */}
          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => router.push('/(tabs)')}
            activeOpacity={0.8}
          >
            <ArrowLeft size={16} color="#ffffff" />
            <Text style={styles.homeBtnText}>Ana Menü</Text>
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
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <LogOut size={17} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <FlatList
        data={filteredServices}
        keyExtractor={(item) => item.id}
        renderItem={renderServiceCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ea580c"
            colors={['#ea580c']}
          />
        }
        ListHeaderComponent={
          /* Görsel-2: Arama & Aksiyon Kutusu */
          <View
            style={[
              styles.topActionCard,
              {
                backgroundColor: isDark ? '#0c152e' : '#ffffff',
                borderColor: isDark ? '#1e293b' : '#e2e8f0',
              },
            ]}
          >
            {/* Search Input */}
            <View
              style={[
                styles.searchBox,
                {
                  backgroundColor: isDark ? '#080e21' : '#f1f5f9',
                  borderColor: isDark ? '#1e293b' : '#cbd5e1',
                },
              ]}
            >
              <Search size={17} color="#94a3b8" />
              <TextInput
                style={[
                  styles.searchInput,
                  { color: isDark ? '#f8fafc' : '#0f172a' },
                ]}
                placeholder="Firma, cari, lokasyon, yapılan iş veya personel ara..."
                placeholderTextColor="#64748b"
                value={search}
                onChangeText={setSearch}
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <X size={16} color="#94a3b8" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* + Yeni Servis Ekle (Turuncu Buton) */}
            <TouchableOpacity
              style={styles.addServiceBtn}
              onPress={() => setIsAddModalOpen(true)}
              activeOpacity={0.85}
            >
              <Plus size={18} color="#ffffff" />
              <Text style={styles.addServiceBtnText}>Yeni Servis Ekle</Text>
            </TouchableOpacity>

            {/* Toplam X Servis Kaydı Kapsülü */}
            <View style={styles.counterRow}>
              <View style={styles.counterPill}>
                <Text style={styles.counterPillText}>
                  Toplam {filteredServices.length} Servis Kaydı
                </Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          /* Görsel-2: Boş Durum Kartı (Henüz Servis Kaydı Yok) */
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: isDark ? '#0c152e' : '#ffffff',
                borderColor: isDark ? '#1e293b' : '#e2e8f0',
              },
            ]}
          >
            {/* Centered Orange Wrench Avatar */}
            <View style={styles.emptyIconCircle}>
              <Wrench size={30} color="#f97316" />
            </View>

            <Text
              style={[
                styles.emptyTitle,
                { color: isDark ? '#ffffff' : '#0f172a' },
              ]}
            >
              Henüz Servis Kaydı Yok
            </Text>

            <Text style={styles.emptyDesc}>
              Müşterilerinizde veya sahada yapılan teknik servis ve müdahaleleri
              kaydetmek için "Yeni Servis Ekle" butonunu kullanabilirsiniz.
            </Text>

            <TouchableOpacity
              style={styles.firstAddBtn}
              onPress={() => setIsAddModalOpen(true)}
              activeOpacity={0.85}
            >
              <Plus size={17} color="#ffffff" />
              <Text style={styles.firstAddBtnText}>İlk Servisi Ekle</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Görsel-3: Yeni Servis Ekle Modalı */}
      <AddServiceModal
        visible={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
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

      {/* Notification List Modal */}
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
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  topActionCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  addServiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ea580c',
    borderRadius: 12,
    paddingVertical: 13,
  },
  addServiceBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  counterRow: {
    flexDirection: 'row',
    marginTop: -2,
  },
  counterPill: {
    backgroundColor: 'rgba(234, 88, 12, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(234, 88, 12, 0.45)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterPillText: {
    color: '#fb923c',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(234, 88, 12, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: 20,
  },
  firstAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ea580c',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  firstAddBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  serviceCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  cariNameBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38bdf8',
    marginBottom: 2,
  },
  companyNameText: {
    fontSize: 16,
    fontWeight: '900',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dateText: {
    fontSize: 11,
    color: '#f97316',
    fontWeight: '700',
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locText: {
    flex: 1,
    fontSize: 12,
  },
  mapActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 6,
  },
  mapActionText: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: '700',
  },
  workBox: {
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  workLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#f97316',
  },
  workText: {
    fontSize: 13,
    lineHeight: 18,
  },
  photosScroll: {
    flexDirection: 'row',
    marginTop: 2,
  },
  cardPhoto: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  creatorText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  whatsappActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  whatsappActionText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteActionBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    padding: 6,
    borderRadius: 8,
  },
});
