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
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useStorage } from '../../context/StorageContext';
import { useAppTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
  Search,
  ClipboardList,
  Calendar,
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
  Clock,
  CheckCircle2,
  Check,
  Megaphone,
  Lock,
  Building2,
  Camera,
  UserCheck,
} from 'lucide-react-native';
import { GeneralNote } from '../../types/storage';
import AddWorkOrderModal from '../../components/AddWorkOrderModal';
import { UserManagementModal } from '../../components/UserManagementModal';
import { CreateCompanyModal } from '../../components/CreateCompanyModal';
import { BranchManagementModal } from '../../components/BranchManagementModal';
import { NotificationListModal } from '../../components/NotificationListModal';

type FilterTab = 'all' | 'pending' | 'approved';

export default function WorkOrdersScreen() {
  const { notes, refreshData, deleteNote, updateNoteStatus } = useStorage();
  const { isDark, toggleTheme } = useAppTheme();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

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

  const counts = useMemo(() => {
    const total = notes.length;
    const pending = notes.filter((n) => (n.status || 'pending') === 'pending').length;
    const approved = notes.filter((n) => n.status === 'approved' || n.status === 'completed').length;
    return { total, pending, approved };
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const list = notes.filter((n) => {
      // Tab filter
      const status = n.status || 'pending';
      if (activeTab === 'pending' && status !== 'pending') return false;
      if (activeTab === 'approved' && status !== 'approved' && status !== 'completed') return false;

      // Search query filter
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const inContent = (n.content || '').toLowerCase().includes(q);
      const inCari = (n.cariName || '').toLowerCase().includes(q);
      const inCreator = (n.createdByName || '').toLowerCase().includes(q);
      const inTargets = (n.targetUserNames || []).some((u) => u.toLowerCase().includes(q));
      return inContent || inCari || inCreator || inTargets;
    });

    return [...list].sort((a, b) => {
      // 1. Onaylananlar sekmesinde en son onaylanan iş emri en üstte
      if (activeTab === 'approved') {
        const aAppr = a.approvedAt || a.completedAt || a.createdAt || 0;
        const bAppr = b.approvedAt || b.completedAt || b.createdAt || 0;
        return bAppr - aAppr;
      }

      // 2. Diğer sekmelerde (Tümü vb.):
      // Onaylanmışsa onay zamanı, bekleyen onay ise tamamlanma zamanı, değilse oluşturulma zamanı
      const aTime =
        (a.status === 'approved' || a.status === 'completed') && a.approvedAt
          ? a.approvedAt
          : a.status === 'pending_approval' && a.completedAt
          ? a.completedAt
          : a.createdAt || 0;

      const bTime =
        (b.status === 'approved' || b.status === 'completed') && b.approvedAt
          ? b.approvedAt
          : b.status === 'pending_approval' && b.completedAt
          ? b.completedAt
          : b.createdAt || 0;

      return bTime - aTime;
    });
  }, [notes, activeTab, search]);

  const shareViaWhatsApp = (item: GeneralNote) => {
    const targetDesc =
      item.targetMode === 'all'
        ? 'Tüm Saha Ekibi'
        : item.targetMode === 'self'
        ? item.createdByName || 'Şahsi'
        : (item.targetUserNames || []).join(', ');

    const dateStr = new Date(item.createdAt).toLocaleDateString('tr-TR');
    const text =
      `*İŞ EMRİ / DUYURU RAPORU*\n` +
      `👥 Kime: ${targetDesc}\n` +
      (item.cariName ? `🏢 Cari: ${item.cariName}\n` : '') +
      `📅 Tarih: ${dateStr}\n` +
      `📋 Açıklama:\n${item.content}\n` +
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

  const handleDelete = (item: GeneralNote) => {
    Alert.alert(
      'İş Emrini Sil',
      'Bu iş emrini silmek istediğinize emin misiniz?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteNote(item.id);
            if (!res.success) {
              Alert.alert('Hata', res.message);
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = async (item: GeneralNote) => {
    const isCompleted = item.status === 'approved' || item.status === 'completed';
    const newStatus = isCompleted ? 'pending' : 'approved';
    await updateNoteStatus(item.id, newStatus);
  };

  const renderNoteCard = ({ item }: { item: GeneralNote }) => {
    const isCompleted = item.status === 'approved' || item.status === 'completed';

    return (
      <View
        style={[
          styles.noteCard,
          {
            backgroundColor: isDark ? '#0c152e' : '#ffffff',
            borderColor: isCompleted
              ? 'rgba(16, 185, 129, 0.4)'
              : isDark
              ? '#1e293b'
              : '#e2e8f0',
          },
        ]}
      >
        {/* Top Prominent Cari Banner (Görsel-4 style) */}
        {item.cariName ? (
          <View style={styles.cariBanner}>
            <Building2 size={16} color="#ffffff" />
            <View style={styles.cariBadgePill}>
              <Text style={styles.cariBadgePillText}>CARİ</Text>
            </View>
            <Text style={styles.cariBannerTitle} numberOfLines={1}>
              {item.cariName}
            </Text>
          </View>
        ) : null}

        {/* Header Row: Target Mode Badge & Status Badge */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.targetBadge}>
            {item.targetMode === 'all' ? (
              <>
                <Megaphone size={12} color="#60a5fa" />
                <Text style={styles.targetBadgeText}>Tüm Personel</Text>
              </>
            ) : item.targetMode === 'self' ? (
              <>
                <Lock size={12} color="#cbd5e1" />
                <Text style={styles.targetBadgeText}>Sadece Kendim</Text>
              </>
            ) : (
              <>
                <Users size={12} color="#a78bfa" />
                <Text style={[styles.targetBadgeText, { color: '#c4b5fd' }]}>
                  {(item.targetUserNames || []).join(', ') || 'Özel Kişiler'}
                </Text>
              </>
            )}
          </View>

          <View
            style={[
              styles.statusBadge,
              isCompleted ? styles.statusBadgeDone : styles.statusBadgePending,
            ]}
          >
            {isCompleted ? (
              <>
                <CheckCircle2 size={12} color="#10b981" />
                <Text style={styles.statusTextDone}>Onaylandı</Text>
              </>
            ) : (
              <>
                <Clock size={12} color="#f59e0b" />
                <Text style={styles.statusTextPending}>Bekliyor</Text>
              </>
            )}
          </View>
        </View>

        {/* Content Box */}
        <View
          style={[
            styles.contentBox,
            { backgroundColor: isDark ? '#080e21' : '#f8fafc' },
          ]}
        >
          <Text
            style={[
              styles.contentText,
              { color: isDark ? '#f1f5f9' : '#0f172a' },
            ]}
          >
            {item.content}
          </Text>
        </View>

        {/* Job Order Photos (Görsel-4 style) */}
        {item.photos && item.photos.length > 0 ? (
          <View style={styles.photosSection}>
            <View style={styles.photosSectionHeader}>
              <Camera size={13} color="#94a3b8" />
              <Text style={styles.photosSectionTitle}>
                İŞ EMRİ FOTOĞRAFLARI ({item.photos.length})
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
            >
              {item.photos.map((uri, idx) => (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.85}
                  onPress={() => setLightboxImage(uri)}
                  style={styles.photoThumbWrapper}
                >
                  <Image source={{ uri }} style={styles.cardPhoto} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Personnel Completion Details Box (Görsel-4 style) */}
        {(item.completedByName || item.completionNote || (item.completionPhotos && item.completionPhotos.length > 0)) ? (
          <View
            style={[
              styles.completionBox,
              {
                backgroundColor: isDark ? '#081726' : '#f0fdf4',
                borderColor: isDark ? '#164e63' : '#bbf7d0',
              },
            ]}
          >
            <View style={styles.completionHeaderRow}>
              <UserCheck size={14} color="#10b981" />
              <Text style={styles.completedByText}>
                Tamamlayan: <Text style={{ fontWeight: '800' }}>{item.completedByName || 'Saha Personeli'}</Text>
              </Text>
              {item.completedAt ? (
                <Text style={styles.completedAtText}>
                  ({new Date(item.completedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })})
                </Text>
              ) : null}
            </View>

            {item.completionNote ? (
              <Text style={[styles.completionNoteText, { color: isDark ? '#e2e8f0' : '#1e293b' }]}>
                <Text style={{ fontWeight: '700', color: '#10b981' }}>Personel Açıklaması: </Text>
                {item.completionNote}
              </Text>
            ) : null}

            {item.completionPhotos && item.completionPhotos.length > 0 ? (
              <View style={{ marginTop: 6 }}>
                <Text style={styles.completionPhotosTitle}>
                  TAMAMLAMA FOTOĞRAFLARI ({item.completionPhotos.length})
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, marginTop: 4 }}
                >
                  {item.completionPhotos.map((cpUri, cpIdx) => (
                    <TouchableOpacity
                      key={cpIdx}
                      activeOpacity={0.85}
                      onPress={() => setLightboxImage(cpUri)}
                      style={styles.photoThumbWrapper}
                    >
                      <Image source={{ uri: cpUri }} style={styles.cardPhotoSmall} resizeMode="cover" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Card Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.metaRow}>
            <Calendar size={12} color="#94a3b8" />
            <Text style={styles.metaText}>
              {new Date(item.createdAt).toLocaleDateString('tr-TR', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            <Text style={styles.metaDivider}>•</Text>
            <User size={12} color="#94a3b8" />
            <Text style={styles.metaText}>{item.createdByName || 'Yönetici'}</Text>
            {item.approvedAt && isCompleted ? (
              <>
                <Text style={styles.metaDivider}>•</Text>
                <CheckCircle2 size={12} color="#10b981" />
                <Text style={[styles.metaText, { color: '#10b981', fontWeight: '700' }]}>
                  Onay: {new Date(item.approvedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </>
            ) : null}
          </View>

          <View style={styles.actionButtonsRow}>
            {/* Status Toggle Button */}
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                isCompleted ? styles.toggleBtnDone : styles.toggleBtnPending,
              ]}
              onPress={() => handleToggleStatus(item)}
              activeOpacity={0.8}
            >
              <Check size={12} color={isCompleted ? '#10b981' : '#f59e0b'} />
              <Text
                style={[
                  styles.toggleBtnText,
                  { color: isCompleted ? '#10b981' : '#f59e0b' },
                ]}
              >
                {isCompleted ? 'Tamamlandı' : 'Onayla'}
              </Text>
            </TouchableOpacity>

            {/* WhatsApp Share */}
            <TouchableOpacity
              style={styles.whatsappBtn}
              onPress={() => shareViaWhatsApp(item)}
              activeOpacity={0.8}
            >
              <Share2 size={13} color="#10b981" />
            </TouchableOpacity>

            {/* Delete */}
            <TouchableOpacity
              style={styles.deleteBtn}
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
      {/* 1. Header Bar (Matches Görsel-1 Style) */}
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
        data={filteredNotes}
        keyExtractor={(item) => item.id}
        renderItem={renderNoteCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2563eb"
            colors={['#2563eb']}
          />
        }
        ListHeaderComponent={
          /* Görsel-4: Arama & Buton & Filtre Hapları Kutusu */
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
                placeholder="İş emri veya personel adında ara..."
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

            {/* + Yeni İş Emri Ekle (Mavi Buton - Görsel-4) */}
            <TouchableOpacity
              style={styles.addWorkOrderBtn}
              onPress={() => setIsAddModalOpen(true)}
              activeOpacity={0.85}
            >
              <Plus size={18} color="#ffffff" />
              <Text style={styles.addWorkOrderBtnText}>Yeni İş Emri Ekle</Text>
            </TouchableOpacity>

            {/* Status Filter Pills Row (Görsel-4) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterPillsScroll}
            >
              {/* Tüm İş Emirleri (X) */}
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  activeTab === 'all'
                    ? styles.pillAllActive
                    : styles.pillInactive,
                ]}
                onPress={() => setActiveTab('all')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    activeTab === 'all' && styles.filterPillTextActive,
                  ]}
                >
                  Tüm İş Emirleri ({counts.total})
                </Text>
              </TouchableOpacity>

              {/* Bekleyenler (X) */}
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  activeTab === 'pending'
                    ? styles.pillPendingActive
                    : styles.pillInactivePending,
                ]}
                onPress={() => setActiveTab('pending')}
                activeOpacity={0.8}
              >
                <Clock
                  size={14}
                  color={activeTab === 'pending' ? '#ffffff' : '#f59e0b'}
                />
                <Text
                  style={[
                    styles.filterPillText,
                    { color: activeTab === 'pending' ? '#ffffff' : '#f59e0b' },
                  ]}
                >
                  Bekleyenler ({counts.pending})
                </Text>
              </TouchableOpacity>

              {/* Onaylananlar (X) */}
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  activeTab === 'approved'
                    ? styles.pillApprovedActive
                    : styles.pillInactiveApproved,
                ]}
                onPress={() => setActiveTab('approved')}
                activeOpacity={0.8}
              >
                <CheckCircle2
                  size={14}
                  color={activeTab === 'approved' ? '#ffffff' : '#10b981'}
                />
                <Text
                  style={[
                    styles.filterPillText,
                    { color: activeTab === 'approved' ? '#ffffff' : '#10b981' },
                  ]}
                >
                  Onaylananlar ({counts.approved})
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          /* Empty State */
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: isDark ? '#0c152e' : '#ffffff',
                borderColor: isDark ? '#1e293b' : '#e2e8f0',
              },
            ]}
          >
            <View style={styles.emptyIconCircle}>
              <ClipboardList size={30} color="#3b82f6" />
            </View>

            <Text
              style={[
                styles.emptyTitle,
                { color: isDark ? '#ffffff' : '#0f172a' },
              ]}
            >
              Henüz İş Emri Yok
            </Text>

            <Text style={styles.emptyDesc}>
              Saha personellerine görev iletmek, talimat ve iş emri oluşturmak için
              "Yeni İş Emri Ekle" butonunu kullanabilirsiniz.
            </Text>

            <TouchableOpacity
              style={styles.firstAddBtn}
              onPress={() => setIsAddModalOpen(true)}
              activeOpacity={0.85}
            >
              <Plus size={17} color="#ffffff" />
              <Text style={styles.firstAddBtnText}>İlk İş Emrini Ekle</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Görsel-5: Yeni İş Emri & Hatırlatıcı Modalı */}
      <AddWorkOrderModal
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

      {/* Lightbox Image Preview Modal */}
      <Modal
        visible={!!lightboxImage}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxImage(null)}
      >
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity
            style={styles.lightboxCloseBtn}
            onPress={() => setLightboxImage(null)}
            activeOpacity={0.8}
          >
            <X size={24} color="#ffffff" />
          </TouchableOpacity>
          {lightboxImage && (
            <Image
              source={{ uri: lightboxImage }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
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
    gap: 6,
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 11,
  },
  homeBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
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
  addWorkOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 13,
  },
  addWorkOrderBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  filterPillsScroll: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  pillAllActive: {
    backgroundColor: '#2563eb',
  },
  pillInactive: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  pillPendingActive: {
    backgroundColor: '#d97706',
  },
  pillInactivePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  pillApprovedActive: {
    backgroundColor: '#059669',
  },
  pillInactiveApproved: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#93c5fd',
  },
  filterPillTextActive: {
    color: '#ffffff',
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
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
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
    backgroundColor: '#2563eb',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  firstAddBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  noteCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  targetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  targetBadgeText: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: '800',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  statusBadgeDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusTextPending: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '800',
  },
  statusTextDone: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '800',
  },
  cariBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  cariBadgePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cariBadgePillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cariBannerTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  cariRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cariNameText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '800',
  },
  contentBox: {
    borderRadius: 12,
    padding: 12,
  },
  contentText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  photosSection: {
    gap: 6,
    paddingTop: 2,
  },
  photosSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photosSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.4,
  },
  photoThumbWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardPhoto: {
    width: 76,
    height: 76,
    borderRadius: 10,
    backgroundColor: '#1e293b',
  },
  cardPhotoSmall: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  completionBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  completionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  completedByText: {
    fontSize: 12,
    color: '#10b981',
  },
  completedAtText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  completionNoteText: {
    fontSize: 12,
    lineHeight: 18,
  },
  completionPhotosTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: 0.4,
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  lightboxCloseBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 36,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImage: {
    width: '100%',
    height: '80%',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  metaDivider: {
    color: '#64748b',
    fontSize: 10,
    marginHorizontal: 2,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  toggleBtnPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  toggleBtnDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  whatsappBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    padding: 7,
    borderRadius: 8,
  },
  deleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    padding: 7,
    borderRadius: 8,
  },
});
