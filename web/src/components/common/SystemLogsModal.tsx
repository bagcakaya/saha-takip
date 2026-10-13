import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Download,
  Trash2,
  RefreshCw,
  Search,
  X,
  AlertTriangle,
  AlertCircle,
  Info,
  Laptop,
  CheckCircle2,
} from 'lucide-react';
import { SystemLogger } from '../../services/systemLogger';
import { SystemLogItem } from '../../types/storage';

interface SystemLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemLogsModal: React.FC<SystemLogsModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<SystemLogItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await SystemLogger.fetchAllLogs();
      setLogs(data);
    } catch (err) {
      console.error('Log yükleme hatası:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen]);

  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
      if (selectedLevel !== 'ALL' && item.level !== selectedLevel) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchMsg = (item.message || '').toLowerCase().includes(q);
        const matchUser = (item.userName || '').toLowerCase().includes(q);
        const matchDetails = (item.details || '').toLowerCase().includes(q);
        const matchCat = (item.category || '').toLowerCase().includes(q);
        if (!matchMsg && !matchUser && !matchDetails && !matchCat) return false;
      }
      return true;
    });
  }, [logs, selectedCategory, selectedLevel, searchQuery]);

  const handleDownload = async () => {
    try {
      await SystemLogger.downloadLogFile('is_takip_hatalari');
      setToastMsg('Log dosyası başarıyla indirildi!');
      setTimeout(() => setToastMsg(null), 3000);
    } catch {
      alert('Log dosyası indirilirken bir hata oluştu.');
    }
  };

  const handleClear = async () => {
    if (!window.confirm('Tüm sistem ve hata loglarını silmek istediğinize emin misiniz?')) return;
    await SystemLogger.clearLogs();
    setLogs([]);
    setToastMsg('Tüm loglar temizlendi.');
    setTimeout(() => setToastMsg(null), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>İş Takip Sistemi - Hata ve Sistem Günlüğü</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                  {filteredLogs.length} Kayıt
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Uygulamada, mesai giriş/çıkışlarında veya senkronizasyonda yaşanan sorunların detaylı kayıtları
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              title="Log Dosyasını İndir (.log)"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">.log İndir</span>
            </button>

            <button
              onClick={loadLogs}
              title="Yenile"
              disabled={isLoading}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {logs.length > 0 && (
              <button
                onClick={handleClear}
                title="Logları Temizle"
                className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toast notification */}
        {toastMsg && (
          <div className="mx-6 mt-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Filter bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Mesaj, kullanıcı veya hata ara..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">Tüm Kategoriler</option>
              <option value="MESAI_GIRIS">Mesai Girişi</option>
              <option value="MESAI_CIKIS">Mesai Çıkışı</option>
              <option value="MESAI_ONAY">Mesai Onay</option>
              <option value="GPS_KONUM">GPS ve Konum</option>
              <option value="VARDIYA">Vardiya & Hatırlatıcı</option>
              <option value="BILDIRIM">Bildirimler</option>
              <option value="SENKRONIZASYON">Senkronizasyon</option>
              <option value="VERITABANI">Veritabanı</option>
              <option value="SISTEM_GENEL">Genel Sistem</option>
            </select>
          </div>

          <div>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">Tüm Düzeyler</option>
              <option value="ERROR">🔴 Sadece Hatalar (ERROR)</option>
              <option value="WARN">🟡 Uyarılar (WARN)</option>
              <option value="INFO">🔵 Bilgi Kayıtları (INFO)</option>
            </select>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-rose-500" />
              <span className="text-xs">Sistem logları yükleniyor...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 dark:text-slate-500">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Kayıtlı sistem hatası veya uyarısı bulunmuyor.</p>
              <p className="text-xs mt-1">İş Takip Sistemi sorunsuz çalışıyor.</p>
            </div>
          ) : (
            filteredLogs.map((item) => {
              const isError = item.level === 'ERROR';
              const isWarn = item.level === 'WARN';
              const isExpanded = expandedLogId === item.id;

              return (
                <div
                  key={item.id}
                  onClick={() => setExpandedLogId(isExpanded ? null : item.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isError
                      ? 'bg-rose-500/5 hover:bg-rose-500/10 border-rose-200 dark:border-rose-900/60'
                      : isWarn
                      ? 'bg-amber-500/5 hover:bg-amber-500/10 border-amber-200 dark:border-amber-900/60'
                      : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800/80 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="mt-0.5">
                        {isError ? (
                          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        ) : isWarn ? (
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <Info className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center flex-wrap gap-1.5 mb-1">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              isError
                                ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                : isWarn
                                ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                : 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                            }`}
                          >
                            {item.level}
                          </span>

                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300">
                            {item.category}
                          </span>

                          {item.userName && (
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                              {item.userName}
                              {item.companyCode ? ` (${item.companyCode})` : ''}
                            </span>
                          )}

                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono ml-auto">
                            {item.dateStr}
                          </span>
                        </div>

                        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium break-words">
                          {item.message}
                        </p>

                        {/* Collapsible Details */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2 text-xs">
                            {item.details && (
                              <div>
                                <span className="font-semibold text-slate-600 dark:text-slate-400 text-[11px]">
                                  Hata / Detay:
                                </span>
                                <pre className="mt-1 p-2.5 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                                  {item.details}
                                </pre>
                              </div>
                            )}

                            {item.deviceInfo && (
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                <Laptop className="w-3.5 h-3.5" />
                                <span>{item.deviceInfo}</span>
                              </div>
                            )}

                            {item.url && (
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                                Sayfa: {item.url}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>
              Loglar doğrudan bilgisayarınızdaki{' '}
              <strong className="text-slate-700 dark:text-slate-300 font-mono">
                C:\Users\Mert\Desktop\Görev_Tamamlama\Logs\is_takip_hatalari.log
              </strong>{' '}
              dosyasına yazılmaktadır.
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
