import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import {
  Server,
  Cloud,
  CheckCircle2,
  XCircle,
  HardDrive,
  Globe,
  RefreshCw,
  X,
  ShieldCheck,
} from 'lucide-react-native';
import { MobileServerConfigService, ServerConfig } from '../services/serverConfigService';
import { useAppTheme } from '../context/ThemeContext';

interface ServerSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  visible,
  onClose,
  onSaved,
}) => {
  const { isDark } = useAppTheme();
  const [config, setConfig] = useState<ServerConfig>(() => MobileServerConfigService.getConfig());
  const [mode, setMode] = useState<'cloud' | 'local'>(config.mode);
  const [localUrl, setLocalUrl] = useState(config.localUrl || 'http://81.213.219.69:3001');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    database?: string;
  } | null>(null);

  useEffect(() => {
    if (visible) {
      const cfg = MobileServerConfigService.getConfig();
      setConfig(cfg);
      setMode(cfg.mode);
      setLocalUrl(cfg.localUrl || 'http://81.213.219.69:3001');
      setTestResult(null);
    }
  }, [visible]);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await MobileServerConfigService.testConnection(localUrl);
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

  const handleSave = async () => {
    await MobileServerConfigService.saveConfig({
      mode,
      localUrl,
      lastTestedAt: testResult?.success ? Date.now() : config.lastTestedAt,
      lastTestSuccess: testResult?.success ?? config.lastTestSuccess,
    });
    if (onSaved) onSaved();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              borderColor: isDark ? '#334155' : '#e2e8f0',
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff' }]}>
                <Server size={20} color="#3b82f6" />
              </View>
              <View>
                <Text style={[styles.title, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                  Sunucu Bağlantı Ayarları
                </Text>
                <Text style={styles.subtitle}>SQL Server (2022) & Bulut Geçişi</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Mode Selectors */}
            <Text style={[styles.sectionLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
              SUNUCU MODU: [BULUT (FIREBASE)] / [YEREL SUNUCU]
            </Text>

            <View style={styles.modesRow}>
              {/* Cloud Mode */}
              <TouchableOpacity
                style={[
                  styles.modeCard,
                  mode === 'cloud' && styles.modeCardActiveCloud,
                  { backgroundColor: isDark ? '#1e293b' : '#f8fafc' },
                ]}
                onPress={() => setMode('cloud')}
                activeOpacity={0.8}
              >
                <View style={styles.modeCardTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Cloud size={16} color={mode === 'cloud' ? '#3b82f6' : '#94a3b8'} />
                    <Text
                      style={[
                        styles.modeTitle,
                        { color: isDark ? '#ffffff' : '#0f172a' },
                        mode === 'cloud' && { color: '#3b82f6' },
                      ]}
                    >
                      Bulut (Firebase)
                    </Text>
                  </View>
                  {mode === 'cloud' && <CheckCircle2 size={16} color="#3b82f6" />}
                </View>
                <Text style={styles.modeDesc}>
                  Varsayılan bulut altyapısı üzerinden çalışır. Ekstra ayar gerektirmez.
                </Text>
              </TouchableOpacity>

              {/* Local Server Mode */}
              <TouchableOpacity
                style={[
                  styles.modeCard,
                  mode === 'local' && styles.modeCardActiveLocal,
                  { backgroundColor: isDark ? '#1e293b' : '#f8fafc' },
                ]}
                onPress={() => setMode('local')}
                activeOpacity={0.8}
              >
                <View style={styles.modeCardTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <HardDrive size={16} color={mode === 'local' ? '#10b981' : '#94a3b8'} />
                    <Text
                      style={[
                        styles.modeTitle,
                        { color: isDark ? '#ffffff' : '#0f172a' },
                        mode === 'local' && { color: '#10b981' },
                      ]}
                    >
                      Yerel Sunucu
                    </Text>
                  </View>
                  {mode === 'local' && <CheckCircle2 size={16} color="#10b981" />}
                </View>
                <Text style={styles.modeDesc}>
                  Windows Server 2022 & SQL Server veritabanınıza doğrudan bağlanır.
                </Text>
              </TouchableOpacity>
            </View>

            {/* URL Input Box */}
            <View
              style={[
                styles.urlBox,
                {
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  borderColor: mode === 'local' ? '#10b981' : (isDark ? '#334155' : '#e2e8f0'),
                },
              ]}
            >
              <View style={styles.urlHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Globe size={15} color="#3b82f6" />
                  <Text style={[styles.inputLabel, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                    Sunucu Adresi (Statik IP)
                  </Text>
                </View>
                <Text style={styles.portLabel}>Port: 3001</Text>
              </View>

              <View style={styles.inputRow}>
                <TextInput
                  value={localUrl}
                  onChangeText={setLocalUrl}
                  placeholder="http://81.213.219.69:3001"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark ? '#090d16' : '#ffffff',
                      color: isDark ? '#ffffff' : '#0f172a',
                      borderColor: isDark ? '#334155' : '#cbd5e1',
                    },
                  ]}
                />
                <TouchableOpacity
                  style={[styles.testBtn, (!localUrl.trim() || isTesting) && { opacity: 0.6 }]}
                  onPress={handleTest}
                  disabled={!localUrl.trim() || isTesting}
                  activeOpacity={0.8}
                >
                  {isTesting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <RefreshCw size={13} color="#ffffff" />
                      <Text style={styles.testBtnText}>Bağlantıyı Test Et</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.helpText}>
                Ofis içindeyken yerel ağdan, sahadayken Statik IP (http://81.213.219.69:3001) üzerinden bağlanılır.
              </Text>

              {/* Test Result Message */}
              {testResult && (
                <View
                  style={[
                    styles.resultBox,
                    testResult.success ? styles.resultSuccess : styles.resultError,
                  ]}
                >
                  {testResult.success ? (
                    <CheckCircle2 size={16} color="#10b981" style={{ marginTop: 2 }} />
                  ) : (
                    <XCircle size={16} color="#ef4444" style={{ marginTop: 2 }} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.resultTitle,
                        { color: testResult.success ? '#047857' : '#b91c1c' },
                      ]}
                    >
                      {testResult.success ? 'Bağlantı Başarılı!' : 'Bağlantı Başarısız'}
                    </Text>
                    <Text
                      style={[
                        styles.resultDesc,
                        { color: testResult.success ? '#065f46' : '#991b1b' },
                      ]}
                    >
                      {testResult.message}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer Buttons */}
          <View style={[styles.footer, { borderTopColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
              <ShieldCheck size={16} color="#ffffff" />
              <Text style={styles.saveBtnText}>Ayarları Kaydet ve Uygula</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modesRow: {
    gap: 10,
  },
  modeCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  modeCardActiveCloud: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  modeCardActiveLocal: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  modeCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modeTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  modeDesc: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
  },
  urlBox: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  urlHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  portLabel: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  testBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  testBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  helpText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  resultBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: 12,
  },
  resultSuccess: {
    backgroundColor: '#ecfdf5',
  },
  resultError: {
    backgroundColor: '#fef2f2',
  },
  resultTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  resultDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  saveBtn: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
