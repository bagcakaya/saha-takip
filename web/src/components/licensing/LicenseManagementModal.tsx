import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Snowflake,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Infinity as InfinityIcon,
  FileEdit,
  Save,
} from 'lucide-react';
import { Company, canUserManageLicenses, getCompanyLicenseInfo } from '../../types/auth';
import { CompanyService } from '../../services/companyService';
import { useAuth } from '../../context/AuthContext';

interface LicenseManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LicenseManagementModal: React.FC<LicenseManagementModalProps> = ({ isOpen, onClose }) => {
  const { user, refreshCompany } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'expiring' | 'expired' | 'frozen'>('all');
  const [actionLoadingCode, setActionLoadingCode] = useState<string | null>(null);

  // Custom date modal / popover state
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [customDate, setCustomDate] = useState('');
  const [customNotes, setCustomNotes] = useState('');

  const isSuperAdmin = canUserManageLicenses(user);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const list = await CompanyService.fetchCompanies();
      setCompanies(list);
    } catch (e) {
      console.error('Kurumlar yüklenemedi:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCompanies();
    }
  }, [isOpen]);

  // Calculations for metric cards
  const metrics = useMemo(() => {
    let active = 0;
    let expiring = 0;
    let expired = 0;
    let frozen = 0;

    companies.forEach((comp) => {
      const info = getCompanyLicenseInfo(comp);
      if (info.status === 'suspended') {
        frozen++;
      } else if (info.status === 'expired') {
        expired++;
      } else if (info.status === 'expiring_soon') {
        expiring++;
        active++;
      } else {
        active++;
      }
    });

    return {
      total: companies.length,
      active,
      expiring,
      expired,
      frozen,
    };
  }, [companies]);

  // Filtered companies
  const filteredCompanies = useMemo(() => {
    return companies.filter((comp) => {
      const info = getCompanyLicenseInfo(comp);
      const matchesSearch =
        comp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        comp.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        comp.adminName.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterTab === 'all') return true;
      if (filterTab === 'active') return info.active && info.status !== 'expiring_soon';
      if (filterTab === 'expiring') return info.status === 'expiring_soon';
      if (filterTab === 'expired') return info.status === 'expired';
      if (filterTab === 'frozen') return info.status === 'suspended';

      return true;
    });
  }, [companies, searchQuery, filterTab]);

  const handleQuickExtend = async (companyCode: string, daysOrMonths: { months?: number; days?: number }) => {
    setActionLoadingCode(companyCode);
    try {
      const res = await CompanyService.extendLicense(companyCode, daysOrMonths);
      if (res.success) {
        await loadCompanies();
        await refreshCompany();
      } else {
        alert(res.error || 'İşlem başarısız');
      }
    } catch (e: any) {
      alert('Hata: ' + e?.message);
    } finally {
      setActionLoadingCode(null);
    }
  };

  const handleMakeLifetime = async (companyCode: string) => {
    if (!window.confirm(`"${companyCode}" kurumuna SINIRSIZ / Ömür Boyu lisans vermek istediğinize emin misiniz?`)) {
      return;
    }
    setActionLoadingCode(companyCode);
    try {
      const res = await CompanyService.updateCompanyLicense(companyCode, {
        licenseType: 'lifetime',
        licenseExpiresAt: 0,
        isFrozen: false,
      });
      if (res.success) {
        await loadCompanies();
        await refreshCompany();
      } else {
        alert(res.error || 'İşlem başarısız');
      }
    } catch (e: any) {
      alert('Hata: ' + e?.message);
    } finally {
      setActionLoadingCode(null);
    }
  };

  const handleToggleFreeze = async (company: Company) => {
    const isCurrentlyFrozen = company.isFrozen === true;
    const actionText = isCurrentlyFrozen ? 'dondurmasını kaldırmak' : 'hesabını dondurmak';

    let reason: string | undefined = undefined;
    if (!isCurrentlyFrozen) {
      const input = window.prompt(
        `"${company.name}" kurumunu dondurma nedeni (Kullanıcıya gösterilir):`,
        'Yıllık lisans ödemesi gecikmesi sebebiyle hesap dondurulmuştur.'
      );
      if (input === null) return; // Cancelled
      reason = input.trim();
    } else {
      if (!window.confirm(`"${company.name}" kurumunun ${actionText} istediğinize emin misiniz?`)) {
        return;
      }
    }

    setActionLoadingCode(company.code);
    try {
      const res = await CompanyService.toggleFreezeCompany(company.code, !isCurrentlyFrozen, reason);
      if (res.success) {
        await loadCompanies();
        await refreshCompany();
      } else {
        alert(res.error || 'İşlem başarısız');
      }
    } catch (e: any) {
      alert('Hata: ' + e?.message);
    } finally {
      setActionLoadingCode(null);
    }
  };

  const handleSaveCustomDateAndNotes = async () => {
    if (!editingCompany) return;

    let targetTimestamp: number | undefined = undefined;
    if (customDate) {
      const dateObj = new Date(customDate + 'T23:59:59');
      if (isNaN(dateObj.getTime())) {
        alert('Lütfen geçerli bir tarih seçin.');
        return;
      }
      targetTimestamp = dateObj.getTime();
    }

    setActionLoadingCode(editingCompany.code);
    try {
      const res = await CompanyService.updateCompanyLicense(editingCompany.code, {
        ...(targetTimestamp !== undefined ? { licenseExpiresAt: targetTimestamp, licenseType: 'custom', isFrozen: false } : {}),
        notes: customNotes,
      });

      if (res.success) {
        setEditingCompany(null);
        await loadCompanies();
        await refreshCompany();
      } else {
        alert(res.error || 'Güncelleme başarısız');
      }
    } catch (e: any) {
      alert('Hata: ' + e?.message);
    } finally {
      setActionLoadingCode(null);
    }
  };

  if (!isOpen) return null;

  if (!isSuperAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
        <div className="w-full max-w-md p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-500/30 text-center">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Yetkisiz Erişim</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Bu ekran yalnızca Polatlar ana yöneticileri (admin ve murat) tarafından görüntülenebilir.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Lisanslama</span>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  SaaS Masası
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Müşteri kurum lisans süreleri, dondurma ve şube kotaları
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadCompanies}
              disabled={loading}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Yenile"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 p-4 sm:p-5 bg-slate-50/70 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800">
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Toplam Kurum</span>
            <div className="text-xl font-black text-slate-800 dark:text-white mt-0.5">{metrics.total}</div>
          </div>
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/20">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Aktif Lisans</span>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{metrics.active}</div>
          </div>
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/20">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">&lt; 7 Gün Kalan</span>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{metrics.expiring}</div>
          </div>
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-rose-500/20">
            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Süresi Dolan</span>
            <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">{metrics.expired}</div>
          </div>
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-cyan-500/20 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Dondurulan</span>
            <div className="text-xl font-black text-cyan-600 dark:text-cyan-400 mt-0.5">{metrics.frozen}</div>
          </div>
        </div>

        {/* Search & Tabs */}
        <div className="px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Kurum adı, kodu veya yönetici ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 border border-transparent focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {(
              [
                { id: 'all', label: 'Tümü' },
                { id: 'active', label: '🟢 Aktif' },
                { id: 'expiring', label: '🟡 Bitiyor' },
                { id: 'expired', label: '🔴 Dolanlar' },
                { id: 'frozen', label: '❄️ Dondurulan' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  filterTab === tab.id
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Company Cards List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {filteredCompanies.length === 0 ? (
            <div className="py-12 text-center">
              <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Aramanıza uygun kurum bulunamadı.
              </p>
            </div>
          ) : (
            filteredCompanies.map((comp) => {
              const info = getCompanyLicenseInfo(comp);
              const isPolatlar = comp.code === 'POLATLAR';
              const isLoadingThis = actionLoadingCode === comp.code;

              return (
                <div
                  key={comp.code}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 bg-white dark:bg-slate-900/90 shadow-sm hover:shadow-md ${
                    info.status === 'suspended'
                      ? 'border-cyan-500/40 bg-cyan-500/[0.02]'
                      : info.status === 'expired'
                      ? 'border-rose-500/40 bg-rose-500/[0.02]'
                      : info.status === 'expiring_soon'
                      ? 'border-amber-500/40 bg-amber-500/[0.02]'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left Details */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-black text-slate-900 dark:text-white">
                          {comp.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {comp.code}
                        </span>

                        {/* Status Badge */}
                        {isPolatlar ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                            <InfinityIcon className="w-3 h-3" />
                            <span>Ömür Boyu (Ana Sistem)</span>
                          </span>
                        ) : info.status === 'suspended' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center gap-1 animate-pulse">
                            <Snowflake className="w-3 h-3" />
                            <span>Donduruldu</span>
                          </span>
                        ) : info.status === 'expired' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Süresi Doldu</span>
                          </span>
                        ) : info.status === 'expiring_soon' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1 animate-pulse">
                            <Clock className="w-3 h-3" />
                            <span>{info.remainingDays} Gün Kaldı</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{info.isLifetime ? 'Sınırsız' : `${info.remainingDays} Gün Kaldı`}</span>
                          </span>
                        )}
                      </div>

                      {/* Admin Info */}
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                        <span>Yönetici: <strong className="text-slate-700 dark:text-slate-300">{comp.adminName}</strong></span>
                        <span>•</span>
                        <span>E-posta: <strong className="text-slate-700 dark:text-slate-300">{comp.adminEmail}</strong></span>
                        {comp.createdAt && (
                          <>
                            <span>•</span>
                            <span>Kayıt: {new Date(comp.createdAt).toLocaleDateString('tr-TR')}</span>
                          </>
                        )}
                      </div>

                      {/* License Info Row */}
                      {!isPolatlar && (
                        <div className="flex items-center gap-2 text-xs pt-1 flex-wrap">
                          <span className="font-semibold text-slate-500 dark:text-slate-400">Lisans Bitişi:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {info.isLifetime ? 'Sınırsız / Ömür Boyu' : info.expiresDateFormatted || 'Belirtilmedi'}
                          </span>

                          {comp.notes && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] italic">
                              "{comp.notes}"
                            </span>
                          )}

                          {comp.freezeReason && info.status === 'suspended' && (
                            <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[11px] font-medium">
                              Neden: {comp.freezeReason}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right Actions for Customer Companies */}
                    {!isPolatlar && (
                      <div className="flex flex-wrap items-center gap-1.5 lg:justify-end shrink-0">
                        {/* Quick +1 Ay */}
                        <button
                          onClick={() => handleQuickExtend(comp.code, { months: 1 })}
                          disabled={isLoadingThis}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                          title="1 Ay Uzat (30 Gün)"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+1 Ay</span>
                        </button>

                        {/* Quick +1 Yıl */}
                        <button
                          onClick={() => handleQuickExtend(comp.code, { months: 12 })}
                          disabled={isLoadingThis}
                          className="px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                          title="1 Yıl Uzat (365 Gün)"
                        >
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          <span>+1 Yıl</span>
                        </button>

                        {/* Lifetime */}
                        <button
                          onClick={() => handleMakeLifetime(comp.code)}
                          disabled={isLoadingThis}
                          className="px-2.5 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-500/30 text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                          title="Sınırsız / Ömür Boyu Lisans Ver"
                        >
                          <InfinityIcon className="w-3 h-3" />
                          <span>Sınırsız</span>
                        </button>

                        {/* Edit & Custom Date */}
                        <button
                          onClick={() => {
                            setEditingCompany(comp);
                            if (comp.licenseExpiresAt) {
                              const d = new Date(comp.licenseExpiresAt);
                              setCustomDate(d.toISOString().split('T')[0]);
                            } else {
                              setCustomDate('');
                            }
                            setCustomNotes(comp.notes || '');
                          }}
                          disabled={isLoadingThis}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                          title="Özel Tarih & Not Ekle"
                        >
                          <FileEdit className="w-3 h-3 text-slate-500" />
                          <span>Özel Tarih</span>
                        </button>

                        {/* Freeze / Unfreeze Toggle */}
                        <button
                          onClick={() => handleToggleFreeze(comp)}
                          disabled={isLoadingThis}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1 ${
                            comp.isFrozen
                              ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm shadow-cyan-500/20'
                              : 'bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {comp.isFrozen ? (
                            <>
                              <Play className="w-3 h-3 fill-current" />
                              <span>Dondurmayı Kaldır</span>
                            </>
                          ) : (
                            <>
                              <Snowflake className="w-3 h-3" />
                              <span>Dondur</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400">
          <span>* Lisansı dolan kurumlar sisteme giriş yaptıklarında güvenli ödeme/kilit ekranı görürler. Veriler asla silinmez.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-xl font-bold transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>

      {/* Custom Date & Notes Sub-Modal */}
      {editingCompany && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                <span>Lisans Süresi & Not Düzenle</span>
              </h4>
              <button
                onClick={() => setEditingCompany(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kurum
                </label>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {editingCompany.name} ({editingCompany.code})
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Yeni Bitiş Tarihi
                </label>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-blue-500"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Seçilen gün sonuna kadar (23:59) geçerli olacaktır.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Lisans / Tahsilat Notu (İsteğe bağlı)
                </label>
                <textarea
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  rows={2}
                  placeholder="Örn: 2026-2027 yıllık lisans bedeli banka havalesiyle ödendi."
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setEditingCompany(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                onClick={handleSaveCustomDateAndNotes}
                disabled={actionLoadingCode === editingCompany.code}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Kaydet</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
