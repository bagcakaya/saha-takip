import React, { useState } from 'react';
import {
  Building2,
  X,
  Sparkles,
  Loader2,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Company, User } from '../../types/auth';

interface CreateCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateCompanyModal: React.FC<CreateCompanyModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { createCompanyByAdmin } = useAuth();

  const [companyName, setCompanyName] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Success state holding created details
  const [createdResult, setCreatedResult] = useState<{
    company: Company;
    adminUser: User;
    plainPassword: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleCompanyNameChange = (val: string) => {
    setCompanyName(val);
    if (
      !companyCode ||
      companyCode === companyName.toUpperCase().slice(0, 8).replace(/[^A-Z0-9]/g, '')
    ) {
      const clean = val
        .toUpperCase()
        .replace(/Ğ/g, 'G')
        .replace(/Ü/g, 'U')
        .replace(/Ş/g, 'S')
        .replace(/İ/g, 'I')
        .replace(/I/g, 'I')
        .replace(/Ö/g, 'O')
        .replace(/Ç/g, 'C')
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 10);
      setCompanyCode(clean);
    }
  };

  const resetForm = () => {
    setCompanyName('');
    setCompanyCode('');
    setAdminName('');
    setAdminEmail('');
    setPassword('');
    setErrorMsg('');
    setCreatedResult(null);
    setCopied(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const res = await createCompanyByAdmin({
        name: companyName,
        code: companyCode,
        adminName: adminName,
        adminEmail: adminEmail,
        password: password,
      });

      if (res.success && res.company && res.adminUser) {
        setCreatedResult({
          company: res.company,
          adminUser: res.adminUser,
          plainPassword: password,
        });
      } else {
        setErrorMsg(res.error || 'Kurum kaydı oluşturulurken bir hata oluştu.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Kurum kaydı oluşturulurken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdResult) return;
    const text = `🏢 Kurum Adı: ${createdResult.company.name}\n🔑 Kurum Kodu: ${createdResult.company.code}\n👤 Yönetici Girişi: admin (veya ${createdResult.company.adminEmail})\n🔒 Şifre: ${createdResult.plainPassword}\n\nSisteme Giriş Linki: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn select-none">
      <div className="bg-slate-900 border border-white/20 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl text-white space-y-5">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Yeni Kurum Kaydı</h3>
              <span className="text-xs text-blue-300 font-semibold">
                Kendi kurumunuzu açın ve personellerinizi yönetin
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-bold text-center">
            {errorMsg}
          </div>
        )}

        {/* Success View */}
        {createdResult ? (
          <div className="space-y-4 py-1">
            <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 space-y-2 text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-black text-white">Kurum Başarıyla Oluşturuldu!</h4>
              <p className="text-xs text-emerald-300/90 leading-relaxed">
                Yeni kurum ve yönetici hesabı aktif edildi. Aşağıdaki giriş bilgilerini kurum yetkilisine iletebilirsiniz:
              </p>
            </div>

            {/* Credentials Card */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Kurum Adı:</span>
                <span className="font-bold text-white">{createdResult.company.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Kurum Kodu:</span>
                <span className="font-black text-blue-300 tracking-wider">
                  {createdResult.company.code}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Yönetici Adı:</span>
                <span className="font-bold text-white">{createdResult.company.adminName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Giriş (Kullanıcı / E-Posta):</span>
                <span className="font-mono text-amber-300 font-bold">
                  admin <span className="text-slate-400 font-normal">veya</span> {createdResult.company.adminEmail}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Şifre:</span>
                <span className="font-mono text-emerald-300 font-bold">
                  {createdResult.plainPassword}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 border border-white/20 text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Kopyalandı!' : 'Bilgileri Kopyala'}</span>
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="py-2.5 px-5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer"
              >
                Tamam
              </button>
            </div>
          </div>
        ) : (
          /* Form (Görsel-2) */
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Kurum Adı */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                Kurum / Şirket Adı <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => handleCompanyNameChange(e.target.value)}
                placeholder="Örn: Akarsu Ltd. Şti."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 text-xs font-medium"
              />
            </div>

            {/* Kurum Kodu */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 block">
                  Kurum Kodu (Personel Giriş Kodu) <span className="text-rose-400">*</span>
                </label>
                <span className="text-[10px] text-blue-300">Büyük harf, boşluksuz</span>
              </div>
              <input
                type="text"
                required
                value={companyCode}
                onChange={(e) =>
                  setCompanyCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))
                }
                placeholder="ÖRN: AKARSU"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 text-xs font-black tracking-wider uppercase"
              />
            </div>

            {/* Yönetici Ad Soyad */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                Yönetici Adı ve Soyadı <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Örn: Mehmet Akarsu"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 text-xs font-medium"
              />
            </div>

            {/* Yönetici E-Posta */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                Yönetici E-Posta <span className="text-rose-400">*</span>
              </label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="Örn: mehmet@akarsu.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 text-xs font-medium"
              />
            </div>

            {/* Yönetici Şifre */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                Yönetici Şifresi <span className="text-rose-400">*</span>
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="En az 3 karakter"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 text-xs font-medium"
              />
            </div>

            {/* Info pill */}
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-400/20 text-[11px] text-blue-200 leading-relaxed">
              ℹ️ Kurumunuz açıldığında tüm verileriniz diğer firmalardan <strong>%100 izole</strong>{' '}
              saklanacaktır. Yönetici olarak personellerinizi ve çalışma yerinizi hemen belirleyebilirsiniz.
            </div>

            {/* Modal Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/10 transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>Kurumu Oluştur</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
