import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Key,
  Shield,
  User as UserIcon,
  UserX,
  UserCheck,
  Crown,
  Users,
  CheckCircle2,
  Unlock,
  Smartphone,
  Building2,
  Store,
  Sparkles,
  RefreshCw,
  Search,
  X,
  MessageSquare,
  Copy,
  Check,
  Edit3,
  Phone,
  CreditCard,
  MapPin,
  Briefcase,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useStorage } from '../../context/StorageContext';
import { UserRole, isUserAdmin, isSuperAdmin, Company, UserAccount } from '../../types/auth';
import { DeviceService } from '../../services/deviceService';
import { UserDeviceBinding, Branch } from '../../types/storage';
import { CompanyService } from '../../services/companyService';
import { StorageService } from '../../services/storageService';
import { CreateCompanyModal } from './CreateCompanyModal';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    users,
    user: currentUser,
    company,
    addUser,
    updateUser,
    suggestUsername,
    refreshUsers,
  } = useAuth();
  const { branches, assignStaffToBranch, departmentSalaries } = useStorage();

  const isSuper = isSuperAdmin(currentUser);
  const userCompanyCode = (currentUser?.companyCode || 'POLATLAR').toUpperCase();
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);

  const [activeSubTab, setActiveSubTab] = useState<'list' | 'add'>('list');

  // Multi-company & all-branches states
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyCode, setSelectedCompanyCode] = useState<string>(
    () => (isSuper ? (currentUser?.companyCode || 'POLATLAR') : userCompanyCode).toUpperCase()
  );
  const [targetAddCompanyCode, setTargetAddCompanyCode] = useState<string>(
    () => (isSuper ? (currentUser?.companyCode || 'POLATLAR') : userCompanyCode).toUpperCase()
  );
  const [allBranchesMap, setAllBranchesMap] = useState<Record<string, Branch[]>>({});
  const [loadingAllBranches, setLoadingAllBranches] = useState<boolean>(false);
  const [isRefreshingUsers, setIsRefreshingUsers] = useState<boolean>(false);

  // Keep selectedCompanyCode locked to userCompanyCode if non-super-admin
  useEffect(() => {
    if (!isSuper && userCompanyCode) {
      if (selectedCompanyCode !== userCompanyCode) {
        setSelectedCompanyCode(userCompanyCode);
      }
      if (targetAddCompanyCode !== userCompanyCode) {
        setTargetAddCompanyCode(userCompanyCode);
      }
    }
  }, [isSuper, userCompanyCode, selectedCompanyCode, targetAddCompanyCode]);

  // Flattened list of all branches with company codes
  const allBranchesList = useMemo(() => {
    const list: Branch[] = [];
    Object.entries(allBranchesMap).forEach(([compCode, bList]) => {
      bList.forEach((b) => {
        list.push({
          ...b,
          companyCode: b.companyCode || compCode,
        });
      });
    });
    return list;
  }, [allBranchesMap]);

  // Filtered companies strictly visible to this user
  // Non-super-admins can ONLY see their own company
  const visibleCompanies = useMemo(() => {
    if (!isSuper) {
      const match = companies.filter(
        (c) => c.code.toUpperCase() === userCompanyCode
      );
      if (match.length > 0) return match;
      return [{ code: userCompanyCode, name: company?.name || userCompanyCode }];
    }
    return companies;
  }, [companies, isSuper, userCompanyCode, company?.name]);

  // Load companies and branches: scoped strictly to user company for non-super-admins
  const loadCompaniesAndBranches = useCallback(async () => {
    try {
      setLoadingAllBranches(true);
      const compList = await CompanyService.fetchCompanies();
      setCompanies(compList);

      const map: Record<string, Branch[]> = {};
      if (isSuper) {
        map['POLATLAR'] = branches;
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
      } else {
        // Non-super-admins: fetch ONLY branches for user's own company
        try {
          const bList = await StorageService.getBranchesForCompany(userCompanyCode);
          map[userCompanyCode] = (bList && bList.length > 0) ? bList : (branches || []);
        } catch {
          map[userCompanyCode] = branches || [];
        }
      }
      setAllBranchesMap(map);
    } catch (e) {
      console.warn('Kurumlar veya şubeler yüklenemedi:', e);
    } finally {
      setLoadingAllBranches(false);
    }
  }, [branches, isSuper, userCompanyCode]);

  // Device bindings state
  const [userBindings, setUserBindings] = useState<UserDeviceBinding[]>([]);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);

  const loadBindings = useCallback(async () => {
    try {
      const activeComp = (selectedCompanyCode || currentUser?.companyCode || 'POLATLAR').toUpperCase();
      const list = await DeviceService.getUserDeviceBindings(activeComp);
      setUserBindings(list);
    } catch {
      // ignore
    }
  }, [selectedCompanyCode, currentUser?.companyCode]);

  const handleRefreshAll = useCallback(async () => {
    if (isRefreshingUsers || loadingAllBranches) return;
    setIsRefreshingUsers(true);
    try {
      await Promise.allSettled([
        loadCompaniesAndBranches(),
        refreshUsers(),
        loadBindings(),
      ]);
    } finally {
      setIsRefreshingUsers(false);
    }
  }, [loadCompaniesAndBranches, refreshUsers, loadBindings, isRefreshingUsers, loadingAllBranches]);

  const hasLoadedOnOpenRef = React.useRef(false);

  // Initial load when modal opens - runs exactly once per opening
  useEffect(() => {
    if (isOpen) {
      if (!hasLoadedOnOpenRef.current) {
        hasLoadedOnOpenRef.current = true;
        loadCompaniesAndBranches();
        loadBindings();
      }
    } else {
      hasLoadedOnOpenRef.current = false;
      setIsRefreshingUsers(false);
    }
  }, [isOpen, loadCompaniesAndBranches, loadBindings]);

  // When selected company changes in dropdown, refresh device bindings for that company
  useEffect(() => {
    if (isOpen && hasLoadedOnOpenRef.current) {
      loadBindings();
    }
  }, [isOpen, selectedCompanyCode, loadBindings]);

  // Filter users belonging to selected company
  const companyUsers = React.useMemo(() => {
    const currentCode = (isSuper ? selectedCompanyCode : userCompanyCode).toUpperCase();
    return users.filter(
      (u) => (u.companyCode || 'POLATLAR').toUpperCase() === currentCode
    );
  }, [users, isSuper, selectedCompanyCode, userCompanyCode]);

  // Search query for users list
  const [userSearchQuery, setUserSearchQuery] = useState('');
  // User status filter: 'all' | 'active' | 'passive'
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'passive'>('all');

  const activeUsersCount = useMemo(() => {
    return companyUsers.filter((u) => u.isActive !== false).length;
  }, [companyUsers]);

  const passiveUsersCount = useMemo(() => {
    return companyUsers.filter((u) => u.isActive === false).length;
  }, [companyUsers]);

  // Filter companyUsers by search query, branch name and active/passive status
  const filteredCompanyUsers = useMemo(() => {
    return companyUsers.filter((u) => {
      if (userStatusFilter === 'active' && u.isActive === false) return false;
      if (userStatusFilter === 'passive' && u.isActive !== false) return false;

      if (!userSearchQuery.trim()) return true;
      const q = userSearchQuery.toLowerCase().trim();
      const matchName = (u.name || '').toLowerCase().includes(q);
      const matchUsername = (u.username || '').toLowerCase().includes(q);
      const branch = allBranchesList.find((b) => b.assignedUserIds?.includes(u.id));
      const matchBranch = (branch?.name || '').toLowerCase().includes(q);
      return matchName || matchUsername || matchBranch;
    });
  }, [companyUsers, userSearchQuery, allBranchesList, userStatusFilter]);

  // Form states for adding user
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('staff');
  const [newBranchId, setNewBranchId] = useState<string>('');
  const [newTcNo, setNewTcNo] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [formMsg, setFormMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // States for editing user profile (TC, Phone, Address, Name, Department)
  const [editingProfileUser, setEditingProfileUser] = useState<UserAccount | null>(null);
  const [editName, setEditName] = useState('');
  const [editTcNo, setEditTcNo] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Hafızadaki bilinen bölümler (Bu firmaya ait personellerin bölümleri + maaş tanımları)
  const activeCompanyForDept = (isSuper ? (targetAddCompanyCode || selectedCompanyCode) : userCompanyCode).toUpperCase();
  const knownDepartments = useMemo(() => {
    const set = new Set<string>();
    companyUsers.forEach((u) => {
      if (u.department && u.department.trim()) {
        set.add(u.department.trim());
      }
    });
    departmentSalaries?.forEach((ds) => {
      if (
        (ds.companyCode || '').toUpperCase() === activeCompanyForDept &&
        ds.department &&
        ds.department.trim()
      ) {
        set.add(ds.department.trim());
      }
    });
    return Array.from(set).sort();
  }, [companyUsers, departmentSalaries, activeCompanyForDept]);

  // Random secure password generator (1 uppercase, 1 lowercase, 4 numbers, 1 symbol)
  const generateRandomPassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '?!*.-_#';

    const pUpper = upper[Math.floor(Math.random() * upper.length)];
    const pLower = lower[Math.floor(Math.random() * lower.length)];
    const pDigits = Array.from({ length: 4 }, () => numbers[Math.floor(Math.random() * numbers.length)]).join('');
    const pSymbol = symbols[Math.floor(Math.random() * symbols.length)];

    setNewPassword(`${pUpper}${pLower}${pDigits}${pSymbol}`);
  };

  // States for password edit modal/prompt
  const [editingPasswordUserId, setEditingPasswordUserId] = useState<string | null>(null);
  const [changedPassword, setChangedPassword] = useState('');

  const handleSaveProfile = async () => {
    if (!editingProfileUser) return;
    if (!editName.trim()) {
      alert('Personel adı boş bırakılamaz.');
      return;
    }
    setIsSavingProfile(true);
    try {
      const res = await updateUser(editingProfileUser.id, {
        name: editName.trim(),
        tcNo: editTcNo.trim() || undefined,
        phone: editPhone.trim() || undefined,
        address: editAddress.trim() || undefined,
        department: editDepartment.trim() || undefined,
      });
      if (res.success) {
        setEditingProfileUser(null);
        await refreshUsers();
      } else {
        alert(res.error || 'Profil güncellenemedi.');
      }
    } catch (e: any) {
      alert(e?.message || 'Bir hata oluştu.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // WhatsApp share modal state
  interface WhatsAppShareData {
    companyName: string;
    companyCode: string;
    userName: string;
    username: string;
    email?: string;
    role: string;
    newPassword?: string;
  }
  const [whatsappShareData, setWhatsappShareData] = useState<WhatsAppShareData | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

  const getWhatsAppText = (data: WhatsAppShareData) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://saha-takip-beige.vercel.app';
    const roleText = data.role === 'admin' ? 'Sistem Yöneticisi (Admin)' : 'Personel';
    const lines = [
      `🏢 *Firma / Kurum:* ${data.companyName}`,
      `🔑 *Kurum Kodu:* ${data.companyCode}`,
      `👤 *Yetkili / Personel:* ${data.userName} (${roleText})`,
      `👤 *Kullanıcı Adı:* ${data.username}${data.email ? ` (veya ${data.email})` : ''}`,
    ];
    if (data.newPassword) {
      lines.push(`🔒 *Giriş Şifresi:* ${data.newPassword}`);
    }
    lines.push(`🌐 *Giriş Linki:* ${origin}`);
    lines.push(``);
    lines.push(`💡 *Giriş Talimatı:* Sisteme giriş yaparken Kurum Kodu kutucuğuna "${data.companyCode}", Kullanıcı Adı kutucuğuna "${data.username}" ve şifrenizi yazınız.`);
    return lines.join('\n');
  };

  const handleSendWhatsApp = (data: WhatsAppShareData) => {
    const text = getWhatsAppText(data);
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyWhatsAppText = (data: WhatsAppShareData) => {
    const text = getWhatsAppText(data);
    navigator.clipboard.writeText(text);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };



  const handleResetDeviceLock = async (userId: string, userName: string, companyCode?: string) => {
    if (
      !window.confirm(
        `"${userName}" kullanıcısının telefon cihaz kilidini sıfırlamak istediğinize emin misiniz?\n\nKilit kaldırıldığında personel yeni telefonundan sisteme girdiği anda yeni cihazı sisteme otomatik kilitlenecektir.`
      )
    ) {
      return;
    }

    try {
      setResettingUserId(userId);
      const activeComp = (companyCode || (isSuper ? selectedCompanyCode : userCompanyCode) || 'POLATLAR').toUpperCase();
      await DeviceService.unbindUserDevice(userId, activeComp);
      await loadBindings();
      alert(`"${userName}" kullanıcısının cihaz kilidi başarıyla sıfırlandı.`);
    } catch (err: any) {
      alert(err?.message || 'Cihaz kilidi sıfırlanamadı.');
    } finally {
      setResettingUserId(null);
    }
  };

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setNewName(val);
    const suggested = suggestUsername(val);
    setNewUsername(suggested);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);

    const compCodeToUse = (isSuper ? (targetAddCompanyCode || selectedCompanyCode) : userCompanyCode).toUpperCase();

    const res = await addUser({
      username: newUsername,
      password: newPassword,
      name: newName,
      role: newRole,
      companyCode: compCodeToUse,
      tcNo: newTcNo.trim() || undefined,
      phone: newPhone.trim() || undefined,
      address: newAddress.trim() || undefined,
      department: newDepartment.trim() || undefined,
    });

    if (res.success) {
      if (newBranchId && res.user?.id) {
        const targetBranch = allBranchesList.find((b) => b.id === newBranchId);
        const branchCompCode = (targetBranch?.companyCode || compCodeToUse).toUpperCase();
        const existingIds = targetBranch?.assignedUserIds || [];
        if (!existingIds.includes(res.user.id)) {
          await assignStaffToBranch(newBranchId, [...existingIds, res.user.id], branchCompCode);
        }
      }
      setFormMsg({ type: 'success', text: `"${newUsername}" kullanıcısı (${compCodeToUse}) başarıyla eklendi.` });
      setNewUsername('');
      setNewPassword('');
      setNewName('');
      setNewRole('staff');
      setNewBranchId('');
      setNewTcNo('');
      setNewPhone('');
      setNewAddress('');
      setNewDepartment('');
      await loadCompaniesAndBranches();
      setTimeout(() => {
        setActiveSubTab('list');
        setFormMsg(null);
      }, 1200);
    } else {
      setFormMsg({ type: 'error', text: res.error || 'Kullanıcı eklenemedi.' });
    }
  };

  const handleRoleToggle = async (userId: string, currentRole: UserRole) => {
    const nextRole: UserRole = currentRole === 'admin' ? 'staff' : 'admin';
    const roleName = nextRole === 'admin' ? 'Sistem Yöneticisi (Admin)' : 'Personel';

    if (
      window.confirm(
        `Bu kullanıcının yetkisini "${roleName}" olarak değiştirmek istediğinize emin misiniz?`
      )
    ) {
      const res = await updateUser(userId, { role: nextRole });
      if (!res.success && res.error) {
        alert(res.error);
      }
    }
  };

  const handleSaveNewPassword = async (userId: string) => {
    if (!changedPassword || changedPassword.length < 3) {
      alert('Şifre en az 3 karakter olmalıdır.');
      return;
    }
    const savedPass = changedPassword;
    const res = await updateUser(userId, { password: savedPass });
    if (res.success) {
      const targetUser = companyUsers.find((u) => u.id === userId);
      const compName = visibleCompanies.find(c => c.code.toUpperCase() === (targetUser?.companyCode || selectedCompanyCode).toUpperCase())?.name || targetUser?.companyCode || selectedCompanyCode;
      
      setWhatsappShareData({
        companyName: compName,
        companyCode: (targetUser?.companyCode || selectedCompanyCode).toUpperCase(),
        userName: targetUser?.name || 'Kullanıcı',
        username: targetUser?.username || 'admin',
        email: targetUser?.email,
        role: targetUser?.role || 'staff',
        newPassword: savedPass,
      });

      setEditingPasswordUserId(null);
      setChangedPassword('');
    } else {
      alert(res.error || 'Şifre güncellenemedi.');
    }
  };

  const handleToggleActive = async (account: UserAccount) => {
    const isCurrentlyPassive = account.isActive === false;
    const nextActive = isCurrentlyPassive; // if passive, turn active (true); if active, turn passive (false)

    if (account.id === currentUser?.id) {
      alert('Kendi hesabınızı pasife alamazsınız.');
      return;
    }

    if (!nextActive) {
      // Pasife alma onayı
      const confirmMsg = `"${account.name || account.username}" kullanıcısını PASİFE almak istediğinize emin misiniz?\n\n• Bu kullanıcı kullanıcı adı ve şifresiyle sisteme giriş yapamayacaktır.\n• Geçmiş tüm kayıtları (iş emirleri, kurulumlar, servisler, maaş ve personel takibi) yöneticide eksiksiz görünmeye devam edecektir.\n• İleride dilediğiniz zaman tekrar aktif edebilirsiniz.`;
      if (!window.confirm(confirmMsg)) return;
    } else {
      // Aktif etme onayı
      const confirmMsg = `"${account.name || account.username}" kullanıcısını tekrar AKTİF etmek istediğinize emin misiniz?\n\nKullanıcı mevcut şifresiyle sisteme tekrar giriş yapabilecektir.`;
      if (!window.confirm(confirmMsg)) return;
    }

    const res = await updateUser(account.id, { isActive: nextActive });
    if (!res.success && res.error) {
      alert(res.error);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Kullanıcı ve Yetki Yönetimi"
      maxWidth="max-w-5xl"
      fullScreenOnMobile={true}
    >
      <div className="space-y-4">
        {/* Company Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-blue-50/90 dark:from-blue-950/50 dark:via-indigo-950/30 dark:to-blue-950/50 border border-blue-200/90 dark:border-blue-900/60 text-xs shadow-xs">
          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
            <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="font-extrabold text-blue-900 dark:text-blue-200 shrink-0 text-xs">
              Kurum:
            </span>
            {isSuper && visibleCompanies.length > 1 ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <select
                  value={selectedCompanyCode}
                  onChange={(e) => {
                    const newCode = e.target.value.toUpperCase();
                    setSelectedCompanyCode(newCode);
                    setTargetAddCompanyCode(newCode);
                  }}
                  className="max-w-[190px] sm:max-w-xs truncate px-3 py-1.5 rounded-xl border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 text-xs font-black text-slate-900 dark:text-slate-100 shadow-xs focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  title="Yönetmek istediğiniz kurumu seçin"
                >
                  {visibleCompanies.map((c) => (
                    <option key={c.code} value={c.code.toUpperCase()}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleRefreshAll()}
                  disabled={loadingAllBranches || isRefreshingUsers}
                  className="p-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg cursor-pointer disabled:opacity-50 transition-all shrink-0"
                  title="Kurum, şube ve kullanıcı listesini sunucudan yenile"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAllBranches || isRefreshingUsers ? 'animate-spin' : ''}`} />
                </button>
              </div>
            ) : (
              <span className="font-black text-blue-900 dark:text-blue-100 text-sm truncate">
                {company?.name || userCompanyCode}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {isSuper && (
              <button
                type="button"
                onClick={() => setIsCreateCompanyOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer active:scale-95 shrink-0"
                title="Yeni bir müşteri firması/kurumu oluşturun"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>+ Yeni Kurum Ekle</span>
              </button>
            )}
            <span className="px-2.5 py-1 rounded-xl font-black bg-blue-700 text-white text-[11px] tracking-wider shadow-xs shrink-0">
              KURUM KODU: {isSuper ? selectedCompanyCode : userCompanyCode}
            </span>
          </div>
        </div>

        {/* Sub Tabs */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/80">
          <button
            onClick={() => {
              setActiveSubTab('list');
              setFormMsg(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'list'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Kullanıcı Listesi ({companyUsers.length})</span>
            {isRefreshingUsers && (
              <RefreshCw className="w-3 h-3 text-blue-500 animate-spin shrink-0" />
            )}
          </button>

          <button
            onClick={() => {
              setActiveSubTab('add');
              setFormMsg(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'add'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Yeni Kullanıcı Ekle</span>
          </button>
        </div>

        {/* Tab 1: Users List */}
        {activeSubTab === 'list' && (
          <div className="space-y-3">
            {/* Search Input for User List */}
            {companyUsers.length > 0 && (
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder={`Personel adı, kullanıcı adı veya şube ara... (${filteredCompanyUsers.length}/${companyUsers.length})`}
                  className="w-full pl-9 pr-8 py-2.5 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-all"
                />
                {userSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setUserSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                    title="Aramayı Temizle"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Status Filter Pills: Tümü, Aktif, Pasif */}
            {companyUsers.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                <button
                  type="button"
                  onClick={() => setUserStatusFilter('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    userStatusFilter === 'all'
                      ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Tümü ({companyUsers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setUserStatusFilter('active')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    userStatusFilter === 'active'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Aktif ({activeUsersCount})</span>
                </button>
                {passiveUsersCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setUserStatusFilter('passive')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      userStatusFilter === 'passive'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-850 hover:bg-amber-100'
                    }`}
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Pasif ({passiveUsersCount})</span>
                  </button>
                )}
              </div>
            )}

            <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
              {filteredCompanyUsers.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-medium bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  {isRefreshingUsers ? (
                    <div className="flex flex-col items-center justify-center py-4 gap-2">
                      <RefreshCw className="w-7 h-7 text-blue-500 animate-spin" />
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                        "{selectedCompanyCode}" kullanıcıları sunucudan yükleniyor...
                      </p>
                    </div>
                  ) : (
                    <>
                      <Users className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                      {companyUsers.length === 0 ? (
                        <>
                          <p>"{selectedCompanyCode}" kurumuna ait kayıtlı kullanıcı bulunamadı.</p>
                          <div className="flex items-center justify-center gap-3 mt-3">
                            <button
                              type="button"
                              onClick={() => handleRefreshAll()}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-bold hover:bg-blue-100 cursor-pointer text-xs"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Tekrar Dene / Yenile
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTargetAddCompanyCode(selectedCompanyCode);
                                setActiveSubTab('add');
                              }}
                              className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                            >
                              + Yeni Kullanıcı Ekle
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p>"{userSearchQuery}" aramasına uygun personel bulunamadı.</p>
                          <button
                            type="button"
                            onClick={() => setUserSearchQuery('')}
                            className="mt-2 text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                          >
                            Aramayı Temizle
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              ) : (
                filteredCompanyUsers.map((account) => {
                const isAdmin = isUserAdmin(account);
                const isCurrent = currentUser?.id === account.id;
                const isPassive = account.isActive === false;
                const binding = userBindings.find(
                  (b) =>
                    b.userId === account.id ||
                    (b.username && b.username.toLowerCase() === account.username.toLowerCase())
                );
                const userBranch = allBranchesList.find((b) => b.assignedUserIds?.includes(account.id));

                return (
                  <div
                    key={account.id}
                    className={`rounded-2xl p-4 border space-y-3 transition-all ${
                      isPassive
                        ? 'bg-amber-50/20 dark:bg-amber-950/15 border-amber-300/60 dark:border-amber-900/50'
                        : 'bg-slate-50 dark:bg-slate-900/90 border-slate-200/80 dark:border-slate-700/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* User Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 ${
                            isPassive
                              ? 'bg-gradient-to-br from-slate-400 to-slate-600 shadow-xs'
                              : isAdmin
                              ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-xs'
                              : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                          }`}
                        >
                          {isAdmin ? <Crown className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                              {account.name}
                            </h4>
                            {isCurrent && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                                Siz
                              </span>
                            )}
                            {isPassive && (
                              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 inline-flex items-center gap-1">
                                <UserX className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                Pasif
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 font-mono block truncate">
                            @{account.username}
                          </span>

                          {/* Device Lock Status Badge */}
                          {binding && (
                            <div className="flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-1">
                              <Smartphone className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              <span className="truncate">
                                Kilitli Cihaz: <strong>{binding.boundDeviceName || binding.boundDeviceId}</strong>
                              </span>
                            </div>
                          )}
                          {!binding && !isAdmin && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium mt-1">
                              <Smartphone className="w-3.5 h-3.5 opacity-50 shrink-0" />
                              <span>Cihaz henüz kilitlenmedi (İlk girişte kilitlenecek)</span>
                            </div>
                          )}

                          {/* Branch Selector */}
                          <div className="flex items-center gap-1.5 text-[11px] mt-1.5">
                            <Store className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                            {(() => {
                              const accountComp = (account.companyCode || (isSuper ? selectedCompanyCode : userCompanyCode)).trim().toUpperCase();
                              const compBranches = allBranchesMap[accountComp] || (accountComp === userCompanyCode ? branches : []);
                              return (
                                <select
                                  value={userBranch?.id || ''}
                                  onChange={async (e) => {
                                    const targetBId = e.target.value;
                                    if (!targetBId) {
                                      if (userBranch) {
                                        const filtered = (userBranch.assignedUserIds || []).filter(
                                          (uid) => uid !== account.id
                                        );
                                        await assignStaffToBranch(userBranch.id, filtered, userBranch.companyCode || accountComp);
                                        await loadCompaniesAndBranches();
                                      }
                                    } else {
                                      const targetB = compBranches.find((b) => b.id === targetBId) || allBranchesList.find((b) => b.id === targetBId);
                                      const branchCompCode = targetB?.companyCode || accountComp;
                                      const existingIds = targetB?.assignedUserIds || [];
                                      if (!existingIds.includes(account.id)) {
                                        await assignStaffToBranch(targetBId, [...existingIds, account.id], branchCompCode);
                                        await loadCompaniesAndBranches();
                                      }
                                    }
                                  }}
                                  className="text-[11px] font-semibold py-0.5 px-2 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer max-w-[200px] truncate"
                                  title="Personelin bağlı olduğu şubeyi seçin"
                                >
                                  <option value="">Şube: Atanmamış (Merkez)</option>
                                  {compBranches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                      {b.name}
                                    </option>
                                  ))}
                                </select>
                              );
                            })()}
                          </div>

                          {/* Bölüm, TC, Phone & Address Pill info */}
                          {(account.department || account.tcNo || account.phone || account.address) && (
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 pt-1 border-t border-slate-200/50 dark:border-slate-800/60">
                              {account.department && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200/60 dark:border-indigo-900/50">
                                  <Briefcase className="w-3 h-3 text-indigo-500" />
                                  {account.department}
                                </span>
                              )}
                              {account.tcNo && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-mono font-bold">
                                  <CreditCard className="w-3 h-3 text-blue-500" />
                                  TC: {account.tcNo}
                                </span>
                              )}
                              {account.phone && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium">
                                  <Phone className="w-3 h-3 text-emerald-500" />
                                  {account.phone}
                                </span>
                              )}
                              {account.address && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 truncate max-w-[240px]" title={account.address}>
                                  <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                                  {account.address}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Role Pill */}
                      <button
                        onClick={() => handleRoleToggle(account.id, account.role)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border shrink-0 ${
                          isAdmin
                            ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/80 hover:bg-amber-100'
                            : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/80 hover:bg-blue-100'
                        }`}
                        title="Yetkiyi Değiştirmek İçin Tıklayın"
                      >
                        {isAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                        <span>{isAdmin ? 'Yönetici (Admin)' : 'Personel'}</span>
                      </button>
                    </div>

                    {/* Password Changer inline box */}
                    {editingPasswordUserId === account.id ? (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                        <div className="flex-1 flex items-center gap-1.5 min-w-0">
                          <input
                            type="text"
                            value={changedPassword}
                            onChange={(e) => setChangedPassword(e.target.value)}
                            placeholder="Yeni şifre belirleyin..."
                            autoFocus
                            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
                              const lower = 'abcdefghjkmnpqrstuvwxyz';
                              const numbers = '0123456789';
                              const symbols = '?!*.-_#';
                              const pUpper = upper[Math.floor(Math.random() * upper.length)];
                              const pLower = lower[Math.floor(Math.random() * lower.length)];
                              const pDigits = Array.from({ length: 4 }, () => numbers[Math.floor(Math.random() * numbers.length)]).join('');
                              const pSymbol = symbols[Math.floor(Math.random() * symbols.length)];
                              setChangedPassword(`${pUpper}${pLower}${pDigits}${pSymbol}`);
                            }}
                            className="px-2 py-1.5 rounded-lg text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 cursor-pointer shrink-0"
                            title="Rastgele güvenli şifre üret"
                          >
                            🎲 Rastgele
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 justify-end">
                          <button
                            type="button"
                            onClick={() => handleSaveNewPassword(account.id)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            <span>Kaydet & WhatsApp</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPasswordUserId(null);
                              setChangedPassword('');
                            }}
                            className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            İptal
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {/* Actions Row */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                      <span className="text-[11px] text-slate-400">
                        Eklenme: {new Date(account.createdAt).toLocaleDateString('tr-TR')}
                      </span>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {!isAdmin && (
                          <button
                            type="button"
                            disabled={resettingUserId === account.id}
                            onClick={() => handleResetDeviceLock(account.id, account.name, account.companyCode)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                              binding?.boundDeviceId
                                ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/70'
                                : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                            }`}
                            title="Personelin cihaz kilidini sıfırlayın (Yeni telefondan giriş yapabilmesi için)"
                          >
                            <Unlock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                            <span>
                              {resettingUserId === account.id
                                ? 'Sıfırlanıyor...'
                                : binding?.boundDeviceId
                                ? '🔓 Kilidi Sıfırla'
                                : '🔓 Kilit Sıfırla'}
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            const compName = visibleCompanies.find(c => c.code.toUpperCase() === (account.companyCode || selectedCompanyCode).toUpperCase())?.name || account.companyCode || selectedCompanyCode;
                            setWhatsappShareData({
                              companyName: compName,
                              companyCode: (account.companyCode || selectedCompanyCode).toUpperCase(),
                              userName: account.name,
                              username: account.username,
                              email: account.email,
                              role: account.role,
                            });
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                          title="Giriş bilgilerini WhatsApp ile gönder veya panoya kopyala"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>WhatsApp</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingProfileUser(account);
                            setEditName(account.name || '');
                            setEditTcNo(account.tcNo || '');
                            setEditPhone(account.phone || '');
                            setEditAddress(account.address || '');
                            setEditDepartment(account.department || '');
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80 font-semibold transition-colors cursor-pointer"
                          title="Personel Bilgilerini (Ad, T.C. No, Telefon, Adres) Düzenle"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                          <span>Düzenle</span>
                        </button>

                        <button
                          onClick={() => {
                            setEditingPasswordUserId(
                              editingPasswordUserId === account.id ? null : account.id
                            );
                            setChangedPassword('');
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80 font-semibold transition-colors cursor-pointer"
                        >
                          <Key className="w-3.5 h-3.5 text-amber-500" />
                          <span>Şifre Belirle</span>
                        </button>

                        {isPassive ? (
                          <button
                            type="button"
                            onClick={() => handleToggleActive(account)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                            title="Kullanıcıyı Tekrar Aktif Et (Giriş yapabilmesi için)"
                          >
                            <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Aktif Et</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isCurrent}
                            onClick={() => handleToggleActive(account)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              isCurrent
                                ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
                                : 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800/80'
                            }`}
                            title={
                              isCurrent
                                ? 'Kendi hesabınızı pasife alamazsınız'
                                : 'Kullanıcıyı Pasife Al (Giriş yapamaz, geçmiş tüm kayıtları yöneticide kalır)'
                            }
                          >
                            <UserX className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>Pasife Al</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            </div>
          </div>
        )}

        {/* Tab 2: Add User Form */}
        {activeSubTab === 'add' && (
          <form onSubmit={handleAddSubmit} className="space-y-4">
            {formMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  formMsg.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                }`}
              >
                {formMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                ) : null}
                <span>{formMsg.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* 0. Kurum / Firma Seçimi (Tüm Kurumlar - Sadece Süper Admin) */}
              {isSuper && companies.length > 0 && (
                <div className="sm:col-span-2 p-3.5 rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-blue-50/80 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-blue-950/40 border border-blue-200/90 dark:border-blue-800/60 space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Personelin Ekleneceği Kurum / Firma</span> <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] font-black text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800 shadow-2xs">
                      Seçili Kod: {targetAddCompanyCode}
                    </span>
                  </div>
                  <select
                    value={targetAddCompanyCode}
                    onChange={(e) => {
                      const selected = e.target.value.toUpperCase();
                      setTargetAddCompanyCode(selected);
                      setSelectedCompanyCode(selected);
                      setNewBranchId('');
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-blue-200 dark:border-blue-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
                  >
                    {companies.map((c) => (
                      <option key={c.code} value={c.code.toUpperCase()}>
                        🏢 {c.name} (Kurum Kodu: {c.code})
                      </option>
                    ))}
                  </select>
                  <span className="block text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                    💡 Bu kullanıcı hesabı doğrudan <strong>{targetAddCompanyCode}</strong> kurumu altında açılacaktır.
                  </span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Ad Soyad / Unvan
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Örn: Ahmet Yılmaz"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Username (Auto-suggested) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Kullanıcı Adı (Giriş için)
                  </label>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                    ✨ Otomatik üretildi
                  </span>
                </div>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="Örn: ayilmaz (veya mayilmaz)"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs sm:text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Password with Random Generator Button */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Giriş Şifresi
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[11px] text-blue-600 hover:text-blue-700 dark:text-blue-400 font-bold flex items-center gap-1 cursor-pointer hover:underline"
                    title="1 Büyük harf, 1 Küçük harf, 4 Rakam ve 1 Simge içeren rastgele şifre üret"
                  >
                    <Sparkles className="w-3 h-3 text-blue-500" />
                    <span>🎲 Rastgele Şifre</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Örn: Pa4534! (veya Rastgele Şifre üretin)"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs sm:text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Yetki Seviyesi (Rol)
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="staff">Personel</option>
                  <option value="admin">Sistem Yöneticisi (Admin - Tam Yetkili)</option>
                </select>
              </div>

              {/* Branch Selection (Filtered by Target Company) */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-blue-600" />
                    <span>Bağlı Olacağı Şube (Mesai Takibi İçin)</span>
                  </label>
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                    🏢 {isSuper ? `Kurum: ${targetAddCompanyCode}` : 'Kurum Şubeleri'}
                  </span>
                </div>
                {(() => {
                  const targetComp = (isSuper ? targetAddCompanyCode : userCompanyCode).trim().toUpperCase();
                  const compBranches = allBranchesMap[targetComp] || (targetComp === userCompanyCode ? branches : []);
                  return (
                    <select
                      value={newBranchId}
                      onChange={(e) => {
                        const bId = e.target.value;
                        setNewBranchId(bId);
                        if (isSuper && bId) {
                          const foundBranch = compBranches.find((b) => b.id === bId) || allBranchesList.find((b) => b.id === bId);
                          if (foundBranch?.companyCode) {
                            setTargetAddCompanyCode(foundBranch.companyCode.toUpperCase());
                            setSelectedCompanyCode(foundBranch.companyCode.toUpperCase());
                          }
                        }
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="">🏢 Şube Seçilmedi (Genel / Merkez)</option>
                      {compBranches.length === 0 ? (
                        <option disabled value="no-branch">
                          &nbsp;&nbsp;— Bu kuruma ait henüz şube yok —
                        </option>
                      ) : (
                        compBranches.map((b) => (
                          <option key={b.id} value={b.id}>
                            📍 {b.name} {b.address ? `• ${b.address}` : ''}
                          </option>
                        ))
                      )}
                    </select>
                  );
                })()}
                <p className="text-[11px] text-slate-500 mt-1">
                  Personel sadece atandığı şubenin 20 metre çapında doğrudan mesaiye başlayabilir. Farklı şubede mesaiye başlamak için yönetici onayı gerekecektir.
                </p>
              </div>

              {/* Bölüm / Departman (Maaş ve Personel Takibi İçin) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                    <span>Bölüm / Departman</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal lowercase">(opsiyonel)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    list="company-departments-list-add"
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    placeholder="Örn: Yazılım, Saha, Muhasebe..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <datalist id="company-departments-list-add">
                    {knownDepartments.map((dept) => (
                      <option key={dept} value={dept} />
                    ))}
                  </datalist>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Elle girdiğiniz bölümler firma hafızasında saklanır ve Maaş Takibi modülünde otomatik maaş tutarı belirlemek için kullanılır.
                </p>
              </div>

              {/* Personel Özlük / Maaş Bilgileri (Opsiyonel) */}
              <div className="sm:col-span-2 pt-3 border-t border-slate-200/70 dark:border-slate-800">
                <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                  <span>Personel Özlük & Maaş Bilgileri (Opsiyonel)</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      T.C. Kimlik No <span className="text-[10px] text-slate-400 font-normal lowercase">(opsiyonel)</span>
                    </label>
                    <input
                      type="text"
                      maxLength={11}
                      value={newTcNo}
                      onChange={(e) => setNewTcNo(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder="11 haneli T.C. Kimlik No"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs sm:text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Telefon Numarası <span className="text-[10px] text-slate-400 font-normal lowercase">(opsiyonel)</span>
                    </label>
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="Örn: 0555 123 45 67"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      İkametgah / Açık Adres <span className="text-[10px] text-slate-400 font-normal lowercase">(opsiyonel)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={newAddress}
                      onChange={(e) => setNewAddress(e.target.value)}
                      placeholder="Örn: Atatürk Mah. Cumhuriyet Cad. No: 12 Kadıköy / İstanbul"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <span className="font-bold text-blue-700 dark:text-blue-300 block mb-1">
                Yetki Bilgilendirmesi:
              </span>
              • <strong>Sistem Yöneticisi (Admin)</strong>: Diğer kullanıcıları yönetebilir, yeni kullanıcılar ekleyebilir ve yetkilerini değiştirebilir.
              <br />• <strong>Personel</strong>: Kurulumları, iş emirlerini ve şablonları yönetebilir fakat Kullanıcı Yönetim Paneline erişemez.
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white text-xs sm:text-sm font-extrabold shadow-md transition-all active:scale-[0.99] cursor-pointer"
            >
              Kullanıcıyı Kaydet
            </button>
          </form>
        )}
      </div>

      {/* Create Company Modal (For Polatlar Super Admins) */}
      {isSuper && (
        <CreateCompanyModal
          isOpen={isCreateCompanyOpen}
          onClose={() => {
            setIsCreateCompanyOpen(false);
            loadCompaniesAndBranches();
          }}
        />
      )}

      {/* WhatsApp Share Credentials Modal */}
      {whatsappShareData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    Giriş Bilgilerini Paylaş
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    WhatsApp üzerinden veya metin olarak gönderin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWhatsappShareData(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message preview box */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 space-y-1.5 whitespace-pre-wrap select-all leading-relaxed max-h-56 overflow-y-auto">
              {getWhatsAppText(whatsappShareData)}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleCopyWhatsAppText(whatsappShareData)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                {copiedShare ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500 stroke-[3]" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-black">Kopyalandı!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-500" />
                    <span>Metni Kopyala</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleSendWhatsApp(whatsappShareData)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md shadow-emerald-600/25 transition-all cursor-pointer active:scale-95"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp'ta Aç</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Profile Modal (TC No, Phone, Address, Name) */}
      {editingProfileUser && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    Personel Bilgilerini Düzenle
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    @{editingProfileUser.username}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingProfileUser(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Ad Soyad / Unvan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    T.C. Kimlik No <span className="text-[10px] lowercase text-slate-400 font-normal">(opsiyonel)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={11}
                    value={editTcNo}
                    onChange={(e) => setEditTcNo(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    placeholder="11 haneli T.C. No"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Telefon Numarası <span className="text-[10px] lowercase text-slate-400 font-normal">(opsiyonel)</span>
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="0555 123 45 67"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                    <span>Bölüm / Departman</span>
                  </span>
                  <span className="text-[10px] lowercase text-slate-400 font-normal">(opsiyonel)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    list="company-departments-list-edit"
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    placeholder="Örn: Yazılım, Saha, Muhasebe..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <datalist id="company-departments-list-edit">
                    {knownDepartments.map((dept) => (
                      <option key={dept} value={dept} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  İkametgah / Açık Adres <span className="text-[10px] lowercase text-slate-400 font-normal">(opsiyonel)</span>
                </label>
                <textarea
                  rows={2}
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="İkametgah / açık adres..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-[11px] text-blue-700 dark:text-blue-300">
                💡 Bu bilgiler maaş pusulasında, resmi bordro çıktılarında ve personel dosyasında otomatik olarak görünecektir.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingProfileUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSavingProfile ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
