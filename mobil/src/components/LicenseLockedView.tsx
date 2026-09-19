import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ShieldAlert, LogOut, RefreshCw, Database, CheckCircle2, Mail } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';

export const LicenseLockedView: React.FC = () => {
  const { user, company, licenseInfo, logout, refreshCompany } = useAuth();
  const { isDark, colors } = useAppTheme();
  const [isChecking, setIsChecking] = useState(false);

  const handleRecheck = async () => {
    setIsChecking(true);
    try {
      await refreshCompany();
      Alert.alert('Bilgi', 'Lisans durumu kontrol edildi.');
    } catch (e) {
      console.warn('Lisans kontrol hatası:', e);
    } finally {
      setIsChecking(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Çıkış Yap', 'Hesabınızdan çıkış yapmak istediğinize emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const isSuspended = licenseInfo.status === 'suspended';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#020617' : '#f8fafc' }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              borderColor: 'rgba(239, 68, 68, 0.35)',
            },
          ]}
        >
          {/* Status Badge & Icon */}
          <View style={styles.iconCircle}>
            <ShieldAlert size={42} color="#ef4444" />
          </View>

          {/* Institution Pills */}
          <View style={styles.pillRow}>
            <View style={[styles.companyPill, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
              <Text style={[styles.companyPillText, { color: isDark ? '#cbd5e1' : '#334155' }]}>
                {company?.name || user?.companyCode || 'Kurum'}
              </Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>
                {isSuspended ? '❄️ Donduruldu' : '🔴 Lisans Süresi Doldu'}
              </Text>
            </View>
          </View>

          {/* Main Title */}
          <Text style={[styles.title, { color: isDark ? '#ffffff' : '#0f172a' }]}>
            {isSuspended ? 'Hizmet Geçici Olarak Donduruldu' : 'Lisans Kullanım Süresi Sona Erdi'}
          </Text>

          {/* Body Text */}
          <Text style={[styles.bodyText, { color: isDark ? '#94a3b8' : '#475569' }]}>
            {company?.name || 'Kurumunuzun'} Saha Takip sistemi lisans süresi dolmuş veya hizmeti geçici olarak dondurulmuştur.
          </Text>

          {/* Guarantee Data Box */}
          <View style={[styles.guaranteeBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5' }]}>
            <View style={styles.guaranteeIconCircle}>
              <Database size={20} color="#10b981" />
            </View>
            <View style={styles.guaranteeTextCol}>
              <View style={styles.guaranteeTitleRow}>
                <Text style={[styles.guaranteeTitle, { color: isDark ? '#6ee7b7' : '#065f46' }]}>
                  Verileriniz Güvenle Saklanmaktadır
                </Text>
                <CheckCircle2 size={14} color="#10b981" />
              </View>
              <Text style={[styles.guaranteeDesc, { color: isDark ? '#a7f3d0' : '#047857' }]}>
                Tüm montajlarınız, servisleriniz ve personelleriniz korunmaktadır. Lisans uzatıldığında kaldığınız yerden devam edebilirsiniz.
              </Text>
            </View>
          </View>

          {/* Expiry Details */}
          {(licenseInfo.expiresDateFormatted || company?.freezeReason) && (
            <View style={[styles.detailsBox, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}>
              {licenseInfo.expiresDateFormatted && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Son Geçerlilik:</Text>
                  <Text style={[styles.detailValue, { color: isDark ? '#f8fafc' : '#0f172a' }]}>{licenseInfo.expiresDateFormatted}</Text>
                </View>
              )}
              {company?.freezeReason && (
                <View style={[styles.detailRow, { marginTop: 4 }]}>
                  <Text style={[styles.detailLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Açıklama:</Text>
                  <Text style={[styles.detailValue, { color: '#ef4444' }]}>{company.freezeReason}</Text>
                </View>
              )}
            </View>
          )}

          {/* Action Buttons */}
          <TouchableOpacity
            style={[styles.recheckBtn, isChecking && { opacity: 0.6 }]}
            onPress={handleRecheck}
            disabled={isChecking}
            activeOpacity={0.8}
          >
            {isChecking ? (
              <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
            ) : (
              <RefreshCw size={18} color="#ffffff" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.recheckBtnText}>
              {isChecking ? 'Kontrol Ediliyor...' : 'Lisansı Yeniden Kontrol Et'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.logoutBtn, { borderColor: isDark ? '#334155' : '#cbd5e1' }]}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <LogOut size={18} color="#ef4444" style={{ marginRight: 8 }} />
            <Text style={[styles.logoutBtnText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>Oturumu Kapat</Text>
          </TouchableOpacity>

          {/* Footer Contact */}
          <View style={styles.footerRow}>
            <Mail size={14} color="#64748b" style={{ marginRight: 6 }} />
            <Text style={styles.footerText}>Polatlar Bilişim: admin@polatlar.com</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 28,
    borderWidth: 1.5,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  companyPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  companyPillText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
  },
  bodyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  guaranteeBox: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  guaranteeIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  guaranteeTextCol: {
    flex: 1,
  },
  guaranteeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  guaranteeTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  guaranteeDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  detailsBox: {
    width: '100%',
    padding: 12,
    borderRadius: 14,
    marginBottom: 18,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  recheckBtn: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  recheckBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  logoutBtn: {
    width: '100%',
    flexDirection: 'row',
    borderWidth: 1.2,
    paddingVertical: 13,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
});
