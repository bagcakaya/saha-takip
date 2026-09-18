import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Linking,
  Alert,
} from 'react-native';
import {
  KeyRound,
  X,
  MessageCircle,
  Phone,
  Building2,
  User,
  ShieldAlert,
} from 'lucide-react-native';

interface ForgotPasswordModalProps {
  visible: boolean;
  onClose: () => void;
  defaultCompanyCode?: string;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  visible,
  onClose,
  defaultCompanyCode = 'POLATLAR',
}) => {
  const isDark = useColorScheme() === 'dark';
  const [compCode, setCompCode] = useState(defaultCompanyCode);
  const [username, setUsername] = useState('');

  const handleWhatsAppRequest = () => {
    const text = encodeURIComponent(
      `Merhaba Sayın Murat POLAT,\n` +
      `İş Takip Sistemi mobil uygulamasında şifremi unuttum.\n\n` +
      `🏢 Firma Kodu: ${compCode || 'POLATLAR'}\n` +
      `👤 Kullanıcı Adım: ${username || '(Belirtilmedi)'}\n\n` +
      `Lütfen şifremi sıfırlayarak bana yeni şifremi iletebilir misiniz? Teşekkürler.`
    );
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

  const handleCallAdmin = () => {
    Linking.openURL('tel:05336082353').catch(() => {
      Alert.alert('Hata', 'Arama başlatılamadı.');
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.iconCircle}>
                <KeyRound size={18} color="#2563eb" />
              </View>
              <View>
                <Text style={[styles.title, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                  Şifremi Unuttum
                </Text>
                <Text style={styles.subtitle}>Yönetici Doğrulamalı Sıfırlama</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Info note */}
          <View style={[styles.infoBox, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
            <ShieldAlert size={16} color="#059669" style={{ marginTop: 2 }} />
            <Text style={[styles.infoText, { color: isDark ? '#cbd5e1' : '#475569' }]}>
              Güvenlik protokolü gereği şifre sıfırlama işlemleri sistem yöneticisi onayı ile yapılmaktadır. Bilgilerinizi girip doğrudan yöneticiye iletebilirsiniz.
            </Text>
          </View>

          {/* Inputs */}
          <View style={styles.formArea}>
            <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
              FİRMA KODU
            </Text>
            <View style={[styles.inputRow, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9' }]}>
              <Building2 size={16} color="#94a3b8" />
              <TextInput
                style={[styles.input, { color: isDark ? '#f8fafc' : '#0f172a' }]}
                value={compCode}
                onChangeText={setCompCode}
                autoCapitalize="characters"
                placeholder="POLATLAR"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#64748b', marginTop: 10 }]}>
              KULLANICI ADINIZ
            </Text>
            <View style={[styles.inputRow, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9' }]}>
              <User size={16} color="#94a3b8" />
              <TextInput
                style={[styles.input, { color: isDark ? '#f8fafc' : '#0f172a' }]}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                placeholder="Kullanıcı adınızı yazın..."
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          {/* Action buttons */}
          <TouchableOpacity style={styles.whatsappBtn} onPress={handleWhatsAppRequest}>
            <MessageCircle size={18} color="#ffffff" />
            <Text style={styles.actionBtnText}>Yöneticiye WhatsApp ile İlet</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.callBtn} onPress={handleCallAdmin}>
            <Phone size={16} color="#2563eb" />
            <Text style={styles.callBtnText}>Yöneticiyi Ara (0533 608 23 53)</Text>
          </TouchableOpacity>
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
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.15)',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  formArea: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  input: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    height: 48,
    borderRadius: 12,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    height: 44,
    borderRadius: 12,
    marginTop: 8,
  },
  callBtnText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '700',
  },
});
