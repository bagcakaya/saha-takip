import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Building2,
  Plus,
  Search,
  MapPin,
  Users,
  ExternalLink,
  Edit3,
  Trash2,
  Phone,
  Loader2,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Smartphone,
  CheckCircle2,
  Store,
  X,
  Save,
} from 'lucide-react';
import { useStorage } from '../context/StorageContext';
import { useAuth } from '../context/AuthContext';
import { canUserAddBranch, canUserManageInstitutionsAndBranches, Company } from '../types/auth';
import { Branch } from '../types/storage';
import { LocationService } from '../services/locationService';
import { CompanyService } from '../services/companyService';
import { StorageService } from '../services/storageService';
import { DeviceService } from '../services/deviceService';
import { UserService } from '../services/userService';
import { BranchModal } from '../components/branches/BranchModal';
import { BranchStaffModal } from '../components/branches/BranchStaffModal';
import { CreateCompanyModal } from '../components/auth/CreateCompanyModal';

export const BranchesView: React.FC = () => {
  const { user, users, updateUser } = useAuth();
  const {
    branches,
    addBranch,
    updateBranch,
    deleteBranch,
    assignStaffToBranch,
    attendanceRecords,
  } = useStorage();

  const canAddBranch = canUserAddBranch(user);
  const currentCompCode = useMemo(() => (user?.companyCode || 'POLATLAR').trim().toUpperCase(), [user]);

  const [searchQuery, setSearchQuery] = useState('');
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);
  const [companyBranchesMap, setCompanyBranchesMap] = useState<Record<string, Branch[]>>({});
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  // Accordion expanded states
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(() => new Set([currentCompCode]));
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());

  // Modal states
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [targetCompanyForBranch, setTargetCompanyForBranch] = useState<string>(currentCompCode);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [assigningBranch, setAssigningBranch] = useState<Branch | null>(null);

  // Password change modal state
  const [passwordModalUser, setPasswordModalUser] = useState<{ id: string; name: string; username: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // User coords for distance
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    LocationService.getCurrentPosition()
      .then((pos) => setUserCoords({ lat: pos.latitude, lon: pos.longitude }))
      .catch(() => {});
  }, []);

  const loadAllCompaniesAndBranches = useCallback(async () => {
    setLoadingCompanies(true);
    try {
      const compList = await CompanyService.fetchCompanies();
      setAvailableCompanies(compList);

      const map: Record<string, Branch[]> = {};
      map['POLATLAR'] = branches;

      // Load branches for other companies
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
      setLoadingCompanies(false);
    }
  }, [branches]);

  useEffect(() => {
    loadAllCompaniesAndBranches();
  }, [loadAllCompaniesAndBranches]);

  // Keep POLATLAR branches synchronized with StorageContext
  useEffect(() => {
    setCompanyBranchesMap((prev) => ({
      ...prev,
      POLATLAR: branches,
    }));
  }, [branches]);

  const toggleCompany = (code: string) => {
    setExpandedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const toggleBranch = (branchId: string) => {
    setExpandedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(branchId)) {
        next.delete(branchId);
      } else {
        next.add(branchId);
      }
      return next;
    });
  };

  // Today's attendance
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

  // Count metrics
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
      totalAssignedStaff: assignedUserSet.size,
      activeStaffToday: activeStaffTodaySet.size,
    };
  }, [availableCompanies, companyBranchesMap, activeStaffTodaySet]);

  // Staff reset device lock action
  const handleResetDeviceLock = async (staffId: string, staffName: string) => {
    if (!window.confirm(`"${staffName}" kullanıcısının cihaz kilidini sıfırlamak istediğinize emin misiniz?\n\nKullanıcı yeni telefonundan giriş yaptığında sistem otomatik olarak yeni cihazıyla eşleşecektir.`)) {
      return;
    }
    try {
      await DeviceService.unbindUserDevice(staffId);
      alert(`✅ "${staffName}" kullanıcısının cihaz kilidi başarıyla kaldırıldı.`);
    } catch (e: any) {
      alert('Hata: ' + (e?.message || 'Cihaz kilidi kaldırılamadı.'));
    }
  };

  // Staff change password action
  const handleSavePassword = async () => {
    if (!passwordModalUser) return;
    if (!newPassword || newPassword.trim().length < 3) {
      alert('Şifre en az 3 karakter olmalıdır.');
      return;
    }
    setIsUpdatingPassword(true);
    try {
      const res = await updateUser(passwordModalUser.id, { password: newPassword.trim() });
      if (res.success) {
        setPasswordSuccess(`"${passwordModalUser.name}" kullanıcısının şifresi başarıyla güncellendi.`);
        setTimeout(() => {
          setPasswordModalUser(null);
          setNewPassword('');
          setPasswordSuccess('');
        }, 1200);
      } else {
        alert(res.error || 'Şifre güncellenemedi.');
      }
    } catch (e: any) {
      alert('Hata: ' + (e?.message || 'Şifre güncellenemedi.'));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleDeleteBranch = async (b: Branch, companyCode: string) => {
    if (!canAddBranch) {
      alert('Şube silme yetkisi sadece POLATLAR yöneticilerine aittir.');
      return;
    }
    if (!window.confirm(`"${b.name}" şubesini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) {
      return;
    }
    try {
      await deleteBranch(b.id, companyCode);
      setCompanyBranchesMap((prev) => ({
        ...prev,
        [companyCode]: (prev[companyCode] || []).filter((item) => item.id !== b.id),
      }));
    } catch (e) {
      console.error('Şube silinirken hata oluştu:', e);
    }
  };

  const handleDeleteCompany = async (comp: Company) => {
    if (!canUserManageInstitutionsAndBranches(user)) {
      alert('Kurum silme yetkisi sadece POLATLAR ana yöneticilerine (admin ve murat) aittir.');
      return;
    }
    const cleanCode = comp.code.toUpperCase();
    if (cleanCode === 'POLATLAR') {
      alert('Ana sistem kurumu (POLATLAR) silinemez.');
      return;
    }
    if (
      !window.confirm(
        `"${comp.name}" (${comp.code}) kurumunu silmek istediğinize emin misiniz?\n\n⚠️ DİKKAT: Bu işlem geri alınamaz! Kurum, bağlı tüm şubeleri ve personelleri sistemden tamamen silinecektir.`
      )
    ) {
      return;
    }
    try {
      const res = await CompanyService.deleteCompany(cleanCode);
      if (res.success) {
        // Clear branches in cloud slot 14
        await StorageService.saveBranchesForCompany(cleanCode, []);
        // Delete users associated with this company
        await UserService.deleteUsersForCompany(cleanCode);
        // Refresh local states
        setAvailableCompanies((prev) => prev.filter((c) => c.code.toUpperCase() !== cleanCode));
        setCompanyBranchesMap((prev) => {
          const next = { ...prev };
          delete next[cleanCode];
          return next;
        });
        alert(`✅ "${comp.name}" kurumu ve tüm şubeleri başarıyla silindi.`);
      } else {
        alert('Hata: ' + (res.error || 'Kurum silinemedi.'));
      }
    } catch (e: any) {
      alert('Hata: ' + (e?.message || 'Kurum silinirken bir hata oluştu.'));
    }
  };

  const handleOpenAddBranch = (companyCode: string) => {
    setTargetCompanyForBranch(companyCode);
    setEditingBranch(null);
    setIsAddBranchOpen(true);
  };

  // Filtered companies based on search
  const filteredCompanies = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return availableCompanies;

    return availableCompanies.filter((comp) => {
      const compCode = comp.code.toUpperCase();
      const compMatch = comp.name.toLowerCase().includes(q) || compCode.toLowerCase().includes(q);
      const bList = companyBranchesMap[compCode] || [];
      const branchMatch = bList.some(
        (b) => b.name.toLowerCase().includes(q) || (b.address || '').toLowerCase().includes(q)
      );
      const compUsers = users.filter((u) => (u.companyCode || 'POLATLAR').toUpperCase() === compCode);
      const userMatch = compUsers.some((u) => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));

      return compMatch || branchMatch || userMatch;
    });
  }, [availableCompanies, searchQuery, companyBranchesMap, users]);

  if (!canUserManageInstitutionsAndBranches(user)) {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-3xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-sm">
          <Building2 className="w-8 h-8" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Yetkisiz Erişim</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            Kurum ve şubeler yönetimi yalnızca POLATLAR ana sistem yöneticilerine ('admin' ve 'murat') açıktır.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* 1. Header Banner & Top Stats */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-blue-800/50">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-blue-500/25 text-blue-300 border border-blue-400/30 backdrop-blur-xs flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Kurum, Şube & Personel Yönetimi
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/10 text-slate-300">
                20m Mesai Yarıçapı
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Kurum ve Şubeler Masası
            </h1>
            <p className="text-xs sm:text-sm text-blue-200/90 max-w-xl leading-relaxed">
              Tüm kurumları, bağlı şubeleri ve personelleri tek ekrandan yönetin. Şube mesai alanlarını belirleyin, personelleri atayın, şifrelerini güncelleyin ve cihaz kilitlerini sıfırlayın.
            </p>
          </div>

          {/* Quick Stats Badges & Top Create Company Action */}
          <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="px-3.5 py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center min-w-[80px]">
                <span className="text-[9px] font-bold text-blue-200 block uppercase">Kurum</span>
                <span className="text-xl font-black text-white">{metrics.totalCompanies}</span>
              </div>
              <div className="px-3.5 py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center min-w-[80px]">
                <span className="text-[9px] font-bold text-indigo-200 block uppercase">Şube</span>
                <span className="text-xl font-black text-indigo-300">{metrics.totalBranches}</span>
              </div>
              <div className="px-3.5 py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center min-w-[80px]">
                <span className="text-[9px] font-bold text-purple-200 block uppercase">Personel</span>
                <span className="text-xl font-black text-purple-300">{metrics.totalAssignedStaff}</span>
              </div>
              <div className="px-3.5 py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center min-w-[80px]">
                <span className="text-[9px] font-bold text-emerald-200 block uppercase">Mesaide</span>
                <span className="text-xl font-black text-emerald-300">{metrics.activeStaffToday}</span>
              </div>
            </div>

            {/* Top + Yeni Kurum Ekle Butonu (Görsel-2'nin taşındığı ana buton) */}
            {canAddBranch && (
              <button
                type="button"
                onClick={() => setIsCreateCompanyOpen(true)}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-black text-xs sm:text-sm shadow-lg shadow-blue-500/30 transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Yeni Kurum Ekle</span>
              </button>
            )}
          </div>
        </div>

        {/* Decorative blobs */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -top-10 w-48 h-48 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none" />
      </div>

      {/* 2. Search & Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Kurum adı, şube veya personel ara..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 shadow-xs focus:ring-2 focus:ring-blue-500 outline-hidden transition-all"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const allCodes = new Set(availableCompanies.map((c) => c.code.toUpperCase()));
              setExpandedCompanies(expandedCompanies.size === allCodes.size ? new Set() : allCodes);
            }}
            className="px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
          >
            {expandedCompanies.size === availableCompanies.length ? 'Tümünü Daralt' : 'Tümünü Genişlet'}
          </button>
        </div>
      </div>

      {/* 3. Hierarchical Company & Branch Accordion List */}
      <div className="space-y-4">
        {loadingCompanies ? (
          <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">Kurumlar ve şubeler yükleniyor...</p>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
              Aramanıza uygun kurum bulunamadı.
            </p>
          </div>
        ) : (
          filteredCompanies.map((comp) => {
            const compCode = comp.code.toUpperCase();
            const isPolatlar = compCode === 'POLATLAR';
            const isExpanded = expandedCompanies.has(compCode);
            const compBranches = companyBranchesMap[compCode] || [];
            const compUsers = users.filter((u) => (u.companyCode || 'POLATLAR').toUpperCase() === compCode);

            return (
              <div
                key={comp.code}
                className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 shadow-sm overflow-hidden transition-all duration-200"
              >
                {/* Company Header Accordion Bar */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/60">
                  <div
                    className="flex items-center gap-3 cursor-pointer flex-1 select-none"
                    onClick={() => toggleCompany(compCode)}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                      <Building2 className="w-6 h-6" />
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                          {comp.name}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {comp.code}
                        </span>
                        {isPolatlar && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            Ana Firma
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Yönetici: <strong className="text-slate-700 dark:text-slate-300">{comp.adminName}</strong> ({comp.adminEmail})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Stats pills */}
                    <span className="px-3 py-1 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-xs">
                      {compBranches.length} Şube
                    </span>
                    <span className="px-3 py-1 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-xs">
                      {compUsers.length} Personel
                    </span>

                    {/* Quick + Yeni Şube Ekle */}
                    {canAddBranch && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAddBranch(compCode);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-black shadow-sm transition-all active:scale-95 cursor-pointer"
                        title="Bu kuruma yeni şube ekle"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Şube Ekle</span>
                      </button>
                    )}

                    {/* Kurumu Sil Butonu (Yalnızca POLATLAR dışındaki kurumlar için) */}
                    {!isPolatlar && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCompany(comp);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 text-xs font-black shadow-2xs transition-all active:scale-95 cursor-pointer"
                        title="Kurumu ve Tüm Şubelerini Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Kurumu Sil</span>
                      </button>
                    )}

                    {/* Chevron expand/collapse */}
                    <button
                      onClick={() => toggleCompany(compCode)}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Company Branches & Personnel Expanded Content */}
                {isExpanded && (
                  <div className="p-4 sm:p-6 space-y-6 bg-white dark:bg-slate-900/90 animate-in fade-in duration-200">
                    {/* Branches List */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-extrabold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-blue-500" />
                          <span>Tanımlı Şubeler ({compBranches.length})</span>
                        </h4>
                      </div>

                      {compBranches.length === 0 ? (
                        <div className="p-6 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800/80">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                            "{comp.name}" kurumuna ait henüz bir şube tanımlanmamış.
                          </p>
                          {canAddBranch && (
                            <button
                              onClick={() => handleOpenAddBranch(compCode)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-700 transition-all cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>İlk Şubeyi Ekle</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {compBranches.map((branch) => {
                            const assignedCount = (branch.assignedUserIds || []).length;
                            const isBranchExpanded = expandedBranches.has(branch.id);
                            const branchStaff = compUsers.filter((u) => (branch.assignedUserIds || []).includes(u.id));

                            // Calculate distance to current user position
                            let distanceToUser: number | null = null;
                            if (userCoords && branch.latitude && branch.longitude) {
                              distanceToUser = LocationService.calculateDistance(
                                userCoords.lat,
                                userCoords.lon,
                                branch.latitude,
                                branch.longitude
                              );
                            }
                            const isUserInside20m =
                              distanceToUser !== null && distanceToUser <= (branch.radiusMeters || 20);

                            return (
                              <div
                                key={branch.id}
                                className="rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 p-4 space-y-3 shadow-xs hover:shadow-md transition-shadow"
                              >
                                {/* Branch Card Top */}
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <h5 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                                      <span>{branch.name}</span>
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                                        {branch.radiusMeters || 20}m
                                      </span>
                                    </h5>
                                    <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                      <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                      <span className="line-clamp-1">{branch.address || 'Adres girilmedi'}</span>
                                    </div>
                                    {branch.phone && (
                                      <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                                        <Phone className="w-3 h-3" />
                                        <span>{branch.phone}</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Distance pill */}
                                  {distanceToUser !== null && (
                                    <span
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-black shrink-0 ${
                                        isUserInside20m
                                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 animate-pulse'
                                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                      }`}
                                    >
                                      {LocationService.formatDistance(distanceToUser)}
                                    </span>
                                  )}
                                </div>

                                {/* Branch Actions Bar */}
                                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        LocationService.openInGoogleMaps(
                                          branch.address,
                                          branch.latitude,
                                          branch.longitude
                                        )
                                      }
                                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-200/50 dark:hover:bg-slate-700 transition-colors"
                                      title="Haritada Göster"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => toggleBranch(branch.id)}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-colors cursor-pointer"
                                      title="Personelleri Göster / Gizle"
                                    >
                                      <Users className="w-3.5 h-3.5" />
                                      <span>{assignedCount} Personel</span>
                                      {isBranchExpanded ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setAssigningBranch(branch)}
                                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                                      title="Personel Ata"
                                    >
                                      Ata
                                    </button>

                                    {canAddBranch && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => setEditingBranch(branch)}
                                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                          title="Düzenle"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteBranch(branch, compCode)}
                                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                          title="Sil"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Branch Staff Expanded Sub-section */}
                                {isBranchExpanded && (
                                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                      Bu Şubeye Atanmış Personeller ({branchStaff.length})
                                    </span>
                                    {branchStaff.length === 0 ? (
                                      <p className="text-[11px] text-slate-400 italic">
                                        Henüz bu şubeye personel atanmamış.
                                      </p>
                                    ) : (
                                      <div className="space-y-1.5">
                                        {branchStaff.map((staff) => {
                                          const isWorkingToday = activeStaffTodaySet.has(staff.id);
                                          return (
                                            <div
                                              key={staff.id}
                                              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2 text-xs shadow-2xs"
                                            >
                                              <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px]">
                                                  {staff.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                  <span className="font-bold text-slate-800 dark:text-slate-200 block leading-tight">
                                                    {staff.name}
                                                  </span>
                                                  <span className="text-[10px] text-slate-400">@{staff.username}</span>
                                                </div>
                                                {isWorkingToday && (
                                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                                    Mesaide
                                                  </span>
                                                )}
                                              </div>

                                              {/* Staff Actions: Şifre Değiştir & Cihaz Kilidi Sıfırla */}
                                              <div className="flex items-center gap-1">
                                                <button
                                                  type="button"
                                                  onClick={() => setPasswordModalUser(staff)}
                                                  className="p-1 rounded-md text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                                  title="Şifresini Değiştir"
                                                >
                                                  <KeyRound className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleResetDeviceLock(staff.id, staff.name)}
                                                  className="p-1 rounded-md text-slate-500 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                                  title="Cihaz Kilidini Sıfırla (Yeni Telefondan Giriş)"
                                                >
                                                  <Smartphone className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* All Personnel of this Company (Including unassigned) */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-extrabold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-purple-500" />
                          <span>Kurum Personelleri ({compUsers.length})</span>
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {compUsers.map((staff) => {
                          const isWorkingToday = activeStaffTodaySet.has(staff.id);
                          const assignedBranch = compBranches.find((b) => (b.assignedUserIds || []).includes(staff.id));

                          return (
                            <div
                              key={staff.id}
                              className="p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold flex items-center justify-center shrink-0">
                                  {staff.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <span className="font-bold text-slate-900 dark:text-slate-100 block truncate leading-tight">
                                    {staff.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block truncate">@{staff.username}</span>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${isWorkingToday ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                                      {isWorkingToday ? '🟢 Mesaide' : '⚪ Dışarıda'}
                                    </span>
                                    {assignedBranch ? (
                                      <span className="text-[9px] font-semibold text-blue-600 dark:text-blue-400 truncate">
                                        📍 {assignedBranch.name}
                                      </span>
                                    ) : (
                                      <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400">
                                        ⚠️ Şube atanmamış
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Action buttons: Key & Smartphone */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setPasswordModalUser(staff)}
                                  className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors cursor-pointer"
                                  title="Şifre Değiştir"
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleResetDeviceLock(staff.id, staff.name)}
                                  className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors cursor-pointer"
                                  title="Cihaz Kilidini Sıfırla"
                                >
                                  <Smartphone className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 4. Modals */}
      {/* Create Company Modal (Integrated directly from Görsel-2) */}
      <CreateCompanyModal
        isOpen={isCreateCompanyOpen}
        onClose={() => {
          setIsCreateCompanyOpen(false);
          loadAllCompaniesAndBranches();
        }}
      />

      {/* Add / Edit Branch Modal */}
      <BranchModal
        isOpen={isAddBranchOpen || !!editingBranch}
        onClose={() => {
          setIsAddBranchOpen(false);
          setEditingBranch(null);
        }}
        branchToEdit={editingBranch}
        defaultCompanyCode={targetCompanyForBranch}
        onSave={async (data) => {
          if (editingBranch) {
            await updateBranch(editingBranch.id, data);
            await loadAllCompaniesAndBranches();
          } else {
            await addBranch(data);
            await loadAllCompaniesAndBranches();
          }
        }}
      />

      {/* Staff Assignment Modal */}
      <BranchStaffModal
        isOpen={!!assigningBranch}
        onClose={() => setAssigningBranch(null)}
        branch={assigningBranch}
        onSave={async (branchId, userIds) => {
          if (assigningBranch) {
            await assignStaffToBranch(branchId, userIds, assigningBranch.companyCode);
            await loadAllCompaniesAndBranches();
          }
        }}
      />

      {/* Quick Password Change Modal for Staff */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-500" />
                <span>Personel Şifresi Değiştir</span>
              </h4>
              <button
                onClick={() => {
                  setPasswordModalUser(null);
                  setNewPassword('');
                  setPasswordSuccess('');
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <span className="text-xs text-slate-500 block">Personel:</span>
                <span className="text-sm font-black text-slate-900 dark:text-white block">{passwordModalUser.name}</span>
                <span className="text-[11px] text-slate-400 block font-mono">@{passwordModalUser.username}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Yeni Şifre
                </label>
                <input
                  type="text"
                  placeholder="En az 3 karakter giriniz..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-blue-500 font-mono"
                  autoFocus
                />
              </div>

              {passwordSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPasswordModalUser(null);
                  setNewPassword('');
                  setPasswordSuccess('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleSavePassword}
                disabled={isUpdatingPassword}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isUpdatingPassword ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
