import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import {
  X,
  Search,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Snowflake,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Infinity as InfinityIcon,
  FileEdit,
} from 'lucide-react-native';
import { Company, canUserManageLicenses, getCompanyLicenseInfo } from '../types/auth';
import { CompanyService } from '../services/companyService';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';

interface LicenseManagementModalProps {
  visible: boolean;
  onClose: () => void;
}

export const LicenseManagementModal: React.FC<LicenseManagementModalProps> = ({ visible, onClose }) => {
  const { user, refreshCompany } = useAuth();
  const { isDark, colors } = useAppTheme();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'expiring' | 'expired' | 'frozen'>('all');
  const [actionLoadingCode, setActionLoadingCode] = useState<string | null>(null);

  const isSuperAdmin = canUserManageLicenses(user);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const list = await CompanyService.fetchCompanies();
      setCompanies(list);
    } catch (e) {
      console.error('Kurumlar yüklenemedi:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadCompanies();
    }
  }, [visible]);

  const metrics = useMemo(() => {
    let active = 0;
    let expiring = 0;
    let expired = 0;
    let frozen = 0;

    companies.forEach((comp) => {
      const info = getCompanyLicenseInfo(comp);
      if (info.status === 'suspended') {
        frozen++;
      } else if (info.status === 'expired') {
        expired++;
      } else if (info.status === 'expiring_soon') {
        expiring++;
        active++;
      } else {
        active++;
      }
    });

    return { total: companies.length, active, expiring, expired, frozen };
  }, [companies]);

  const filteredCompanies = useMemo(() => {
    return companies.filter((comp) => {
      const info = getCompanyLicenseInfo(comp);
      const matchesSearch =
        comp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        comp.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        comp.adminName.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterTab === 'all') return true;
      if (filterTab === 'active') return info.active && info.status !== 'expiring_soon';
      if (filterTab === 'expiring') return info.status === 'expiring_soon';
      if (filterTab === 'expired') return info.status === 'expired';
      if (filterTab === 'frozen') return info.status === 'suspended';

      return true;
    });
  }, [companies, searchQuery, filterTab]);

  const handleQuickExtend = async (companyCode: string, daysOrMonths: { months?: number; days?: number }) => {
    setActionLoadingCode(companyCode);
    try {
      const res = await CompanyService.extendLicense(companyCode, daysOrMonths);
      if (res.success) {
        await loadCompanies();
        await refreshCompany();
        Alert.alert('Başarılı', `${companyCode} kurumunun lisansı uzatıldı.`);
      } else {
        Alert.alert('Hata', res.error || 'İşlem başarısız.');
      }
    } catch (e: any) {
      Alert.alert('Hata', e?.message || 'Bağlantı hatası.');
    } finally {
      setActionLoadingCode(null);
    }
  };

  const handleMakeLifetime = (companyCode: string) => {
    Alert.alert(
      'Sınırsız Lisans',
      `"${companyCode}" kurumuna Ömür Boyu (Sınırsız) lisans vermek istediğinize emin misiniz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sınırsız Yap',
          onPress: async () => {
            setActionLoadingCode(companyCode);
            try {
              const res = await CompanyService.updateCompanyLicense(companyCode, {
                licenseType: 'lifetime',
                licenseExpiresAt: 0,
                isFrozen: false,
              });
              if (res.success) {
                await loadCompanies();
                await refreshCompany();
                Alert.alert('Başarılı', `${companyCode} kurumu sınırsız lisansa geçirildi.`);
              } else {
                Alert.alert('Hata', res.error || 'İşlem başarısız.');
              }
            } catch (e: any) {
              Alert.alert('Hata', e?.message || 'Hata oluştu.');
            } finally {
              setActionLoadingCode(null);
            }
          },
        },
      ]
    );
  };

  const handleToggleFreeze = (company: Company) => {
    const isCurrentlyFrozen = company.isFrozen === true;
    const actionText = isCurrentlyFrozen ? 'dondurmasını kaldırmak' : 'hesabını dondurmak';

    Alert.alert(
      isCurrentlyFrozen ? 'Hesabı Aç' : 'Hesabı Dondur',
      `"${company.name}" kurumunun ${actionText} istediğinize emin misiniz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: isCurrentlyFrozen ? 'Dondurmayı Kaldır' : 'Dondur',
          style: isCurrentlyFrozen ? 'default' : 'destructive',
          onPress: async () => {
            setActionLoadingCode(company.code);
            try {
              const res = await CompanyService.toggleFreezeCompany(
                company.code,
                !isCurrentlyFrozen,
                isCurrentlyFrozen ? undefined : 'Yıllık lisans ödemesi gecikmesi sebebiyle hesap dondurulmuştur.'
              );
              if (res.success) {
                await loadCompanies();
                await refreshCompany();
                Alert.alert('Bilgi', `${company.name} hesap durumu güncellendi.`);
              } else {
                Alert.alert('Hata', res.error || 'İşlem başarısız.');
              }
            } catch (e: any) {
              Alert.alert('Hata', e?.message || 'Hata oluştu.');
            } finally {
              setActionLoadingCode(null);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: isDark ? '#020617' : '#f8fafc' }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              borderBottomColor: isDark ? '#1e293b' : '#e2e8f0',
            },
          ]}
        >
          <View style={styles.headerLeft}>
            <View style={styles.headerIconCircle}>
              <Building2 size={20} color="#ffffff" />
            </View>
            <View>
              <View style={styles.titleRow}>
                <Text style={[styles.headerTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                  Lisanslama
                </Text>
                <View style={styles.saasBadge}>
                  <Text style={styles.saasBadgeText}>SaaS Masası</Text>
                </View>
              </View>
              <Text style={[styles.headerSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                Kurum lisans süreleri ve hesap dondurma
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity onPress={loadCompanies} disabled={loading} style={styles.refreshBtn}>
              <RefreshCw size={18} color={isDark ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={isDark ? '#cbd5e1' : '#475569'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Metrics Grid */}
        <View
          style={[
            styles.metricsRow,
            {
              backgroundColor: isDark ? '#0b1329' : '#f1f5f9',
              borderBottomColor: isDark ? '#1e293b' : '#e2e8f0',
            },
          ]}
        >
          <View style={[styles.metricCard, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
            <Text style={styles.metricLabel}>TOPLAM</Text>
            <Text style={[styles.metricValue, { color: isDark ? '#ffffff' : '#0f172a' }]}>
              {metrics.total}
            </Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
            <Text style={[styles.metricLabel, { color: '#10b981' }]}>AKTİF</Text>
            <Text style={[styles.metricValue, { color: '#10b981' }]}>{metrics.active}</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
            <Text style={[styles.metricLabel, { color: '#f59e0b' }]}>&lt; 7 GÜN</Text>
            <Text style={[styles.metricValue, { color: '#f59e0b' }]}>{metrics.expiring}</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
            <Text style={[styles.metricLabel, { color: '#ef4444' }]}>DOLAN</Text>
            <Text style={[styles.metricValue, { color: '#ef4444' }]}>{metrics.expired}</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
            <Text style={[styles.metricLabel, { color: '#06b6d4' }]}>DONDURULAN</Text>
            <Text style={[styles.metricValue, { color: '#06b6d4' }]}>{metrics.frozen}</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View
          style={[
            styles.searchSection,
            {
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              borderBottomColor: isDark ? '#1e293b' : '#e2e8f0',
            },
          ]}
        >
          <View
            style={[
              styles.searchInputWrap,
              {
                backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                borderColor: isDark ? '#334155' : '#e2e8f0',
              },
            ]}
          >
            <Search size={16} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: isDark ? '#ffffff' : '#0f172a' }]}
              placeholder="Kurum adı veya kodu ile ara..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsScroll}>
            {[
              { id: 'all', label: 'Tümü' },
              { id: 'active', label: '🟢 Aktif' },
              { id: 'expiring', label: '🟡 Bitiyor' },
              { id: 'expired', label: '🔴 Dolanlar' },
              { id: 'frozen', label: '❄️ Dondurulan' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setFilterTab(tab.id as any)}
                style={[
                  styles.filterTab,
                  filterTab === tab.id
                    ? styles.filterTabActive
                    : { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' },
                ]}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filterTab === tab.id
                      ? styles.filterTabTextActive
                      : { color: isDark ? '#94a3b8' : '#475569' },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Company List */}
        <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
          ) : filteredCompanies.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Building2 size={40} color="#94a3b8" />
              <Text style={styles.emptyText}>Kurum bulunamadı.</Text>
            </View>
          ) : (
            filteredCompanies.map((comp) => {
              const info = getCompanyLicenseInfo(comp);
              const isPolatlar = comp.code === 'POLATLAR';
              const isLoadingThis = actionLoadingCode === comp.code;

              return (
                <View
                  key={comp.code}
                  style={[
                    styles.companyCard,
                    {
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      borderColor:
                        info.status === 'suspended'
                          ? 'rgba(6, 182, 212, 0.4)'
                          : info.status === 'expired'
                          ? 'rgba(239, 68, 68, 0.4)'
                          : info.status === 'expiring_soon'
                          ? 'rgba(245, 158, 11, 0.4)'
                          : isDark
                          ? '#1e293b'
                          : '#e2e8f0',
                    },
                  ]}
                >
                  {/* Top Line */}
                  <View style={styles.cardHeader}>
                    <View style={styles.companyTitleWrap}>
                      <Text style={[styles.companyName, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                        {comp.name}
                      </Text>
                      <View style={styles.codeBadge}>
                        <Text style={styles.codeBadgeText}>{comp.code}</Text>
                      </View>
                    </View>

                    {/* Status Pill */}
                    {isPolatlar ? (
                      <View style={[styles.statusBadge, { backgroundColor: 'rgba(37, 99, 235, 0.15)' }]}>
                        <InfinityIcon size={12} color="#2563eb" style={{ marginRight: 4 }} />
                        <Text style={[styles.statusBadgeText, { color: '#2563eb' }]}>Ana Sistem</Text>
                      </View>
                    ) : info.status === 'suspended' ? (
                      <View style={[styles.statusBadge, { backgroundColor: 'rgba(6, 182, 212, 0.15)' }]}>
                        <Snowflake size={12} color="#06b6d4" style={{ marginRight: 4 }} />
                        <Text style={[styles.statusBadgeText, { color: '#06b6d4' }]}>Donduruldu</Text>
                      </View>
                    ) : info.status === 'expired' ? (
                      <View style={[styles.statusBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                        <AlertTriangle size={12} color="#ef4444" style={{ marginRight: 4 }} />
                        <Text style={[styles.statusBadgeText, { color: '#ef4444' }]}>Süresi Doldu</Text>
                      </View>
                    ) : info.status === 'expiring_soon' ? (
                      <View style={[styles.statusBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                        <Clock size={12} color="#f59e0b" style={{ marginRight: 4 }} />
                        <Text style={[styles.statusBadgeText, { color: '#f59e0b' }]}>{info.remainingDays} Gün Kaldı</Text>
                      </View>
                    ) : (
                      <View style={[styles.statusBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                        <CheckCircle2 size={12} color="#10b981" style={{ marginRight: 4 }} />
                        <Text style={[styles.statusBadgeText, { color: '#10b981' }]}>
                          {info.isLifetime ? 'Sınırsız' : `${info.remainingDays} Gün Kaldı`}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Details Subtitle */}
                  <View style={styles.cardDetails}>
                    <Text style={[styles.adminInfoText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                      Yönetici: <Text style={{ fontWeight: '700', color: isDark ? '#e2e8f0' : '#1e293b' }}>{comp.adminName}</Text> • {comp.adminEmail}
                    </Text>

                    {!isPolatlar && (
                      <Text style={[styles.expiryText, { color: isDark ? '#cbd5e1' : '#334155' }]}>
                        Lisans Bitişi:{' '}
                        <Text style={{ fontWeight: '800' }}>
                          {info.isLifetime ? 'Sınırsız / Ömür Boyu' : info.expiresDateFormatted || 'Belirtilmedi'}
                        </Text>
                      </Text>
                    )}

                    {comp.freezeReason && info.status === 'suspended' && (
                      <Text style={styles.reasonText}>Neden: {comp.freezeReason}</Text>
                    )}
                  </View>

                  {/* Actions (for Customer Companies) */}
                  {!isPolatlar && (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.actionBtnGreen}
                        onPress={() => handleQuickExtend(comp.code, { months: 1 })}
                        disabled={isLoadingThis}
                      >
                        <Plus size={12} color="#047857" style={{ marginRight: 2 }} />
                        <Text style={styles.actionBtnGreenText}>+1 Ay</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionBtnBlue}
                        onPress={() => handleQuickExtend(comp.code, { months: 12 })}
                        disabled={isLoadingThis}
                      >
                        <Sparkles size={12} color="#1d4ed8" style={{ marginRight: 2 }} />
                        <Text style={styles.actionBtnBlueText}>+1 Yıl</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionBtnPurple}
                        onPress={() => handleMakeLifetime(comp.code)}
                        disabled={isLoadingThis}
                      >
                        <InfinityIcon size={12} color="#6d28d9" style={{ marginRight: 2 }} />
                        <Text style={styles.actionBtnPurpleText}>Sınırsız</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.freezeBtn,
                          comp.isFrozen ? styles.freezeBtnActive : styles.freezeBtnNormal,
                        ]}
                        onPress={() => handleToggleFreeze(comp)}
                        disabled={isLoadingThis}
                      >
                        {comp.isFrozen ? (
                          <>
                            <Play size={12} color="#ffffff" style={{ marginRight: 4 }} />
                            <Text style={styles.freezeBtnActiveText}>Aç</Text>
                          </>
                        ) : (
                          <>
                            <Snowflake size={12} color="#be123c" style={{ marginRight: 4 }} />
                            <Text style={styles.freezeBtnNormalText}>Dondur</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  saasBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  saasBadgeText: {
    color: '#2563eb',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshBtn: {
    padding: 6,
  },
  closeBtn: {
    padding: 6,
  },
  metricsRow: {
    flexDirection: 'row',
    padding: 10,
    gap: 6,
    borderBottomWidth: 1,
  },
  metricCard: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },
  searchSection: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  filterPillsScroll: {
    gap: 6,
    paddingBottom: 2,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  filterTabActive: {
    backgroundColor: '#2563eb',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterTabTextActive: {
    color: '#ffffff',
  },
  listContainer: {
    padding: 14,
    gap: 10,
    paddingBottom: 40,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  companyCard: {
    borderRadius: 18,
    borderWidth: 1.2,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  companyTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  companyName: {
    fontSize: 15,
    fontWeight: '800',
  },
  codeBadge: {
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  codeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cardDetails: {
    gap: 3,
    marginBottom: 10,
  },
  adminInfoText: {
    fontSize: 11,
  },
  expiryText: {
    fontSize: 11,
    marginTop: 2,
  },
  reasonText: {
    fontSize: 10,
    color: '#ef4444',
    fontWeight: '600',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.15)',
  },
  actionBtnGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  actionBtnGreenText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  actionBtnBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  actionBtnBlueText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  actionBtnPurple: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f3ff',
    borderColor: '#ddd6fe',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  actionBtnPurpleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6d28d9',
  },
  freezeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  freezeBtnNormal: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  freezeBtnNormalText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#be123c',
  },
  freezeBtnActive: {
    backgroundColor: '#0891b2',
  },
  freezeBtnActiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
});
