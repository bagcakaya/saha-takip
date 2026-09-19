import React, { useState, useEffect } from 'react';
import {
  Server,
  Cloud,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Globe,
  HardDrive,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { ServerConfigService, ServerConfig } from '../../services/serverConfigService';

interface ServerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [config, setConfig] = useState<ServerConfig>(() => ServerConfigService.getConfig());
  const [mode, setMode] = useState<'cloud' | 'local'>(config.mode);
  const [localUrl, setLocalUrl] = useState(config.localUrl || 'http://81.213.219.69:3001');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    database?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const cfg = ServerConfigService.getConfig();
      setConfig(cfg);
      setMode(cfg.mode);
      setLocalUrl(cfg.localUrl || 'http://81.213.219.69:3001');
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await ServerConfigService.testConnection(localUrl);
      setTestResult(res);
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e?.message || 'Bilinmeyen hata oluştu.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    ServerConfigService.saveConfig({
      mode,
      localUrl,
      lastTestedAt: testResult?.success ? Date.now() : config.lastTestedAt,
      lastTestSuccess: testResult?.success ?? config.lastTestSuccess,
    });
    if (onSaved) onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl text-white space-y-5 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Sunucu Bağlantı Ayarları</h3>
              <p className="text-xs text-slate-400">
                SQL Server (Windows Server 2022) & Bulut Geçişi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Server Mode Selector */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Sunucu Modu: [Bulut (Firebase)] / [Yerel Sunucu]
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Mode 1: Cloud */}
            <div
              onClick={() => setMode('cloud')}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                mode === 'cloud'
                  ? 'bg-blue-600/15 border-blue-500 shadow-sm shadow-blue-500/20 ring-1 ring-blue-500'
                  : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Cloud className={`w-4 h-4 ${mode === 'cloud' ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold text-white">Bulut (Firebase)</span>
                </div>
                {mode === 'cloud' && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Varsayılan bulut altyapısı üzerinden çalışır. Ekstra sunucu ayarı gerektirmez.
              </p>
            </div>

            {/* Mode 2: Local Server (SQL Server) */}
            <div
              onClick={() => setMode('local')}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                mode === 'local'
                  ? 'bg-emerald-600/15 border-emerald-500 shadow-sm shadow-emerald-500/20 ring-1 ring-emerald-500'
                  : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <HardDrive className={`w-4 h-4 ${mode === 'local' ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold text-white">Yerel Sunucu</span>
                </div>
                {mode === 'local' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Windows Server 2022 & SQL Server yerel veritabanınıza doğrudan bağlanır.
              </p>
            </div>
          </div>
        </div>

        {/* Local Server URL input (Always visible or highlighted when local) */}
        <div className={`space-y-2 rounded-2xl p-3.5 border transition-all ${
          mode === 'local'
            ? 'bg-slate-800/90 border-emerald-500/40 ring-1 ring-emerald-500/20'
            : 'bg-slate-800/30 border-slate-700/40 opacity-70'
        }`}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span>Sunucu Adresi (Statik IP)</span>
            </label>
            <span className="text-[10px] text-slate-400">Port: 3001</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={localUrl}
              onChange={(e) => setLocalUrl(e.target.value)}
              placeholder="http://81.213.219.69:3001"
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting || !localUrl.trim()}
              className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shrink-0"
              title="Bağlantıyı Test Et"
            >
              {isTesting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>{isTesting ? 'Test Ediliyor...' : 'Bağlantıyı Test Et'}</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-400">
            Ofis içindeyken yerel ağdan, sahadayken veya mobil verideyken Statik IP (<code className="text-blue-300">http://81.213.219.69:3001</code>) üzerinden bağlanılır.
          </p>

          {/* Test Result Message Box */}
          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 animate-in fade-in duration-200 ${
                testResult.success
                  ? 'bg-emerald-950/60 border border-emerald-600/50 text-emerald-200'
                  : 'bg-rose-950/60 border border-rose-600/50 text-rose-200'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="font-bold">
                  {testResult.success ? 'Bağlantı Başarılı!' : 'Bağlantı Başarısız'}
                </div>
                <div className="text-[11px] mt-0.5 opacity-90">{testResult.message}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-emerald-900/30 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Ayarları Kaydet ve Uygula</span>
          </button>
        </div>
      </div>
    </div>
  );
};
