import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { WeatherService, MobileWeatherData } from '../services/weatherService';
import { WeatherBackground } from '../components/WeatherBackground';
import { ContactModal } from '../components/ContactModal';
import { ForgotPasswordModal } from '../components/ForgotPasswordModal';
import {
  Building2,
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  MessageCircle,
  KeyRound,
  MapPin,
  ClipboardList,
  Check,
  Server,
} from 'lucide-react-native';
import { ServerSettingsModal } from '../components/ServerSettingsModal';
import { MobileServerConfigService } from '../services/serverConfigService';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [companyCode, setCompanyCode] = useState('POLATLAR');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Modals
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [isServerOpen, setIsServerOpen] = useState(false);
  const [isLocalServer, setIsLocalServer] = useState(() => MobileServerConfigService.isLocalMode());

  // Weather state (Matches Görsel-5: 📍 Konumunuz Belirleni... • 22°C • Yıldızlı Gece)
  const [weather, setWeather] = useState<MobileWeatherData>({
    condition: 'clear',
    temperature: 22,
    weatherText: 'Yıldızlı Gece',
    locationName: 'Konumunuz Belirleni...',
    isDay: false,
    timeOfDay: 'night',
  });

  useEffect(() => {
    WeatherService.getCurrentWeather().then((w) => {
      setWeather(w);
    });
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Lütfen kullanıcı adı ve şifrenizi girin.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const res = await login(companyCode, username, password);
      if (!res.success) {
        setErrorMsg(res.error || 'Giriş yapılamadı.');
      } else {
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Giriş sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* 1. Dynamic Cloud & Atmospheric Weather Canvas Background */}
      <WeatherBackground weather={weather} />

      {/* 2. Top Right Floating Buttons (Sunucu & İletişim) */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.serverBtn}
          onPress={() => setIsServerOpen(true)}
          activeOpacity={0.8}
        >
          <Server size={14} color="#10b981" />
          <Text style={styles.serverBtnText}>Sunucu</Text>
          {isLocalServer && <View style={styles.activeDot} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.contactBtn}
          onPress={() => setIsContactOpen(true)}
          activeOpacity={0.8}
        >
          <MessageCircle size={14} color="#60a5fa" />
          <Text style={styles.contactBtnText}>İletişim</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 3. Glassmorphic Card Container (Matches Görsel 4) */}
        <View style={styles.glassCard}>
          {/* Logo with Blue Glowing Background */}
          <View style={styles.logoWrapper}>
            <View style={styles.logoGlow} />
            <Image
              source={require('../../assets/images/app-logo.png')}
              style={styles.logo3d}
              resizeMode="cover"
            />
          </View>

          {/* Title & Subtitle */}
          <Text style={styles.appTitle}>İş Takip Sistemi</Text>
          <Text style={styles.appSubtitle}>İş Takip, Görev & Tutanak Portalı</Text>

          {/* Weather Pill (Matches Görsel 4: [ 📍 Erzurum • 23°C • Bulutlu / Kapalı ]) */}
          <View style={styles.weatherPill}>
            <MapPin size={12} color="#60a5fa" />
            <Text style={styles.weatherPillText}>
              {weather.locationName} • {weather.temperature}°C • {weather.weatherText}
            </Text>
          </View>

          {/* Error Message */}
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Form */}
          <View style={styles.formContainer}>
            {/* 1. KURUM KODU */}
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>KURUM KODU</Text>
              <Text style={styles.hintLabel}>Örn: POLATLAR</Text>
            </View>
            <View style={styles.inputBox}>
              <Building2 size={18} color="#60a5fa" />
              <TextInput
                style={styles.textInputBold}
                value={companyCode}
                onChangeText={setCompanyCode}
                autoCapitalize="characters"
                placeholder="POLATLAR"
                placeholderTextColor="#64748b"
              />
            </View>

            {/* 2. KULLANICI ADI / E-POSTA */}
            <Text style={[styles.inputLabel, { marginTop: 14 }]}>
              KULLANICI ADI / E-POSTA
            </Text>
            <View style={styles.inputBox}>
              <User size={18} color="#94a3b8" />
              <TextInput
                style={styles.textInput}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                placeholder="Kullanıcı adınızı veya e-postanızı girin"
                placeholderTextColor="#64748b"
              />
            </View>

            {/* 3. ŞİFRE */}
            <Text style={[styles.inputLabel, { marginTop: 14 }]}>ŞİFRE</Text>
            <View style={styles.inputBox}>
              <Lock size={18} color="#94a3b8" />
              <TextInput
                style={styles.textInput}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="Şifrenizi girin"
                placeholderTextColor="#64748b"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                {showPassword ? (
                  <EyeOff size={18} color="#94a3b8" />
                ) : (
                  <Eye size={18} color="#94a3b8" />
                )}
              </TouchableOpacity>
            </View>

            {/* Remember Me & Forgot Password Row (Matches Görsel 4) */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberMeRow}
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Check size={11} color="#ffffff" strokeWidth={3} />}
                </View>
                <Text style={styles.rememberMeText}>Beni Hatırla</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsForgotOpen(true)}
                style={styles.forgotBtn}
                activeOpacity={0.8}
              >
                <KeyRound size={13} color="#60a5fa" />
                <Text style={styles.forgotBtnText}>Şifremi Unuttum?</Text>
              </TouchableOpacity>
            </View>

            {/* Login Button (Deep Blue/Indigo Gradient Style) */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>Giriş Yap</Text>
                  <ArrowRight size={17} color="#ffffff" style={{ marginLeft: 8 }} />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer (Matches Görsel 5: © Polatlar Yazılım - 2026. Tüm Hakları Saklıdır) */}
          <View style={styles.footerWrapper}>
            <Text style={styles.footerText}>
              © Polatlar Yazılım - 2026. Tüm Hakları Saklıdır
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      <ContactModal visible={isContactOpen} onClose={() => setIsContactOpen(false)} />
      <ForgotPasswordModal
        visible={isForgotOpen}
        onClose={() => setIsForgotOpen(false)}
        defaultCompanyCode={companyCode}
      />
      <ServerSettingsModal
        visible={isServerOpen}
        onClose={() => setIsServerOpen(false)}
        onSaved={() => setIsLocalServer(MobileServerConfigService.isLocalMode())}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 40,
    right: 16,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.45)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  serverBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.7)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  contactBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    paddingTop: 80,
    paddingBottom: 30,
  },
  glassCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.55)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 10,
  },
  logoWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoGlow: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2563eb',
    opacity: 0.35,
    transform: [{ scale: 1.4 }],
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logo3d: {
    width: 68,
    height: 68,
    borderRadius: 34,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  appTitle: {
    fontSize: 25,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  appSubtitle: {
    fontSize: 12,
    color: '#cbd5e1',
    marginTop: 3,
    fontWeight: '500',
    textAlign: 'center',
  },
  weatherPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.7)',
    marginTop: 12,
    marginBottom: 8,
  },
  weatherPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  errorBox: {
    width: '100%',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    padding: 10,
    borderRadius: 12,
    marginTop: 10,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '700',
  },
  formContainer: {
    width: '100%',
    marginTop: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#cbd5e1',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  hintLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#60a5fa',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  textInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  textInputBold: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  eyeBtn: {
    padding: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 6,
  },
  rememberMeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 17,
    height: 17,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2563eb',
    borderColor: '#3b82f6',
  },
  rememberMeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  forgotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  forgotBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#60a5fa',
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  footerWrapper: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.4)',
    paddingTop: 14,
    marginTop: 18,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
  },
});