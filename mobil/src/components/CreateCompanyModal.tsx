import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Building2,
  X,
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { Company, User } from '../types/auth';

interface CreateCompanyModalProps {
  visible: boolean;
  onClose: () => void;
}

export const CreateCompanyModal: React.FC<CreateCompanyModalProps> = ({
  visible,
  onClose,
}) => {
  const { createCompanyByAdmin } = useAuth();

  const [companyName, setCompanyName] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Success state holding created details
  const [createdResult, setCreatedResult] = useState<{
    company: Company;
    adminUser: User;
    plainPassword: string;
  } | null>(null);

  if (!visible) return null;

  const handleCompanyNameChange = (val: string) => {
    setCompanyName(val);
    if (
      !companyCode ||
      companyCode === companyName.toUpperCase().slice(0, 8).replace(/[^A-Z0-9]/g, '')
    ) {
      const clean = val
        .toUpperCase()
        .replace(/Ğ/g, 'G')
        .replace(/Ü/g, 'U')
        .replace(/Ş/g, 'S')
        .replace(/İ/g, 'I')
        .replace(/I/g, 'I')
        .replace(/Ö/g, 'O')
        .replace(/Ç/g, 'C')
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 10);
      setCompanyCode(clean);
    }
  };

  const resetForm = () => {
    setCompanyName('');
    setCompanyCode('');
    setAdminName('');
    setAdminEmail('');
    setPassword('');
    setErrorMsg('');
    setCreatedResult(null);
    setCopied(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    setErrorMsg('');

    if (!companyName.trim()) {
      setErrorMsg('Lütfen Kurum / Şirket adını girin.');
      return;
    }
    if (!companyCode.trim() || companyCode.trim().length < 3) {
      setErrorMsg('Kurum kodu en az 3 karakter olmalıdır.');
      return;
    }
    if (!adminName.trim()) {
      setErrorMsg('Lütfen yönetici adı ve soyadını girin.');
      return;
    }
    if (!adminEmail.trim() || !adminEmail.includes('@')) {
      setErrorMsg('Lütfen geçerli bir yönetici e-posta adresi girin.');
      return;
    }
    if (!password.trim() || password.trim().length < 3) {
      setErrorMsg('Yönetici şifresi en az 3 karakter olmalıdır.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await createCompanyByAdmin({
        name: companyName.trim(),
        code: companyCode.trim().toUpperCase(),
        adminName: adminName.trim(),
        adminEmail: adminEmail.trim().toLowerCase(),
        password: password.trim(),
      });

      if (res.success && res.company && res.adminUser) {
        setCreatedResult({
          company: res.company,
          adminUser: res.adminUser,
          plainPassword: password.trim(),
        });
      } else {
        setErrorMsg(res.error || 'Kurum kaydı oluşturulurken bir hata oluştu.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Kurum kaydı oluşturulurken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdResult) return;
    const text = `🏢 Kurum Adı: ${createdResult.company.name}\n🔑 Kurum Kodu: ${createdResult.company.code}\n👤 Yönetici Girişi: admin (veya ${createdResult.company.adminEmail})\n🔒 Şifre: ${createdResult.plainPassword}`;
    
    if (typeof navigator !== 'undefined' && (navigator as any).clipboard?.writeText) {
      (navigator as any).clipboard.writeText(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    Alert.alert('Kopyalandı', 'Kurum giriş bilgileri panoya kopyalandı.');
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.iconCircle}>
                  <Building2 size={24} color="#60a5fa" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>Yeni Kurum Kaydı</Text>
                  <Text style={styles.subtitle}>
                    Kendi kurumunuzu açın ve personellerinizi yönetin
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Error Message */}
            {errorMsg ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Success View */}
            {createdResult ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 10 }}
              >
                <View style={styles.successBanner}>
                  <View style={styles.successIconCircle}>
                    <CheckCircle2 size={28} color="#10b981" />
                  </View>
                  <Text style={styles.successTitle}>Kurum Başarıyla Oluşturuldu!</Text>
                  <Text style={styles.successDesc}>
                    Yeni kurum ve yönetici hesabı aktif edildi. Aşağıdaki giriş bilgilerini kurum yetkilisine iletebilirsiniz:
                  </Text>
                </View>

                {/* Credentials Card */}
                <View style={styles.credentialsCard}>
                  <View style={styles.credRow}>
                    <Text style={styles.credLabel}>Kurum Adı:</Text>
                    <Text style={styles.credValue}>{createdResult.company.name}</Text>
                  </View>
                  <View style={styles.credRow}>
                    <Text style={styles.credLabel}>Kurum Kodu:</Text>
                    <Text style={styles.credCode}>{createdResult.company.code}</Text>
                  </View>
                  <View style={styles.credRow}>
                    <Text style={styles.credLabel}>Yönetici Adı:</Text>
                    <Text style={styles.credValue}>{createdResult.company.adminName}</Text>
                  </View>
                  <View style={styles.credRow}>
                    <Text style={styles.credLabel}>Giriş (Kullanıcı / E-Posta):</Text>
                    <Text style={styles.credAmber}>
                      admin <Text style={styles.credSub}>veya</Text> {createdResult.company.adminEmail}
                    </Text>
                  </View>
                  <View style={styles.credRow}>
                    <Text style={styles.credLabel}>Şifre:</Text>
                    <Text style={styles.credEmerald}>{createdResult.plainPassword}</Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.successActions}>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={handleCopyCredentials}
                    activeOpacity={0.7}
                  >
                    {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} color="#ffffff" />}
                    <Text style={styles.copyBtnText}>
                      {copied ? 'Kopyalandı!' : 'Bilgileri Kopyala'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.okBtn}
                    onPress={handleClose}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.okBtnText}>Tamam</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              /* Form (Görsel-1) */
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 10 }}
              >
                {/* 1. Kurum / Şirket Adı */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Kurum / Şirket Adı <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={companyName}
                    onChangeText={handleCompanyNameChange}
                    placeholder="Örn: Akarsu Ltd. Şti."
                    placeholderTextColor="#64748b"
                  />
                </View>

                {/* 2. Kurum Kodu */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>
                      Kurum Kodu (Personel Giriş Kodu) <Text style={styles.required}>*</Text>
                    </Text>
                    <Text style={styles.helperNote}>Büyük harf, boşluksuz</Text>
                  </View>
                  <TextInput
                    style={[styles.input, styles.codeFont]}
                    value={companyCode}
                    onChangeText={(t) =>
                      setCompanyCode(t.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))
                    }
                    placeholder="ÖRN: AKARSU"
                    placeholderTextColor="#64748b"
                    autoCapitalize="characters"
                  />
                </View>

                {/* 3. Yönetici Adı ve Soyadı */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Yönetici Adı ve Soyadı <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={adminName}
                    onChangeText={setAdminName}
                    placeholder="Örn: Mehmet Akarsu"
                    placeholderTextColor="#64748b"
                  />
                </View>

                {/* 4. Yönetici E-Posta */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Yönetici E-Posta <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={adminEmail}
                    onChangeText={setAdminEmail}
                    placeholder="Örn: mehmet@akarsu.com"
                    placeholderTextColor="#64748b"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                {/* 5. Yönetici Şifresi */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Yönetici Şifresi <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="En az 3 karakter"
                    placeholderTextColor="#64748b"
                    secureTextEntry
                  />
                </View>

                {/* Info Card */}
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    <Text style={styles.infoIcon}>ℹ️ </Text>
                    Kurumunuz açıldığında tüm verileriniz diğer firmalardan{' '}
                    <Text style={{ fontWeight: 'bold', color: '#bfdbfe' }}>%100 izole</Text>{' '}
                    saklanacaktır. Yönetici olarak personellerinizi ve çalışma yerinizi hemen belirleyebilirsiniz.
                  </Text>
                </View>

                {/* Action Buttons (Matches Görsel-1) */}
                <View style={styles.footerActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={handleClose}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelBtnText}>Vazgeç</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.submitBtn, isLoading && { opacity: 0.6 }]}
                    onPress={handleSubmit}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <>
                        <Sparkles size={16} color="#ffffff" />
                        <Text style={styles.submitBtnText}>Kurumu Oluştur</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  keyboardContainer: {
    width: '100%',
    maxWidth: 440,
  },
  modalCard: {
    backgroundColor: '#0c1527',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#93c5fd',
    marginTop: 2,
    lineHeight: 15,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 5,
  },
  helperNote: {
    fontSize: 10,
    color: '#93c5fd',
    fontWeight: '600',
  },
  required: {
    color: '#f43f5e',
  },
  input: {
    backgroundColor: '#162238',
    borderWidth: 1,
    borderColor: '#223554',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
  },
  codeFont: {
    fontWeight: '900',
    letterSpacing: 1,
    color: '#93c5fd',
  },
  infoBox: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.25)',
    borderRadius: 14,
    padding: 12,
    marginVertical: 12,
  },
  infoIcon: {
    fontSize: 12,
  },
  infoText: {
    fontSize: 11,
    color: '#93c5fd',
    lineHeight: 16,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#3b82f6',
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 14,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  successBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  successIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 4,
  },
  successDesc: {
    fontSize: 11,
    color: '#a7f3d0',
    textAlign: 'center',
    lineHeight: 16,
  },
  credentialsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  credRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  credLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  credValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  credCode: {
    fontSize: 13,
    fontWeight: '900',
    color: '#93c5fd',
    letterSpacing: 1,
  },
  credAmber: {
    fontSize: 12,
    fontWeight: '800',
    color: '#f59e0b',
  },
  credSub: {
    fontWeight: '400',
    color: '#94a3b8',
  },
  credEmerald: {
    fontSize: 13,
    fontWeight: '900',
    color: '#10b981',
  },
  successActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  copyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 11,
    borderRadius: 12,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  okBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 11,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  okBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
  },
});
