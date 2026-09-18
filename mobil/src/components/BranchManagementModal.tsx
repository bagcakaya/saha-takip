import React, { useState, useMemo, useEffect } from 'react';
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
} from 'react-native';
import {
  X,
  Store,
  MapPin,
  Trash2,
  Navigation,
  Compass,
  Check,
  Search,
  Phone,
  Users,
  Info,
  Building2,
  Plus,
  Edit2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react-native';
import { useStorage } from '../context/StorageContext';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { LocationService } from '../services/locationService';
import { MapPickerModal, MapPickerLocation } from './MapPickerModal';

interface BranchManagementModalProps {
  visible: boolean;
  onClose: () => void;
}

export const BranchManagementModal: React.FC<BranchManagementModalProps> = ({
  visible,
  onClose,
}) => {
  const {
    branches,
    headquarters,
    addBranch,
    deleteBranch,
    addHeadquarter,
    deleteHeadquarter,
    updateBranchHeadquarter,
    cariler,
  } = useStorage();
  const { users, user: currentUser } = useAuth();
  const { isDark } = useAppTheme();

  // Tabs: 'list' | 'add' | 'hq'
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'hq'>('list');
  const [submitting, setSubmitting] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Filter for branch list
  const [selectedHqFilter, setSelectedHqFilter] = useState<string>('all');

  // Change HQ inline modal
  const [changeHqBranchId, setChangeHqBranchId] = useState<string | null>(null);

  // Form states for adding branch
  const [selectedHqId, setSelectedHqId] = useState<string>('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [radiusMeters, setRadiusMeters] = useState(20);
  const [phone, setPhone] = useState('');
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);

  // Form states for adding headquarter
  const [submittingHq, setSubmittingHq] = useState(false);
  const [hqName, setHqName] = useState('');
  const [hqContactPerson, setHqContactPerson] = useState('');
  const [hqPhone, setHqPhone] = useState('');
  const [hqAddress, setHqAddress] = useState('');
  const [hqTaxNumber, setHqTaxNumber] = useState('');
  const [showCariPicker, setShowCariPicker] = useState(false);
  const [cariSearch, setCariSearch] = useState('');

  // Synchronize default selectedHqId when headquarters change
  useEffect(() => {
    if (headquarters && headquarters.length > 0) {
      if (!selectedHqId || !headquarters.some((h) => h.id === selectedHqId)) {
        setSelectedHqId(headquarters[0].id);
      }
    }
  }, [headquarters, selectedHqId]);

  const companyCode = (currentUser?.companyCode || 'POLATLAR').toUpperCase();
  const companyUsers = users.filter(
    (u) => (u.companyCode || 'POLATLAR').toUpperCase() === companyCode
  );

  // Counts of branches per headquarter
  const hqBranchCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    branches.forEach((b) => {
      const key = b.headquarterId || 'unassigned';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [branches]);

  // Filtered branches for 'list' tab
  const filteredBranches = useMemo(() => {
    if (selectedHqFilter === 'all') return branches;
    return branches.filter((b) => b.headquarterId === selectedHqFilter);
  }, [branches, selectedHqFilter]);

  // Filtered cariler for HQ autocomplete
  const filteredCariler = useMemo(() => {
    if (!cariSearch.trim()) return cariler || [];
    const lower = cariSearch.toLowerCase();
    return (cariler || []).filter((c) => c.toLowerCase().includes(lower));
  }, [cariler, cariSearch]);

  const handleGetCurrentLocation = async () => {
    setGettingLocation(true);
    const loc = await LocationService.getCurrentPosition();
    setGettingLocation(false);

    if (loc) {
      setLatitude(loc.latitude.toFixed(6));
      setLongitude(loc.longitude.toFixed(6));
      if (!address.trim() && loc.address) {
        setAddress(loc.address);
      }
      Alert.alert('Konum Alındı', `Enlem: ${loc.latitude.toFixed(5)}, Boylam: ${loc.longitude.toFixed(5)}`);
    } else {
      Alert.alert('Konum Hatası', 'Cihaz konumu alınamadı. GPS izninizin açık olduğundan emin olun.');
    }
  };

  const handleOpenGoogleMaps = () => {
    setIsMapPickerOpen(true);
  };

  const handleSelectLocationFromMap = (loc: MapPickerLocation) => {
    setLatitude(loc.latitude.toFixed(6));
    setLongitude(loc.longitude.toFixed(6));
    if (loc.address) {
      setAddress(loc.address);
    }
  };

  const handleToggleUser = (userId: string) => {
    setAssignedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAllUsers = () => {
    if (assignedUserIds.length === companyUsers.length) {
      setAssignedUserIds([]);
    } else {
      setAssignedUserIds(companyUsers.map((u) => u.id));
    }
  };

  const handleAddBranch = async () => {
    if (!name.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen şube adını girin.');
      return;
    }
    const latNum = parseFloat(latitude);
    const lonNum = parseFloat(longitude);
    if (isNaN(latNum) || isNaN(lonNum)) {
      Alert.alert('Eksik Bilgi', 'Lütfen geçerli Enlem ve Boylam koordinatları girin veya GPS butonuna basın.');
      return;
    }

    const targetHq = headquarters.find((h) => h.id === selectedHqId) || headquarters[0];

    setSubmitting(true);
    const res = await addBranch({
      name: name.trim(),
      headquarterId: targetHq?.id,
      headquarterName: targetHq?.name || 'Merkez Firma',
      address: address.trim() || 'Merkez Adres',
      latitude: latNum,
      longitude: lonNum,
      radiusMeters,
      phone: phone.trim() || undefined,
    });
    setSubmitting(false);

    if (res.success) {
      Alert.alert('Başarılı', `"${name}" şubesi "${targetHq?.name || 'Merkez'}" altına başarıyla kaydedildi.`);
      setName('');
      setAddress('');
      setLatitude('');
      setLongitude('');
      setPhone('');
      setAssignedUserIds([]);
      setActiveTab('list');
    } else {
      Alert.alert('Hata', res.message || 'Şube eklenemedi.');
    }
  };

  const handleDelete = (id: string, branchName: string) => {
    Alert.alert('Şubeyi Sil', `"${branchName}" şubesini silmek istediğinize emin misiniz?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await deleteBranch(id);
        },
      },
    ]);
  };

  const handleAddHeadquarter = async () => {
    if (!hqName.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen Merkez Firma adını girin.');
      return;
    }
    setSubmittingHq(true);
    const res = await addHeadquarter({
      name: hqName.trim(),
      contactPerson: hqContactPerson.trim() || undefined,
      phone: hqPhone.trim() || undefined,
      address: hqAddress.trim() || undefined,
      taxNumber: hqTaxNumber.trim() || undefined,
    });
    setSubmittingHq(false);

    if (res.success) {
      Alert.alert('Başarılı', res.message);
      if (res.headquarter) {
        setSelectedHqId(res.headquarter.id);
      }
      setHqName('');
      setHqContactPerson('');
      setHqPhone('');
      setHqAddress('');
      setHqTaxNumber('');
      setShowCariPicker(false);
      setCariSearch('');
    } else {
      Alert.alert('Hata', res.message || 'Merkez firma eklenemedi.');
    }
  };

  const handleDeleteHeadquarter = (id: string, hqTitle: string) => {
    Alert.alert(
      'Merkez Firmayı Sil',
      `"${hqTitle}" merkez firmasını silmek istediğinize emin misiniz? Bu firmaya bağlı şubeler ana merkeze aktarılacaktır.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteHeadquarter(id);
            if (!res.success) {
              Alert.alert('Uyarı', res.message);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: isDark ? '#0b1329' : '#ffffff' },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIconCircle, { backgroundColor: '#2563eb' }]}>
                <Building2 size={20} color="#ffffff" />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                  Şube & Firma Yönetimi
                </Text>
                <Text style={styles.headerSubtitle}>
                  {headquarters.length} Merkez Firma • {branches.length} Aktif Şube
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color={isDark ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
          </View>

          {/* Segmented Tabs (3 Tabs) */}
          <View style={[styles.tabsRow, { backgroundColor: isDark ? '#020617' : '#f1f5f9' }]}>
            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'list' && [
                  styles.tabBtnActive,
                  { backgroundColor: isDark ? '#1e293b' : '#ffffff' },
                ],
              ]}
              onPress={() => setActiveTab('list')}
            >
              <Store size={14} color={activeTab === 'list' ? '#2563eb' : '#94a3b8'} />
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'list' ? (isDark ? '#ffffff' : '#0f172a') : '#94a3b8' },
                ]}
                numberOfLines={1}
              >
                Mevcut Şubeler ({branches.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'add' && [
                  styles.tabBtnActive,
                  { backgroundColor: isDark ? '#1e293b' : '#ffffff' },
                ],
              ]}
              onPress={() => setActiveTab('add')}
            >
              <Plus size={14} color={activeTab === 'add' ? '#2563eb' : '#94a3b8'} />
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'add' ? (isDark ? '#ffffff' : '#0f172a') : '#94a3b8' },
                ]}
                numberOfLines={1}
              >
                + Şube Ekle
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'hq' && [
                  styles.tabBtnActive,
                  { backgroundColor: isDark ? '#1e293b' : '#ffffff' },
                ],
              ]}
              onPress={() => setActiveTab('hq')}
            >
              <Building2 size={14} color={activeTab === 'hq' ? '#2563eb' : '#94a3b8'} />
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'hq' ? (isDark ? '#ffffff' : '#0f172a') : '#94a3b8' },
                ]}
                numberOfLines={1}
              >
                Merkez Firmalar ({headquarters.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView contentContainerStyle={styles.bodyScroll} showsVerticalScrollIndicator={false}>
            {/* TAB 1: MEVCUT ŞUBELER LİSTESİ */}
            {activeTab === 'list' && (
              <View style={styles.listContainer}>
                {/* Merkez Firma Filtre Çipleri */}
                {headquarters.length > 1 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterChipsRow}
                  >
                    <TouchableOpacity
                      style={[
                        styles.filterChip,
                        selectedHqFilter === 'all' && styles.filterChipActive,
                        {
                          backgroundColor: selectedHqFilter === 'all'
                            ? '#2563eb'
                            : (isDark ? '#0c152e' : '#e2e8f0'),
                        },
                      ]}
                      onPress={() => setSelectedHqFilter('all')}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          { color: selectedHqFilter === 'all' ? '#ffffff' : (isDark ? '#94a3b8' : '#475569') },
                        ]}
                      >
                        Tümü ({branches.length})
                      </Text>
                    </TouchableOpacity>

                    {headquarters.map((hq) => {
                      const count = hqBranchCounts[hq.id] || 0;
                      const isSelected = selectedHqFilter === hq.id;
                      return (
                        <TouchableOpacity
                          key={hq.id}
                          style={[
                            styles.filterChip,
                            isSelected && styles.filterChipActive,
                            {
                              backgroundColor: isSelected
                                ? '#2563eb'
                                : (isDark ? '#0c152e' : '#e2e8f0'),
                            },
                          ]}
                          onPress={() => setSelectedHqFilter(hq.id)}
                        >
                          <Building2 size={11} color={isSelected ? '#ffffff' : '#60a5fa'} />
                          <Text
                            style={[
                              styles.filterChipText,
                              { color: isSelected ? '#ffffff' : (isDark ? '#94a3b8' : '#475569') },
                            ]}
                          >
                            {hq.name} ({count})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                {filteredBranches.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Store size={40} color="#94a3b8" />
                    <Text style={styles.emptyTitle}>
                      {selectedHqFilter !== 'all' ? 'Bu Merkez Firmaya Bağlı Şube Yok' : 'Henüz Şube Eklenmemiş'}
                    </Text>
                    <Text style={styles.emptySubtitle}>
                      {selectedHqFilter !== 'all'
                        ? 'Yukarıdaki "+ Şube Ekle" sekmesinden bu firmaya yeni şube ekleyebilirsiniz.'
                        : 'Personel mesai kontrolü için "+ Şube Ekle" sekmesinden şube oluşturabilirsiniz.'}
                    </Text>
                  </View>
                ) : (
                  filteredBranches.map((b) => (
                    <View
                      key={b.id}
                      style={[
                        styles.branchCard,
                        {
                          backgroundColor: isDark ? '#0c152e' : '#f8fafc',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                        },
                      ]}
                    >
                      <View style={styles.branchCardTop}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <Text
                              style={[
                                styles.branchName,
                                { color: isDark ? '#ffffff' : '#0f172a' },
                              ]}
                            >
                              {b.name}
                            </Text>

                            {/* Merkez Firma Rozeti & Değiştirme Butonu */}
                            <TouchableOpacity
                              style={[
                                styles.hqBranchBadge,
                                {
                                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
                                  borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#bfdbfe',
                                },
                              ]}
                              onPress={() => setChangeHqBranchId(b.id)}
                              activeOpacity={0.7}
                            >
                              <Building2 size={11} color="#3b82f6" />
                              <Text style={styles.hqBranchBadgeText}>
                                {b.headquarterName || 'Merkez Firma Ata'}
                              </Text>
                              <Edit2 size={10} color="#60a5fa" style={{ marginLeft: 2 }} />
                            </TouchableOpacity>
                          </View>

                          <View style={styles.addressRow}>
                            <MapPin size={13} color="#94a3b8" />
                            <Text style={styles.addressText} numberOfLines={2}>
                              {b.address}
                            </Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => handleDelete(b.id, b.name)}
                        >
                          <Trash2 size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.branchMetaRow}>
                        <View style={styles.coordBadge}>
                          <Navigation size={11} color="#60a5fa" />
                          <Text style={styles.coordText}>
                            {b.latitude ? b.latitude.toFixed(4) : '0'}, {b.longitude ? b.longitude.toFixed(4) : '0'}
                          </Text>
                        </View>

                        <View style={styles.radiusBadge}>
                          <Text style={styles.radiusText}>{b.radiusMeters || 20}m Alan</Text>
                        </View>

                        {b.assignedUserIds && b.assignedUserIds.length > 0 && (
                          <View style={styles.staffBadge}>
                            <Users size={11} color="#a855f7" />
                            <Text style={styles.staffBadgeText}>
                              {b.assignedUserIds.length} Personel
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* TAB 2: YENİ ŞUBE EKLE */}
            {activeTab === 'add' && (
              <View style={styles.formContainer}>
                {/* 0. BAĞLI OLDUĞU MERKEZ FİRMA * */}
                <View style={styles.formGroup}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.label, { color: isDark ? '#cbd5e1' : '#334155' }]}>
                      BAĞLI OLDUĞU MERKEZ FİRMA *
                    </Text>
                    <TouchableOpacity
                      onPress={() => setActiveTab('hq')}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <Plus size={12} color="#3b82f6" />
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#3b82f6' }}>
                        + Yeni Firma Tanımla
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                  >
                    {headquarters.map((hq) => {
                      const isSelected = selectedHqId === hq.id;
                      return (
                        <TouchableOpacity
                          key={hq.id}
                          style={[
                            styles.hqSelectChip,
                            {
                              backgroundColor: isSelected
                                ? '#2563eb'
                                : (isDark ? '#0c152e' : '#f1f5f9'),
                              borderColor: isSelected
                                ? '#3b82f6'
                                : (isDark ? '#1e293b' : '#cbd5e1'),
                            },
                          ]}
                          onPress={() => setSelectedHqId(hq.id)}
                        >
                          <Building2 size={13} color={isSelected ? '#ffffff' : '#60a5fa'} />
                          <Text
                            style={[
                              styles.hqSelectChipText,
                              { color: isSelected ? '#ffffff' : (isDark ? '#e2e8f0' : '#1e293b') },
                            ]}
                          >
                            {hq.name}
                          </Text>
                          {isSelected && <Check size={13} color="#ffffff" />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* 1. ŞUBE ADI * */}
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: isDark ? '#cbd5e1' : '#334155' }]}>
                    ŞUBE ADI *
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: isDark ? '#0c152e' : '#f8fafc',
                        borderColor: isDark ? '#1e293b' : '#cbd5e1',
                        color: isDark ? '#ffffff' : '#0f172a',
                      },
                    ]}
                    value={name}
                    onChangeText={setName}
                    placeholder="Örn: GOLD CITY, Kadıköy Şubesi, Merkez..."
                    placeholderTextColor="#64748b"
                  />
                </View>

                {/* 2. ADRES & HARİTADAN SEÇİM */}
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: isDark ? '#cbd5e1' : '#334155' }]}>
                    AÇIK ADRES
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: isDark ? '#0c152e' : '#f8fafc',
                        borderColor: isDark ? '#1e293b' : '#cbd5e1',
                        color: isDark ? '#ffffff' : '#0f172a',
                      },
                    ]}
                    value={address}
                    onChangeText={setAddress}
                    placeholder="Mahalle, cadde, sokak veya bina bilgisi..."
                    placeholderTextColor="#64748b"
                  />

                  {/* Google Haritalar Aç Butonu */}
                  <View style={styles.mapActionRow}>
                    <TouchableOpacity
                      style={styles.mapBtnBlue}
                      onPress={handleOpenGoogleMaps}
                      activeOpacity={0.8}
                    >
                      <MapPin size={16} color="#60a5fa" />
                      <Text style={styles.mapBtnBlueText}>
                        Harita Aç & Konumu Pinle
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.mapBtnGreen}
                      onPress={handleGetCurrentLocation}
                      disabled={gettingLocation}
                      activeOpacity={0.8}
                    >
                      {gettingLocation ? (
                        <ActivityIndicator size="small" color="#10b981" />
                      ) : (
                        <>
                          <Compass size={16} color="#10b981" />
                          <Text style={styles.mapBtnGreenText}>
                            Şu Anki Cihaz Konumumu Al (GPS)
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 3. KOORDİNATLAR & MESAI ÇEMBERİ KUTUSU */}
                <View
                  style={[
                    styles.coordsBox,
                    {
                      backgroundColor: isDark ? '#080d1a' : '#f0f9ff',
                      borderColor: isDark ? '#1e3a8a' : '#bfdbfe',
                    },
                  ]}
                >
                  <View style={styles.coordsHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Navigation size={15} color="#3b82f6" />
                      <Text style={styles.coordsBoxTitle}>Koordinat & Mesai Çemberi</Text>
                    </View>
                    <View style={styles.mesaiPill}>
                      <Text style={styles.mesaiPillText}>{radiusMeters}m Mesai Alanı</Text>
                    </View>
                  </View>

                  <View style={styles.latLonRow}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.latLonLabel}>ENLEM (LATITUDE)</Text>
                      <TextInput
                        style={[
                          styles.latLonInput,
                          {
                            backgroundColor: isDark ? '#0c152e' : '#ffffff',
                            borderColor: isDark ? '#1e293b' : '#cbd5e1',
                            color: isDark ? '#ffffff' : '#0f172a',
                          },
                        ]}
                        value={latitude}
                        onChangeText={setLatitude}
                        placeholder="39.875600"
                        placeholderTextColor="#64748b"
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.latLonLabel}>BOYLAM (LONGITUDE)</Text>
                      <TextInput
                        style={[
                          styles.latLonInput,
                          {
                            backgroundColor: isDark ? '#0c152e' : '#ffffff',
                            borderColor: isDark ? '#1e293b' : '#cbd5e1',
                            color: isDark ? '#ffffff' : '#0f172a',
                          },
                        ]}
                        value={longitude}
                        onChangeText={setLongitude}
                        placeholder="41.245600"
                        placeholderTextColor="#64748b"
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <View style={styles.infoNoteRow}>
                    <Info size={13} color="#94a3b8" style={{ marginTop: 2 }} />
                    <Text style={styles.infoNoteText}>
                      Personel mesai girişini yalnızca bu koordinatın {radiusMeters} metre çevresindeyken yapabilir.
                    </Text>
                  </View>
                </View>

                {/* 4. ŞUBE TELEFONU */}
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: isDark ? '#cbd5e1' : '#334155' }]}>
                    ŞUBE TELEFONU (OPSİYONEL)
                  </Text>
                  <View
                    style={[
                      styles.phoneInputBox,
                      {
                        backgroundColor: isDark ? '#0c152e' : '#f8fafc',
                        borderColor: isDark ? '#1e293b' : '#cbd5e1',
                      },
                    ]}
                  >
                    <Phone size={15} color="#94a3b8" />
                    <TextInput
                      style={[styles.phoneInput, { color: isDark ? '#ffffff' : '#0f172a' }]}
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="0442 234 56 78"
                      placeholderTextColor="#64748b"
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                {/* 5. BU ŞUBEYE ATANACAK PERSONELLER */}
                <View style={styles.formGroup}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.label, { color: isDark ? '#cbd5e1' : '#334155' }]}>
                      BU ŞUBEYE ATANACAK PERSONELLER ({assignedUserIds.length})
                    </Text>
                    <TouchableOpacity onPress={handleSelectAllUsers}>
                      <Text style={styles.selectAllText}>
                        {assignedUserIds.length === companyUsers.length ? 'Seçimi Kaldır' : 'Tümünü Seç'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View
                    style={[
                      styles.staffListContainer,
                      {
                        backgroundColor: isDark ? '#080d1a' : '#f8fafc',
                        borderColor: isDark ? '#1e293b' : '#e2e8f0',
                      },
                    ]}
                  >
                    {companyUsers.map((u) => {
                      const isSelected = assignedUserIds.includes(u.id);
                      const initial = (u.name || u.username || 'P').charAt(0).toUpperCase();
                      return (
                        <TouchableOpacity
                          key={u.id}
                          style={[
                            styles.staffRow,
                            { borderBottomColor: isDark ? '#1e293b' : '#e2e8f0' },
                          ]}
                          onPress={() => handleToggleUser(u.id)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.initialCircle}>
                            <Text style={styles.initialText}>{initial}</Text>
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text style={[styles.staffNameText, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                              {u.name}
                            </Text>
                            <Text style={styles.staffHandleText}>
                              @{u.username} • {u.role === 'admin' ? 'Yönetici' : 'Saha Yetkilisi'}
                            </Text>
                          </View>

                          <View style={[styles.selectCircle, isSelected && styles.selectCircleActive]}>
                            {isSelected && <Check size={12} color="#ffffff" />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                  onPress={handleAddBranch}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      <Store size={18} color="#ffffff" />
                      <Text style={styles.submitBtnText}>Şubeyi Kaydet</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* TAB 3: MERKEZ FİRMALAR YÖNETİMİ */}
            {activeTab === 'hq' && (
              <View style={styles.formContainer}>
                {/* Yeni Merkez Firma Ekle Form Kartı */}
                <View
                  style={[
                    styles.hqFormCard,
                    {
                      backgroundColor: isDark ? '#0c152e' : '#f8fafc',
                      borderColor: isDark ? '#1e293b' : '#e2e8f0',
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Building2 size={16} color="#3b82f6" />
                    <Text style={[styles.hqFormTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                      Yeni Merkez Firma Tanımla
                    </Text>
                  </View>
                  <Text style={[styles.subHintText, { marginBottom: 10 }]}>
                    Tanımladığınız merkez firmalar altına dilediğiniz kadar şube atayabilirsiniz.
                  </Text>

                  {/* Firma Adı */}
                  <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: isDark ? '#cbd5e1' : '#334155' }]}>
                      FİRMA ADI *
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: isDark ? '#080d1a' : '#ffffff',
                          borderColor: isDark ? '#1e293b' : '#cbd5e1',
                          color: isDark ? '#ffffff' : '#0f172a',
                        },
                      ]}
                      value={hqName}
                      onChangeText={setHqName}
                      placeholder="Örn: POLATLAR A.Ş., DEFACİO, LC WAIKIKI..."
                      placeholderTextColor="#64748b"
                    />
                  </View>

                  {/* Carilerden Hızlı Seçim (Opsiyonel) */}
                  {cariler && cariler.length > 0 && (
                    <View style={{ marginTop: 2 }}>
                      <TouchableOpacity
                        style={styles.cariPickerToggle}
                        onPress={() => setShowCariPicker(!showCariPicker)}
                      >
                        <Search size={13} color="#60a5fa" />
                        <Text style={styles.cariPickerToggleText}>
                          {showCariPicker ? 'Cariler Listesini Kapat' : 'Kayıtlı Carilerden Seç (Excel/Veritabanı)'}
                        </Text>
                        <ChevronDown size={14} color="#60a5fa" />
                      </TouchableOpacity>

                      {showCariPicker && (
                        <View
                          style={[
                            styles.cariPickerBox,
                            {
                              backgroundColor: isDark ? '#080d1a' : '#ffffff',
                              borderColor: isDark ? '#1e293b' : '#cbd5e1',
                            },
                          ]}
                        >
                          <TextInput
                            style={[
                              styles.cariSearchInput,
                              {
                                color: isDark ? '#ffffff' : '#0f172a',
                                borderBottomColor: isDark ? '#1e293b' : '#e2e8f0',
                              },
                            ]}
                            value={cariSearch}
                            onChangeText={setCariSearch}
                            placeholder="Cari firma adı ara..."
                            placeholderTextColor="#64748b"
                          />
                          <ScrollView style={{ maxHeight: 140 }} nestedScrollEnabled>
                            {filteredCariler.slice(0, 30).map((c, i) => (
                              <TouchableOpacity
                                key={i}
                                style={[
                                  styles.cariItemRow,
                                  { borderBottomColor: isDark ? '#1e293b' : '#f1f5f9' },
                                ]}
                                onPress={() => {
                                  setHqName(c);
                                  setShowCariPicker(false);
                                  setCariSearch('');
                                }}
                              >
                                <Text
                                  style={[
                                    styles.cariItemText,
                                    { color: isDark ? '#e2e8f0' : '#1e293b' },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {c}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Yetkili & Telefon satırı */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={[styles.label, { color: isDark ? '#cbd5e1' : '#334155' }]}>
                        YETKİLİ KİŞİ
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: isDark ? '#080d1a' : '#ffffff',
                            borderColor: isDark ? '#1e293b' : '#cbd5e1',
                            color: isDark ? '#ffffff' : '#0f172a',
                          },
                        ]}
                        value={hqContactPerson}
                        onChangeText={setHqContactPerson}
                        placeholder="Yetkili Adı"
                        placeholderTextColor="#64748b"
                      />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={[styles.label, { color: isDark ? '#cbd5e1' : '#334155' }]}>
                        TELEFON
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: isDark ? '#080d1a' : '#ffffff',
                            borderColor: isDark ? '#1e293b' : '#cbd5e1',
                            color: isDark ? '#ffffff' : '#0f172a',
                          },
                        ]}
                        value={hqPhone}
                        onChangeText={setHqPhone}
                        placeholder="05..."
                        placeholderTextColor="#64748b"
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>

                  {/* Kaydet Butonu */}
                  <TouchableOpacity
                    style={[styles.submitBtn, submittingHq && { opacity: 0.6 }]}
                    onPress={handleAddHeadquarter}
                    disabled={submittingHq}
                  >
                    {submittingHq ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <>
                        <Building2 size={16} color="#ffffff" />
                        <Text style={styles.submitBtnText}>Merkez Firmayı Kaydet</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Kayıtlı Merkez Firmalar Listesi */}
                <View style={styles.listContainer}>
                  <Text style={[styles.sectionHeader, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                    KAYITLI MERKEZ FİRMALAR ({headquarters.length})
                  </Text>

                  {headquarters.map((hq) => {
                    const count = hqBranchCounts[hq.id] || 0;
                    return (
                      <View
                        key={hq.id}
                        style={[
                          styles.hqCard,
                          {
                            backgroundColor: isDark ? '#0c152e' : '#f8fafc',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                          },
                        ]}
                      >
                        <View style={styles.hqCardTop}>
                          <View style={styles.hqCardIconCircle}>
                            <Building2 size={18} color="#3b82f6" />
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text style={[styles.hqCardName, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                              {hq.name}
                            </Text>
                            <View style={styles.hqBadgeRow}>
                              <View style={styles.hqCountPill}>
                                <Store size={11} color="#60a5fa" />
                                <Text style={styles.hqCountPillText}>{count} Bağlı Şube</Text>
                              </View>
                              {hq.contactPerson ? (
                                <Text style={styles.hqSubInfo}>Yetkili: {hq.contactPerson}</Text>
                              ) : null}
                            </View>
                          </View>

                          {headquarters.length > 1 && (
                            <TouchableOpacity
                              style={styles.deleteBtn}
                              onPress={() => handleDeleteHeadquarter(hq.id, hq.name)}
                            >
                              <Trash2 size={16} color="#ef4444" />
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Hızlı Buton: Bu firmaya şube ekle */}
                        <TouchableOpacity
                          style={styles.addBranchToHqBtn}
                          onPress={() => {
                            setSelectedHqId(hq.id);
                            setActiveTab('add');
                          }}
                        >
                          <Plus size={13} color="#2563eb" />
                          <Text style={styles.addBranchToHqBtnText}>Bu Firmaya Şube Ekle</Text>
                          <ChevronRight size={14} color="#2563eb" style={{ marginLeft: 'auto' }} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* MODAL: ŞUBEYE MERKEZ FİRMA ATA / DEĞİŞTİR */}
      <Modal
        visible={!!changeHqBranchId}
        transparent
        animationType="fade"
        onRequestClose={() => setChangeHqBranchId(null)}
      >
        <View style={styles.miniModalOverlay}>
          <View
            style={[
              styles.miniModalContent,
              { backgroundColor: isDark ? '#0b1329' : '#ffffff' },
            ]}
          >
            <View style={styles.miniModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Building2 size={18} color="#3b82f6" />
                <Text style={[styles.miniModalTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                  Merkez Firma Ata / Değiştir
                </Text>
              </View>
              <TouchableOpacity onPress={() => setChangeHqBranchId(null)}>
                <X size={18} color={isDark ? '#94a3b8' : '#64748b'} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.miniModalSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
              Bu şubeyi bağlamak istediğiniz Merkez Firmayı seçin:
            </Text>

            <ScrollView style={{ maxHeight: 260, marginVertical: 10 }}>
              {headquarters.map((hq) => {
                const targetBranch = branches.find((b) => b.id === changeHqBranchId);
                const isCurrent = targetBranch?.headquarterId === hq.id;
                return (
                  <TouchableOpacity
                    key={hq.id}
                    style={[
                      styles.miniHqItem,
                      {
                        backgroundColor: isCurrent
                          ? (isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff')
                          : (isDark ? '#080d1a' : '#f8fafc'),
                        borderColor: isCurrent ? '#2563eb' : (isDark ? '#1e293b' : '#e2e8f0'),
                      },
                    ]}
                    onPress={async () => {
                      if (changeHqBranchId) {
                        await updateBranchHeadquarter(changeHqBranchId, hq.id, hq.name);
                        setChangeHqBranchId(null);
                        Alert.alert('Başarılı', `Şube "${hq.name}" merkez firmasına atandı.`);
                      }
                    }}
                  >
                    <Building2 size={16} color={isCurrent ? '#2563eb' : '#94a3b8'} />
                    <Text
                      style={[
                        styles.miniHqItemText,
                        {
                          color: isCurrent ? '#2563eb' : (isDark ? '#ffffff' : '#0f172a'),
                          fontWeight: isCurrent ? '800' : '600',
                        },
                      ]}
                    >
                      {hq.name}
                    </Text>
                    {isCurrent && <Check size={16} color="#2563eb" style={{ marginLeft: 'auto' }} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MAP PICKER MODAL */}
      <MapPickerModal
        visible={isMapPickerOpen}
        onClose={() => setIsMapPickerOpen(false)}
        initialLatitude={latitude}
        initialLongitude={longitude}
        initialAddress={address}
        onSelectLocation={handleSelectLocationFromMap}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.15)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    fontWeight: '600',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  tabBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  bodyScroll: {
    padding: 16,
  },
  formContainer: {
    gap: 14,
  },
  formGroup: {
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  subHintText: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 15,
  },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 13,
    fontWeight: '600',
  },
  mapActionRow: {
    gap: 8,
    marginTop: 4,
  },
  mapBtnBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2563eb',
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  mapBtnBlueText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '800',
  },
  mapBtnGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  mapBtnGreenText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '800',
  },
  coordsBox: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    gap: 12,
  },
  coordsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coordsBoxTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#60a5fa',
  },
  mesaiPill: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  mesaiPillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  latLonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  latLonLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
  latLonInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '700',
  },
  infoNoteRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
  },
  infoNoteText: {
    fontSize: 10,
    color: '#94a3b8',
    flex: 1,
    lineHeight: 14,
  },
  phoneInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  phoneInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  selectAllText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#3b82f6',
  },
  staffListContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 6,
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  initialCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: '900',
  },
  staffNameText: {
    fontSize: 13,
    fontWeight: '800',
  },
  staffHandleText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  selectCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCircleActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    height: 48,
    borderRadius: 14,
    marginTop: 8,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  listContainer: {
    gap: 10,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#94a3b8',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 17,
  },
  branchCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 10,
  },
  branchCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  branchName: {
    fontSize: 15,
    fontWeight: '900',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  addressText: {
    fontSize: 12,
    color: '#94a3b8',
    flex: 1,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  coordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  coordText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#60a5fa',
  },
  radiusBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  radiusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10b981',
  },
  staffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  staffBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#a855f7',
  },
  // Headquarter related styles
  hqBranchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  hqBranchBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#3b82f6',
  },
  filterChipsRow: {
    gap: 8,
    paddingBottom: 6,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterChipActive: {
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  filterChipText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  hqSelectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  hqSelectChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  hqFormCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    gap: 8,
  },
  hqFormTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginTop: 6,
  },
  hqCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  hqCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hqCardIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hqCardName: {
    fontSize: 15,
    fontWeight: '900',
  },
  hqBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  hqCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hqCountPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#60a5fa',
  },
  hqSubInfo: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  addBranchToHqBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
  },
  addBranchToHqBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563eb',
  },
  cariPickerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  cariPickerToggleText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#60a5fa',
  },
  cariPickerBox: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
    overflow: 'hidden',
  },
  cariSearchInput: {
    height: 38,
    paddingHorizontal: 10,
    fontSize: 12,
    borderBottomWidth: 1,
  },
  cariItemRow: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  cariItemText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Mini modal for changing headquarter
  miniModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  miniModalContent: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  miniModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  miniModalTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  miniModalSubtitle: {
    fontSize: 12,
    marginBottom: 6,
  },
  miniHqItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  miniHqItemText: {
    fontSize: 13,
  },
});
