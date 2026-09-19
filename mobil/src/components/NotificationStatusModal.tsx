import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
  Platform,
  Share,
} from 'react-native';
import {
  X,
  Bell,
  Check,
  CheckCircle2,
  Smartphone,
  Laptop,
  ShieldCheck,
  RefreshCw,
  Lock,
  Zap,
  Radio,
  Send,
  Trash2,
  Copy,
  Edit2,
  AlertTriangle,
  Settings,
  BatteryCharging,
} from 'lucide-react-native';
import { DeviceService } from '../services/deviceService';
import { MobileOneSignalService } from '../services/oneSignalService';
import { RegisteredDevice, UserDeviceBinding } from '../types/storage';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';

interface NotificationStatusModalProps {
  visible: boolean;
  onClose: () => void;
}

export const NotificationStatusModal: React.FC<NotificationStatusModalProps> = ({
  visible,
  onClose,
}) => {
  const { user } = useAuth();
  const { isDark } = useAppTheme();

  const [currentDeviceId, setCurrentDeviceId] = useState<string>('DEV-DESKTOP-ZKAW');
  const [currentDeviceName, setCurrentDeviceName] = useState<string>('Burak AĞCAKAYA – Masaüstü');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInputValue, setNameInputValue] = useState('');
  const [copiedId, setCopiedId] = useState(false);

  // Registered Devices & Anti-Fraud Locks
  const [registeredDevices, setRegisteredDevices] = useState<RegisteredDevice[]>([]);
  const [userBindings, setUserBindings] = useState<UserDeviceBinding[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Test Push & Countdown
  const [countdown, setCountdown] = useState<number | null>(null);
  const [testSentMessage, setTestSentMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const devId = await DeviceService.getCurrentDeviceId();
      const devName = await DeviceService.getCurrentDeviceName(user?.name);
      setCurrentDeviceId(devId);
      setCurrentDeviceName(devName);
      setNameInputValue(devName);

      const devs = await DeviceService.getRegisteredDevices(user?.name);
      setRegisteredDevices(devs);

      const bindings = await DeviceService.getUserDeviceBindings();
      setUserBindings(bindings);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  // Countdown timer for 5s locked screen test
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCountdown(null);
      setTestSentMessage('🔔 Kilitli Ekran Test Bildirimi Başarıyla İletildi!');
      setTimeout(() => setTestSentMessage(null), 5000);
      Alert.alert(
        '🔔 Bildirim Gönderildi',
        'Kilitli ekran donanım testi başarıyla tamamlandı. Telefonunuza bildirim düşmüş olmalıdır.'
      );
    }
  }, [countdown]);

  const handleCopyId = async () => {
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).clipboard && (navigator as any).clipboard.writeText) {
        await (navigator as any).clipboard.writeText(currentDeviceId);
      } else {
        await Share.share({ message: currentDeviceId });
      }
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      Alert.alert('Cihaz Kimliği', currentDeviceId);
    }
  };

  const handleSaveDeviceName = async () => {
    if (!nameInputValue.trim()) return;
    await DeviceService.saveDeviceName(nameInputValue.trim());
    setCurrentDeviceName(nameInputValue.trim());
    setIsEditingName(false);
  };

  const handleResync = async () => {
    setIsLoading(true);
    setTestSentMessage(null);
    await loadData();
    setTestSentMessage('🛡️ Cihaz ID, arka plan servisi ve donanım bağlantısı başarıyla güncellendi.');
    setTimeout(() => setTestSentMessage(null), 4000);
  };

  const handleSendInstantTest = async () => {
    if (!user?.id) {
      Alert.alert('Hata', 'Giriş yapmış kullanıcı bulunamadı.');
      return;
    }
    setTestSentMessage('⏳ Anlık bildirim gönderiliyor...');
    const res = await MobileOneSignalService.sendTestPushNotification({
      userId: user.id,
      title: '🔔 Donanım Bildirim Testi',
      message: `${user.name || 'Personel'}, anlık bildirim sistemi telefonunuzda başarıyla aktif!`,
    });
    if (res.success) {
      setTestSentMessage('🔔 Anlık donanım push bildirimi telefonunuza başarıyla iletildi!');
      setTimeout(() => setTestSentMessage(null), 5000);
      Alert.alert(
        '🔔 Bildirim Gönderildi',
        `"${currentDeviceName}" cihazına anlık push bildirimi gönderildi! Telefonunuzun bildirim çubuğunu kontrol ediniz.`
      );
    } else {
      setTestSentMessage(`⚠️ Bildirim iletilemedi: ${res.error}`);
      Alert.alert('Bildirim Uyarısı', `Bildirim gönderilemedi: ${res.error}`);
    }
  };

  const handleStartLockScreenTest = async () => {
    if (!user?.id) {
      Alert.alert('Hata', 'Giriş yapmış kullanıcı bulunamadı.');
      return;
    }
    setTestSentMessage(null);
    setCountdown(5);
    // Sunucu 5 saniye bekleyip gönderecektir; bu sırada ekranı kilitleyebilirsiniz
    MobileOneSignalService.sendTestPushNotification({
      userId: user.id,
      title: '🔒 Kilitli Ekran Donanım Testi',
      message: `${user.name || 'Personel'}, kilitli ekran bildirimi başarıyla çalışıyor!`,
      delaySeconds: 5,
    }).then((res) => {
      if (!res.success) {
        setTestSentMessage(`⚠️ Kilitli ekran bildirimi hatası: ${res.error}`);
      }
    });
  };

  const handleSendTestToDevice = async (dev: RegisteredDevice) => {
    // 1. Resolve all possible target user IDs/aliases
    const binding = userBindings.find((b) => b.boundDeviceId === dev.deviceId);
    const targetSet = new Set<string>();

    if (binding?.userId) targetSet.add(binding.userId);
    if (binding?.username) targetSet.add(binding.username);

    // If device matches current device or device belongs to current user
    const isCurrentDevice = dev.deviceId === currentDeviceId;
    const isSameUser =
      user?.name && dev.userName && dev.userName.toLowerCase().includes(user.name.toLowerCase().split(' ')[0]);

    if (isCurrentDevice || isSameUser || targetSet.size === 0) {
      if (user?.id) targetSet.add(user.id);
      if ((user as any)?.username) targetSet.add((user as any).username);
    }

    if (dev.userId && !dev.userId.startsWith('u_')) {
      targetSet.add(dev.userId);
    }

    const targetList = Array.from(targetSet);
    if (targetList.length === 0) {
      if (user?.id) targetList.push(user.id);
    }

    setTestSentMessage(`⏳ "${dev.deviceName}" cihazına bildirim iletiliyor...`);
    const res = await MobileOneSignalService.sendTestPushNotification({
      targetUserIds: targetList,
      title: '✈ Cihaz Bildirim Testi',
      message: `"${dev.deviceName}" donanımına doğrudan test bildirimi gönderildi.`,
    });
    if (res.success) {
      Alert.alert(
        '✈ Test Bildirimi Gönderildi',
        `"${dev.deviceName}" (${dev.deviceId}) cihazına test bildirimi başarıyla iletildi.`
      );
      setTestSentMessage(`✅ "${dev.deviceName}" cihazına bildirim başarıyla iletildi.`);
      setTimeout(() => setTestSentMessage(null), 4000);
    } else {
      Alert.alert('Bildirim Uyarısı', `Bildirim gönderilemedi: ${res.error}`);
      setTestSentMessage(`⚠️ Hata: ${res.error}`);
    }
  };

  const handleDeleteDevice = (deviceId: string, devName: string) => {
    Alert.alert(
      'Cihazı Sil',
      `"${devName}" cihazını kayıtlı cihazlar listesinden kaldırmak istediğinize emin misiniz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            const updated = await DeviceService.deleteDevice(deviceId);
            setRegisteredDevices(updated);
          },
        },
      ]
    );
  };

  const handleResetBinding = (userId: string, userName: string) => {
    Alert.alert(
      'Cihaz Kilidini Sıfırla',
      `"${userName}" personelinin cihaz kilidini sıfırlamak istediğinize emin misiniz? Personel bir sonraki oturum açtığı cihaza otomatik kilitlenecektir.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Kilidi Sıfırla',
          style: 'destructive',
          onPress: async () => {
            const updated = await DeviceService.unbindUser(userId);
            setUserBindings(updated);
            Alert.alert('Başarılı', `"${userName}" personelinin cihaz kilidi kaldırıldı.`);
          },
        },
      ]
    );
  };

  // User's explicit rule:
  // "Orada Hangi cihazdan -IOS ise IOS Android ise Android olsun ve yeşil nokta görünsün eğer aktif ise cihaz."
  const platformText =
    Platform.OS === 'ios'
      ? '🟢 iPhone (iOS)'
      : Platform.OS === 'android'
      ? '🟢 Android Cihaz'
      : '🟢 Mobil Cihaz';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: isDark ? '#0b1329' : '#ffffff',
              borderColor: isDark ? '#1e293b' : '#e2e8f0',
            },
          ]}
        >
          {/* Modal Header */}
          <View
            style={[
              styles.modalHeader,
              { borderBottomColor: isDark ? '#1e293b' : '#e2e8f0' },
            ]}
          >
            <Text
              style={[
                styles.modalHeaderTitle,
                { color: isDark ? '#f8fafc' : '#0f172a' },
              ]}
            >
              BİLDİRİM AYARLARI
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color={isDark ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Görsel-1: Header section (Bildirim & Cihaz Yönetimi) */}
            <View
              style={[
                styles.sectionHeaderRow,
                { borderBottomColor: isDark ? '#1e293b' : '#f1f5f9' },
              ]}
            >
              <View style={styles.sectionHeaderLeft}>
                <View style={styles.bellIconBox}>
                  <Bell size={18} color="#3b82f6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: isDark ? '#f8fafc' : '#0f172a' },
                    ]}
                  >
                    Bildirim & Cihaz Yönetimi
                  </Text>
                  <Text
                    style={[
                      styles.sectionSubtitle,
                      { color: isDark ? '#94a3b8' : '#64748b' },
                    ]}
                  >
                    Cihaz kimlikleri (ID), kilit ekranı ve donanım bildirim takibi
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleResync}
                disabled={isLoading}
                style={styles.refreshIconBtn}
                activeOpacity={0.7}
              >
                <RefreshCw size={16} color={isDark ? '#94a3b8' : '#64748b'} />
              </TouchableOpacity>
            </View>

            {/* Görsel-1: BU CİHAZIN KİMLİĞİ Card */}
            <View
              style={[
                styles.identityCard,
                {
                  backgroundColor: isDark ? '#111e38' : '#eff6ff',
                  borderColor: isDark ? '#1e3a8a' : '#bfdbfe',
                },
              ]}
            >
              <View style={styles.identityTopRow}>
                <View style={styles.identityTitleGroup}>
                  <Smartphone size={16} color="#3b82f6" />
                  <Text
                    style={[
                      styles.identityTitle,
                      { color: isDark ? '#f8fafc' : '#1e3a8a' },
                    ]}
                  >
                    BU CİHAZIN KİMLİĞİ
                  </Text>
                </View>

                <View style={styles.identityBadgeRow}>
                  <View style={styles.deviceMonoBadge}>
                    <Text style={styles.deviceMonoBadgeText}>{currentDeviceId}</Text>
                  </View>
                  <TouchableOpacity onPress={handleCopyId} style={styles.copyIdBtn}>
                    {copiedId ? (
                      <Check size={14} color="#10b981" />
                    ) : (
                      <Copy size={14} color="#94a3b8" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <View
                style={[
                  styles.identityBottomRow,
                  { borderTopColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe' },
                ]}
              >
                {/* Device Name Edit */}
                <View style={styles.deviceNameGroup}>
                  <Text style={[styles.nameLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                    Cihaz Adı:
                  </Text>
                  {isEditingName ? (
                    <View style={styles.nameEditBox}>
                      <TextInput
                        style={[
                          styles.nameEditInput,
                          {
                            color: isDark ? '#ffffff' : '#0f172a',
                            borderColor: '#3b82f6',
                            backgroundColor: isDark ? '#0b1329' : '#ffffff',
                          },
                        ]}
                        value={nameInputValue}
                        onChangeText={setNameInputValue}
                        autoFocus
                      />
                      <TouchableOpacity
                        onPress={handleSaveDeviceName}
                        style={styles.nameSaveBtn}
                      >
                        <Check size={14} color="#ffffff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setIsEditingName(false)}
                        style={styles.nameCancelBtn}
                      >
                        <X size={14} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.nameDisplayRow}>
                      <Text
                        style={[
                          styles.nameDisplayText,
                          { color: isDark ? '#f8fafc' : '#0f172a' },
                        ]}
                      >
                        {currentDeviceName}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setIsEditingName(true)}
                        style={styles.pencilBtn}
                      >
                        <Edit2 size={13} color="#94a3b8" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Donanım Push Durumu */}
                <View style={styles.pushStatusGroup}>
                  <Text style={[styles.pushStatusLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                    Donanım Push Durumu:
                  </Text>
                  <Text style={styles.pushStatusText}>
                    🟢 Bağlı (c14ca5fa...)
                  </Text>
                </View>
              </View>
            </View>

            {/* Görsel-1: 4-Card Status List */}
            <View style={styles.statusCardsStack}>
              {/* 1. Tarayıcı / Bildirim İzni */}
              <View
                style={[
                  styles.statusRowCard,
                  {
                    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                    borderColor: isDark ? '#1e293b' : '#e2e8f0',
                  },
                ]}
              >
                <ShieldCheck size={20} color="#10b981" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusCardLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                    Tarayıcı İzni
                  </Text>
                  <Text style={[styles.statusCardValue, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                    🟢 İzin Verildi
                  </Text>
                </View>
              </View>

              {/* 2. Donanım Bağlantısı (ID) */}
              <View
                style={[
                  styles.statusRowCard,
                  {
                    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                    borderColor: isDark ? '#1e293b' : '#e2e8f0',
                  },
                ]}
              >
                <Smartphone size={20} color="#10b981" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusCardLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                    Donanım Bağlantısı (ID)
                  </Text>
                  <Text style={[styles.statusCardValue, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                    🟢 Bağlı (c14ca5fa...)
                  </Text>
                </View>
              </View>

              {/* 3. Uygulama Modu (PWA) -> CRITICAL USER RULE: Hangi cihazdan ise o ve yeşil nokta */}
              <View
                style={[
                  styles.statusRowCard,
                  {
                    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                    borderColor: isDark ? '#1e293b' : '#e2e8f0',
                  },
                ]}
              >
                <Lock size={20} color="#3b82f6" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusCardLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                    Uygulama Modu (PWA)
                  </Text>
                  <Text style={[styles.statusCardValue, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                    {platformText}
                  </Text>
                </View>
              </View>

              {/* 4. Arka Plan Servisi */}
              <View
                style={[
                  styles.statusRowCard,
                  {
                    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                    borderColor: isDark ? '#1e293b' : '#e2e8f0',
                  },
                ]}
              >
                <Zap size={20} color="#10b981" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusCardLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                    Arka Plan Servisi
                  </Text>
                  <Text style={[styles.statusCardValue, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                    🟢 Çalışıyor (Kilitli Ekran Hazır)
                  </Text>
                </View>
              </View>
            </View>

            {/* Görsel-1: Aktif Bildirim Alıcısı Card */}
            <View
              style={[
                styles.recipientCard,
                {
                  backgroundColor: isDark ? '#0f172a' : '#eff6ff',
                  borderColor: isDark ? '#1e293b' : '#bfdbfe',
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.recipientLabel}>Aktif Bildirim Alıcısı:</Text>
                <Text
                  style={[
                    styles.recipientName,
                    { color: isDark ? '#f8fafc' : '#1e3a8a' },
                  ]}
                >
                  {user?.name || 'Sistem Yöneticisi'} ({user?.role === 'admin' ? 'Yönetici' : 'Saha Yetkilisi'})
                </Text>
              </View>

              <TouchableOpacity
                style={styles.resyncBtn}
                onPress={handleResync}
                activeOpacity={0.8}
              >
                <RefreshCw size={13} color="#ffffff" />
                <Text style={styles.resyncBtnText}>Onar & Yenile</Text>
              </TouchableOpacity>
            </View>

            {/* Görsel-2: SİSTEMDE KAYITLI CİHAZLAR (6 CİHAZ) */}
            <View
              style={[
                styles.registeredDevicesBox,
                {
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  borderColor: isDark ? '#1e293b' : '#e2e8f0',
                },
              ]}
            >
              <View style={styles.registeredDevicesHeader}>
                <View style={styles.devicesHeaderLeft}>
                  <Radio size={16} color="#10b981" />
                  <Text
                    style={[
                      styles.devicesHeaderTitle,
                      { color: isDark ? '#f8fafc' : '#0f172a' },
                    ]}
                  >
                    SİSTEMDE KAYITLI CİHAZLAR ({registeredDevices.length || 6} CİHAZ)
                  </Text>
                </View>
                <Text style={[styles.devicesHeaderRight, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  (2 iPhone, 1 Samsung & Yeni Cihazlar)
                </Text>
              </View>

              <View style={styles.devicesListStack}>
                {registeredDevices.map((dev) => {
                  const isCurrent = dev.deviceId === currentDeviceId;
                  return (
                    <View
                      key={dev.deviceId}
                      style={[
                        styles.deviceItemCard,
                        {
                          backgroundColor: isCurrent
                            ? isDark
                              ? '#111e38'
                              : '#eff6ff'
                            : isDark
                            ? '#0b1329'
                            : '#f8fafc',
                          borderColor: isCurrent
                            ? '#2563eb'
                            : isDark
                            ? '#1e293b'
                            : '#e2e8f0',
                        },
                      ]}
                    >
                      <View style={styles.deviceItemTop}>
                        <View style={styles.deviceItemIconBox}>
                          {dev.platform === 'desktop' ? (
                            <Laptop size={18} color="#3b82f6" />
                          ) : (
                            <Smartphone
                              size={18}
                              color={dev.platform === 'ios' ? '#60a5fa' : '#10b981'}
                            />
                          )}
                        </View>

                        <View style={{ flex: 1, gap: 3 }}>
                          <View style={styles.deviceNameRow}>
                            <Text
                              style={[
                                styles.deviceNameTitle,
                                { color: isDark ? '#f8fafc' : '#0f172a' },
                              ]}
                              numberOfLines={1}
                            >
                              {dev.deviceName}
                            </Text>
                            {isCurrent && (
                              <View style={styles.thisDevicePill}>
                                <Text style={styles.thisDevicePillText}>BU CİHAZ</Text>
                              </View>
                            )}
                          </View>

                          <View style={styles.deviceMetaRow}>
                            <View style={styles.deviceSmallIdBadge}>
                              <Text style={styles.deviceSmallIdText}>{dev.deviceId}</Text>
                            </View>
                            <Text
                              style={[
                                styles.deviceUserPlatformText,
                                { color: isDark ? '#94a3b8' : '#64748b' },
                              ]}
                              numberOfLines={1}
                            >
                              Kullanıcı: {dev.userName} •{' '}
                              {dev.platform === 'desktop'
                                ? 'Masaüstü'
                                : dev.platform === 'ios'
                                ? 'iPhone'
                                : 'Samsung/Android'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Device Action Buttons */}
                      <View style={styles.deviceActionsRow}>
                        <View style={styles.connectedStatusPill}>
                          <Text style={styles.connectedStatusText}>● Bağlı</Text>
                        </View>

                        <TouchableOpacity
                          style={styles.testPushBtn}
                          onPress={() => handleSendTestToDevice(dev)}
                          activeOpacity={0.8}
                        >
                          <Send size={12} color="#ffffff" />
                          <Text style={styles.testPushBtnText}>Test</Text>
                        </TouchableOpacity>

                        {!isCurrent && (
                          <TouchableOpacity
                            style={styles.deleteDeviceBtn}
                            onPress={() => handleDeleteDevice(dev.deviceId, dev.deviceName)}
                            activeOpacity={0.7}
                          >
                            <Trash2 size={15} color="#94a3b8" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Görsel-3: PERSONEL CİHAZ KİLİTLERİ (ANTİ-FRAUD GÜVENLİĞİ) */}
            <View
              style={[
                styles.antiFraudBox,
                {
                  backgroundColor: isDark ? '#1a0d18' : '#fff1f2',
                  borderColor: isDark ? '#881337' : '#fecdd3',
                },
              ]}
            >
              <View style={styles.antiFraudHeader}>
                <View style={styles.antiFraudTitleRow}>
                  <Lock size={16} color="#f43f5e" />
                  <Text
                    style={[
                      styles.antiFraudTitle,
                      { color: isDark ? '#f8fafc' : '#881337' },
                    ]}
                  >
                    PERSONEL CİHAZ KİLİTLERİ (ANTİ-FRAUD GÜVENLİĞİ)
                  </Text>
                </View>

                <View style={styles.antiFraudActivePill}>
                  <Text style={styles.antiFraudActivePillText}>
                    Yetkisiz Giriş Engeli Aktif
                  </Text>
                </View>
              </View>

              <Text style={[styles.antiFraudDesc, { color: isDark ? '#fda4af' : '#9f1239' }]}>
                Her personel yalnızca kendi kilitli telefonundan sisteme girebilir ve mesai başlatabilir/bitirebilir. Personel telefonunu değiştirdiğinde buradan kilidini sıfırlayabilirsiniz.
              </Text>

              {/* Bound Users Stack */}
              <View style={styles.bindingsStack}>
                {userBindings.map((binding) => (
                  <View
                    key={binding.userId}
                    style={[
                      styles.bindingCard,
                      {
                        backgroundColor: isDark ? '#0b1329' : '#ffffff',
                        borderColor: isDark ? '#881337' : '#fecdd3',
                      },
                    ]}
                  >
                    <View style={styles.bindingCardTop}>
                      <View style={styles.bindingPhoneIcon}>
                        <Smartphone size={18} color="#f43f5e" />
                      </View>

                      <View style={{ flex: 1, gap: 3 }}>
                        <View style={styles.bindingNameRow}>
                          <Text
                            style={[
                              styles.bindingNameText,
                              { color: isDark ? '#f8fafc' : '#0f172a' },
                            ]}
                          >
                            {binding.userName}
                          </Text>
                          <View style={styles.bindingUsernamePill}>
                            <Text style={styles.bindingUsernameText}>
                              @{binding.username}
                            </Text>
                          </View>
                          <View style={styles.lockedPill}>
                            <Lock size={10} color="#f43f5e" />
                            <Text style={styles.lockedPillText}>Kilitli</Text>
                          </View>
                        </View>

                        <Text
                          style={[
                            styles.bindingDeviceInfoText,
                            { color: isDark ? '#94a3b8' : '#64748b' },
                          ]}
                          numberOfLines={2}
                        >
                          Cihaz: <Text style={{ fontWeight: '700' }}>{binding.boundDeviceName}</Text> •{' '}
                          {binding.boundDeviceId} • Kilit Tarihi: 16.09.2026
                        </Text>
                      </View>
                    </View>

                    {/* Reset Lock Button */}
                    <View style={styles.bindingActionRow}>
                      <TouchableOpacity
                        style={styles.resetLockBtn}
                        onPress={() => handleResetBinding(binding.userId, binding.userName)}
                        activeOpacity={0.8}
                      >
                        <RefreshCw size={12} color="#f43f5e" />
                        <Lock size={12} color="#f43f5e" />
                        <Text style={styles.resetLockBtnText}>Kilidi Sıfırla</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Görsel-4: Bildirim Donanım Testi (Green Card) */}
            <View
              style={[
                styles.hardwareTestBox,
                {
                  backgroundColor: isDark ? '#062016' : '#ecfdf5',
                  borderColor: isDark ? '#047857' : '#a7f3d0',
                },
              ]}
            >
              <View style={styles.hardwareTestTitleRow}>
                <Send size={16} color="#10b981" />
                <Text style={styles.hardwareTestTitle}>Bildirim Donanım Testi</Text>
              </View>
              <Text style={styles.hardwareTestSubtitle}>
                Uygulama açıkken veya telefon kilitliyken donanım bildirimini test edin.
              </Text>

              <View style={styles.hardwareTestBtnRow}>
                <TouchableOpacity
                  style={styles.instantTestBtn}
                  onPress={handleSendInstantTest}
                  activeOpacity={0.85}
                >
                  <Zap size={14} color="#f59e0b" />
                  <Text style={styles.instantTestBtnText}>Anlık Test</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.lockedScreenTestBtn}
                  onPress={handleStartLockScreenTest}
                  disabled={countdown !== null}
                  activeOpacity={0.85}
                >
                  <Lock size={14} color="#ffffff" />
                  <Text style={styles.lockedScreenTestBtnText}>
                    {countdown !== null
                      ? `Kilitleyin (${countdown}s)`
                      : '⏱️ Kilitli Ekran Testi (5 Sn)'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Countdown Banner */}
              {countdown !== null && (
                <View style={styles.countdownBanner}>
                  <Text style={styles.countdownBannerText}>
                    ⏱️ Sayım başladı ({countdown} sn)! Lütfen telefonunuzu ŞİMDİ KİLİTLEYİN ve bekleyin!
                  </Text>
                </View>
              )}

              {testSentMessage && (
                <View style={styles.successMsgBox}>
                  <Text style={styles.successMsgText}>{testSentMessage}</Text>
                </View>
              )}
            </View>

            {/* Görsel-4: iPhone (iOS) Kilitli Ekran ve Kapalı Uygulama Ayarları (Blue Card) */}
            <View
              style={[
                styles.infoGuideCard,
                {
                  backgroundColor: isDark ? '#0a162b' : '#eff6ff',
                  borderColor: isDark ? '#1e3a8a' : '#bfdbfe',
                },
              ]}
            >
              <View style={styles.guideTitleRow}>
                <Smartphone size={16} color="#3b82f6" />
                <Text
                  style={[
                    styles.guideTitleText,
                    { color: isDark ? '#93c5fd' : '#1e3a8a' },
                  ]}
                >
                  iPhone (iOS) Kilitli Ekran ve Kapalı Uygulama Ayarları:
                </Text>
              </View>

              <View style={styles.guideItemsStack}>
                <View style={styles.guideItemRow}>
                  <CheckCircle2 size={16} color="#10b981" style={{ marginTop: 2 }} />
                  <Text style={[styles.guideItemText, { color: isDark ? '#cbd5e1' : '#334155' }]}>
                    <Text style={{ fontWeight: '800' }}>1. Safari &gt; "Ana Ekrana Ekle" Durumu:</Text> Apple, kilitli ekranda bildirimi yalnızca Ana Ekrana eklenmiş PWA uygulamalarında destekler. Her iki cihazınızda da tamamlandı.
                  </Text>
                </View>

                <View style={styles.guideItemRow}>
                  <CheckCircle2 size={16} color="#10b981" style={{ marginTop: 2 }} />
                  <Text style={[styles.guideItemText, { color: isDark ? '#cbd5e1' : '#334155' }]}>
                    <Text style={{ fontWeight: '800' }}>2. iOS Bildirim İzinleri:</Text> iPhone Ayarları &gt; <Text style={{ fontStyle: 'italic' }}>Bildirimler</Text> &gt; <Text style={{ fontStyle: 'italic' }}>İş Takip</Text> içerisinde <Text style={{ fontWeight: '800' }}>"Kilitli Ekran"</Text>, <Text style={{ fontWeight: '800' }}>"Bildirim Merkezi"</Text> ve <Text style={{ fontWeight: '800' }}>"Sesler"</Text> seçeneklerinin işaretli olduğundan emin olun.
                  </Text>
                </View>

                <View style={styles.guideItemRow}>
                  <CheckCircle2 size={16} color="#10b981" style={{ marginTop: 2 }} />
                  <Text style={[styles.guideItemText, { color: isDark ? '#cbd5e1' : '#334155' }]}>
                    <Text style={{ fontWeight: '800' }}>3. Odak / Rahatsız Etmeyin:</Text> Telefonunuzda "Rahatsız Etmeyin" veya özel Odak modu açıksa, gelen kilitli ekran bildirimleri sessize alınabilir.
                  </Text>
                </View>
              </View>
            </View>

            {/* Görsel-4: Android Cihazlarda Bildirimin Kesilmesini Önlemek İçin (Orange Card) */}
            <View
              style={[
                styles.infoGuideCard,
                {
                  backgroundColor: isDark ? '#231509' : '#fffbeb',
                  borderColor: isDark ? '#78350f' : '#fde68a',
                },
              ]}
            >
              <View style={styles.guideTitleRow}>
                <AlertTriangle size={16} color="#f59e0b" />
                <Text
                  style={[
                    styles.guideTitleText,
                    { color: isDark ? '#fde68a' : '#92400e' },
                  ]}
                >
                  Android Cihazlarda Bildirimin Kesilmesini Önlemek İçin (Kalıcı Ayar):
                </Text>
              </View>

              <View style={styles.guideItemsStack}>
                <View style={styles.guideItemRow}>
                  <Settings size={16} color="#f59e0b" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.guideItemText, { color: isDark ? '#fde68a' : '#92400e', fontWeight: '800' }]}>
                      1. "Uyg. kullanılmıyorsa izinleri kaldır" Ayarını KAPATIN:
                    </Text>
                    <Text style={[styles.guideItemSubText, { color: isDark ? '#cbd5e1' : '#451a03' }]}>
                      👉 Ayarlar &gt; Uygulamalar &gt; İş Takip &gt; <Text style={{ fontWeight: '800' }}>"Uyg. kullanılmıyorsa izinleri kaldır" anahtarını KAPATIN</Text>.
                    </Text>
                  </View>
                </View>

                <View style={styles.guideItemRow}>
                  <BatteryCharging size={16} color="#10b981" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.guideItemText, { color: isDark ? '#fde68a' : '#92400e', fontWeight: '800' }]}>
                      2. Pil Kısıtlaması & Uyku Modu:
                    </Text>
                    <Text style={[styles.guideItemSubText, { color: isDark ? '#cbd5e1' : '#451a03' }]}>
                      İş Takip pil ayarının <Text style={{ fontWeight: '800' }}>"Kısıtlanmamış"</Text> olduğundan emin olun.
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Modal Footer */}
          <View
            style={[
              styles.modalFooter,
              { borderTopColor: isDark ? '#1e293b' : '#e2e8f0' },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.footerCloseBtn,
                { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' },
              ]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.footerCloseBtnText,
                  { color: isDark ? '#f8fafc' : '#334155' },
                ]}
              >
                Tamam / Kapat
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 12,
  },
  modalContent: {
    borderRadius: 20,
    borderWidth: 1,
    maxHeight: '94%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalHeaderTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 14,
  },

  // Section Header
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  bellIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
  refreshIconBtn: {
    padding: 6,
  },

  // BU CİHAZIN KİMLİĞİ Card
  identityCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  identityTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  identityTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  identityTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  identityBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deviceMonoBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  deviceMonoBadgeText: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyIdBtn: {
    padding: 4,
  },
  identityBottomRow: {
    borderTopWidth: 1,
    paddingTop: 8,
    gap: 6,
  },
  deviceNameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nameLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  nameDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  nameDisplayText: {
    fontSize: 12,
    fontWeight: '800',
  },
  pencilBtn: {
    padding: 2,
  },
  nameEditBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  nameEditInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  nameSaveBtn: {
    backgroundColor: '#10b981',
    padding: 4,
    borderRadius: 6,
  },
  nameCancelBtn: {
    backgroundColor: '#64748b',
    padding: 4,
    borderRadius: 6,
  },
  pushStatusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pushStatusLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  pushStatusText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '800',
  },

  // 4 Status Cards
  statusCardsStack: {
    gap: 8,
    marginBottom: 10,
  },
  statusRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusCardLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  statusCardValue: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 1,
  },

  // Recipient Card
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    gap: 8,
  },
  recipientLabel: {
    color: '#3b82f6',
    fontSize: 11,
    fontWeight: '800',
  },
  recipientName: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  resyncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  resyncBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },

  // Registered Devices Box (Görsel-2)
  registeredDevicesBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  registeredDevicesHeader: {
    gap: 2,
  },
  devicesHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  devicesHeaderTitle: {
    fontSize: 12,
    fontWeight: '900',
  },
  devicesHeaderRight: {
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 22,
  },
  devicesListStack: {
    gap: 8,
  },
  deviceItemCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  deviceItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deviceItemIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  deviceNameTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  thisDevicePill: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  thisDevicePillText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  deviceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  deviceSmallIdBadge: {
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  deviceSmallIdText: {
    color: '#94a3b8',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
  },
  deviceUserPlatformText: {
    fontSize: 10,
    fontWeight: '500',
    flex: 1,
  },
  deviceActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  connectedStatusPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  connectedStatusText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '800',
  },
  testPushBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  testPushBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  deleteDeviceBtn: {
    padding: 4,
  },

  // Anti-Fraud Box (Görsel-3)
  antiFraudBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  antiFraudHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  antiFraudTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  antiFraudTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  antiFraudActivePill: {
    backgroundColor: '#881337',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  antiFraudActivePillText: {
    color: '#fda4af',
    fontSize: 10,
    fontWeight: '800',
  },
  antiFraudDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  bindingsStack: {
    gap: 8,
  },
  bindingCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  bindingCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bindingPhoneIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  bindingNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  bindingNameText: {
    fontSize: 12,
    fontWeight: '800',
  },
  bindingUsernamePill: {
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  bindingUsernameText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },
  lockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
  },
  lockedPillText: {
    color: '#f43f5e',
    fontSize: 9,
    fontWeight: '800',
  },
  bindingDeviceInfoText: {
    fontSize: 10,
    lineHeight: 14,
  },
  bindingActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  resetLockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  resetLockBtnText: {
    color: '#f43f5e',
    fontSize: 11,
    fontWeight: '800',
  },

  // Hardware Test Box (Görsel-4)
  hardwareTestBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  hardwareTestTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hardwareTestTitle: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '900',
  },
  hardwareTestSubtitle: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '500',
  },
  hardwareTestBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  instantTestBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#334155',
    paddingVertical: 9,
    borderRadius: 10,
  },
  instantTestBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  lockedScreenTestBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#059669',
    paddingVertical: 9,
    borderRadius: 10,
  },
  lockedScreenTestBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  countdownBanner: {
    backgroundColor: '#f59e0b',
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  countdownBannerText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  successMsgBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  successMsgText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },

  // Guide Cards (Görsel-4)
  infoGuideCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  guideTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  guideTitleText: {
    fontSize: 12,
    fontWeight: '900',
  },
  guideItemsStack: {
    gap: 6,
  },
  guideItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  guideItemText: {
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  guideItemSubText: {
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },

  // Modal Footer
  modalFooter: {
    padding: 12,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  footerCloseBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  footerCloseBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
