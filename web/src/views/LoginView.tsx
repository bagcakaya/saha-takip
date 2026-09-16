import React, { useEffect, useState } from 'react';
import {
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  MapPin,
  MessageCircle,
  Building2,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { WeatherService } from '../services/weatherService';
import { TimeOfDay, WeatherCondition, WeatherData } from '../types/auth';
import { WeatherBackground } from '../components/auth/WeatherBackground';
import { ContactModal } from '../components/auth/ContactModal';

export const LoginView: React.FC = () => {
  const { login, registerCompany } = useAuth();

  const [companyCode, setCompanyCode] = useState(() => {
    return localStorage.getItem('@saha_takip_company_code') || 'POLATLAR';
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);

  // New Company / Admin Registration Modal States
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [regCompanyName, setRegCompanyName] = useState('');
  const [regCompanyCode, setRegCompanyCode] = useState('');
  const [regAdminName, setRegAdminName] = useState('');
  const [regAdminEmail, setRegAdminEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // Live weather & ambience (100% automatically detected from user's location & time)
  const [liveWeather, setLiveWeather] = useState<WeatherData>({
    timeOfDay: 'night',
    condition: 'clear',
    temperature: 22,
    weatherText: 'Yıldızlı Gece',
    locationName: 'Konumunuz Belirleniyor...',
    isDay: false,
  });

  const [activeTimeOfDay, setActiveTimeOfDay] = useState<TimeOfDay>('night');
  const [activeCondition, setActiveCondition] = useState<WeatherCondition>('clear');

  // Load 100% automatic live weather on mount based on user's location & time
  useEffect(() => {
    let isMounted = true;
    const initWeather = async () => {
      const weather = await WeatherService.getCurrentWeather();
      if (isMounted) {
        setLiveWeather(weather);
        setActiveTimeOfDay(weather.timeOfDay);
        setActiveCondition(weather.condition);
      }
    };
    initWeather();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const res = await login(companyCode, username, password, rememberMe);
      if (!res.success && res.error) {
        setErrorMsg(res.error);
      }
    } catch {
      setErrorMsg('Giriş yapılırken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setIsRegistering(true);

    try {
      const res = await registerCompany({
        name: regCompanyName,
        code: regCompanyCode,
        adminName: regAdminName,
        adminEmail: regAdminEmail,
        password: regPassword,
      });

      if (res.success) {
        setIsRegisterOpen(false);
      } else {
        setRegError(res.error || 'Kayıt sırasında bir hata oluştu.');
      }
    } catch (err: any) {
      setRegError(err?.message || 'Kayıt sırasında bir hata oluştu.');
    } finally {
      setIsRegistering(false);
    }
  };

  // Helper to auto-suggest company code as user types company name
  const handleCompanyNameChange = (val: string) => {
    setRegCompanyName(val);
    if (!regCompanyCode || regCompanyCode === regCompanyName.toUpperCase().slice(0, 8).replace(/[^A-Z0-9]/g, '')) {
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
      setRegCompanyCode(clean);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden select-none">
      {/* 1. Dynamic Live Canvas Sky & Weather Engine (100% Automatic) */}
      <WeatherBackground
        timeOfDay={activeTimeOfDay}
        condition={activeCondition}
      />

      {/* Top Right Floating "İletişim" Button */}
      <div
        className="absolute right-4 sm:right-6 z-20"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
      >
        <button
          type="button"
          onClick={() => setIsContactOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900/60 hover:bg-slate-900/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 text-white text-xs font-black shadow-xl transition-all active:scale-95 group hover:border-blue-400/50"
        >
          <MessageCircle className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
          <span>İletişim</span>
        </button>
      </div>

      {/* 2. Glassmorphic Login Container */}
      <div className="relative z-10 w-full max-w-md bg-slate-900/60 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl text-white space-y-6 animate-in zoom-in-95 duration-300">
        {/* Header with App Logo & Live Weather Badge */}
        <div className="text-center space-y-3">
          <div className="inline-block relative">
            <div className="absolute inset-0 rounded-2xl bg-blue-500/30 blur-lg animate-pulse" />
            <img
              src="/icon.png"
              alt="Saha Takip Raporu"
              className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-contain mx-auto shadow-xl border border-white/30 bg-white/95 p-1"
            />
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-md">
              Saha Takip Raporu
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-300/90 mt-1">
              Saha Görev, Kurulum & Tutanak Portalı
            </p>
          </div>

          {/* Live Auto Weather Indicator Pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-white/90 shadow-xs">
            <MapPin className="w-3.5 h-3.5 text-blue-300 shrink-0" />
            <span className="truncate max-w-[130px]">{liveWeather.locationName}</span>
            <span className="text-white/40">•</span>
            <span>{liveWeather.temperature}°C</span>
            <span className="text-white/40">•</span>
            <span className="capitalize">{liveWeather.weatherText}</span>
          </div>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-bold text-center animate-in shake duration-200">
            {errorMsg}
          </div>
        )}

        {/* Login Form (3 Kutulu Giriş: Kurum Kodu, Kullanıcı Adı, Şifre) */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Kurum Kodu Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Kurum Kodu
              </label>
              <span className="text-[10px] text-blue-300/80 font-medium">
                Örn: POLATLAR
              </span>
            </div>
            <div className="relative">
              <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
              <input
                type="text"
                value={companyCode}
                onChange={(e) => setCompanyCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                placeholder="Kurum Kodunuz (Örn: POLATLAR)"
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm font-black tracking-wider uppercase transition-all"
              />
            </div>
          </div>

          {/* 2. Username Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Kullanıcı Adı / E-Posta
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Kullanıcı adınızı veya e-postanızı girin"
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm font-medium transition-all"
              />
            </div>
          </div>

          {/* 3. Password Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Şifre
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Şifrenizi girin"
                required
                className="w-full pl-10 pr-11 py-3 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm font-medium transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 transition-colors"
                title={showPassword ? 'Şifreyi Gizle' : 'Şifreyi Göster'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Remember Me Toggle */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300 hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded-md bg-white/10 border-white/20 text-blue-600 focus:ring-blue-500"
              />
              <span>Beni Hatırla</span>
            </label>
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
                <span>Giriş Yap</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Divider & "Yeni Kurum / Yönetici Kaydı" Button */}
        <div className="pt-2 border-t border-white/10 text-center space-y-3">
          <p className="text-xs text-slate-300/80">Farklı bir firma veya kurum musunuz?</p>
          <button
            type="button"
            onClick={() => {
              setRegError('');
              setIsRegisterOpen(true);
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 hover:border-blue-400/50 cursor-pointer active:scale-95 shadow-sm"
          >
            <Building2 className="w-4 h-4 text-blue-300" />
            <span>🏢 Yeni Kurum / Yönetici Kaydı</span>
          </button>
        </div>

        {/* Copyright Footer */}
        <div className="pt-1 text-center">
          <p className="text-[11px] font-medium text-slate-300/80 tracking-wide select-none">
            © Polatlar Yazılım - 2026. Tüm Hakları Saklıdır
          </p>
        </div>
      </div>

      {/* --- MODAL: YENİ KURUM / YÖNETİCİ KAYIT MODALI --- */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
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
                onClick={() => setIsRegisterOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {regError && (
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-bold text-center">
                {regError}
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {/* Kurum Adı */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">
                  Kurum / Şirket Adı <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={regCompanyName}
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
                  value={regCompanyCode}
                  onChange={(e) => setRegCompanyCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                  placeholder="Örn: AKARSU"
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
                  value={regAdminName}
                  onChange={(e) => setRegAdminName(e.target.value)}
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
                  value={regAdminEmail}
                  onChange={(e) => setRegAdminEmail(e.target.value)}
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
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="En az 3 karakter"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 text-xs font-medium"
                />
              </div>

              {/* Info pill */}
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-400/20 text-[11px] text-blue-200 leading-relaxed">
                ℹ️ Kurumunuz açıldığında tüm verileriniz diğer firmalardan <strong>%100 izole</strong> saklanacaktır. Yönetici olarak personellerinizi ve çalışma yerinizi hemen belirleyebilirsiniz.
              </div>

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isRegistering}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isRegistering ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>Kurumu Oluştur ve Giriş Yap</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contact Modal Window */}
      <ContactModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
      />
    </div>
  );
};
