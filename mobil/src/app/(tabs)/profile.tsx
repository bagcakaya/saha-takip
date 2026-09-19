import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  useColorScheme,
  Alert,
  Platform,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useStorage } from '../../context/StorageContext';
import { canUserChangePassword, canUserManageServerConfig } from '../../types/auth';
import {
  User,
  Building2,
  Shield,
  Search,
  BookOpen,
  StickyNote,
  Plus,
  LogOut,
  X,
  FileText,
  Key,
  Lock,
  CheckCircle2,
  Server,
} from 'lucide-react-native';
import { ServerSettingsModal } from '../../components/ServerSettingsModal';
import { MobileServerConfigService, ServerConfig } from '../../services/serverConfigService';

export default function ProfileScreen() {
  const { user, company, logout, updateUser, refreshUsers } = useAuth();
  const { cariler, notes, addNote } = useStorage();
  const isDark = useColorScheme() === 'dark';

  const canManageServer = canUserManageServerConfig(user);

  // Server settings modal state
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [serverConfig, setServerConfig] = useState<ServerConfig>(() => MobileServerConfigService.getConfig());

  // Password update state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passMsg, setPassMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const hasPasswordPermission = canUserChangePassword(user);

  const handleChangePassword = async () => {
    setPassMsg(null);
    if (!newPassword.trim() || newPassword.trim().length < 3) {
      setPassMsg({ type: 'error', text: 'Yeni şifre en az 3 karakter olmalıdır.' });
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      setPassMsg({ type: 'error', text: 'Girdiğiniz şifreler birbiriyle eşleşmiyor.' });
      return;
    }
    if (!user?.id) return;

    setIsUpdatingPassword(true);
    const res = await updateUser(user.id, { password: newPassword.trim() });
    setIsUpdatingPassword(false);

    if (res.success) {
      setNewPassword('');
      setConfirmPassword('');
      setPassMsg({ type: 'success', text: 'Şifreniz başarıyla güncellendi ve buluta kaydedildi.' });
      await refreshUsers();
    } else {
      setPassMsg({ type: 'error', text: res.error || 'Şifre güncellenemedi.' });
    }
  };

  // Cari search state
  const [cariSearch, setCariSearch] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const filteredCariler = useMemo(() => {
    if (!cariSearch.trim()) return [];
    const q = cariSearch.toLowerCase();
    return cariler.filter((c) => c.toLowerCase().includes(q)).slice(0, 25);
  }, [cariler, cariSearch]);

  // User notes
  const userNotes = useMemo(() => {
    if (!user) return [];
    return notes.filter((n) => n.createdBy === user.id || n.targetMode === 'all').slice(0, 10);
  }, [notes, user]);

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;
    setAddingNote(true);
    const res = await addNote({ content: newNoteContent.trim() });
    setAddingNote(false);
    if (res.success) {
      setNewNoteContent('');
      Alert.alert('Başarılı', 'Not kaydedildi.');
    } else {
      Alert.alert('Hata', res.message);
    }
  };

  const handleLogout = () => {
    Alert.alert('Çıkış Yap', 'Hesabınızdan çıkmak istediğinize emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Çıkış Yap',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
      {/* 1. User Info Card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderColor: isDark ? '#334155' : '#e2e8f0',
          },
        ]}
      >
        <View style={styles.userHeader}>
          <View style={styles.avatarCircle}>
            <User size={32} color="#059669" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={[styles.userName, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
              {user?.name || 'Kullanıcı'}
            </Text>
            <Text style={styles.userHandle}>@{user?.username}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.metaChip, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9' }]}>
            <Building2 size={13} color="#64748b" />
            <Text style={[styles.metaChipText, { color: isDark ? '#cbd5e1' : '#475569' }]}>
              {user?.companyCode || 'POLATLAR'}
            </Text>
          </View>
          <View style={[styles.metaChip, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9' }]}>
            <Shield size={13} color="#059669" />
            <Text style={[styles.metaChipText, { color: '#059669' }]}>
              {user?.role === 'admin' ? 'Yönetici' : 'Saha Personeli'}
            </Text>
          </View>
        </View>
      </View>

      {/* 2. Password Security Card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderColor: isDark ? '#334155' : '#e2e8f0',
          },
        ]}
      >
        <View style={styles.cardTitleRow}>
          <Key size={18} color="#059669" />
          <Text style={[styles.cardTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
            Şifre Güvenliği
          </Text>
        </View>

        {hasPasswordPermission ? (
          <View style={{ marginTop: 10 }}>
            <Text style={[styles.cardDesc, { color: isDark ? '#94a3b8' : '#64748b', marginBottom: 12 }]}>
              Hesabınız şifre değiştirmeye yetkilidir. Giriş şifrenizi buradan güncelleyebilirsiniz.
            </Text>

            {passMsg && (
              <View
                style={[
                  styles.msgBox,
                  passMsg.type === 'success' ? styles.msgBoxSuccess : styles.msgBoxError,
                ]}
              >
                {passMsg.type === 'success' && (
                  <CheckCircle2 size={16} color="#10b981" style={{ marginRight: 6 }} />
                )}
                <Text
                  style={[
                    styles.msgText,
                    passMsg.type === 'success' ? { color: '#6ee7b7' } : { color: '#fca5a5' },
                  ]}
                >
                  {passMsg.text}
                </Text>
              </View>
            )}

            <View style={styles.passInputGroup}>
              <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                YENİ ŞİFRE
              </Text>
              <TextInput
                style={[
                  styles.passInput,
                  {
                    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                    color: isDark ? '#f8fafc' : '#0f172a',
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                  },
                ]}
                placeholder="En az 3 karakter..."
                placeholderTextColor="#94a3b8"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />

              <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#64748b', marginTop: 10 }]}>
                YENİ ŞİFRE (TEKRAR)
              </Text>
              <TextInput
                style={[
                  styles.passInput,
                  {
                    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                    color: isDark ? '#f8fafc' : '#0f172a',
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                  },
                ]}
                placeholder="Şifreyi tekrar yazın..."
                placeholderTextColor="#94a3b8"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />

              <TouchableOpacity
                style={[styles.savePassBtn, isUpdatingPassword && { opacity: 0.6 }]}
                onPress={handleChangePassword}
                disabled={isUpdatingPassword}
                activeOpacity={0.8}
              >
                <Key size={16} color="#ffffff" />
                <Text style={styles.savePassBtnText}>
                  {isUpdatingPassword ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={[styles.lockedPermBox, { backgroundColor: isDark ? '#2a1215' : '#fff1f2', borderColor: isDark ? '#881337' : '#fecdd3' }]}>
            <Lock size={20} color="#f43f5e" />
            <View style={{ flex: 1 }}>
              <Text style={styles.lockedPermTitle}>Şifre Değiştirme Yetkisi Kısıtlı</Text>
              <Text style={[styles.lockedPermDesc, { color: isDark ? '#cbd5e1' : '#64748b' }]}>
                Hesabınız için şifre değiştirme yetkisi kapalıdır. Şifre sıfırlama veya değişiklik talebinizi sistem yöneticinize iletebilirsiniz.
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* 2.5. Server Connection Settings Card (Only for Authorized Admins: admin, murat) */}
      {canManageServer && (
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              borderColor: isDark ? '#334155' : '#e2e8f0',
            },
          ]}
        >
          <View style={styles.cardTitleRow}>
            <Server size={18} color="#3b82f6" />
            <Text style={[styles.cardTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
              Sunucu Bağlantı Ayarları
            </Text>
          </View>

          <Text style={[styles.cardDesc, { color: isDark ? '#94a3b8' : '#64748b' }]}>
            Uygulamanın bağlandığı veritabanı altyapısını (Windows Server 2022 SQL Server veya Bulut) buradan yönetebilirsiniz.
          </Text>

          <View
            style={[
              styles.serverStatusBox,
              {
                backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                borderColor: serverConfig.mode === 'local' ? '#10b981' : (isDark ? '#334155' : '#cbd5e1'),
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: serverConfig.mode === 'local' ? '#10b981' : '#3b82f6',
                  }}
                />
                <Text style={[styles.serverModeText, { color: isDark ? '#ffffff' : '#0f172a' }]} numberOfLines={1}>
                  {serverConfig.mode === 'local' ? 'Yerel Sunucu (SQL Server)' : 'Bulut Modu (Varsayılan)'}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.configBtn,
                  { backgroundColor: serverConfig.mode === 'local' ? '#10b981' : '#3b82f6' },
                ]}
                onPress={() => setIsServerModalOpen(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.configBtnText}>Yapılandır</Text>
              </TouchableOpacity>
            </View>

            {serverConfig.mode === 'local' && (
              <Text style={styles.serverUrlText} numberOfLines={1}>
                Adres: {serverConfig.localUrl}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* 3. Fast Cari Search Tool */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderColor: isDark ? '#334155' : '#e2e8f0',
          },
        ]}
      >
        <View style={styles.cardTitleRow}>
          <BookOpen size={18} color="#059669" />
          <Text style={[styles.cardTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
            Hızlı Cari Arama ({cariler.length} Cari)
          </Text>
        </View>
        <Text style={[styles.cardDesc, { color: isDark ? '#94a3b8' : '#64748b' }]}>
          İnternet olmasa dahi cihazınızdaki tam cari rehberinde arama yapın.
        </Text>

        <View style={[styles.cariSearchBar, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9' }]}>
          <Search size={16} color="#94a3b8" />
          <TextInput
            style={[styles.cariSearchInput, { color: isDark ? '#f8fafc' : '#0f172a' }]}
            placeholder="Cari veya müşteri adı yazın..."
            placeholderTextColor="#94a3b8"
            value={cariSearch}
            onChangeText={setCariSearch}
          />
          {cariSearch ? (
            <TouchableOpacity onPress={() => setCariSearch('')}>
              <X size={15} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {cariSearch.trim() && (
          <View style={styles.cariResultsList}>
            {filteredCariler.length === 0 ? (
              <Text style={styles.cariNotFound}>Eşleşen cari bulunamadı.</Text>
            ) : (
              filteredCariler.map((c, idx) => (
                <View
                  key={idx}
                  style={[styles.cariResultItem, { borderBottomColor: isDark ? '#334155' : '#f1f5f9' }]}
                >
                  <Text style={[styles.cariResultText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                    {c}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </View>

      {/* 3. Personal Notes */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderColor: isDark ? '#334155' : '#e2e8f0',
          },
        ]}
      >
        <View style={styles.cardTitleRow}>
          <StickyNote size={18} color="#059669" />
          <Text style={[styles.cardTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
            Hızlı Notlar
          </Text>
        </View>

        <View style={styles.addNoteRow}>
          <TextInput
            style={[
              styles.addNoteInput,
              {
                backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                color: isDark ? '#f8fafc' : '#0f172a',
                borderColor: isDark ? '#334155' : '#e2e8f0',
              },
            ]}
            placeholder="Kendinize hızlı bir not ekleyin..."
            placeholderTextColor="#94a3b8"
            value={newNoteContent}
            onChangeText={setNewNoteContent}
          />
          <TouchableOpacity
            style={[styles.addNoteBtn, addingNote && { opacity: 0.6 }]}
            onPress={handleAddNote}
            disabled={addingNote}
          >
            <Plus size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {userNotes.length === 0 ? (
          <Text style={[styles.emptyText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
            Henüz eklenmiş notunuz yok.
          </Text>
        ) : (
          userNotes.map((n) => (
            <View
              key={n.id}
              style={[styles.noteItem, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}
            >
              <FileText size={14} color="#059669" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.noteText, { color: isDark ? '#f8fafc' : '#1e293b' }]}>
                  {n.content}
                </Text>
                <Text style={styles.noteDate}>
                  {new Date(n.createdAt).toLocaleDateString('tr-TR')}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* 4. Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <LogOut size={18} color="#dc2626" />
        <Text style={styles.logoutBtnText}>Oturumu Kapat</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>İş Takip Sistemi Mobil v1.0.0 (Expo SDK 57)</Text>
    </ScrollView>

    {canManageServer && (
      <ServerSettingsModal
        visible={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
        onSaved={() => setServerConfig(MobileServerConfigService.getConfig())}
      />
    )}
  </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
  },
  userHandle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  cardDesc: {
    fontSize: 12,
    marginBottom: 12,
  },
  cariSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
  },
  cariSearchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
  },
  cariResultsList: {
    marginTop: 10,
  },
  cariNotFound: {
    fontSize: 12,
    color: '#94a3b8',
    paddingVertical: 8,
  },
  cariResultItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  cariResultText: {
    fontSize: 13,
    fontWeight: '600',
  },
  addNoteRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  addNoteInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
  },
  addNoteBtn: {
    backgroundColor: '#059669',
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    paddingVertical: 8,
  },
  noteItem: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 18,
  },
  noteDate: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginTop: 8,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
  },
  passInputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  passInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
    marginBottom: 4,
  },
  savePassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    height: 44,
    borderRadius: 10,
    marginTop: 10,
  },
  savePassBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  msgBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  msgBoxSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  msgBoxError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  msgText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  lockedPermBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
  },
  lockedPermTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#f43f5e',
    marginBottom: 4,
  },
  lockedPermDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 20,
  },
  serverStatusBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  serverModeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  serverUrlText: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  configBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  configBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
});
