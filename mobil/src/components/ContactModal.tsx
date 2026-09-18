import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Linking,
  Alert,
} from 'react-native';
import {
  User,
  Phone,
  Mail,
  X,
  MessageCircle,
  Building2,
  ExternalLink,
} from 'lucide-react-native';

interface ContactModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({ visible, onClose }) => {
  const isDark = useColorScheme() === 'dark';

  const handleCall = () => {
    Linking.openURL('tel:05336082353').catch(() => {
      Alert.alert('Hata', 'Arama başlatılamadı.');
    });
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent('Merhaba, İş Takip Sistemi hakkında bilgi almak istiyorum.');
    const url = `whatsapp://send?phone=905336082353&text=${text}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(`https://wa.me/905336082353?text=${text}`).catch(() => {
          Alert.alert('Hata', 'WhatsApp açılamadı.');
        });
      }
    });
  };

  const handleEmail = () => {
    Linking.openURL('mailto:polatdg@hotmail.com?subject=İş Takip Sistemi Destek').catch(() => {
      Alert.alert('Hata', 'E-posta uygulaması bulunamadı.');
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            { backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0' },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                İletişim & Destek
              </Text>
              <Text style={styles.subtitle}>Polatlar Yazılım İletişim Bilgileri</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Contact Cards */}
          <View style={styles.cardsList}>
            {/* 1. Name */}
            <View
              style={[
                styles.itemCard,
                { backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' },
              ]}
            >
              <View style={styles.iconCircle}>
                <User size={18} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemLabel}>AD SOYAD</Text>
                <Text style={[styles.itemValue, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                  MURAT POLAT
                </Text>
              </View>
            </View>

            {/* 2. Phone / WhatsApp */}
            <View
              style={[
                styles.itemCard,
                { backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' },
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#2563eb' }]}>
                <Phone size={18} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemLabel}>TELEFON & WHATSAPP</Text>
                <Text style={[styles.itemValue, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                  0533 608 23 53
                </Text>
              </View>
            </View>

            <View style={styles.actionBtnRow}>
              <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
                <Phone size={15} color="#ffffff" />
                <Text style={styles.actionBtnText}>Hemen Ara</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.whatsappBtn} onPress={handleWhatsApp}>
                <MessageCircle size={15} color="#ffffff" />
                <Text style={styles.actionBtnText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>

            {/* 3. Email */}
            <TouchableOpacity
              style={[
                styles.itemCard,
                { backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0', marginTop: 4 },
              ]}
              onPress={handleEmail}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#059669' }]}>
                <Mail size={18} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemLabel}>E-POSTA</Text>
                <Text style={[styles.itemValue, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                  polatdg@hotmail.com
                </Text>
              </View>
              <ExternalLink size={16} color="#94a3b8" />
            </TouchableOpacity>

            {/* 4. Company */}
            <View
              style={[
                styles.itemCard,
                { backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' },
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#64748b' }]}>
                <Building2 size={18} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemLabel}>KURUM</Text>
                <Text style={[styles.itemValue, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                  Polatlar Yazılım
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.15)',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  cardsList: {
    gap: 10,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  itemValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 1,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    height: 40,
    borderRadius: 10,
  },
  whatsappBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    height: 40,
    borderRadius: 10,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
