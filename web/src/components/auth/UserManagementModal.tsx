import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  Key,
  Shield,
  User as UserIcon,
  Crown,
  Users,
  CheckCircle2,
  Unlock,
  Smartphone,
  Building2,
  Store,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useStorage } from '../../context/StorageContext';
import { UserRole, isUserAdmin, Company } from '../../types/auth';
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
    deleteUser,
    suggestUsername,
  } = useAuth();
  const { branches, assignStaffToBranch } = useStorage();

  const isPolatlarAdmin =
    isUserAdmin(currentUser) &&
    (currentUser?.companyCode || 'POLATLAR').toUpperCase() === 'POLATLAR';
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);

  const [activeSubTab, setActiveSubTab] = useState<'list' | 'add'>('list');

  // Multi-company & all-branches states
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyCode, setSelectedCompanyCode] = useState<string>(
    () => (currentUser?.companyCode || 'POLATLAR').toUpperCase()
  );
  const [targetAddCompanyCode, setTargetAddCompanyCode] = useState<string>(
    () => (currentUser?.companyCode || 'POLATLAR').toUpperCase()
  );
  const [allBranchesMap, setAllBranchesMap] = useState<Record<string, Branch[]>>({});
  const [loadingAllBranches, setLoadingAllBranches] = useState<boolean>(false);

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

  const userCompanyCode = (currentUser?.companyCode || 'POLATLAR').toUpperCase();

  // Filtered companies strictly visible to this user
  // Non-POLATLAR company managers can ONLY see their own company, NEVER POLATLAR
  const visibleCompanies = useMemo(() => {
    if (!isPolatlarAdmin) {
      return companies.filter(
        (c) => c.code.toUpperCase() === userCompanyCode && c.code.toUpperCase() !== 'POLATLAR'
      );
    }
    return companies;
  }, [companies, isPolatlarAdmin, userCompanyCode]);

  // Load all companies and their branches
  const loadCompaniesAndBranches = useCallback(async () => {
    try {
      setLoadingAllBranches(true);
      const compList = await CompanyService.fetchCompanies();
      setCompanies(compList);

      const map: Record<string, Branch[]> = {};
      if (isPolatlarAdmin) {
        map['POLATLAR'] = branches;
      }

      for (const comp of compList) {
        const code = comp.code.toUpperCase();
        if (code !== 'POLATLAR') {
          // If not polatlar admin, only fetch branches for user's own company
          if (!isPolatlarAdmin && code !== userCompanyCode) continue;
          try {
            const bList = await StorageService.getBranchesForCompany(code);
            map[code] = bList;
          } catch {
            map[code] = [];
          }
        }
      }
      setAllBranchesMap(map);
    } catch (e) {
      console.warn('Kurumlar veya şubeler yüklenemedi:', e);
    } finally {
      setLoadingAllBranches(false);
    }
  }, [branches, isPolatlarAdmin, userCompanyCode]);

  useEffect(() => {
    if (isOpen) {
      loadCompaniesAndBranches();
    }
  }, [isOpen, loadCompaniesAndBranches]);

  // Filter users belonging to selected company
  const companyUsers = React.useMemo(() => {
    const currentCode = selectedCompanyCode.toUpperCase();
    return users.filter(
      (u) => (u.companyCode || 'POLATLAR').toUpperCase() === currentCode
    );
  }, [users, selectedCompanyCode]);

  // Form states for adding user
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('staff');
  const [newBranchId, setNewBranchId] = useState<string>('');
  const [formMsg, setFormMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

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

  // Device bindings state
  const [userBindings, setUserBindings] = useState<UserDeviceBinding[]>([]);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);

  const loadBindings = async () => {
    try {
      const list = await DeviceService.getUserDeviceBindings();
      setUserBindings(list);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBindings();
    }
  }, [isOpen]);

  const handleResetDeviceLock = async (userId: string, userName: string) => {
    if (
      !window.confirm(
        `"${userName}" kullanıcısının telefon cihaz kilidini sıfırlamak istediğinize emin misiniz?\n\nKilit kaldırıldığında personel yeni telefonundan sisteme girdiği anda yeni cihazı sisteme otomatik kilitlenecektir.`
      )
    ) {
      return;
    }

    try {
      setResettingUserId(userId);
      await DeviceService.unbindUserDevice(userId);
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

    const compCodeToUse = (targetAddCompanyCode || selectedCompanyCode || currentUser?.companyCode || 'POLATLAR').toUpperCase();

    const res = await addUser({
      username: newUsername,
      password: newPassword,
      name: newName,
      role: newRole,
      companyCode: compCodeToUse,
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
    const res = await updateUser(userId, { password: changedPassword });
    if (res.success) {
      alert('Şifre başarıyla güncellendi.');
      setEditingPasswordUserId(null);
      setChangedPassword('');
    } else {
      alert(res.error || 'Şifre güncellenemedi.');
    }
  };

  const handleDelete = async (userId: string, username: string) => {
    if (
      window.confirm(
        `"${username}" kullanıcısını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
      )
    ) {
      const res = await deleteUser(userId);
      if (!res.success && res.error) {
        alert(res.error);
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Kullanıcı ve Yetki Yönetimi" maxWidth="max-w-2xl">
      <div className="space-y-4">
        {/* Company Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-blue-50/90 dark:from-blue-950/50 dark:via-indigo-950/30 dark:to-blue-950/50 border border-blue-200/90 dark:border-blue-900/60 text-xs shadow-xs">
          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
            <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="font-extrabold text-blue-900 dark:text-blue-200 shrink-0 text-xs">
              Kurum:
            </span>
            {isPolatlarAdmin && visibleCompanies.length > 0 ? (
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
                  onClick={() => loadCompaniesAndBranches()}
                  disabled={loadingAllBranches}
                  className="p-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg cursor-pointer disabled:opacity-50 transition-all shrink-0"
                  title="Kurum ve şube listesini yenile"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAllBranches ? 'animate-spin' : ''}`} />
                </button>
              </div>
            ) : (
              <span className="font-black text-blue-900 dark:text-blue-100 text-sm truncate">
                {company?.name || currentUser?.companyCode || 'KURUM'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {isPolatlarAdmin && (
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
              KURUM KODU: {selectedCompanyCode}
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
          <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
            {companyUsers.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs font-medium bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <Users className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <p>"{selectedCompanyCode}" kurumuna ait kayıtlı kullanıcı bulunamadı.</p>
                <button
                  type="button"
                  onClick={() => {
                    setTargetAddCompanyCode(selectedCompanyCode);
                    setActiveSubTab('add');
                  }}
                  className="mt-2 text-blue-600 dark:text-blue-400 font-bold hover:underline"
                >
                  + Yeni Kullanıcı Ekle
                </button>
              </div>
            ) : (
              companyUsers.map((account) => {
                const isAdmin = isUserAdmin(account);
                const isCurrent = currentUser?.id === account.id;
                const binding = userBindings.find(
                  (b) =>
                    b.userId === account.id ||
                    (b.username && b.username.toLowerCase() === account.username.toLowerCase())
                );
                const userBranch = allBranchesList.find((b) => b.assignedUserIds?.includes(account.id));

                return (
                  <div
                    key={account.id}
                    className="bg-slate-50 dark:bg-slate-900/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 space-y-3 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* User Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 ${
                            isAdmin
                              ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-xs'
                              : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                          }`}
                        >
                          {isAdmin ? <Crown className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                              {account.name}
                            </h4>
                            {isCurrent && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                                Siz
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
                            <select
                              value={userBranch?.id || ''}
                              onChange={async (e) => {
                                const targetBId = e.target.value;
                                if (!targetBId) {
                                  if (userBranch) {
                                    const filtered = (userBranch.assignedUserIds || []).filter(
                                      (uid) => uid !== account.id
                                    );
                                    await assignStaffToBranch(userBranch.id, filtered, userBranch.companyCode || account.companyCode);
                                    await loadCompaniesAndBranches();
                                  }
                                } else {
                                  const targetB = allBranchesList.find((b) => b.id === targetBId);
                                  const branchCompCode = targetB?.companyCode || account.companyCode;
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
                              {visibleCompanies.map((comp) => {
                                const compCode = comp.code.toUpperCase();
                                const compBranches = allBranchesMap[compCode] || [];
                                if (compBranches.length === 0) return null;
                                return (
                                  <optgroup key={comp.code} label={`🏢 ${comp.name}`}>
                                    {compBranches.map((b) => (
                                      <option key={b.id} value={b.id}>
                                        {b.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                );
                              })}
                            </select>
                          </div>
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
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <input
                          type="password"
                          value={changedPassword}
                          onChange={(e) => setChangedPassword(e.target.value)}
                          placeholder="Yeni şifre belirleyin..."
                          autoFocus
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => handleSaveNewPassword(account.id)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-xs"
                        >
                          Kaydet
                        </button>
                        <button
                          onClick={() => {
                            setEditingPasswordUserId(null);
                            setChangedPassword('');
                          }}
                          className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-xs font-semibold"
                        >
                          İptal
                        </button>
                      </div>
                    ) : null}

                    {/* Actions Row */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                      <span className="text-[11px] text-slate-400">
                        Eklenme: {new Date(account.createdAt).toLocaleDateString('tr-TR')}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {binding && (
                          <button
                            type="button"
                            disabled={resettingUserId === account.id}
                            onClick={() => handleResetDeviceLock(account.id, account.name)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/70 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                            title="Personelin cihaz kilidini sıfırlayın (Yeni telefondan giriş yapabilmesi için)"
                          >
                            <Unlock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                            <span>{resettingUserId === account.id ? 'Sıfırlanıyor...' : '🔓 Kilidi Sıfırla'}</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setEditingPasswordUserId(
                              editingPasswordUserId === account.id ? null : account.id
                            );
                            setChangedPassword('');
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80 font-semibold transition-colors"
                        >
                          <Key className="w-3.5 h-3.5 text-amber-500" />
                          <span>Şifre Belirle</span>
                        </button>

                        <button
                          onClick={() => handleDelete(account.id, account.username)}
                          className="p-1.5 rounded-lg text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                          title="Kullanıcıyı Sil"
                          aria-label="Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
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
              {/* 0. Kurum / Firma Seçimi (Tüm Kurumlar) */}
              {isPolatlarAdmin && companies.length > 0 && (
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

              {/* Branch Selection (Filtered by Accessible Institutions & Branches) */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-blue-600" />
                    <span>Bağlı Olacağı Şube (Mesai Takibi İçin)</span>
                  </label>
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                    {isPolatlarAdmin ? '🌐 Tüm Kurum & Şubeler' : '🏢 Kurum Şubeleri'}
                  </span>
                </div>
                <select
                  value={newBranchId}
                  onChange={(e) => {
                    const bId = e.target.value;
                    setNewBranchId(bId);
                    if (bId) {
                      const foundBranch = allBranchesList.find((b) => b.id === bId);
                      if (foundBranch?.companyCode) {
                        setTargetAddCompanyCode(foundBranch.companyCode.toUpperCase());
                        setSelectedCompanyCode(foundBranch.companyCode.toUpperCase());
                      }
                    }
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">🏢 Şube Seçilmedi (Genel / Merkez)</option>
                  {visibleCompanies.length > 0 ? (
                    visibleCompanies.map((comp) => {
                      const compCode = comp.code.toUpperCase();
                      const compBranches = allBranchesMap[compCode] || [];
                      return (
                        <optgroup key={comp.code} label={`🏢 ${comp.name} (${comp.code})`}>
                          {compBranches.length === 0 ? (
                            <option disabled value={`empty-${comp.code}`}>
                              &nbsp;&nbsp;— Bu kuruma ait henüz şube yok —
                            </option>
                          ) : (
                            compBranches.map((b) => (
                              <option key={b.id} value={b.id}>
                                📍 {b.name} {b.address ? `• ${b.address}` : ''}
                              </option>
                            ))
                          )}
                        </optgroup>
                      );
                    })
                  ) : (
                    branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        🏢 {b.name} {b.address ? `(${b.address})` : ''}
                      </option>
                    ))
                  )}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Personel sadece atandığı şubenin 20 metre çapında doğrudan mesaiye başlayabilir. Farklı şubede mesaiye başlamak için yönetici onayı gerekecektir.
                </p>
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

      {/* Create Company Modal (For Polatlar / Master Admins) */}
      {isPolatlarAdmin && (
        <CreateCompanyModal
          isOpen={isCreateCompanyOpen}
          onClose={() => {
            setIsCreateCompanyOpen(false);
            loadCompaniesAndBranches();
          }}
        />
      )}
    </Modal>
  );
};
