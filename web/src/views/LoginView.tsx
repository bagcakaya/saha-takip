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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { WeatherService } from '../services/weatherService';
import { TimeOfDay, WeatherCondition, WeatherData } from '../types/auth';
import { WeatherBackground } from '../components/auth/WeatherBackground';
import { ContactModal } from '../components/auth/ContactModal';

export const LoginView: React.FC = () => {
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);

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
      const res = await login(username, password, rememberMe);
      if (!res.success && res.error) {
        setErrorMsg(res.error);
      }
    } catch {
      setErrorMsg('Giriş yapılırken bir hata oluştu.');
    } finally {
      setIsLoading(false);
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
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
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

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Kullanıcı Adı
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Kullanıcı adınızı girin"
                autoFocus
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm font-medium transition-all"
              />
            </div>
          </div>

          {/* Password Input */}
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
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 mt-2"
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

        {/* Copyright Footer */}
        <div className="pt-1 text-center">
          <p className="text-[11px] font-medium text-slate-300/80 tracking-wide select-none">
            © Polatlar Yazılım - 2026. Tüm Hakları Saklıdır
          </p>
        </div>
      </div>

      {/* Contact Modal Window */}
      <ContactModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
      />
    </div>
  );
};
