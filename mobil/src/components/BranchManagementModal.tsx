import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  Linking,
} from 'react-native';
import {
  X,
  Store,
  MapPin,
  Trash2,
  Compass,
  Check,
  Search,
  Phone,
  Users,
  Building2,
  Plus,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Smartphone,
  CheckCircle2,
  Lock,
  ArrowRight,
  ExternalLink,
  Shield,
  Eye,
  EyeOff,
} from 'lucide-react-native';
import { useStorage } from '../context/StorageContext';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { Company, UserAccount, canUserManageInstitutionsAndBranches } from '../types/auth';
import { Branch } from '../types/storage';
import { LocationService } from '../services/locationService';
import { CompanyService } from '../services/companyService';
import { StorageService } from '../services/storageService';
import { DeviceService } from '../services/deviceService';
import { MapPickerModal, MapPickerLocation } from './MapPickerModal';
import { CreateCompanyModal } from './CreateCompanyModal';

interface BranchManagementModalProps {
  visible: boolean;
  onClose: () => void;
}

export const BranchManagementModal: React.FC<BranchManagementModalProps> = ({
  visible,
  onClose,
}) => {
  const { isDark } = useAppTheme();
  const { user: currentUser, users, updateUser } = useAuth();
  const {
    branches: polatlarBranches,
    addBranch,
    deleteBranch,
    assignStaffToBranch,
    attendanceRecords,
  } = useStorage();

  const currentCompCode = useMemo(
    () => (currentUser?.companyCode || 'POLATLAR').trim().toUpperCase(),
    [currentUser]
  );

  const isSuperAdmin = useMemo(() => {
    return canUserManageInstitutionsAndBranches(currentUser);
  }, [currentUser]);

  // Main list states
  const [searchQuery, setSearchQuery] = useState('');
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);
  const [companyBranchesMap, setCompanyBranchesMap] = useState<Record<string, Branch[]>>({});
  const [loading, setLoading] = useState(false);

  // Accordion state
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(
    () => new Set([currentCompCode])
  );
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());

  // Sub-modal states
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);

  // Add branch modal state
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [targetCompanyForBranch, setTargetCompanyForBranch] = useState<string>(currentCompCode);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchLat, setNewBranchLat] = useState('');
  const [newBranchLon, setNewBranchLon] = useState('');
  const [newBranchRadius, setNewBranchRadius] = useState<number>(20);
  const [newBranchPhone, setNewBranchPhone] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [isSavingBranch, setIsSavingBranch] = useState(false);

  // Assign staff modal state
  const [isAssignStaffOpen, setIsAssignStaffOpen] = useState(false);
  const [targetBranchForStaff, setTargetBranchForStaff] = useState<Branch | null>(null);
  const [targetCompanyForStaff, setTargetCompanyForStaff] = useState<string>(currentCompCode);
  const [tempAssignedStaffIds, setTempAssignedStaffIds] = useState<string[]>([]);
  const [isSavingStaffAssignment, setIsSavingStaffAssignment] = useState(false);

  // Staff password modal state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [targetStaffForPassword, setTargetStaffForPassword] = useState<{
    id: string;
    name: string;
    username: string;
  } | null>(null);
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // User location for distance calculation
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    LocationService.getCurrentPosition()
      .then((pos) => setUserCoords({ lat: pos.latitude, lon: pos.longitude }))
      .catch(() => {});
  }, []);

  // Load all companies and their branches
  const loadAllCompaniesAndBranches = useCallback(async () => {
    setLoading(true);
    try {
      const compList = await CompanyService.fetchCompanies();
      setAvailableCompanies(compList);

      const map: Record<string, Branch[]> = {};
      map['POLATLAR'] = polatlarBranches;

      for (const comp of compList) {
        const code = comp.code.toUpperCase();
        if (code !== 'POLATLAR') {
          try {
            const bList = await StorageService.getBranchesForCompany(code);
            map[code] = bList;
          } catch {
            map[code] = [];
          }
        }
      }
      setCompanyBranchesMap(map);
    } catch (e) {
      console.warn('Kurumlar ve şubeler yüklenemedi:', e);
    } finally {
      setLoading(false);
    }
  }, [polatlarBranches]);

  useEffect(() => {
    if (visible) {
      loadAllCompaniesAndBranches();
    }
  }, [visible, loadAllCompaniesAndBranches]);

  // Sync POLATLAR branches
  useEffect(() => {
    setCompanyBranchesMap((prev) => ({
      ...prev,
      POLATLAR: polatlarBranches,
    }));
  }, [polatlarBranches]);

  // Today's attendance set
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const activeStaffTodaySet = useMemo(() => {
    const set = new Set<string>();
    attendanceRecords.forEach((r) => {
      if (r.date === todayStr && r.status === 'checked_in') {
        set.add(r.userId);
      }
    });
    return set;
  }, [attendanceRecords, todayStr]);

  // Metrics
  const metrics = useMemo(() => {
    let totalBranches = 0;
    const assignedUserSet = new Set<string>();

    Object.values(companyBranchesMap).forEach((bList) => {
      totalBranches += bList.length;
      bList.forEach((b) => {
        (b.assignedUserIds || []).forEach((uid) => assignedUserSet.add(uid));
      });
    });

    return {
      totalCompanies: availableCompanies.length,
      totalBranches,
      totalStaff: users.length,
      activeStaffToday: activeStaffTodaySet.size,
    };
  }, [availableCompanies, companyBranchesMap, users, activeStaffTodaySet]);

  // Accordion toggles
  const toggleCompany = (code: string) => {
    setExpandedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleBranch = (branchId: string) => {
    setExpandedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(branchId)) next.delete(branchId);
      else next.add(branchId);
      return next;
    });
  };

  // Search Filter
  const filteredCompanies = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return availableCompanies;

    return availableCompanies.filter((comp) => {
      const code = comp.code.toUpperCase();
      const compMatch =
        comp.name.toLowerCase().includes(q) || comp.code.toLowerCase().includes(q);
      if (compMatch) return true;

      const compBranches = companyBranchesMap[code] || [];
      const branchMatch = compBranches.some(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          (b.address && b.address.toLowerCase().includes(q))
      );
      if (branchMatch) return true;

      const compStaff = users.filter((u) => (u.companyCode || 'POLATLAR').toUpperCase() === code);
      const staffMatch = compStaff.some(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q)
      );
      return staffMatch;
    });
  }, [availableCompanies, companyBranchesMap, users, searchQuery]);

  // Open Add Branch Modal for a specific company
  const handleOpenAddBranch = (companyCode: string) => {
    setTargetCompanyForBranch(companyCode);
    setNewBranchName('');
    setNewBranchAddress('');
    setNewBranchLat('');
    setNewBranchLon('');
    setNewBranchRadius(20);
    setNewBranchPhone('');
    setIsAddBranchOpen(true);
  };

  // GPS for Add Branch
  const handleGetCurrentLocation = async () => {
    setIsGettingLocation(true);
    try {
      const loc = await LocationService.getCurrentPosition();
      setNewBranchLat(loc.latitude.toFixed(6));
      setNewBranchLon(loc.longitude.toFixed(6));
      if (!newBranchAddress.trim() && loc.address) {
        setNewBranchAddress(loc.address);
      }
      Alert.alert('Konum Alındı', `Enlem: ${loc.latitude.toFixed(5)}, Boylam: ${loc.longitude.toFixed(5)}`);
    } catch {
      Alert.alert('Konum Hatası', 'Cihaz konumu alınamadı. GPS izninizin açık olduğundan emin olun.');
    } finally {
      setIsGettingLocation(false);
    }
  };

  // Save new Branch
  const handleSaveBranch = async () => {
    if (!newBranchName.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen şube adını girin.');
      return;
    }
    const latNum = parseFloat(newBranchLat);
    const lonNum = parseFloat(newBranchLon);
    if (isNaN(latNum) || isNaN(lonNum)) {
      Alert.alert('Eksik Bilgi', 'Lütfen geçerli Enlem ve Boylam koordinatları girin.');
      return;
    }

    setIsSavingBranch(true);
    try {
      const res = await addBranch({
        name: newBranchName.trim(),
        address: newBranchAddress.trim() || 'Merkez Adres',
        latitude: latNum,
        longitude: lonNum,
        radiusMeters: newBranchRadius,
        phone: newBranchPhone.trim() || undefined,
        companyCode: targetCompanyForBranch,
      });

      if (res.success) {
        Alert.alert('Başarılı', `"${newBranchName}" şubesi "${targetCompanyForBranch}" kurumuna eklendi.`);
        setIsAddBranchOpen(false);
        // Refresh target company branches
        if (targetCompanyForBranch !== 'POLATLAR') {
          const updatedB = await StorageService.getBranchesForCompany(targetCompanyForBranch);
          setCompanyBranchesMap((prev) => ({
            ...prev,
            [targetCompanyForBranch]: updatedB,
          }));
        }
        // Expand target company
        setExpandedCompanies((prev) => new Set([...prev, targetCompanyForBranch]));
      } else {
        Alert.alert('Hata', res.message || 'Şube eklenemedi.');
      }
    } catch (e: any) {
      Alert.alert('Hata', e?.message || 'Şube eklenirken bir hata oluştu.');
    } finally {
      setIsSavingBranch(false);
    }
  };

  // Delete Branch
  const handleDeleteBranch = (branch: Branch, companyCode: string) => {
    Alert.alert(
      'Şubeyi Sil',
      `"${branch.name}" şubesini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBranch(branch.id, companyCode);
              setCompanyBranchesMap((prev) => ({
                ...prev,
                [companyCode]: (prev[companyCode] || []).filter((b) => b.id !== branch.id),
              }));
              Alert.alert('Başarılı', `"${branch.name}" şubesi silindi.`);
            } catch (e: any) {
              Alert.alert('Hata', e?.message || 'Şube silinemedi.');
            }
          },
        },
      ]
    );
  };

  // Open Staff Assignment Modal
  const handleOpenAssignStaff = (branch: Branch, companyCode: string) => {
    setTargetBranchForStaff(branch);
    setTargetCompanyForStaff(companyCode);
    setTempAssignedStaffIds(branch.assignedUserIds || []);
    setIsAssignStaffOpen(true);
  };

  // Toggle staff in temp selection
  const handleToggleStaff = (staffId: string) => {
    setTempAssignedStaffIds((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  };

  // Save Staff Assignment
  const handleSaveStaffAssignment = async () => {
    if (!targetBranchForStaff) return;
    setIsSavingStaffAssignment(true);
    try {
      await assignStaffToBranch(
        targetBranchForStaff.id,
        tempAssignedStaffIds,
        targetCompanyForStaff
      );

      // Update map locally
      setCompanyBranchesMap((prev) => {
        const compList = prev[targetCompanyForStaff] || [];
        return {
          ...prev,
          [targetCompanyForStaff]: compList.map((b) =>
            b.id === targetBranchForStaff.id
              ? { ...b, assignedUserIds: tempAssignedStaffIds, updatedAt: Date.now() }
              : b
          ),
        };
      });

      setIsAssignStaffOpen(false);
      Alert.alert('Başarılı', 'Personel atamaları başarıyla kaydedildi.');
    } catch (e: any) {
      Alert.alert('Hata', e?.message || 'Personel ataması kaydedilemedi.');
    } finally {
      setIsSavingStaffAssignment(false);
    }
  };

  // Staff Device Lock Reset Action
  const handleResetDeviceLock = (staff: UserAccount) => {
    Alert.alert(
      'Cihaz Kilidini Sıfırla',
      `"${staff.name}" kullanıcısının cihaz kilidini sıfırlamak istediğinize emin misiniz?\n\nKullanıcı yeni telefonundan giriş yaptığında sistem otomatik olarak yeni cihazıyla eşleşecektir.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Kilidi Sıfırla',
          style: 'destructive',
          onPress: async () => {
            try {
              await DeviceService.unbindUserDevice(staff.id, staff.username);
              Alert.alert('Başarılı', `"${staff.name}" kullanıcısının cihaz kilidi başarıyla kaldırıldı.`);
            } catch (e: any) {
              Alert.alert('Hata', e?.message || 'Cihaz kilidi kaldırılamadı.');
            }
          },
        },
      ]
    );
  };

  // Staff Password Change Modal
  const handleOpenPasswordModal = (staff: UserAccount) => {
    setTargetStaffForPassword({
      id: staff.id,
      name: staff.name,
      username: staff.username,
    });
    setNewStaffPassword('');
    setShowPasswordText(false);
    setIsPasswordModalOpen(true);
  };

  const handleSavePassword = async () => {
    if (!targetStaffForPassword) return;
    if (!newStaffPassword || newStaffPassword.trim().length < 3) {
      Alert.alert('Uyarı', 'Şifre en az 3 karakter olmalıdır.');
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await updateUser(targetStaffForPassword.id, {
        password: newStaffPassword.trim(),
      });
      if (res.success) {
        Alert.alert(
          'Başarılı',
          `"${targetStaffForPassword.name}" kullanıcısının yeni şifresi kaydedildi.`
        );
        setIsPasswordModalOpen(false);
      } else {
        Alert.alert('Hata', res.error || 'Şifre güncellenemedi.');
      }
    } catch (e: any) {
      Alert.alert('Hata', e?.message || 'Şifre güncellenemedi.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  if (!visible || !isSuperAdmin) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: isDark ? '#0b1329' : '#f8fafc' },
          ]}
        >
          {/* 1. Modal Top Bar */}
          <View
            style={[
              styles.header,
              {
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderBottomColor: isDark ? '#1e293b' : '#e2e8f0',
              },
            ]}
          >
            <View style={styles.headerLeft}>
              <View style={[styles.headerIconCircle, { backgroundColor: '#0d9488' }]}>
                <Building2 size={20} color="#ffffff" />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                  Kurum ve Şubeler
                </Text>
                <Text style={styles.headerSubtitle}>
                  {metrics.totalCompanies} Kurum • {metrics.totalBranches} Şube • {metrics.totalStaff} Personel
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={20} color={isDark ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
          </View>

          {/* 2. Scrollable Body */}
          <ScrollView
            contentContainerStyle={styles.bodyScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Top Action: + Yeni Kurum Ekle (Super Admin only or all admins) */}
            {isSuperAdmin && (
              <TouchableOpacity
                style={styles.primaryCreateCompanyBtn}
                onPress={() => setIsCreateCompanyOpen(true)}
                activeOpacity={0.85}
              >
                <View style={styles.createCompanyBtnIcon}>
                  <Building2 size={18} color="#ffffff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.createCompanyBtnTitle}>+ Yeni Kurum Ekle</Text>
                  <Text style={styles.createCompanyBtnSubtitle}>
                    Yeni firma tanımlayın, şubeler açın ve lisans atayın
                  </Text>
                </View>
                <ArrowRight size={18} color="#ffffff" />
              </TouchableOpacity>
            )}

            {/* KPI Metrics Row */}
            <View style={styles.kpiRow}>
              <View
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: isDark ? '#1e293b' : '#e2e8f0',
                  },
                ]}
              >
                <Text style={styles.kpiLabel}>KURUM</Text>
                <Text style={[styles.kpiValue, { color: '#0d9488' }]}>
                  {metrics.totalCompanies}
                </Text>
              </View>

              <View
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: isDark ? '#1e293b' : '#e2e8f0',
                  },
                ]}
              >
                <Text style={styles.kpiLabel}>ŞUBE</Text>
                <Text style={[styles.kpiValue, { color: '#2563eb' }]}>
                  {metrics.totalBranches}
                </Text>
              </View>

              <View
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: isDark ? '#1e293b' : '#e2e8f0',
                  },
                ]}
              >
                <Text style={styles.kpiLabel}>PERSONEL</Text>
                <Text style={[styles.kpiValue, { color: '#f59e0b' }]}>
                  {metrics.totalStaff}
                </Text>
              </View>

              <View
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: isDark ? '#1e293b' : '#e2e8f0',
                  },
                ]}
              >
                <Text style={styles.kpiLabel}>MESAİDE</Text>
                <Text style={[styles.kpiValue, { color: '#10b981' }]}>
                  {metrics.activeStaffToday}
                </Text>
              </View>
            </View>

            {/* Search Input */}
            <View
              style={[
                styles.searchBox,
                {
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  borderColor: isDark ? '#1e293b' : '#cbd5e1',
                },
              ]}
            >
              <Search size={17} color="#94a3b8" />
              <TextInput
                style={[styles.searchInput, { color: isDark ? '#ffffff' : '#0f172a' }]}
                placeholder="Kurum, şube veya personel ara..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={16} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Loading Indicator */}
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#0d9488" />
                <Text style={styles.loadingText}>Kurumlar ve şubeler senkronize ediliyor...</Text>
              </View>
            )}

            {/* Companies Accordion List */}
            {filteredCompanies.length === 0 && !loading ? (
              <View
                style={[
                  styles.emptyStateBox,
                  {
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: isDark ? '#1e293b' : '#e2e8f0',
                  },
                ]}
              >
                <Store size={40} color="#94a3b8" />
                <Text style={[styles.emptyTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                  Arama Sonucu Bulunamadı
                </Text>
                <Text style={styles.emptySubtitle}>
                  Farklı bir anahtar kelime deneyebilir veya yeni bir kurum ekleyebilirsiniz.
                </Text>
              </View>
            ) : (
              filteredCompanies.map((comp) => {
                const code = comp.code.toUpperCase();
                const isExpanded = expandedCompanies.has(code);
                const compBranches = companyBranchesMap[code] || [];
                const compStaff = users.filter(
                  (u) => (u.companyCode || 'POLATLAR').toUpperCase() === code
                );
                const isPolatlar = code === 'POLATLAR';

                return (
                  <View
                    key={comp.code}
                    style={[
                      styles.companyCard,
                      {
                        backgroundColor: isDark ? '#0f172a' : '#ffffff',
                        borderColor: isExpanded
                          ? '#0d9488'
                          : isDark
                          ? '#1e293b'
                          : '#e2e8f0',
                      },
                    ]}
                  >
                    {/* Company Header Row */}
                    <TouchableOpacity
                      style={styles.companyHeaderRow}
                      onPress={() => toggleCompany(code)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.compIconCircle,
                          {
                            backgroundColor: isPolatlar
                              ? 'rgba(13, 148, 136, 0.15)'
                              : 'rgba(37, 99, 235, 0.15)',
                          },
                        ]}
                      >
                        <Building2
                          size={20}
                          color={isPolatlar ? '#0d9488' : '#2563eb'}
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text
                            style={[
                              styles.companyName,
                              { color: isDark ? '#ffffff' : '#0f172a' },
                            ]}
                          >
                            {comp.name}
                          </Text>
                          <View
                            style={[
                              styles.companyCodeBadge,
                              {
                                backgroundColor: isPolatlar
                                  ? 'rgba(13, 148, 136, 0.15)'
                                  : 'rgba(37, 99, 235, 0.15)',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.companyCodeText,
                                { color: isPolatlar ? '#0d9488' : '#3b82f6' },
                              ]}
                            >
                              {comp.code}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.companySubInfo}>
                          {compBranches.length} Şube • {compStaff.length} Personel
                          {comp.isFrozen ? ' • ⚠️ Donduruldu' : ''}
                        </Text>
                      </View>

                      {/* Right Action buttons */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {/* + Şube Ekle Button */}
                        <TouchableOpacity
                          style={styles.quickAddBranchBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleOpenAddBranch(code);
                          }}
                          activeOpacity={0.8}
                        >
                          <Plus size={13} color="#0d9488" />
                          <Text style={styles.quickAddBranchText}>Şube</Text>
                        </TouchableOpacity>

                        <View style={styles.chevronCircle}>
                          {isExpanded ? (
                            <ChevronUp size={16} color="#94a3b8" />
                          ) : (
                            <ChevronDown size={16} color="#94a3b8" />
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Company Expanded: Branches List */}
                    {isExpanded && (
                      <View
                        style={[
                          styles.branchesContainer,
                          { borderTopColor: isDark ? '#1e293b' : '#f1f5f9' },
                        ]}
                      >
                        {compBranches.length === 0 ? (
                          <View style={styles.noBranchesBox}>
                            <Store size={26} color="#94a3b8" />
                            <Text
                              style={[
                                styles.noBranchesText,
                                { color: isDark ? '#94a3b8' : '#64748b' },
                              ]}
                            >
                              Bu kuruma ait henüz şube tanımlanmamış.
                            </Text>
                            <TouchableOpacity
                              style={styles.inlineAddBranchBtn}
                              onPress={() => handleOpenAddBranch(code)}
                              activeOpacity={0.8}
                            >
                              <Plus size={14} color="#ffffff" />
                              <Text style={styles.inlineAddBranchBtnText}>
                                Bu Kuruma Şube Ekle
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          compBranches.map((branch) => {
                            const isBranchExpanded = expandedBranches.has(branch.id);
                            const assignedStaff = compStaff.filter((u) =>
                              (branch.assignedUserIds || []).includes(u.id)
                            );

                            let distanceStr: string | null = null;
                            if (userCoords && branch.latitude && branch.longitude) {
                              const meters = LocationService.calculateDistance(
                                userCoords.lat,
                                userCoords.lon,
                                branch.latitude,
                                branch.longitude
                              );
                              distanceStr = LocationService.formatDistance(meters);
                            }

                            return (
                              <View
                                key={branch.id}
                                style={[
                                  styles.branchCard,
                                  {
                                    backgroundColor: isDark ? '#080e21' : '#f8fafc',
                                    borderColor: isBranchExpanded
                                      ? '#2563eb'
                                      : isDark
                                      ? '#1e293b'
                                      : '#e2e8f0',
                                  },
                                ]}
                              >
                                {/* Branch Top Info Row */}
                                <View style={styles.branchHeaderRow}>
                                  <View style={styles.branchIconCircle}>
                                    <Store size={16} color="#0d9488" />
                                  </View>

                                  <View style={{ flex: 1 }}>
                                    <Text
                                      style={[
                                        styles.branchName,
                                        { color: isDark ? '#ffffff' : '#0f172a' },
                                      ]}
                                    >
                                      {branch.name}
                                    </Text>
                                    <View
                                      style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 4,
                                        marginTop: 2,
                                      }}
                                    >
                                      <MapPin size={11} color="#94a3b8" />
                                      <Text
                                        style={styles.branchAddress}
                                        numberOfLines={1}
                                      >
                                        {branch.address || 'Adres belirtilmemiş'}
                                      </Text>
                                    </View>
                                  </View>

                                  {/* Delete Branch Button */}
                                  <TouchableOpacity
                                    style={styles.branchDeleteBtn}
                                    onPress={() => handleDeleteBranch(branch, code)}
                                    activeOpacity={0.7}
                                  >
                                    <Trash2 size={15} color="#ef4444" />
                                  </TouchableOpacity>
                                </View>

                                {/* Branch Badges Row */}
                                <View style={styles.branchBadgesRow}>
                                  <View style={styles.badgePill}>
                                    <Text style={styles.badgePillText}>
                                      {branch.radiusMeters || 20}m Çember
                                    </Text>
                                  </View>

                                  <View
                                    style={[
                                      styles.badgePill,
                                      { backgroundColor: 'rgba(37, 99, 235, 0.1)' },
                                    ]}
                                  >
                                    <Users size={11} color="#3b82f6" />
                                    <Text
                                      style={[
                                        styles.badgePillText,
                                        { color: '#3b82f6' },
                                      ]}
                                    >
                                      {assignedStaff.length} Personel
                                    </Text>
                                  </View>

                                  {distanceStr && (
                                    <View
                                      style={[
                                        styles.badgePill,
                                        { backgroundColor: 'rgba(245, 158, 11, 0.1)' },
                                      ]}
                                    >
                                      <Compass size={11} color="#f59e0b" />
                                      <Text
                                        style={[
                                          styles.badgePillText,
                                          { color: '#f59e0b' },
                                        ]}
                                      >
                                        {distanceStr}
                                      </Text>
                                    </View>
                                  )}
                                </View>

                                {/* Branch Action Buttons */}
                                <View style={styles.branchActionsRow}>
                                  <TouchableOpacity
                                    style={styles.branchActionBtn}
                                    onPress={() => handleOpenAssignStaff(branch, code)}
                                    activeOpacity={0.8}
                                  >
                                    <Users size={13} color="#2563eb" />
                                    <Text style={styles.branchActionBtnText}>
                                      Personel Ata
                                    </Text>
                                  </TouchableOpacity>

                                  {branch.latitude && branch.longitude && (
                                    <TouchableOpacity
                                      style={[
                                        styles.branchActionBtn,
                                        { borderColor: 'rgba(16, 185, 129, 0.3)' },
                                      ]}
                                      onPress={() =>
                                        LocationService.openInMaps(
                                          branch.address,
                                          branch.latitude,
                                          branch.longitude
                                        )
                                      }
                                      activeOpacity={0.8}
                                    >
                                      <ExternalLink size={13} color="#10b981" />
                                      <Text
                                        style={[
                                          styles.branchActionBtnText,
                                          { color: '#10b981' },
                                        ]}
                                      >
                                        Harita
                                      </Text>
                                    </TouchableOpacity>
                                  )}

                                  <TouchableOpacity
                                    style={[
                                      styles.branchActionBtn,
                                      { flex: 1, justifyContent: 'center' },
                                    ]}
                                    onPress={() => toggleBranch(branch.id)}
                                    activeOpacity={0.8}
                                  >
                                    <Text
                                      style={[
                                        styles.branchActionBtnText,
                                        { color: isDark ? '#cbd5e1' : '#475569' },
                                      ]}
                                    >
                                      {isBranchExpanded
                                        ? 'Personelleri Gizle'
                                        : `Personelleri Gör (${assignedStaff.length})`}
                                    </Text>
                                    {isBranchExpanded ? (
                                      <ChevronUp size={13} color="#94a3b8" />
                                    ) : (
                                      <ChevronDown size={13} color="#94a3b8" />
                                    )}
                                  </TouchableOpacity>
                                </View>

                                {/* Branch Staff Expanded List */}
                                {isBranchExpanded && (
                                  <View
                                    style={[
                                      styles.staffListContainer,
                                      {
                                        backgroundColor: isDark ? '#0b1329' : '#ffffff',
                                        borderColor: isDark ? '#1e293b' : '#e2e8f0',
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.staffListHeaderTitle,
                                        { color: isDark ? '#94a3b8' : '#64748b' },
                                      ]}
                                    >
                                      ATANMIŞ PERSONELLER ({assignedStaff.length})
                                    </Text>

                                    {assignedStaff.length === 0 ? (
                                      <View style={styles.noStaffBox}>
                                        <Text
                                          style={[
                                            styles.noStaffText,
                                            { color: isDark ? '#94a3b8' : '#64748b' },
                                          ]}
                                        >
                                          Bu şubeye atanmış personel bulunmuyor.
                                        </Text>
                                        <TouchableOpacity
                                          style={styles.smallAssignBtn}
                                          onPress={() =>
                                            handleOpenAssignStaff(branch, code)
                                          }
                                        >
                                          <Text style={styles.smallAssignBtnText}>
                                            + Personel Ata
                                          </Text>
                                        </TouchableOpacity>
                                      </View>
                                    ) : (
                                      assignedStaff.map((staff) => {
                                        const isCheckedInToday =
                                          activeStaffTodaySet.has(staff.id);
                                        const initials = (staff.name || 'P')
                                          .split(' ')
                                          .map((n) => n[0])
                                          .slice(0, 2)
                                          .join('')
                                          .toUpperCase();

                                        return (
                                          <View
                                            key={staff.id}
                                            style={[
                                              styles.staffItemCard,
                                              {
                                                backgroundColor: isDark
                                                  ? '#0f172a'
                                                  : '#f8fafc',
                                                borderColor: isDark
                                                  ? '#1e293b'
                                                  : '#e2e8f0',
                                              },
                                            ]}
                                          >
                                            {/* Avatar & Info */}
                                            <View style={styles.staffItemLeft}>
                                              <View style={styles.staffAvatar}>
                                                <Text style={styles.staffAvatarText}>
                                                  {initials}
                                                </Text>
                                              </View>

                                              <View style={{ flex: 1 }}>
                                                <View
                                                  style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                  }}
                                                >
                                                  <Text
                                                    style={[
                                                      styles.staffNameText,
                                                      {
                                                        color: isDark
                                                          ? '#ffffff'
                                                          : '#0f172a',
                                                      },
                                                    ]}
                                                  >
                                                    {staff.name}
                                                  </Text>
                                                  <View
                                                    style={[
                                                      styles.staffRolePill,
                                                      {
                                                        backgroundColor:
                                                          staff.role === 'admin'
                                                            ? 'rgba(245, 158, 11, 0.15)'
                                                            : 'rgba(59, 130, 246, 0.15)',
                                                      },
                                                    ]}
                                                  >
                                                    <Text
                                                      style={[
                                                        styles.staffRolePillText,
                                                        {
                                                          color:
                                                            staff.role === 'admin'
                                                              ? '#f59e0b'
                                                              : '#3b82f6',
                                                        },
                                                      ]}
                                                    >
                                                      {staff.role === 'admin'
                                                        ? 'YÖNETİCİ'
                                                        : 'SAHA'}
                                                    </Text>
                                                  </View>
                                                </View>

                                                <Text style={styles.staffUsernameText}>
                                                  @{staff.username}
                                                </Text>

                                                {/* Attendance Status Badge */}
                                                <View
                                                  style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    gap: 4,
                                                    marginTop: 4,
                                                  }}
                                                >
                                                  <View
                                                    style={[
                                                      styles.statusDot,
                                                      {
                                                        backgroundColor: isCheckedInToday
                                                          ? '#10b981'
                                                          : '#94a3b8',
                                                      },
                                                    ]}
                                                  />
                                                  <Text
                                                    style={[
                                                      styles.statusText,
                                                      {
                                                        color: isCheckedInToday
                                                          ? '#10b981'
                                                          : '#94a3b8',
                                                      },
                                                    ]}
                                                  >
                                                    {isCheckedInToday
                                                      ? 'Bugün Mesaide'
                                                      : 'Mesai Başlamadı'}
                                                  </Text>
                                                </View>
                                              </View>
                                            </View>

                                            {/* Staff Actions: Password & Device Lock */}
                                            <View style={styles.staffActionsCol}>
                                              <TouchableOpacity
                                                style={[
                                                  styles.staffSmallActionBtn,
                                                  {
                                                    backgroundColor:
                                                      'rgba(245, 158, 11, 0.1)',
                                                    borderColor:
                                                      'rgba(245, 158, 11, 0.25)',
                                                  },
                                                ]}
                                                onPress={() =>
                                                  handleOpenPasswordModal(staff)
                                                }
                                                activeOpacity={0.8}
                                              >
                                                <KeyRound size={12} color="#f59e0b" />
                                                <Text
                                                  style={[
                                                    styles.staffSmallActionText,
                                                    { color: '#f59e0b' },
                                                  ]}
                                                >
                                                  Şifre
                                                </Text>
                                              </TouchableOpacity>

                                              <TouchableOpacity
                                                style={[
                                                  styles.staffSmallActionBtn,
                                                  {
                                                    backgroundColor:
                                                      'rgba(59, 130, 246, 0.1)',
                                                    borderColor:
                                                      'rgba(59, 130, 246, 0.25)',
                                                  },
                                                ]}
                                                onPress={() =>
                                                  handleResetDeviceLock(staff)
                                                }
                                                activeOpacity={0.8}
                                              >
                                                <Smartphone size={12} color="#3b82f6" />
                                                <Text
                                                  style={[
                                                    styles.staffSmallActionText,
                                                    { color: '#3b82f6' },
                                                  ]}
                                                >
                                                  Kilit Sıfırla
                                                </Text>
                                              </TouchableOpacity>
                                            </View>
                                          </View>
                                        );
                                      })
                                    )}
                                  </View>
                                )}
                              </View>
                            );
                          })
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* ============================================================== */}
          {/* SUB-MODAL 1: ADD BRANCH MODAL                                  */}
          {/* ============================================================== */}
          <Modal
            visible={isAddBranchOpen}
            animationType="slide"
            transparent
            onRequestClose={() => setIsAddBranchOpen(false)}
          >
            <View style={styles.subModalOverlay}>
              <View
                style={[
                  styles.subModalContent,
                  { backgroundColor: isDark ? '#0f172a' : '#ffffff' },
                ]}
              >
                {/* Header */}
                <View style={styles.subModalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View
                      style={[styles.headerIconCircle, { backgroundColor: '#0d9488' }]}
                    >
                      <Store size={18} color="#ffffff" />
                    </View>
                    <View>
                      <Text
                        style={[
                          styles.subModalTitle,
                          { color: isDark ? '#ffffff' : '#0f172a' },
                        ]}
                      >
                        Yeni Şube Ekle
                      </Text>
                      <Text style={styles.subModalSubtitle}>
                        Kurum: {targetCompanyForBranch}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setIsAddBranchOpen(false)}
                  >
                    <X size={18} color="#94a3b8" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={{ maxHeight: 460 }}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Branch Name */}
                  <View style={styles.formGroup}>
                    <Text
                      style={[
                        styles.formLabel,
                        { color: isDark ? '#cbd5e1' : '#334155' },
                      ]}
                    >
                      ŞUBE ADI *
                    </Text>
                    <TextInput
                      style={[
                        styles.formInput,
                        {
                          backgroundColor: isDark ? '#0b1329' : '#f8fafc',
                          color: isDark ? '#ffffff' : '#0f172a',
                          borderColor: isDark ? '#1e293b' : '#cbd5e1',
                        },
                      ]}
                      placeholder="Örn: Erzurum Merkez Şube"
                      placeholderTextColor="#94a3b8"
                      value={newBranchName}
                      onChangeText={setNewBranchName}
                    />
                  </View>

                  {/* Branch Address */}
                  <View style={styles.formGroup}>
                    <Text
                      style={[
                        styles.formLabel,
                        { color: isDark ? '#cbd5e1' : '#334155' },
                      ]}
                    >
                      ŞUBE ADRESİ
                    </Text>
                    <TextInput
                      style={[
                        styles.formInput,
                        styles.formInputMultiline,
                        {
                          backgroundColor: isDark ? '#0b1329' : '#f8fafc',
                          color: isDark ? '#ffffff' : '#0f172a',
                          borderColor: isDark ? '#1e293b' : '#cbd5e1',
                        },
                      ]}
                      placeholder="Şube açık adresi..."
                      placeholderTextColor="#94a3b8"
                      multiline
                      value={newBranchAddress}
                      onChangeText={setNewBranchAddress}
                    />
                  </View>

                  {/* GPS & Map Buttons */}
                  <View style={styles.locationBtnsRow}>
                    <TouchableOpacity
                      style={[styles.locBtn, { backgroundColor: '#0d9488' }]}
                      onPress={handleGetCurrentLocation}
                      disabled={isGettingLocation}
                      activeOpacity={0.8}
                    >
                      {isGettingLocation ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Compass size={14} color="#ffffff" />
                      )}
                      <Text style={styles.locBtnText}>Mevcut Konumu Al</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.locBtn, { backgroundColor: '#2563eb' }]}
                      onPress={() => setIsMapPickerOpen(true)}
                      activeOpacity={0.8}
                    >
                      <MapPin size={14} color="#ffffff" />
                      <Text style={styles.locBtnText}>Haritadan Seç</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Lat / Lon Inputs */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.formLabel,
                          { color: isDark ? '#cbd5e1' : '#334155' },
                        ]}
                      >
                        ENLEM (LAT) *
                      </Text>
                      <TextInput
                        style={[
                          styles.formInput,
                          {
                            backgroundColor: isDark ? '#0b1329' : '#f8fafc',
                            color: isDark ? '#ffffff' : '#0f172a',
                            borderColor: isDark ? '#1e293b' : '#cbd5e1',
                          },
                        ]}
                        placeholder="Örn: 39.9107"
                        placeholderTextColor="#94a3b8"
                        keyboardType="numeric"
                        value={newBranchLat}
                        onChangeText={setNewBranchLat}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.formLabel,
                          { color: isDark ? '#cbd5e1' : '#334155' },
                        ]}
                      >
                        BOYLAM (LON) *
                      </Text>
                      <TextInput
                        style={[
                          styles.formInput,
                          {
                            backgroundColor: isDark ? '#0b1329' : '#f8fafc',
                            color: isDark ? '#ffffff' : '#0f172a',
                            borderColor: isDark ? '#1e293b' : '#cbd5e1',
                          },
                        ]}
                        placeholder="Örn: 41.2713"
                        placeholderTextColor="#94a3b8"
                        keyboardType="numeric"
                        value={newBranchLon}
                        onChangeText={setNewBranchLon}
                      />
                    </View>
                  </View>

                  {/* Radius Options */}
                  <View style={styles.formGroup}>
                    <Text
                      style={[
                        styles.formLabel,
                        { color: isDark ? '#cbd5e1' : '#334155' },
                      ]}
                    >
                      MESAİ KONTROL ÇEMBERİ
                    </Text>
                    <View style={styles.radiusPillsRow}>
                      {[20, 50, 100, 200].map((rad) => {
                        const isSelected = newBranchRadius === rad;
                        return (
                          <TouchableOpacity
                            key={rad}
                            style={[
                              styles.radiusPill,
                              {
                                backgroundColor: isSelected
                                  ? '#0d9488'
                                  : isDark
                                  ? '#0b1329'
                                  : '#f1f5f9',
                                borderColor: isSelected
                                  ? '#0d9488'
                                  : isDark
                                  ? '#1e293b'
                                  : '#cbd5e1',
                              },
                            ]}
                            onPress={() => setNewBranchRadius(rad)}
                          >
                            <Text
                              style={[
                                styles.radiusPillText,
                                {
                                  color: isSelected
                                    ? '#ffffff'
                                    : isDark
                                    ? '#cbd5e1'
                                    : '#475569',
                                },
                              ]}
                            >
                              {rad} Metre
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Phone */}
                  <View style={styles.formGroup}>
                    <Text
                      style={[
                        styles.formLabel,
                        { color: isDark ? '#cbd5e1' : '#334155' },
                      ]}
                    >
                      ŞUBE TELEFONU (OPSİYONEL)
                    </Text>
                    <TextInput
                      style={[
                        styles.formInput,
                        {
                          backgroundColor: isDark ? '#0b1329' : '#f8fafc',
                          color: isDark ? '#ffffff' : '#0f172a',
                          borderColor: isDark ? '#1e293b' : '#cbd5e1',
                        },
                      ]}
                      placeholder="0442 000 00 00"
                      placeholderTextColor="#94a3b8"
                      keyboardType="phone-pad"
                      value={newBranchPhone}
                      onChangeText={setNewBranchPhone}
                    />
                  </View>
                </ScrollView>

                {/* Save Button */}
                <TouchableOpacity
                  style={[
                    styles.primarySubmitBtn,
                    { backgroundColor: '#0d9488' },
                  ]}
                  onPress={handleSaveBranch}
                  disabled={isSavingBranch}
                  activeOpacity={0.85}
                >
                  {isSavingBranch ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Check size={16} color="#ffffff" />
                      <Text style={styles.primarySubmitBtnText}>Şubeyi Kaydet</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* ============================================================== */}
          {/* SUB-MODAL 2: STAFF ASSIGNMENT MODAL                            */}
          {/* ============================================================== */}
          <Modal
            visible={isAssignStaffOpen}
            animationType="slide"
            transparent
            onRequestClose={() => setIsAssignStaffOpen(false)}
          >
            <View style={styles.subModalOverlay}>
              <View
                style={[
                  styles.subModalContent,
                  { backgroundColor: isDark ? '#0f172a' : '#ffffff' },
                ]}
              >
                {/* Header */}
                <View style={styles.subModalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View
                      style={[styles.headerIconCircle, { backgroundColor: '#2563eb' }]}
                    >
                      <Users size={18} color="#ffffff" />
                    </View>
                    <View>
                      <Text
                        style={[
                          styles.subModalTitle,
                          { color: isDark ? '#ffffff' : '#0f172a' },
                        ]}
                      >
                        Personel Ata
                      </Text>
                      <Text style={styles.subModalSubtitle} numberOfLines={1}>
                        {targetBranchForStaff?.name} ({targetCompanyForStaff})
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setIsAssignStaffOpen(false)}
                  >
                    <X size={18} color="#94a3b8" />
                  </TouchableOpacity>
                </View>

                {/* Staff Selection List */}
                <ScrollView
                  style={{ maxHeight: 380 }}
                  showsVerticalScrollIndicator={false}
                >
                  {(() => {
                    const compUsers = users.filter(
                      (u) =>
                        (u.companyCode || 'POLATLAR').toUpperCase() ===
                        targetCompanyForStaff
                    );

                    if (compUsers.length === 0) {
                      return (
                        <View style={{ padding: 20, alignItems: 'center' }}>
                          <Text
                            style={{
                              color: isDark ? '#94a3b8' : '#64748b',
                              fontSize: 13,
                              textAlign: 'center',
                            }}
                          >
                            Bu kuruma kayıtlı personel bulunmamaktadır.
                          </Text>
                        </View>
                      );
                    }

                    return compUsers.map((staff) => {
                      const isSelected = tempAssignedStaffIds.includes(staff.id);
                      return (
                        <TouchableOpacity
                          key={staff.id}
                          style={[
                            styles.staffSelectRow,
                            {
                              backgroundColor: isSelected
                                ? isDark
                                  ? 'rgba(37, 99, 235, 0.2)'
                                  : 'rgba(37, 99, 235, 0.08)'
                                : isDark
                                ? '#0b1329'
                                : '#f8fafc',
                              borderColor: isSelected
                                ? '#2563eb'
                                : isDark
                                ? '#1e293b'
                                : '#e2e8f0',
                            },
                          ]}
                          onPress={() => handleToggleStaff(staff.id)}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.checkboxSquare,
                              {
                                backgroundColor: isSelected
                                  ? '#2563eb'
                                  : 'transparent',
                                borderColor: isSelected ? '#2563eb' : '#94a3b8',
                              },
                            ]}
                          >
                            {isSelected && <Check size={12} color="#ffffff" />}
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.staffSelectName,
                                { color: isDark ? '#ffffff' : '#0f172a' },
                              ]}
                            >
                              {staff.name}
                            </Text>
                            <Text style={styles.staffSelectUser}>
                              @{staff.username} •{' '}
                              {staff.role === 'admin' ? 'Yönetici' : 'Saha'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    });
                  })()}
                </ScrollView>

                {/* Submit button */}
                <TouchableOpacity
                  style={[
                    styles.primarySubmitBtn,
                    { backgroundColor: '#2563eb' },
                  ]}
                  onPress={handleSaveStaffAssignment}
                  disabled={isSavingStaffAssignment}
                  activeOpacity={0.85}
                >
                  {isSavingStaffAssignment ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Check size={16} color="#ffffff" />
                      <Text style={styles.primarySubmitBtnText}>
                        Atamaları Kaydet ({tempAssignedStaffIds.length} Personel)
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* ============================================================== */}
          {/* SUB-MODAL 3: STAFF PASSWORD MODAL                              */}
          {/* ============================================================== */}
          <Modal
            visible={isPasswordModalOpen}
            animationType="fade"
            transparent
            onRequestClose={() => setIsPasswordModalOpen(false)}
          >
            <View style={styles.subModalOverlay}>
              <View
                style={[
                  styles.subModalContent,
                  { backgroundColor: isDark ? '#0f172a' : '#ffffff', maxWidth: 380 },
                ]}
              >
                <View style={styles.subModalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View
                      style={[styles.headerIconCircle, { backgroundColor: '#f59e0b' }]}
                    >
                      <KeyRound size={18} color="#ffffff" />
                    </View>
                    <View>
                      <Text
                        style={[
                          styles.subModalTitle,
                          { color: isDark ? '#ffffff' : '#0f172a' },
                        ]}
                      >
                        Şifre Değiştir
                      </Text>
                      <Text style={styles.subModalSubtitle}>
                        {targetStaffForPassword?.name} (@{targetStaffForPassword?.username})
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setIsPasswordModalOpen(false)}
                  >
                    <X size={18} color="#94a3b8" />
                  </TouchableOpacity>
                </View>

                <View style={styles.formGroup}>
                  <Text
                    style={[
                      styles.formLabel,
                      { color: isDark ? '#cbd5e1' : '#334155' },
                    ]}
                  >
                    YENİ ŞİFRE *
                  </Text>
                  <View
                    style={[
                      styles.passwordInputContainer,
                      {
                        backgroundColor: isDark ? '#0b1329' : '#f8fafc',
                        borderColor: isDark ? '#1e293b' : '#cbd5e1',
                      },
                    ]}
                  >
                    <TextInput
                      style={[
                        styles.passwordInputField,
                        { color: isDark ? '#ffffff' : '#0f172a' },
                      ]}
                      placeholder="Yeni şifreyi giriniz..."
                      placeholderTextColor="#94a3b8"
                      secureTextEntry={!showPasswordText}
                      value={newStaffPassword}
                      onChangeText={setNewStaffPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={{ padding: 6 }}
                      onPress={() => setShowPasswordText(!showPasswordText)}
                    >
                      {showPasswordText ? (
                        <EyeOff size={16} color="#94a3b8" />
                      ) : (
                        <Eye size={16} color="#94a3b8" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.primarySubmitBtn,
                    { backgroundColor: '#f59e0b', marginTop: 16 },
                  ]}
                  onPress={handleSavePassword}
                  disabled={isSavingPassword}
                  activeOpacity={0.85}
                >
                  {isSavingPassword ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Check size={16} color="#ffffff" />
                      <Text style={styles.primarySubmitBtnText}>Şifreyi Güncelle</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Map Picker Modal */}
          <MapPickerModal
            visible={isMapPickerOpen}
            onClose={() => setIsMapPickerOpen(false)}
            initialLatitude={newBranchLat || (userCoords?.lat ? userCoords.lat.toString() : '39.9107')}
            initialLongitude={newBranchLon || (userCoords?.lon ? userCoords.lon.toString() : '41.2713')}
            initialAddress={newBranchAddress}
            onSelectLocation={(loc: MapPickerLocation) => {
              setNewBranchLat(loc.latitude.toFixed(6));
              setNewBranchLon(loc.longitude.toFixed(6));
              if (loc.address) setNewBranchAddress(loc.address);
              setIsMapPickerOpen(false);
            }}
          />

          {/* Create Company Modal */}
          <CreateCompanyModal
            visible={isCreateCompanyOpen}
            onClose={() => {
              setIsCreateCompanyOpen(false);
              loadAllCompaniesAndBranches();
            }}
          />
        </View>
      </View>
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
    height: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  bodyScroll: {
    padding: 16,
    paddingBottom: 40,
  },
  // + Yeni Kurum Ekle Banner
  primaryCreateCompanyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0d9488',
    padding: 14,
    borderRadius: 16,
    marginBottom: 14,
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  createCompanyBtnIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createCompanyBtnTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  createCompanyBtnSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
  },
  // KPI Row
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2,
  },
  // Search Box
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '500',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 12.5,
  },
  emptyStateBox: {
    padding: 30,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  // Company Card
  companyCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 12,
    overflow: 'hidden',
  },
  companyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  compIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyName: {
    fontSize: 15,
    fontWeight: '800',
  },
  companyCodeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  companyCodeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  companySubInfo: {
    fontSize: 11.5,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 2,
  },
  quickAddBranchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(13, 148, 136, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.3)',
  },
  quickAddBranchText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0d9488',
  },
  chevronCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchesContainer: {
    borderTopWidth: 1,
    padding: 12,
    gap: 10,
  },
  noBranchesBox: {
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  noBranchesText: {
    fontSize: 12,
    textAlign: 'center',
  },
  inlineAddBranchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0d9488',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 4,
  },
  inlineAddBranchBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  // Branch Card
  branchCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  branchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  branchIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(13, 148, 136, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  branchName: {
    fontSize: 14,
    fontWeight: '800',
  },
  branchAddress: {
    fontSize: 11.5,
    color: '#94a3b8',
    flex: 1,
  },
  branchDeleteBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  branchBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#94a3b8',
  },
  branchActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.1)',
  },
  branchActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
    backgroundColor: 'rgba(37, 99, 235, 0.06)',
  },
  branchActionBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2563eb',
  },
  // Staff List Expanded
  staffListContainer: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  staffListHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  noStaffBox: {
    paddingVertical: 10,
    alignItems: 'center',
    gap: 6,
  },
  noStaffText: {
    fontSize: 11.5,
  },
  smallAssignBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderRadius: 6,
  },
  smallAssignBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563eb',
  },
  staffItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  staffItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  staffAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563eb',
  },
  staffNameText: {
    fontSize: 13,
    fontWeight: '800',
  },
  staffRolePill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  staffRolePillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  staffUsernameText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  staffActionsCol: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 8,
  },
  staffSmallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
  },
  staffSmallActionText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  // Sub Modals (Add Branch, Staff Assign, Password)
  subModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  subModalContent: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  subModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.15)',
    marginBottom: 14,
  },
  subModalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  subModalSubtitle: {
    fontSize: 11.5,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 1,
  },
  formGroup: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  formInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '500',
  },
  formInputMultiline: {
    height: 60,
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
  locationBtnsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  locBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 10,
  },
  locBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  radiusPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  radiusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  primarySubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 12,
    marginTop: 14,
  },
  primarySubmitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  // Staff Selection Row
  staffSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  checkboxSquare: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffSelectName: {
    fontSize: 13,
    fontWeight: '800',
  },
  staffSelectUser: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  // Password Input Field
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  passwordInputField: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
});
