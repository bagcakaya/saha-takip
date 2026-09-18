import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  X,
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  User,
  Trash2,
  Key,
  Smartphone,
  Building2,
  Store,
  ChevronDown,
  CheckCircle2,
  Lock,
  Unlock,
  Check,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useStorage } from '../context/StorageContext';
import { UserRole, UserAccount, isUserAdmin, canUserChangePassword } from '../types/auth';
import { DeviceService } from '../services/deviceService';
import { UserDeviceBinding } from '../types/storage';
import { CreateCompanyModal } from './CreateCompanyModal';

interface UserManagementModalProps {
  visible: boolean;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  visible,
  onClose,
}) => {
  const {
    users,
    user: currentUser,
    company,
    addUser,
    updateUser,
    deleteUser,
    refreshUsers,
    suggestUsername,
  } = useAuth();
  const { branches, assignStaffToBranch } = useStorage();

  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);

  // Form states for adding user
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('staff');
  const [newBranchId, setNewBranchId] = useState<string>('');
  const [newCanChangePassword, setNewCanChangePassword] = useState(true);
  const [formMsg, setFormMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline password changer state
  const [editingPasswordUserId, setEditingPasswordUserId] = useState<string | null>(null);
  const [changedPassword, setChangedPassword] = useState('');

  // Device bindings state
  const [userBindings, setUserBindings] = useState<UserDeviceBinding[]>([]);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);

  // Dropdown modal state for mobile
  const [pickerType, setPickerType] = useState<'role' | 'branch_add' | 'branch_edit' | null>(null);
  const [branchEditUserId, setBranchEditUserId] = useState<string | null>(null);

  const companyCode = (currentUser?.companyCode || 'POLATLAR').toUpperCase();
  const companyName = company?.name || (companyCode === 'POLATLAR' ? 'Polatlar' : companyCode);

  const companyUsers = useMemo(() => {
    return users.filter(
      (u) => (u.companyCode || 'POLATLAR').toUpperCase() === companyCode
    );
  }, [users, companyCode]);

  const loadBindings = async () => {
    try {
      const list = await DeviceService.getUserDeviceBindings();
      setUserBindings(list);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (visible) {
      loadBindings();
    }
  }, [visible]);

  if (!visible) return null;

  const handleNameChange = (val: string) => {
    setNewName(val);
    if (suggestUsername) {
      const suggested = suggestUsername(val);
      setNewUsername(suggested);
    } else {
      const trMap: { [k: string]: string } = {
        'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
        'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u',
      };
      let clean = val.toLowerCase();
      for (const [tr, en] of Object.entries(trMap)) {
        clean = clean.split(tr).join(en);
      }
      setNewUsername(clean.replace(/[^a-z0-9]/g, ''));
    }
  };

  const handleAddSubmit = async () => {
    setFormMsg(null);

    if (!newName.trim()) {
      setFormMsg({ type: 'error', text: 'Lütfen Ad Soyad / Unvan girin.' });
      return;
    }
    if (!newUsername.trim()) {
      setFormMsg({ type: 'error', text: 'Lütfen kullanıcı adı belirleyin.' });
      return;
    }
    if (!newPassword.trim() || newPassword.trim().length < 3) {
      setFormMsg({ type: 'error', text: 'Şifre en az 3 karakter olmalıdır.' });
      return;
    }

    setIsSubmitting(true);
    const res = await addUser({
      username: newUsername.trim().toLowerCase(),
      password: newPassword.trim(),
      name: newName.trim(),
      role: newRole,
      canChangePassword: newRole === 'admin' ? true : newCanChangePassword,
    });
    setIsSubmitting(false);

    if (res.success) {
      // Branch assignment if chosen
      if (newBranchId && res.user?.id) {
        const targetBranch = branches.find((b) => b.id === newBranchId);
        const existingIds = targetBranch?.assignedUserIds || [];
        if (!existingIds.includes(res.user.id)) {
          await assignStaffToBranch(newBranchId, [...existingIds, res.user.id]);
        }
      }

      setFormMsg({ type: 'success', text: `"${newUsername}" kullanıcısı başarıyla eklendi.` });
      setNewName('');
      setNewUsername('');
      setNewPassword('');
      setNewRole('staff');
      setNewBranchId('');
      setNewCanChangePassword(true);
      refreshUsers();

      setTimeout(() => {
        setActiveTab('list');
        setFormMsg(null);
      }, 1000);
    } else {
      setFormMsg({ type: 'error', text: res.error || 'Kullanıcı eklenemedi.' });
    }
  };

  const handleRoleToggle = (userId: string, currentRole: UserRole, userName: string) => {
    const nextRole: UserRole = currentRole === 'admin' ? 'staff' : 'admin';
    const roleName = nextRole === 'admin' ? 'Sistem Yöneticisi (Admin)' : 'Saha Yetkilisi';

    Alert.alert(
      'Yetki Değiştir',
      `"${userName}" kullanıcısının yetkisini "${roleName}" olarak değiştirmek istediğinize emin misiniz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Değiştir',
          onPress: async () => {
            const res = await updateUser(userId, { role: nextRole });
            if (res.success) {
              refreshUsers();
            } else {
              Alert.alert('Hata', res.error || 'Yetki güncellenemedi.');
            }
          },
        },
      ]
    );
  };

  const handleTogglePasswordPermission = (account: UserAccount) => {
    if (isUserAdmin(account)) {
      Alert.alert('Bilgi', 'Sistem yöneticileri daima şifre belirleme ve değiştirme yetkisine sahiptir.');
      return;
    }

    const currentPerm = account.canChangePassword !== false;
    const nextPerm = !currentPerm;
    const actionText = nextPerm ? 'yetki vermek' : 'yetkiyi kaldırmak';

    Alert.alert(
      'Şifre Değiştirme Yetkisi',
      `"${account.name}" kullanıcısına şifre değiştirme izni ${actionText} istediğinize emin misiniz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: nextPerm ? 'Yetki Ver' : 'Yetkiyi Kaldır',
          onPress: async () => {
            const res = await updateUser(account.id, { canChangePassword: nextPerm });
            if (res.success) {
              await refreshUsers();
            } else {
              Alert.alert('Hata', res.error || 'Yetki güncellenemedi.');
            }
          },
        },
      ]
    );
  };

  const handleSaveNewPassword = async (userId: string) => {
    if (!changedPassword.trim() || changedPassword.trim().length < 3) {
      Alert.alert('Hata', 'Şifre en az 3 karakter olmalıdır.');
      return;
    }

    setIsSubmitting(true);
    const res = await updateUser(userId, { password: changedPassword.trim() });
    setIsSubmitting(false);

    if (res.success) {
      Alert.alert('Başarılı', 'Şifre başarıyla güncellendi ve buluta kaydedildi.');
      setEditingPasswordUserId(null);
      setChangedPassword('');
      await refreshUsers();
    } else {
      Alert.alert('Hata', res.error || 'Şifre güncellenemedi.');
    }
  };

  const handleResetDeviceLock = (userId: string, userName: string, username?: string) => {
    Alert.alert(
      'Cihaz Kilidini Sıfırla',
      `"${userName}" kullanıcısının telefon cihaz kilidini sıfırlamak istediğinize emin misiniz?\n\nKilit kaldırıldığında personel yeni telefonundan sisteme girdiği anda yeni cihazı sisteme otomatik kilitlenecektir.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Kilidi Sıfırla',
          style: 'destructive',
          onPress: async () => {
            setResettingUserId(userId);
            try {
              const updated = await DeviceService.unbindUserDevice(userId, username);
              setUserBindings(updated);
              Alert.alert('Başarılı', `"${userName}" kullanıcısının cihaz kilidi sıfırlandı.`);
            } catch (err: any) {
              Alert.alert('Hata', err?.message || 'Cihaz kilidi sıfırlanamadı.');
            } finally {
              setResettingUserId(null);
            }
          },
        },
      ]
    );
  };

  const handleDelete = (userId: string, userName: string) => {
    if (userId === 'admin-root' || userId === currentUser?.id) {
      Alert.alert('İşlem Engellendi', 'Kendi hesabınızı veya ana yöneticiyi silemezsiniz.');
      return;
    }

    Alert.alert(
      'Kullanıcıyı Sil',
      `"${userName}" kullanıcısını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteUser(userId);
            if (res.success) {
              refreshUsers();
            } else {
              Alert.alert('Hata', res.error || 'Silme işlemi başarısız.');
            }
          },
        },
      ]
    );
  };

  const handleSelectBranchForUser = async (userId: string, targetBranchId: string) => {
    const userBranch = branches.find((b) => b.assignedUserIds?.includes(userId));

    if (!targetBranchId) {
      // Unassign from current branch
      if (userBranch) {
        const filtered = (userBranch.assignedUserIds || []).filter((id) => id !== userId);
        await assignStaffToBranch(userBranch.id, filtered);
      }
    } else {
      // Remove from existing branch if any
      if (userBranch && userBranch.id !== targetBranchId) {
        const filtered = (userBranch.assignedUserIds || []).filter((id) => id !== userId);
        await assignStaffToBranch(userBranch.id, filtered);
      }
      // Assign to target branch
      const targetB = branches.find((b) => b.id === targetBranchId);
      const existing = targetB?.assignedUserIds || [];
      if (!existing.includes(userId)) {
        await assignStaffToBranch(targetBranchId, [...existing, userId]);
      }
    }

    setPickerType(null);
    setBranchEditUserId(null);
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '02.09.2026';
    const d = new Date(timestamp);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Kullanıcı ve Yetki Yönetimi</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Top Company Banner (Matches Görsel-4 & Görsel-5) */}
            <View style={styles.companyBanner}>
              <View style={styles.companyLeft}>
                <Store size={15} color="#60a5fa" />
                <Text style={styles.companyNameText}>{companyName}</Text>
              </View>

              <View style={styles.companyRight}>
                <TouchableOpacity
                  style={styles.newCompanyBtn}
                  onPress={() => setIsCreateCompanyOpen(true)}
                  activeOpacity={0.7}
                >
                  <Building2 size={13} color="#ffffff" />
                  <Text style={styles.newCompanyBtnText}>+ Yeni Kurum Ekle</Text>
                </TouchableOpacity>

                <View style={styles.companyCodeBadge}>
                  <Text style={styles.companyCodeText}>KURUM KODU: {companyCode}</Text>
                </View>
              </View>
            </View>

            {/* Sub Tabs: [ Kullanıcı Listesi (X) ] and [ + Yeni Kullanıcı Ekle ] (Matches Görsel-4 & 5) */}
            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'list' && styles.tabBtnActive]}
                onPress={() => {
                  setActiveTab('list');
                  setFormMsg(null);
                }}
                activeOpacity={0.7}
              >
                <Users size={15} color={activeTab === 'list' ? '#60a5fa' : '#94a3b8'} />
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'list' ? styles.tabTextActive : styles.tabTextInactive,
                  ]}
                >
                  Kullanıcı Listesi ({companyUsers.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'add' && styles.tabBtnActive]}
                onPress={() => {
                  setActiveTab('add');
                  setFormMsg(null);
                }}
                activeOpacity={0.7}
              >
                <UserPlus size={15} color={activeTab === 'add' ? '#60a5fa' : '#94a3b8'} />
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'add' ? styles.tabTextActive : styles.tabTextInactive,
                  ]}
                >
                  Yeni Kullanıcı Ekle
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab 1: Kullanıcı Listesi (Matches Görsel-5) */}
            {activeTab === 'list' ? (
              <ScrollView
                style={styles.scrollList}
                contentContainerStyle={{ paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
              >
                {companyUsers.map((account) => {
                  const isAdmin = isUserAdmin(account);
                  const isCurrent = currentUser?.id === account.id;
                  const isEditingPass = editingPasswordUserId === account.id;

                  const binding = userBindings.find(
                    (b) =>
                      b.userId === account.id ||
                      (b.username && b.username.toLowerCase() === account.username.toLowerCase())
                  );
                  const userBranch = branches.find((b) => b.assignedUserIds?.includes(account.id));

                  return (
                    <View key={account.id} style={styles.userCard}>
                      <View style={styles.userCardTop}>
                        {/* Avatar */}
                        <View style={styles.avatarBox}>
                          <User size={22} color="#ffffff" />
                        </View>

                        {/* User Details */}
                        <View style={styles.userDetails}>
                          <View style={styles.nameRow}>
                            <Text style={styles.userNameText}>{account.name}</Text>
                            {isCurrent && (
                              <View style={styles.selfBadge}>
                                <Text style={styles.selfBadgeText}>Siz</Text>
                              </View>
                            )}
                          </View>

                          <Text style={styles.userHandleText}>@{account.username}</Text>

                          {/* Device status */}
                          {binding ? (
                            <View style={styles.deviceRow}>
                              <Smartphone size={13} color="#f43f5e" />
                              <Text style={styles.deviceLockedText} numberOfLines={1}>
                                Kilitli Cihaz: {binding.boundDeviceName || binding.boundDeviceId}
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.deviceRow}>
                              <Smartphone size={13} color="#64748b" />
                              <Text style={styles.deviceUnlockedText}>
                                Cihaz henüz kilitlenmedi (İlk girişte kilitlenecek)
                              </Text>
                            </View>
                          )}

                          {/* Branch Selector Row */}
                          <TouchableOpacity
                            style={styles.branchSelectPill}
                            onPress={() => {
                              setBranchEditUserId(account.id);
                              setPickerType('branch_edit');
                            }}
                            activeOpacity={0.7}
                          >
                            <Store size={13} color="#14b8a6" />
                            <Text style={styles.branchSelectText} numberOfLines={1}>
                              Şube: {userBranch?.name || 'Atanmamış (Merkez)'}
                            </Text>
                            <ChevronDown size={13} color="#14b8a6" />
                          </TouchableOpacity>
                        </View>

                        {/* Right side: Role and Password Permission Badges */}
                        <View style={styles.badgesCol}>
                          {/* Role Badge (Clickable to toggle) */}
                          <TouchableOpacity
                            style={[
                              styles.roleBadge,
                              isAdmin ? styles.roleBadgeAdmin : styles.roleBadgeStaff,
                            ]}
                            onPress={() => handleRoleToggle(account.id, account.role, account.name)}
                            activeOpacity={0.7}
                          >
                            {isAdmin ? (
                              <ShieldCheck size={13} color="#f59e0b" />
                            ) : (
                              <Shield size={13} color="#60a5fa" />
                            )}
                            <Text
                              style={[
                                styles.roleBadgeText,
                                isAdmin ? { color: '#f59e0b' } : { color: '#60a5fa' },
                              ]}
                            >
                              {isAdmin ? 'Sistem Yöneticisi' : 'Saha Yetkilisi'}
                            </Text>
                          </TouchableOpacity>

                          {/* Password Permission Badge (Clickable to toggle) */}
                          <TouchableOpacity
                            style={[
                              styles.permBadge,
                              (account.canChangePassword !== false || isAdmin)
                                ? styles.permBadgeActive
                                : styles.permBadgeDisabled,
                            ]}
                            onPress={() => handleTogglePasswordPermission(account)}
                            activeOpacity={0.7}
                          >
                            <Key
                              size={11}
                              color={(account.canChangePassword !== false || isAdmin) ? '#10b981' : '#f87171'}
                            />
                            <Text
                              style={[
                                styles.permBadgeText,
                                (account.canChangePassword !== false || isAdmin)
                                  ? { color: '#10b981' }
                                  : { color: '#f87171' },
                              ]}
                            >
                              {isAdmin
                                ? 'Şifre Yetkisi (Tam)'
                                : account.canChangePassword !== false
                                ? 'Şifre: Yetkili'
                                : 'Şifre: Kısıtlı'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Inline password changer */}
                      {isEditingPass && (
                        <View style={styles.inlinePassBox}>
                          <Text style={styles.inlinePassTitle}>Yeni Şifre Belirle:</Text>
                          <View style={styles.inlinePassInputRow}>
                            <TextInput
                              style={styles.inlinePassInput}
                              placeholder="En az 3 karakter..."
                              placeholderTextColor="#64748b"
                              value={changedPassword}
                              onChangeText={setChangedPassword}
                              secureTextEntry
                            />
                            <TouchableOpacity
                              style={styles.inlinePassSaveBtn}
                              onPress={() => handleSaveNewPassword(account.id)}
                            >
                              <Check size={14} color="#ffffff" />
                              <Text style={styles.inlinePassSaveText}>Kaydet</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.inlinePassCancelBtn}
                              onPress={() => {
                                setEditingPasswordUserId(null);
                                setChangedPassword('');
                              }}
                            >
                              <Text style={styles.inlinePassCancelText}>İptal</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {/* Card Footer Actions (Matches Görsel-5) */}
                      <View style={styles.userCardFooter}>
                        <Text style={styles.dateAddedText}>
                          Eklenme: {formatDate(account.createdAt)}
                        </Text>

                        <View style={styles.footerBtnsRow}>
                          {/* Kilidi Sıfırla (If device is locked) */}
                          {binding && (
                            <TouchableOpacity
                              style={styles.resetLockBtn}
                              onPress={() => handleResetDeviceLock(account.id, account.name, account.username)}
                              disabled={resettingUserId === account.id}
                              activeOpacity={0.7}
                            >
                              <Lock size={12} color="#f87171" />
                              <Unlock size={12} color="#f87171" style={{ marginLeft: -4 }} />
                              <Text style={styles.resetLockText}>
                                {resettingUserId === account.id ? 'Sıfırlanıyor...' : 'Kilidi Sıfırla'}
                              </Text>
                            </TouchableOpacity>
                          )}

                          {/* Şifre Belirle */}
                          <TouchableOpacity
                            style={styles.setPasswordBtn}
                            onPress={() => {
                              setEditingPasswordUserId(isEditingPass ? null : account.id);
                              setChangedPassword('');
                            }}
                            activeOpacity={0.7}
                          >
                            <Key size={13} color="#f59e0b" />
                            <Text style={styles.setPasswordText}>Şifre Belirle</Text>
                          </TouchableOpacity>

                          {/* Sil */}
                          {!isCurrent && account.id !== 'admin-root' && (
                            <TouchableOpacity
                              style={styles.deleteUserBtn}
                              onPress={() => handleDelete(account.id, account.name)}
                              activeOpacity={0.7}
                            >
                              <Trash2 size={14} color="#ef4444" />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              /* Tab 2: Yeni Kullanıcı Ekle (Matches Görsel-4) */
              <ScrollView
                style={styles.scrollForm}
                contentContainerStyle={{ paddingBottom: 30 }}
                showsVerticalScrollIndicator={false}
              >
                {formMsg && (
                  <View
                    style={[
                      styles.msgBox,
                      formMsg.type === 'success' ? styles.msgBoxSuccess : styles.msgBoxError,
                    ]}
                  >
                    {formMsg.type === 'success' && (
                      <CheckCircle2 size={16} color="#10b981" style={{ marginRight: 6 }} />
                    )}
                    <Text
                      style={[
                        styles.msgText,
                        formMsg.type === 'success' ? { color: '#6ee7b7' } : { color: '#fca5a5' },
                      ]}
                    >
                      {formMsg.text}
                    </Text>
                  </View>
                )}

                {/* 1. AD SOYAD / UNVAN */}
                <View style={styles.formItem}>
                  <Text style={styles.formLabel}>AD SOYAD / UNVAN</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newName}
                    onChangeText={handleNameChange}
                    placeholder="Örn: Ahmet Yılmaz"
                    placeholderTextColor="#64748b"
                  />
                </View>

                {/* 2. KULLANICI ADI (GİRİŞ İÇİN) */}
                <View style={styles.formItem}>
                  <View style={styles.formLabelRow}>
                    <Text style={styles.formLabel}>KULLANICI ADI (GİRİŞ İÇİN)</Text>
                    <Text style={styles.sparkleAutoText}>✨ Otomatik üretildi</Text>
                  </View>
                  <TextInput
                    style={[styles.formInput, styles.monoInput]}
                    value={newUsername}
                    onChangeText={(t) =>
                      setNewUsername(t.toLowerCase().replace(/[^a-z0-9_-]/g, ''))
                    }
                    placeholder="Örn: ahmetyilmaz"
                    placeholderTextColor="#64748b"
                    autoCapitalize="none"
                  />
                </View>

                {/* 3. GİRİŞ ŞİFRESİ */}
                <View style={styles.formItem}>
                  <Text style={styles.formLabel}>GİRİŞ ŞİFRESİ</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="En az 3 karakter"
                    placeholderTextColor="#64748b"
                    secureTextEntry
                  />
                </View>

                {/* 4. YETKİ SEVİYESİ (ROL) */}
                <View style={styles.formItem}>
                  <Text style={styles.formLabel}>YETKİ SEVİYESİ (ROL)</Text>
                  <TouchableOpacity
                    style={styles.selectorBtn}
                    onPress={() => setPickerType('role')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.selectorBtnText}>
                      {newRole === 'admin'
                        ? 'Sistem Yöneticisi (Admin - Tam Yetkili)'
                        : 'Saha Yetkilisi (Kurulum & Raporlama)'}
                    </Text>
                    <ChevronDown size={16} color="#94a3b8" />
                  </TouchableOpacity>
                </View>

                {/* 5. ŞİFRE DEĞİŞTİRME YETKİSİ */}
                <View style={styles.formItem}>
                  <Text style={styles.formLabel}>ŞİFRE DEĞİŞTİRME YETKİSİ</Text>
                  <TouchableOpacity
                    style={styles.selectorBtn}
                    onPress={() => setNewCanChangePassword(!newCanChangePassword)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Key size={15} color={newCanChangePassword ? '#10b981' : '#f87171'} />
                      <Text style={styles.selectorBtnText}>
                        {newCanChangePassword
                          ? 'Yetkili (Personel kendi şifresini değiştirebilir)'
                          : 'Kısıtlı (Yalnızca Yönetici şifre belirleyebilir)'}
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        backgroundColor: newCanChangePassword ? '#10b981' : '#334155',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {newCanChangePassword && <Check size={14} color="#ffffff" />}
                    </View>
                  </TouchableOpacity>
                </View>

                {/* 6. BAĞLI OLACAĞI ŞUBE (MESAİ TAKİBİ İÇİN) */}
                <View style={styles.formItem}>
                  <Text style={styles.formLabel}>BAĞLI OLACAĞI ŞUBE (MESAİ TAKİBİ İÇİN)</Text>
                  <TouchableOpacity
                    style={styles.selectorBtn}
                    onPress={() => setPickerType('branch_add')}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Store size={15} color="#60a5fa" />
                      <Text style={styles.selectorBtnText} numberOfLines={1}>
                        {newBranchId
                          ? branches.find((b) => b.id === newBranchId)?.name || 'Şube Seçildi'
                          : 'Şube Seçilmedi (Genel / Merkez)'}
                      </Text>
                    </View>
                    <ChevronDown size={16} color="#94a3b8" />
                  </TouchableOpacity>
                  <Text style={styles.branchNoticeText}>
                    Personel sadece atandığı şubenin 20 metre çapında doğrudan mesaiye başlayabilir. Farklı şubede mesaiye başlamak için yönetici onayı gerekecektir.
                  </Text>
                </View>

                {/* Info Card (Matches Görsel-4) */}
                <View style={styles.authorityInfoCard}>
                  <Text style={styles.authorityInfoTitle}>Yetki Bilgilendirmesi:</Text>
                  <Text style={styles.authorityInfoLine}>
                    • <Text style={{ fontWeight: 'bold', color: '#ffffff' }}>Sistem Yöneticisi (Admin)</Text>: Diğer kullanıcıları yönetebilir, yeni kullanıcılar ekleyebilir ve yetkilerini değiştirebilir.
                  </Text>
                  <Text style={styles.authorityInfoLine}>
                    • <Text style={{ fontWeight: 'bold', color: '#ffffff' }}>Saha Yetkilisi</Text>: Kurulumları, iş emirlerini ve şablonları yönetebilir fakat Kullanıcı Yönetim Paneline erişemez.
                  </Text>
                </View>

                {/* Submit Button (Matches Görsel-4) */}
                <TouchableOpacity
                  style={[styles.saveUserBtn, isSubmitting && { opacity: 0.6 }]}
                  onPress={handleAddSubmit}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.saveUserBtnText}>Kullanıcıyı Kaydet</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Picker Modal for Role & Branch */}
      {pickerType && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={() => setPickerType(null)}
        >
          <TouchableOpacity
            style={styles.pickerBackdrop}
            activeOpacity={1}
            onPress={() => setPickerType(null)}
          >
            <View style={styles.pickerCard}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>
                  {pickerType === 'role'
                    ? 'Yetki Seviyesi Seçin'
                    : 'Bağlı Olacağı Şubeyi Seçin'}
                </Text>
                <TouchableOpacity onPress={() => setPickerType(null)}>
                  <X size={18} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 300 }}>
                {pickerType === 'role' ? (
                  <>
                    <TouchableOpacity
                      style={[
                        styles.pickerItem,
                        newRole === 'staff' && styles.pickerItemActive,
                      ]}
                      onPress={() => {
                        setNewRole('staff');
                        setPickerType(null);
                      }}
                    >
                      <Shield size={16} color="#60a5fa" />
                      <Text style={styles.pickerItemText}>
                        Saha Yetkilisi (Kurulum & Raporlama)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.pickerItem,
                        newRole === 'admin' && styles.pickerItemActive,
                      ]}
                      onPress={() => {
                        setNewRole('admin');
                        setPickerType(null);
                      }}
                    >
                      <ShieldCheck size={16} color="#f59e0b" />
                      <Text style={styles.pickerItemText}>
                        Sistem Yöneticisi (Admin - Tam Yetkili)
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.pickerItem}
                      onPress={() => {
                        if (pickerType === 'branch_add') {
                          setNewBranchId('');
                          setPickerType(null);
                        } else if (branchEditUserId) {
                          handleSelectBranchForUser(branchEditUserId, '');
                        }
                      }}
                    >
                      <Store size={16} color="#94a3b8" />
                      <Text style={styles.pickerItemText}>
                        Şube: Atanmamış (Merkez)
                      </Text>
                    </TouchableOpacity>

                    {branches.map((b) => (
                      <TouchableOpacity
                        key={b.id}
                        style={styles.pickerItem}
                        onPress={() => {
                          if (pickerType === 'branch_add') {
                            setNewBranchId(b.id);
                            setPickerType(null);
                          } else if (branchEditUserId) {
                            handleSelectBranchForUser(branchEditUserId, b.id);
                          }
                        }}
                      >
                        <Store size={16} color="#14b8a6" />
                        <Text style={styles.pickerItemText}>
                          Şube: {b.name} {b.address ? `(${b.address})` : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Create Company Modal (Matches Görsel-1 & 2) */}
      <CreateCompanyModal
        visible={isCreateCompanyOpen}
        onClose={() => setIsCreateCompanyOpen(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0c1527',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '94%',
    minHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  companyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: 'rgba(30, 58, 138, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    gap: 8,
  },
  companyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  companyNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  companyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newCompanyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  newCompanyBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  companyCodeBadge: {
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
  },
  companyCodeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    backgroundColor: '#111c33',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#60a5fa',
  },
  tabTextInactive: {
    color: '#94a3b8',
  },
  scrollList: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  userCard: {
    backgroundColor: '#111c33',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    marginBottom: 10,
  },
  userCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  selfBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  selfBadgeText: {
    color: '#93c5fd',
    fontSize: 10,
    fontWeight: '800',
  },
  userHandleText: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 1,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  deviceLockedText: {
    fontSize: 11,
    color: '#f87171',
    fontWeight: '600',
    flex: 1,
  },
  deviceUnlockedText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    flex: 1,
  },
  branchSelectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(20, 184, 166, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  branchSelectText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2dd4bf',
    maxWidth: 180,
  },
  badgesCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  permBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  permBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  permBadgeDisabled: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  permBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9,
    borderWidth: 1,
  },
  roleBadgeStaff: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  roleBadgeAdmin: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  inlinePassBox: {
    backgroundColor: '#0a0f1d',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
  },
  inlinePassTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#93c5fd',
    marginBottom: 6,
  },
  inlinePassInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlinePassInput: {
    flex: 1,
    backgroundColor: '#162238',
    borderWidth: 1,
    borderColor: '#223554',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#ffffff',
    fontSize: 12,
  },
  inlinePassSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  inlinePassSaveText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  inlinePassCancelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  inlinePassCancelText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  userCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    marginTop: 10,
    paddingTop: 10,
  },
  dateAddedText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  footerBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resetLockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  resetLockText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '800',
  },
  setPasswordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  setPasswordText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '700',
  },
  deleteUserBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  scrollForm: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  msgBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  msgBoxSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  msgBoxError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  msgText: {
    fontSize: 12,
    fontWeight: '700',
  },
  formItem: {
    marginBottom: 12,
  },
  formLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  sparkleAutoText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#60a5fa',
  },
  formInput: {
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
  monoInput: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800',
    color: '#93c5fd',
  },
  selectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#162238',
    borderWidth: 1,
    borderColor: '#223554',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  selectorBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  branchNoticeText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 5,
    lineHeight: 15,
  },
  authorityInfoCard: {
    backgroundColor: 'rgba(30, 58, 138, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    borderRadius: 14,
    padding: 12,
    marginVertical: 10,
    gap: 4,
  },
  authorityInfoTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#60a5fa',
    marginBottom: 2,
  },
  authorityInfoLine: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
  },
  saveUserBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  saveUserBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerCard: {
    backgroundColor: '#0c1527',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    width: '100%',
    maxWidth: 380,
    padding: 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 8,
  },
  pickerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  pickerItemActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  pickerItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
});
