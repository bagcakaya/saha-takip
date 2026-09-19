import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Trash2,
  CheckCheck,
  Smartphone,
  User,
  Clock,
  AlertTriangle,
  KeyRound,
  Building2,
  Lock,
} from 'lucide-react';
import { useStorage } from '../context/StorageContext';
import { useAuth } from '../context/AuthContext';
import { isUserAdmin, Company } from '../types/auth';
import { DeviceService } from '../services/deviceService';
import { CompanyService } from '../services/companyService';

export const SecurityLogsView: React.FC = () => {
  const { user } = useAuth();
  const {
    securityLogs,
    unreadLogsCount,
    markAllAsRead,
    deleteSecurityLog,
    clearAllSecurityLogs,
  } = useStorage();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'cross_device' | 'lockout'>('all');
  const [isUnbindingId, setIsUnbindingId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('ALL');

  const userComp = (user?.companyCode || 'POLATLAR').toUpperCase();
  const isSuperAdmin =
    userComp === 'POLATLAR' && ['admin', 'murat'].includes((user?.username || '').toLowerCase());

  useEffect(() => {
    if (isSuperAdmin) {
      CompanyService.fetchCompanies().then((comps) => setCompanies(comps));
    }
  }, [isSuperAdmin]);

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  const handleClearAll = async () => {
    if (securityLogs.length === 0) return;
    if (
      window.confirm(
        'Tüm güvenlik log kayıtlarını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.'
      )
    ) {
      await clearAllSecurityLogs();
    }
  };

  const handleDeleteSingle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteSecurityLog(id);
  };

  const handleUnbindUserLock = async (userId: string, userName?: string) => {
    if (
      !window.confirm(
        `${userName || 'Bu personel'} için mevcut cihaz kilidini sıfırlamak istiyor musunuz?\n\nSıfırlandıktan sonra personel yeni telefonundan ilk kez giriş yaptığında yeni cihazı otomatik kilitlenecektir.`
      )
    ) {
      return;
    }

    setIsUnbindingId(userId);
    try {
      await DeviceService.unbindUserDevice(userId);
      alert('✅ Cihaz kilidi başarıyla sıfırlandı. Personel artık yeni cihazından giriş yapabilir.');
    } catch {
      alert('Cihaz kilidi sıfırlanırken bir hata oluştu.');
    } finally {
      setIsUnbindingId(null);
    }
  };

  // Filter logs
  const filteredLogs = useMemo(() => {
    return securityLogs.filter((log) => {
      // Company scoping: Non-superadmins only see their own company
      if (!isSuperAdmin) {
        if ((log.companyCode || 'POLATLAR').toUpperCase() !== userComp) return false;
      } else if (selectedCompanyFilter !== 'ALL') {
        if ((log.companyCode || 'POLATLAR').toUpperCase() !== selectedCompanyFilter.toUpperCase()) return false;
      }

      // Filter by type
      if (filterType === 'unread' && log.read) return false;
      if (filterType === 'cross_device' && !log.boundUserId) return false;
      if (filterType === 'lockout' && !log.message.toLowerCase().includes('kilitlendi')) return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchAttempted =
          log.attemptedUsername.toLowerCase().includes(query) ||
          (log.attemptedName && log.attemptedName.toLowerCase().includes(query));
        const matchOwner =
          (log.boundUserName && log.boundUserName.toLowerCase().includes(query)) ||
          (log.boundUserId && log.boundUserId.toLowerCase().includes(query));
        const matchDevice =
          log.deviceId.toLowerCase().includes(query) ||
          (log.deviceName && log.deviceName.toLowerCase().includes(query));
        const matchCompany = (log.companyCode || '').toLowerCase().includes(query);
        const matchMessage = log.message.toLowerCase().includes(query);

        return matchAttempted || matchOwner || matchDevice || matchCompany || matchMessage;
      }

      return true;
    });
  }, [securityLogs, filterType, searchQuery, isSuperAdmin, userComp, selectedCompanyFilter]);

  // Summary statistics
  interface OffenderStat {
    name: string;
    count: number;
  }

  const stats = useMemo(() => {
    const total = filteredLogs.length;
    const crossDeviceAttempts = filteredLogs.filter((l) => l.boundUserId).length;
    const lockoutAttempts = filteredLogs.filter((l) =>
      l.message.toLowerCase().includes('kilitlendi')
    ).length;

    // Find top offender
    const attemptCounts: { [key: string]: { count: number; name: string } } = {};
    filteredLogs.forEach((l) => {
      const key = l.attemptedUserId || l.attemptedUsername;
      const name = l.attemptedName || l.attemptedUsername;
      if (!attemptCounts[key]) attemptCounts[key] = { count: 0, name };
      attemptCounts[key].count++;
    });

    let topOffender: OffenderStat | null = null;
    for (const key of Object.keys(attemptCounts)) {
      const item = attemptCounts[key];
      if (!topOffender || item.count > topOffender.count) {
        topOffender = item;
      }
    }

    return { total, crossDeviceAttempts, lockoutAttempts, topOffender };
  }, [filteredLogs]);

  // Admin access guard
  if (!isUserAdmin(user)) {
    return (
      <div className="max-w-xl mx-auto mt-16 p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          Yetkisiz Erişim
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          Güvenlik ve cihaz log kayıtları yalnızca Kurum Yöneticileri tarafından görüntülenebilir.
        </p>
      </div>
    );
  }

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    const dateStr = d.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const timeStr = d.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const diffSec = Math.floor((Date.now() - ts) / 1000);
    let agoStr = '';
    if (diffSec < 60) agoStr = 'Az önce';
    else if (diffSec < 3600) agoStr = `${Math.floor(diffSec / 60)} dakika önce`;
    else if (diffSec < 86400) agoStr = `${Math.floor(diffSec / 3600)} saat önce`;
    else agoStr = `${Math.floor(diffSec / 86400)} gün önce`;

    return { dateStr, timeStr, agoStr };
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner / Header */}
      <div className="bg-gradient-to-br from-slate-900 via-rose-950 to-slate-900 border border-rose-500/30 rounded-3xl p-6 sm:p-7 shadow-xl text-white relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-rose-500/20 border border-rose-400/40 text-rose-400 flex items-center justify-center shrink-0 shadow-lg">
              <ShieldAlert className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Güvenlik & Log Kayıtları
                </h1>
                {unreadLogsCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white animate-pulse">
                    {unreadLogsCount} Yeni İhlal
                  </span>
                )}
                {isSuperAdmin ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" />
                    Süper Yönetici Konsolu
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {userComp} Kurum Masası
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Personel hesaplarının yetkisiz veya başka personellere ait cihazlarla giriş yapma girişimleri burada anlık olarak kayıt altına alınır.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
            {unreadLogsCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <CheckCheck className="w-4 h-4 text-emerald-400" />
                <span>Tümünü Okundu Say</span>
              </button>
            )}

            {securityLogs.length > 0 && (
              <button
                onClick={handleClearAll}
                className="px-3.5 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Logları Temizle</span>
              </button>
            )}
          </div>
        </div>

        <div className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-rose-500/10 blur-2xl pointer-events-none" />
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Logs */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Toplam İhlal Kaydı
          </span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {stats.total}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Kayıtlı tüm denemeler
          </span>
        </div>

        {/* Unread Logs */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
            Okunmamış İhlaller
          </span>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {unreadLogsCount}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            İnceleme bekleyen kayıtlar
          </span>
        </div>

        {/* Lockout Incidents */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
            Hesap Kilitlenmeleri (5 Dk)
          </span>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {stats.lockoutAttempts}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            5 hatalı şifre girişi
          </span>
        </div>

        {/* Cross-Device Attempts */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
            Başka Personel Telefonu
          </span>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {stats.crossDeviceAttempts}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Cihaz çakışması denemesi
          </span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 min-w-0">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Personel adı, cihaz veya kurum ara..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-sm"
            />
          </div>

          {/* Super Admin Company Selector */}
          {isSuperAdmin && companies.length > 0 && (
            <div className="relative shrink-0 sm:w-auto w-full">
              <select
                value={selectedCompanyFilter}
                onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                className="w-full sm:w-auto px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-sm cursor-pointer"
              >
                <option value="ALL">🏢 Tüm Kurumlar ({securityLogs.length})</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.code}>
                    🏢 {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full lg:w-auto max-w-full">
          <button
            onClick={() => setFilterType('all')}
            className={`flex-1 sm:flex-initial text-center justify-center px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Tümü ({stats.total})
          </button>
          <button
            onClick={() => setFilterType('unread')}
            className={`flex-1 sm:flex-initial text-center justify-center px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'unread'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Okunmamış ({unreadLogsCount})
          </button>
          <button
            onClick={() => setFilterType('lockout')}
            className={`flex-1 sm:flex-initial text-center justify-center px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'lockout'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            🔒 Kilitlenenler ({stats.lockoutAttempts})
          </button>
          <button
            onClick={() => setFilterType('cross_device')}
            className={`flex-1 sm:flex-initial text-center justify-center px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'cross_device'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            📱 Cihaz Çakışması ({stats.crossDeviceAttempts})
          </button>
        </div>
      </div>

      {/* Log Records List */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              {searchQuery || filterType !== 'all'
                ? 'Filtreyle Eşleşen Log Bulunamadı'
                : 'Her Şey Güvende! İhlal Kaydı Bulunmuyor'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
              {searchQuery || filterType !== 'all'
                ? 'Arama kriterlerinizi değiştirerek tekrar deneyebilirsiniz.'
                : 'Personelleriniz yalnızca kendi kayıtlı cihazlarından giriş yapmaktadır. Herhangi bir yetkisiz telefon veya uyuşmazlık denemesi tespit edilmedi.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const timeInfo = formatTimestamp(log.timestamp);
            const isLockout = log.message.toLowerCase().includes('kilitlendi');
            const isCrossDevice = Boolean(log.boundUserId);

            return (
              <div
                key={log.id}
                className={`relative rounded-3xl p-5 sm:p-6 transition-all duration-200 border shadow-sm ${
                  !log.read
                    ? 'bg-rose-500/5 dark:bg-rose-950/20 border-rose-500/40 shadow-rose-500/5'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isLockout ? (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-black flex items-center gap-1.5 bg-rose-600 text-white shadow-sm">
                        <Lock className="w-3.5 h-3.5" />
                        Hesap Kilitlendi (5 Dk)
                      </span>
                    ) : isCrossDevice ? (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-black flex items-center gap-1.5 bg-rose-500 text-white">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Başka Personel Telefonu
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-black flex items-center gap-1.5 bg-amber-500 text-white">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Yetkisiz Cihaz Denemesi
                      </span>
                    )}

                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      🏢 {log.companyCode || 'POLATLAR'}
                    </span>

                    {!log.read && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    )}

                    <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{timeInfo.dateStr}</span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span>{timeInfo.timeStr}</span>
                      <span className="text-rose-600 dark:text-rose-400 font-bold ml-1">
                        ({timeInfo.agoStr})
                      </span>
                    </span>
                  </div>

                  <button
                    onClick={(e) => handleDeleteSingle(log.id, e)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors self-end sm:self-auto cursor-pointer"
                    title="Bu logu sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Main Notification Message (User Requested Format) */}
                <div className="py-3.5">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-900 dark:text-white text-sm sm:text-base font-extrabold leading-relaxed flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-rose-500/20 text-rose-500 shrink-0 mt-0.5">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <span className="tracking-tight">{log.message}</span>
                  </div>
                </div>

                {/* Technical Meta Badges & Unbind Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-blue-500" />
                      <span>Denenen Kullanıcı: <strong className="text-slate-900 dark:text-white font-bold">{log.attemptedUsername}</strong></span>
                    </span>

                    <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Cihaz ID: <code className="font-mono text-[11px] text-slate-900 dark:text-slate-200">{log.deviceId}</code></span>
                    </span>

                    {log.boundUserName && (
                      <span className="px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-rose-500" />
                        <span>Cihazın Gerçek Sahibi: <strong className="font-bold">{log.boundUserName}</strong></span>
                      </span>
                    )}
                  </div>

                  {/* Reset Lock Shortcut Button */}
                  {log.attemptedUserId && (
                    <button
                      type="button"
                      onClick={() => handleUnbindUserLock(log.attemptedUserId!, log.attemptedName || log.attemptedUsername)}
                      disabled={isUnbindingId === log.attemptedUserId}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0 disabled:opacity-50"
                      title="Personel telefonunu yenilediyse kilidi sıfırlayın"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>
                        {isUnbindingId === log.attemptedUserId
                          ? 'Sıfırlanıyor...'
                          : `[🔓 ${log.attemptedUsername} Kilidini Sıfırla]`}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
