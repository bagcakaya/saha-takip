import React, { useState, useEffect } from 'react';
import {
  Sliders,
  X,
  Check,
  Building2,
  Save,
  Loader2,
  UserCheck,
  ClipboardList,
  Clock,
  StickyNote,
  Megaphone,
  Wrench,
  RotateCcw,
  ShieldAlert,
  ListTodo,
  Search,
} from 'lucide-react';
import {
  Company,
  CompanyModulePermissions,
  APP_FEATURE_MODULES,
} from '../../types/auth';
import { CompanyService } from '../../services/companyService';

interface CompanyModulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company | null;
  onSuccess: (updatedCompany: Company) => void;
}

const MODULE_ICONS: Record<string, any> = {
  staff_tracking: UserCheck,
  notes: ClipboardList,
  timed_follow_ups: Clock,
  personal_notes: StickyNote,
  reminders: Megaphone,
  installations: Building2,
  services: Wrench,
  returns: RotateCcw,
  logs: ShieldAlert,
  template: ListTodo,
};

export const CompanyModulesModal: React.FC<CompanyModulesModalProps> = ({
  isOpen,
  onClose,
  company,
  onSuccess,
}) => {
  const [permissions, setPermissions] = useState<CompanyModulePermissions>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize permissions from company when opened
  useEffect(() => {
    if (company) {
      const initial: CompanyModulePermissions = {};
      APP_FEATURE_MODULES.forEach((mod) => {
        if (company.modulePermissions && company.modulePermissions[mod.id]) {
          initial[mod.id] = { ...company.modulePermissions[mod.id] };
        } else {
          initial[mod.id] = {
            staff: mod.defaultStaff,
            admin: mod.defaultAdmin,
          };
        }
      });
      setPermissions(initial);
      setSearchQuery('');
    }
  }, [company, isOpen]);

  if (!isOpen || !company) return null;

  const handleToggleStaff = (moduleId: string) => {
    setPermissions((prev) => {
      const current = prev[moduleId] || { staff: true, admin: true };
      return {
        ...prev,
        [moduleId]: {
          ...current,
          staff: !current.staff,
        },
      };
    });
  };

  const handleToggleAdmin = (moduleId: string) => {
    setPermissions((prev) => {
      const current = prev[moduleId] || { staff: true, admin: true };
      return {
        ...prev,
        [moduleId]: {
          ...current,
          admin: !current.admin,
        },
      };
    });
  };

  // Presets
  const applyPresetAll = () => {
    const next: CompanyModulePermissions = {};
    APP_FEATURE_MODULES.forEach((m) => {
      next[m.id] = { staff: true, admin: true };
    });
    setPermissions(next);
  };

  const applyPresetStaffTrackingOnly = () => {
    const next: CompanyModulePermissions = {};
    APP_FEATURE_MODULES.forEach((m) => {
      if (m.id === 'staff_tracking') {
        next[m.id] = { staff: true, admin: true };
      } else {
        next[m.id] = { staff: false, admin: false };
      }
    });
    setPermissions(next);
  };

  const applyPresetStaffAndNotes = () => {
    const next: CompanyModulePermissions = {};
    APP_FEATURE_MODULES.forEach((m) => {
      if (m.id === 'staff_tracking' || m.id === 'notes') {
        next[m.id] = { staff: true, admin: true };
      } else {
        next[m.id] = { staff: false, admin: false };
      }
    });
    setPermissions(next);
  };

  const applyPresetDefault = () => {
    const next: CompanyModulePermissions = {};
    APP_FEATURE_MODULES.forEach((m) => {
      next[m.id] = { staff: m.defaultStaff, admin: m.defaultAdmin };
    });
    setPermissions(next);
  };

  const filteredModules = APP_FEATURE_MODULES.filter((m) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.shortTitle.toLowerCase().includes(q)
    );
  });

  const activeStaffCount = Object.values(permissions).filter((p) => p.staff).length;
  const activeAdminCount = Object.values(permissions).filter((p) => p.admin).length;

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const res = await CompanyService.updateCompanyModulePermissions(company.code, permissions);
      if (res.success && res.company) {
        onSuccess(res.company);
        onClose();
      } else {
        alert('Kaydetme hatası: ' + (res.error || 'Bilinmeyen hata'));
      }
    } catch (err: any) {
      alert('Kaydetme hatası: ' + (err?.message || 'Bilinmeyen hata'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Kurum Modül & Ekran Yetkileri
                </h3>
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  {company.code}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <strong className="text-slate-700 dark:text-slate-300">{company.name}</strong> kurumu kullanıcılarının Ana Ekran ve Yan Menüde görebileceği bölümleri belirleyin.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Presets and Filter Bar */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Hızlı Şablonlar:
            </span>
            <button
              type="button"
              onClick={applyPresetAll}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs cursor-pointer"
            >
              🌟 Tümünü Aç
            </button>
            <button
              type="button"
              onClick={applyPresetStaffTrackingOnly}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs cursor-pointer"
            >
              ⏱️ Sadece Personel Takibi
            </button>
            <button
              type="button"
              onClick={applyPresetStaffAndNotes}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs cursor-pointer"
            >
              📋 Takip + İş Emri
            </button>
            <button
              type="button"
              onClick={applyPresetDefault}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs cursor-pointer"
            >
              🔄 Varsayılan
            </button>
          </div>

          <div className="relative sm:w-48">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Modül ara..."
              className="w-full pl-7 pr-3 py-1 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-hidden focus:ring-1 focus:ring-purple-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
          </div>
        </div>

        {/* Modules List Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-800/80">
          {filteredModules.map((mod) => {
            const IconComponent = MODULE_ICONS[mod.id] || Building2;
            const perm = permissions[mod.id] || { staff: false, admin: false };

            return (
              <div
                key={mod.id}
                className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                {/* Module Info */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-purple-100 group-hover:text-purple-700 dark:group-hover:bg-purple-950 dark:group-hover:text-purple-300 transition-colors">
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                        {mod.name}
                      </span>
                      <span className="text-[10px] text-slate-400">({mod.shortTitle})</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {mod.description}
                    </p>
                  </div>
                </div>

                {/* Role Toggles */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  {/* Personel Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleStaff(mod.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      perm.staff
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                    title="Personelin bu modülü görmesini aç/kapat"
                  >
                    {perm.staff ? (
                      <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span>Personel</span>
                  </button>

                  {/* Yönetici Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleAdmin(mod.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      perm.admin
                        ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                    title="Yöneticinin bu modülü görmesini aç/kapat"
                  >
                    {perm.admin ? (
                      <Check className="w-3.5 h-3.5 stroke-[3] text-purple-600 dark:text-purple-400" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span>Yönetici</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Aktif Modüller:</span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
              Personel: {activeStaffCount} / {APP_FEATURE_MODULES.length}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold text-[11px]">
              Yönetici: {activeAdminCount} / {APP_FEATURE_MODULES.length}
            </span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              Vazgeç
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-black shadow-md shadow-purple-500/25 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Kaydediliyor...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Kaydet ve Uygula</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
