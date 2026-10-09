import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { AlertTriangle, MessageCircle, Phone, ShieldCheck, X } from 'lucide-react-native';
import { LicenseInfo, Company, isCompanyExempt } from '../types/auth';

interface EmergencyLicenseAlertBannerProps {
  licenseInfo: LicenseInfo;
  company?: Company | null;
  onOpenDetails?: () => void;
}

export const EmergencyLicenseAlertBanner: React.FC<EmergencyLicenseAlertBannerProps> = ({
  licenseInfo,
  company,
  onOpenDetails,
}) => {
  const [dismissed, setDismissed] = useState(false);

  if (
    dismissed ||
    !company ||
    isCompanyExempt(company.code) ||
    !licenseInfo.active ||
    licenseInfo.isLifetime ||
    licenseInfo.remainingDays > 3 ||
    licenseInfo.remainingDays <= 0
  ) {
    return null;
  }

  const daysText = licenseInfo.remainingDays === 1 ? '1 gün' : `${licenseInfo.remainingDays} gün`;
  const compName = company.name || company.code;

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `Merhaba Murat Bey, ${compName} (${company.code}) firmamızın Lisans süresinin bitmesine ${daysText} kalmıştır. Hizmete kesintisiz devam edebilmek için lisansımızı yenilemek istiyoruz.`
    );
    Linking.openURL(`https://wa.me/905336082353?text=${text}`).catch(() => {});
  };

  const handleCall = () => {
    Linking.openURL('tel:05336082353').catch(() => {});
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.badgeRow}>
          <View style={styles.alertIconBox}>
            <AlertTriangle size={18} color="#fef08a" />
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>⚠️ DİKKAT: LİSANS SÜRENİZ DOLUYOR!</Text>
          </View>
          <Text style={styles.daysHighlight}>(Son {daysText}!)</Text>
        </View>

        <TouchableOpacity onPress={() => setDismissed(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <X size={18} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      <Text style={styles.messageText}>
        Firmanıza ait Lisans süresinin bitmesine <Text style={styles.boldUnderline}>{daysText}</Text> kalmıştır. Hizmete kesintisiz devam edebilmek için lütfen Sistem Sağlayıcınızla irtibata geçiniz.
      </Text>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.whatsappBtn} onPress={handleWhatsApp} activeOpacity={0.85}>
          <MessageCircle size={15} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.whatsappBtnText}>WhatsApp ile İletişim</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.callBtn} onPress={handleCall} activeOpacity={0.85}>
          <Phone size={14} color="#ffffff" style={{ marginRight: 5 }} />
          <Text style={styles.callBtnText}>0533 608 23 53</Text>
        </TouchableOpacity>

        {onOpenDetails && (
          <TouchableOpacity style={styles.detailsBtn} onPress={onOpenDetails} activeOpacity={0.85}>
            <ShieldCheck size={14} color="#fef08a" style={{ marginRight: 4 }} />
            <Text style={styles.detailsBtnText}>Detay</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 14,
    borderRadius: 20,
    backgroundColor: '#dc2626',
    borderWidth: 2,
    borderColor: '#ef4444',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  alertIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(254, 240, 138, 0.4)',
  },
  badgeText: {
    color: '#fef08a',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  daysHighlight: {
    color: '#fef9c3',
    fontSize: 11,
    fontWeight: '800',
  },
  messageText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 10,
  },
  boldUnderline: {
    fontWeight: '900',
    color: '#fef08a',
    textDecorationLine: 'underline',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  whatsappBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  callBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(254, 240, 138, 0.3)',
  },
  detailsBtnText: {
    color: '#fef08a',
    fontSize: 11,
    fontWeight: '800',
  },
});
