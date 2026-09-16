import React, { useState, useEffect } from 'react';
import {
  X,
  KeyRound,
  Mail,
  ArrowRight,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { PasswordResetService } from '../../services/passwordResetService';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCompanyCode?: string;
  onSuccess: (companyCode: string, newPassword?: string, username?: string) => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  initialCompanyCode = 'POLATLAR',
  onSuccess,
}) => {
  const [step, setStep] = useState<'request' | 'verify' | 'success'>('request');
  const [companyCode, setCompanyCode] = useState(initialCompanyCode);
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resolvedUsername, setResolvedUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 15-minute expiration countdown & 60-second resend cooldown
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // Sync initial company code
  useEffect(() => {
    if (initialCompanyCode) {
      setCompanyCode(initialCompanyCode);
    }
  }, [initialCompanyCode, isOpen]);

  // Reset state on modal open/close
  useEffect(() => {
    if (!isOpen) {
      setStep('request');
      setEmail('');
      setCode('');
      setNewPassword('');
      setConfirmPassword('');
      setErrorMsg(null);
      setIsLoading(false);
      setExpiresAt(null);
      setResendCooldown(0);
    }
  }, [isOpen]);

  // Expiration and resend countdown timers
  useEffect(() => {
    if (step !== 'verify' || !expiresAt) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const remainingSeconds = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeLeft(remainingSeconds);

      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [step, expiresAt]);

  if (!isOpen) return null;

  // Format MM:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Step 1: Request Code
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanCompany = (companyCode || '').trim().toUpperCase();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanCompany) {
      setErrorMsg('Lütfen kurum kodunuzu giriniz.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Lütfen geçerli bir e-posta adresi giriniz.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await PasswordResetService.requestReset(cleanCompany, cleanEmail);
      if (res.success) {
        setMaskedEmail(res.maskedEmail || cleanEmail);
        setExpiresAt(res.expiresAt || Date.now() + 15 * 60 * 1000);
        setTimeLeft(15 * 60);
        setResendCooldown(60);
        setStep('verify');
      } else {
        setErrorMsg(res.error || 'Sıfırlama kodu gönderilemedi.');
      }
    } catch {
      setErrorMsg('İşlem sırasında bir hata oluştu. Lütfen tekrar deneyiniz.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Resend Code
  const handleResend = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const res = await PasswordResetService.requestReset(companyCode, email);
      if (res.success) {
        setExpiresAt(res.expiresAt || Date.now() + 15 * 60 * 1000);
        setTimeLeft(15 * 60);
        setResendCooldown(60);
        setErrorMsg(null);
      } else {
        setErrorMsg(res.error || 'Kod yeniden gönderilemedi.');
      }
    } catch {
      setErrorMsg('Yeniden kod gönderilirken hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify Code and Reset Password
  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanCode = code.trim().replace(/[^0-9]/g, '');
    const cleanPass = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (cleanCode.length !== 6) {
      setErrorMsg('Lütfen e-postanıza gelen 6 haneli doğrulama kodunu eksiksiz giriniz.');
      return;
    }
    if (cleanPass.length < 3) {
      setErrorMsg('Yeni şifreniz en az 3 karakter olmalıdır.');
      return;
    }
    if (cleanPass !== cleanConfirm) {
      setErrorMsg('Girdiğiniz şifreler birbiriyle eşleşmiyor.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await PasswordResetService.verifyAndResetPassword(
        companyCode,
        cleanCode,
        cleanPass
      );
      if (res.success) {
        if (res.adminUsername) {
          setResolvedUsername(res.adminUsername);
        }
        setStep('success');
      } else {
        setErrorMsg(res.error || 'Şifre güncellenemedi.');
      }
    } catch {
      setErrorMsg('Şifre güncellenirken beklenmedik bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-white/15 rounded-3xl p-6 sm:p-7 shadow-2xl text-white space-y-5 animate-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                Yönetici Şifre Sıfırlama
              </h2>
              <span className="text-xs text-slate-400 font-medium">
                {step === 'request'
                  ? 'E-posta ile 6 haneli kod alma'
                  : step === 'verify'
                  ? 'Kodu doğrula ve yeni şifre belirle'
                  : 'İşlem tamamlandı'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert Box */}
        {errorMsg && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-semibold leading-relaxed animate-in shake duration-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: Request Reset Code */}
        {step === 'request' && (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Yönetici hesabınıza kayıtlı e-posta adresinize 6 haneli tek kullanımlık bir güvenlik doğrulama kodu göndereceğiz.
            </p>

            {/* Kurum Kodu */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Kurum Kodu
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                <input
                  type="text"
                  value={companyCode}
                  onChange={(e) =>
                    setCompanyCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))
                  }
                  placeholder="Örn: POLATLAR veya BURAKDEV"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm font-black tracking-wider uppercase transition-all"
                />
              </div>
            </div>

            {/* Kayıtlı Yönetici E-Postası */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Kayıtlı Yönetici E-Postası
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Örn: yonetici@sirketiniz.com"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm font-medium transition-all"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 mt-2 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Doğrulama Kodu Gönder</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: Verify Code and Set New Password */}
        {step === 'verify' && (
          <form onSubmit={handleVerifyAndReset} className="space-y-4">
            {/* Info pill with masked email & countdown */}
            <div className="p-3.5 rounded-2xl bg-blue-500/15 border border-blue-500/30 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Kod gönderilen adres:</span>
                <span className="font-bold text-blue-300 font-mono">{maskedEmail}</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-white/10">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Kalan Geçerlilik:</span>
                </div>
                <span
                  className={`font-black font-mono ${
                    timeLeft < 120 ? 'text-red-400 animate-pulse' : 'text-amber-300'
                  }`}
                >
                  {formatTime(timeLeft)}
                </span>
              </div>
            </div>

            {/* 6-Digit Code Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  6 Haneli Doğrulama Kodu
                </label>
                {resendCooldown > 0 ? (
                  <span className="text-[10px] text-slate-400 font-medium font-mono">
                    Tekrar gönder ({resendCooldown}s)
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isLoading}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Tekrar Gönder</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="• • • • • •"
                required
                autoFocus
                className="w-full text-center py-3.5 px-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 text-2xl font-black tracking-[12px] font-mono transition-all"
              />
            </div>

            {/* New Password Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Yeni Yönetici Şifresi
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="En az 3 karakter"
                  required
                  className="w-full pl-10 pr-11 py-3 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm font-medium transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 transition-colors"
                  title={showPassword ? 'Şifreyi Gizle' : 'Şifreyi Göster'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Yeni Şifre (Tekrar)
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Şifreyi tekrar giriniz"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm font-medium transition-all"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStep('request')}
                className="w-1/3 py-3 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Geri Dön
              </button>
              <button
                type="submit"
                disabled={isLoading || code.length !== 6}
                className="w-2/3 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Şifreyi Güncelle</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Success Screen */}
        {step === 'success' && (
          <div className="py-4 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-xl">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-black text-white">
                Şifreniz Başarıyla Güncellendi!
              </h3>
              <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto leading-relaxed">
                Yönetici şifreniz başarıyla değiştirildi. Şimdi yeni şifrenizle sisteme hemen giriş yapabilirsiniz.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                onSuccess(companyCode, newPassword, resolvedUsername);
                onClose();
              }}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
            >
              <span>Giriş Yap Ekranına Git</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
