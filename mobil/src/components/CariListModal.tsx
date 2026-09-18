import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
  Share,
} from 'react-native';
import {
  X,
  Search,
  Building2,
  Database,
  Download,
  Upload,
  Copy,
  Check,
} from 'lucide-react-native';
import { useStorage } from '../context/StorageContext';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';

interface CariListModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectCari?: (cariName: string) => void;
}

export const CariListModal: React.FC<CariListModalProps> = ({
  visible,
  onClose,
  onSelectCari,
}) => {
  const { user } = useAuth();
  const { cariler, exportCarilerToExcel, importCarilerFromExcelBuffer } = useStorage();
  const { isDark } = useAppTheme();

  const isPolatlar = (user?.companyCode || 'POLATLAR').toUpperCase() === 'POLATLAR';
  const companyTitle = isPolatlar
    ? 'Cari Hesap Listesi (POLATLAR2025)'
    : `Cari Hesap Listesi (${user?.companyCode || 'Kurum'})`;

  const [searchQuery, setSearchQuery] = useState('');
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const filteredCariler = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr');
    if (!q) return cariler;
    return cariler.filter((c) => c.toLocaleLowerCase('tr').includes(q));
  }, [cariler, searchQuery]);

  const handleCopy = async (name: string) => {
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).clipboard && (navigator as any).clipboard.writeText) {
        await (navigator as any).clipboard.writeText(name);
        setCopiedName(name);
        setTimeout(() => setCopiedName(null), 2000);
        return;
      }
      await Share.share({ message: name });
      setCopiedName(name);
      setTimeout(() => setCopiedName(null), 2000);
    } catch {
      Alert.alert('Cari Adı', name);
    }
  };

  const handleExcelExport = async () => {
    try {
      if (cariler.length === 0) {
        Alert.alert('Uyarı', 'Dışa aktarılacak cari hesap bulunamadı.');
        return;
      }
      await exportCarilerToExcel('Cariler.xlsx');
      Alert.alert('Başarılı', `${cariler.length} adet cari Cariler.xlsx olarak indirildi.`);
    } catch {
      Alert.alert('Bilgi', 'Cari listesi Excel olarak paylaşılamadı.');
    }
  };

  const handleExcelUpload = () => {
    if (typeof document === 'undefined') {
      Alert.alert(
        'Excel Yükleme ve Senkronizasyon',
        'Veritabanındaki yeni carileri güncellemek için masaüstünüzdeki Cari_Guncelle.bat dosyasını çalıştırabilir veya web yönetim panelinden doğrudan Excel yükleyebilirsiniz.',
        [{ text: 'Tamam' }]
      );
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = async (e: any) => {
      try {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const buffer = await file.arrayBuffer();
        const res = await importCarilerFromExcelBuffer(buffer, file.name);
        setIsUploading(false);

        if (res.success) {
          Alert.alert(
            'Excel Yüklendi 🎉',
            `"${file.name}" dosyasından ${res.total} adet cari başarıyla sisteme aktarıldı.`
          );
        } else {
          Alert.alert('Yükleme Hatası', res.message);
        }
      } catch (err: any) {
        setIsUploading(false);
        Alert.alert('Hata', err?.message || 'Excel dosyası okunurken hata oluştu.');
      } finally {
        if (document.body.contains(input)) {
          document.body.removeChild(input);
        }
      }
    };

    input.click();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              borderColor: isDark ? '#1e293b' : '#e2e8f0',
            },
          ]}
        >
          {/* Header */}
          <View
            style={[
              styles.modalHeader,
              { borderBottomColor: isDark ? '#1e293b' : '#e2e8f0' },
            ]}
          >
            <View style={styles.headerTitleRow}>
              <Building2 size={20} color="#2563eb" />
              <Text
                style={[
                  styles.modalTitle,
                  { color: isDark ? '#f8fafc' : '#0f172a' },
                ]}
                numberOfLines={1}
              >
                {companyTitle}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={isDark ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
          </View>

          {/* Top Info Banner */}
          <View
            style={[
              styles.infoBanner,
              {
                backgroundColor: isDark ? '#1e293b' : '#eff6ff',
                borderColor: isDark ? '#334155' : '#bfdbfe',
              },
            ]}
          >
            <View style={styles.infoBannerTopRow}>
              <View style={styles.infoBannerTitleGroup}>
                <Database size={16} color="#2563eb" />
                <Text style={[styles.infoBannerTitle, { color: isDark ? '#bfdbfe' : '#1e3a8a' }]}>
                  {isPolatlar ? 'SSMS Veritabanı: POLATLAR2025' : `${user?.companyCode || 'Kurum'} Cari Veritabanı`}
                </Text>
              </View>
              <View style={styles.badgePill}>
                <Text style={styles.badgePillText}>{cariler.length} Cari</Text>
              </View>
            </View>

            {isPolatlar && (
              <Text style={[styles.infoBannerDesc, { color: isDark ? '#94a3b8' : '#475569' }]}>
                Veritabanına yeni bir Cari eklendiğinde masaüstünüzdeki{' '}
                <Text style={{ fontWeight: '700', color: '#2563eb' }}>Cari_Guncelle.bat</Text>{' '}
                dosyasını çift tıklayarak tek tıkla Excel ve uygulamayı anında senkronize edebilirsiniz.
              </Text>
            )}

            {/* Sub Action Buttons */}
            <View style={styles.infoActionRow}>
              <TouchableOpacity
                style={[
                  styles.infoActionBtn,
                  {
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: isDark ? '#334155' : '#cbd5e1',
                    opacity: isUploading ? 0.6 : 1,
                  },
                ]}
                onPress={handleExcelUpload}
                disabled={isUploading}
                activeOpacity={0.8}
              >
                <Upload size={14} color="#2563eb" />
                <Text style={[styles.infoActionText, { color: isDark ? '#cbd5e1' : '#334155' }]}>
                  {isUploading ? 'Yükleniyor...' : "Excel'den Yükle"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.infoActionBtn, { backgroundColor: '#10b981', borderColor: '#10b981' }]}
                onPress={handleExcelExport}
                activeOpacity={0.8}
              >
                <Download size={14} color="#ffffff" />
                <Text style={[styles.infoActionText, { color: '#ffffff' }]}>
                  Excel / Paylaş
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar */}
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                borderColor: isDark ? '#334155' : '#cbd5e1',
              },
            ]}
          >
            <Search size={16} color="#94a3b8" />
            <TextInput
              style={[
                styles.searchInput,
                { color: isDark ? '#f8fafc' : '#0f172a' },
              ]}
              placeholder="Cari adı veya firma ara..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                <X size={14} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Count Row */}
          <View style={styles.countRow}>
            <Text style={[styles.countText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
              {searchQuery ? `${filteredCariler.length} sonuç bulundu` : `Toplam ${cariler.length} Cari`}
            </Text>
            {onSelectCari && (
              <Text style={{ color: '#2563eb', fontWeight: '700', fontSize: 11 }}>
                Seçmek için cariye dokunun
              </Text>
            )}
          </View>

          {/* Scrollable Cari List */}
          <ScrollView
            style={styles.listScrollView}
            contentContainerStyle={{ paddingBottom: 16 }}
            showsVerticalScrollIndicator={true}
          >
            {filteredCariler.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Building2 size={36} color={isDark ? '#475569' : '#cbd5e1'} />
                <Text style={[styles.emptyText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  Aramanıza uygun Cari bulunamadı.
                </Text>
              </View>
            ) : (
              filteredCariler.map((name, index) => {
                const isCopied = copiedName === name;
                return (
                  <TouchableOpacity
                    key={`${name}-${index}`}
                    style={[
                      styles.cariCard,
                      {
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                      },
                    ]}
                    onPress={() => {
                      if (onSelectCari) {
                        onSelectCari(name);
                        onClose();
                      }
                    }}
                    activeOpacity={onSelectCari ? 0.7 : 1}
                  >
                    <View style={styles.cariCardLeft}>
                      <Text style={[styles.indexNumber, { color: isDark ? '#64748b' : '#94a3b8' }]}>
                        {index + 1}.
                      </Text>
                      <Text
                        style={[
                          styles.cariName,
                          { color: isDark ? '#f8fafc' : '#0f172a' },
                        ]}
                        numberOfLines={2}
                      >
                        {name}
                      </Text>
                    </View>

                    <View style={styles.cariCardRight}>
                      {onSelectCari ? (
                        <View style={styles.selectBadge}>
                          <Text style={styles.selectBadgeText}>Seç</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[
                            styles.copyBtn,
                            {
                              backgroundColor: isCopied
                                ? isDark
                                  ? 'rgba(16, 185, 129, 0.2)'
                                  : '#d1fae5'
                                : isDark
                                ? '#334155'
                                : '#f1f5f9',
                            },
                          ]}
                          onPress={() => handleCopy(name)}
                          activeOpacity={0.7}
                        >
                          {isCopied ? (
                            <Check size={14} color="#10b981" />
                          ) : (
                            <Copy size={14} color={isDark ? '#94a3b8' : '#64748b'} />
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Footer Close Button */}
          <View
            style={[
              styles.modalFooter,
              { borderTopColor: isDark ? '#1e293b' : '#e2e8f0' },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.footerCloseBtn,
                { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' },
              ]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.footerCloseBtnText,
                  { color: isDark ? '#f8fafc' : '#334155' },
                ]}
              >
                Kapat
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    padding: 14,
  },
  modalContent: {
    borderRadius: 20,
    borderWidth: 1,
    maxHeight: '90%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  infoBanner: {
    margin: 14,
    marginBottom: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  infoBannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoBannerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  badgePill: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgePillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  infoBannerDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  infoActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  infoActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  infoActionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  countText: {
    fontSize: 11,
    fontWeight: '600',
  },
  listScrollView: {
    maxHeight: 380,
    paddingHorizontal: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cariCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
    gap: 8,
  },
  cariCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  indexNumber: {
    fontSize: 11,
    fontWeight: '700',
    width: 24,
    textAlign: 'right',
  },
  cariName: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  cariCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectBadge: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  selectBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  copyBtn: {
    padding: 6,
    borderRadius: 8,
  },
  modalFooter: {
    padding: 12,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  footerCloseBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  footerCloseBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
