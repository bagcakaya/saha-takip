import React, { useState, useEffect } from 'react';
import {
  Users,
  X,
  Check,
  Search,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { Branch } from '../../types/storage';
import { useAuth } from '../../context/AuthContext';

interface BranchStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  branch: Branch | null;
  onSave: (branchId: string, userIds: string[]) => Promise<void>;
}

export const BranchStaffModal: React.FC<BranchStaffModalProps> = ({
  isOpen,
  onClose,
  branch,
  onSave,
}) => {
  const { users, user: currentUser } = useAuth();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Filter company users based on the branch's company
  const branchCompanyCode = (branch?.companyCode || currentUser?.companyCode || 'POLATLAR').toUpperCase();
  const companyUsers = React.useMemo(() => {
    return users.filter(
      (u) => (u.companyCode || 'POLATLAR').toUpperCase() === branchCompanyCode
    );
  }, [users, branchCompanyCode]);

  useEffect(() => {
    if (branch) {
      setSelectedIds(branch.assignedUserIds || []);
    } else {
      setSelectedIds([]);
    }
    setSearchQuery('');
  }, [branch, isOpen]);

  if (!isOpen || !branch) return null;

  const filteredUsers = companyUsers.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q)
    );
  });

  const handleToggle = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave(branch.id, selectedIds);
      onClose();
    } catch (e) {
      console.error('Personel atama hatası:', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/50 to-transparent dark:from-slate-800/50 dark:to-transparent shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Personel Ata</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                  {branch.name}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bu şubeye bağlı olarak çalışacak personelleri seçin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Actions bar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-2.5 shrink-0">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Personel adı veya kullanıcı adı ara..."
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-hidden"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-500 dark:text-slate-400">
              {selectedIds.length} personel seçili
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedIds(companyUsers.map((u) => u.id))}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 cursor-pointer"
              >
                Tümünü Seç
              </button>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
              >
                Temizle
              </button>
            </div>
          </div>
        </div>

        {/* User list */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              Eşleşen personel bulunamadı.
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isSelected = selectedIds.includes(u.id);
              const isAdmin = u.role === 'admin';
              return (
                <div
                  key={u.id}
                  onClick={() => handleToggle(u.id)}
                  className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : isAdmin
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                      }`}
                    >
                      {isAdmin ? <ShieldCheck className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold leading-tight">{u.name}</h4>
                      <p className={`text-[10px] ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                        @{u.username} • {isAdmin ? 'Yönetici' : 'Saha Yetkilisi'}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`w-6 h-6 rounded-xl flex items-center justify-center border transition-all ${
                      isSelected
                        ? 'bg-white text-indigo-600 border-white shadow-xs'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-black shadow-md shadow-indigo-500/25 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Kaydet ({selectedIds.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
