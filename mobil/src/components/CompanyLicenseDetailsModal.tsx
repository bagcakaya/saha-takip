import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
} from 'react-native';
import {
  ShieldCheck,
  Calendar,
  Building2,
  Clock,
  Phone,
  MessageCircle,
  X,
  Database,
  CheckCircle2,
  AlertTriangle,
  Users,
  Store,
  Sparkles,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { isCompanyExempt } from '../types/auth';

interface CompanyLicenseDetailsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const CompanyLicenseDetailsModal: React.FC<CompanyLicenseDetailsModalProps> = ({
  visible,
  onClose,
}) => {
  const { user, company, licenseInfo } = useAuth();
  const { isDark } = useAppTheme();

  if (!visible) return null;

  const isExempt = isCompanyExempt(company?.code || user?.companyCode);
  const remainingDays = licenseInfo.remainingDays;
  const isExpiringSoon = licenseInfo.status === 'expiring_soon';
  const isExpired = licenseInfo.status === 'expired';
  const isSuspended = licenseInfo.status === 'suspended';

  const formatLicenseType = (type?: string) => {
    switch (type) {
      case 'monthly':
        return 'Aylık Abonelik';
      case 'quarterly':
        return '3 Aylık (Çeyrek)';
      case 'semi_annual':
        return '6 Aylık Paket';
      case 'annual':
        return 'Yıllık Kurumsal Lisans';
      case 'lifetime':
        return 'Sınırsız / Ömür Boyu';
      case 'custom':
        return 'Özel Anlaşmalı';
      default:
        return 'Yıllık Standart';
    }
  };

  const compName = company?.name || user?.companyName || user?.companyCode || 'Kurum';
  const compCode = (company?.code || user?.companyCode || 'KURUM').toUpperCase();

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `Merhaba Murat Bey, ${compName} (${compCode}) firmamızın İş Takip Sistemi lisans süresi hakkında bilgi almak / yenilemek istiyoruz.`
    );
    Linking.openURL(`https://wa.me/905336082353?text=${text}`);
  };

  const handleCall = () => {
    Linking.openURL('tel:05336082353');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.iconBox,
                  {
                    backgroundColor:
                      isExpired || isSuspended
                        ? 'rgba(239, 68, 68, 0.15)'
                        : isExpiringSoon
                        ? 'rgba(245, 158, 11, 0.15)'
                        : 'rgba(16, 185, 129, 0.15)',
                  },
                ]}
              >
                {isExpired || isSuspended ? (
                  <AlertTriangle size={20} color="#ef4444" />
                ) : isExpiringSoon ? (
                  <Clock size={20} color="#f59e0b" />
                ) : (
                  <ShieldCheck size={20} color="#10b981" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                  Kurumsal Lisansım
                </Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {compName} ({compCode})
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color={isDark ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {/* 1. Kalan Süre Büyük Vurgu Kutusu */}
            <View
              style={[
                styles.highlightBox,
                {
                  backgroundColor:
                    isExpired || isSuspended
                      ? isDark
                        ? 'rgba(239, 68, 68, 0.12)'
                        : '#fef2f2'
                      : isExpiringSoon
                      ? isDark
                        ? 'rgba(245, 158, 11, 0.12)'
                        : '#fffbeb'
                      : isDark
                      ? 'rgba(16, 185, 129, 0.12)'
                      : '#ecfdf5',
                  borderColor:
                    isExpired || isSuspended
                      ? 'rgba(239, 68, 68, 0.3)'
                      : isExpiringSoon
                      ? 'rgba(245, 158, 11, 0.3)'
                      : 'rgba(16, 185, 129, 0.3)',
                },
              ]}
            >
              <Text style={styles.highlightSub}>Kalan Lisans Süresi</Text>
              <Text
                style={[
                  styles.highlightTitle,
                  {
                    color:
                      isExpired || isSuspended
                        ? '#ef4444'
                        : isExpiringSoon
                        ? '#f59e0b'
                        : '#10b981',
                  },
                ]}
              >
                {isExempt || licenseInfo.isLifetime
                  ? 'Sınırsız / Ömür Boyu'
                  : isExpired
                  ? 'Süresi Doldu'
                  : isSuspended
                  ? 'Donduruldu'
                  : `${remainingDays} Gün Kaldı`}
              </Text>
              <View style={styles.dateRow}>
                <Calendar size={13} color={isDark ? '#94a3b8' : '#64748b'} />
                <Text style={[styles.dateText, { color: isDark ? '#cbd5e1' : '#475569' }]}>
                  {isExempt || licenseInfo.isLifetime
                    ? 'Süresiz Kurumsal Erişim'
                    : licenseInfo.expiresDateFormatted
                    ? `Bitiş Tarihi: ${licenseInfo.expiresDateFormatted}`
                    : 'Son gün belirlenmedi'}
                </Text>
              </View>
            </View>

            {/* 2. Grid Detaylar */}
            <View style={styles.grid}>
              <View
                style={[
                  styles.gridItem,
                  { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' },
                ]}
              >
                <View style={styles.gridLabelRow}>
                  <Building2 size={12} color="#3b82f6" />
                  <Text style={styles.gridLabel}>Kurum</Text>
                </View>
                <Text style={[styles.gridValue, { color: isDark ? '#ffffff' : '#0f172a' }]} numberOfLines={1}>
                  {compName}
                </Text>
              </View>

              <View
                style={[
                  styles.gridItem,
                  { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' },
                ]}
              >
                <View style={styles.gridLabelRow}>
                  <Sparkles size={12} color="#8b5cf6" />
                  <Text style={styles.gridLabel}>Paket Türü</Text>
                </View>
                <Text style={[styles.gridValue, { color: isDark ? '#ffffff' : '#0f172a' }]} numberOfLines={1}>
                  {formatLicenseType(company?.licenseType)}
                </Text>
              </View>

              <View
                style={[
                  styles.gridItem,
                  { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' },
                ]}
              >
                <View style={styles.gridLabelRow}>
                  <Store size={12} color="#10b981" />
                  <Text style={styles.gridLabel}>Şube Limiti</Text>
                </View>
                <Text style={[styles.gridValue, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                  {company?.maxBranches ? `${company.maxBranches} Şube` : 'Sınırsız'}
                </Text>
              </View>

              <View
                style={[
                  styles.gridItem,
                  { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' },
                ]}
              >
                <View style={styles.gridLabelRow}>
                  <Users size={12} color="#f59e0b" />
                  <Text style={styles.gridLabel}>Personel Limiti</Text>
                </View>
                <Text style={[styles.gridValue, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                  {company?.maxUsers ? `${company.maxUsers} Personel` : 'Sınırsız'}
                </Text>
              </View>
            </View>

            {/* 3. Veri Güvenliği Garantisi */}
            <View
              style={[
                styles.securityBox,
                {
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.1)',
                  borderColor: 'rgba(16, 185, 129, 0.25)',
                },
              ]}
            >
              <View style={styles.securityHeader}>
                <Database size={15} color="#10b981" />
                <Text style={styles.securityTitle}>Verileriniz Güvenle Saklanır</Text>
                <CheckCircle2 size={13} color="#10b981" />
              </View>
              <Text style={styles.securityText}>
                Lisans süreniz dolsa dahi tüm iş emirleriniz, servis kayıtlarınız ve personel verileriniz sistemde güvenle saklanır.
              </Text>
            </View>

            {/* 4. Lisans Uzatma / İletişim */}
            <View
              style={[
                styles.contactBox,
                { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' },
              ]}
            >
              <Text style={[styles.contactLabel, { color: isDark ? '#cbd5e1' : '#334155' }]}>
                Lisans sürenizi uzatmak veya paket değişikliği için:
              </Text>

              <TouchableOpacity style={styles.whatsappBtn} onPress={handleWhatsApp} activeOpacity={0.8}>
                <MessageCircle size={16} color="#ffffff" />
                <Text style={styles.whatsappBtnText}>WhatsApp ile Uzat</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.phoneBtn, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}
                onPress={handleCall}
                activeOpacity={0.8}
              >
                <Phone size={14} color={isDark ? '#f8fafc' : '#1e293b'} />
                <Text style={[styles.phoneBtnText, { color: isDark ? '#f8fafc' : '#1e293b' }]}>
                  0533 608 23 53 (Murat POLAT)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Kapat Butonu */}
            <TouchableOpacity style={styles.closeModalBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.closeModalBtnText}>Kapat</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 10,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  highlightBox: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
  },
  highlightSub: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#94a3b8',
    marginBottom: 4,
  },
  highlightTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridItem: {
    flex: 1,
    minWidth: '47%',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  gridLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  gridLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  gridValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  securityBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  securityTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#10b981',
  },
  securityText: {
    fontSize: 11,
    color: '#10b981',
    lineHeight: 16,
    opacity: 0.9,
  },
  contactBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  contactLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    paddingVertical: 10,
    borderRadius: 12,
  },
  whatsappBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  phoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
  },
  phoneBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  closeModalBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeModalBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
});
