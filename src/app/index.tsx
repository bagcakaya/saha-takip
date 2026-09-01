import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DimensionValue,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';
import { LocationItem, useStorage } from '@/hooks/useStorage';
import { deletePersistentPhoto, savePhotoPersistently } from '@/utils/fileHelper';
import { generateAndShareInstallationReport } from '@/utils/pdfHelper';

export default function HomeScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  
  const {
    locations,
    isLoading,
    addLocation,
    deleteLocation,
    updateTaskStatus,
    addCustomTaskToLocation,
    deleteCustomTaskFromLocation,
    updateLocationDetails,
    addPhotoToLocation,
    deletePhotoFromLocation,
  } = useStorage();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal States
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  
  // Detail Panel States
  const [selectedLocation, setSelectedLocation] = useState<LocationItem | null>(null);
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [newCustomTaskName, setNewCustomTaskName] = useState('');
  
  // Local metadata inputs inside details
  const [locationNameText, setLocationNameText] = useState('');
  const [addressText, setAddressText] = useState('');
  const [notesText, setNotesText] = useState('');
  const [locLatitude, setLocLatitude] = useState<number | undefined>(undefined);
  const [locLongitude, setLocLongitude] = useState<number | undefined>(undefined);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [detailTab, setDetailTab] = useState<'checklist' | 'metadata'>('checklist');
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  // Find currently open location details from state (keeps UI fresh after task status changes)
  const openLocation = useMemo(() => {
    if (!selectedLocation) return null;
    return locations.find((loc) => loc.id === selectedLocation.id) || null;
  }, [locations, selectedLocation]);

  // Sync inputs when selected location changes
  useEffect(() => {
    if (openLocation) {
      setLocationNameText(openLocation.name || '');
      setAddressText(openLocation.address || '');
      setNotesText(openLocation.notes || '');
      setLocLatitude(openLocation.latitude);
      setLocLongitude(openLocation.longitude);
    } else {
      setLocationNameText('');
      setAddressText('');
      setNotesText('');
      setLocLatitude(undefined);
      setLocLongitude(undefined);
      setDetailTab('checklist');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openLocation?.id]);

  // General Dashboard Statistics
  const stats = useMemo(() => {
    let totalTasks = 0;
    let completedTasks = 0;
    let notPresentTasks = 0;

    locations.forEach((loc) => {
      loc.tasks.forEach((task) => {
        totalTasks++;
        if (task.status === 'completed') completedTasks++;
        if (task.status === 'not_present') notPresentTasks++;
      });
    });

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const notPresentRate = totalTasks > 0 ? Math.round((notPresentTasks / totalTasks) * 100) : 0;

    return {
      totalLocations: locations.length,
      completionRate,
      notPresentRate,
    };
  }, [locations]);

  // Filtered Locations
  const filteredLocations = useMemo(() => {
    return locations.filter((loc) =>
      loc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [locations, searchQuery]);

  // Handle Location Creation
  const handleCreateLocation = async () => {
    if (!newLocationName.trim()) {
      Alert.alert('Hata', 'Lütfen geçerli bir lokasyon ismi girin.');
      return;
    }
    await addLocation(newLocationName);
    setNewLocationName('');
    setAddModalVisible(false);
  };

  // Handle Location Deletion
  const handleDeleteLocation = (location: LocationItem) => {
    Alert.alert(
      'Kurulum Silme',
      `"${location.name}" kurulum kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            if (openLocation?.id === location.id) {
              setSelectedLocation(null);
            }
            await deleteLocation(location.id);
          },
        },
      ]
    );
  };

  // Save metadata
  const handleSaveDetails = async () => {
    if (openLocation) {
      await updateLocationDetails(openLocation.id, addressText, notesText, locLatitude, locLongitude, locationNameText);
    }
  };

  // Close panel and save metadata
  const handleCloseDetail = async () => {
    if (openLocation) {
      await updateLocationDetails(openLocation.id, addressText, notesText, locLatitude, locLongitude, locationNameText);
    }
    setSelectedLocation(null);
  };

  // Fetch current GPS coordinates and geocode them into address text
  const handleGetLocation = async () => {
    if (!openLocation) return;
    try {
      setIsFetchingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Reddedildi', 'Konum tespiti için konum izni vermeniz gerekmektedir.');
        setIsFetchingLocation(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = position.coords;
      setLocLatitude(latitude);
      setLocLongitude(longitude);

      // Convert GPS coordinates to a friendly address name
      const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      let friendlyAddress = '';
      if (geocode && geocode.length > 0) {
        const addr = geocode[0];
        const street = addr.street || addr.name || '';
        const district = addr.district || addr.subregion || '';
        const city = addr.city || addr.region || '';
        friendlyAddress = [street, district, city].filter(Boolean).join(', ');
      }

      const newAddress = friendlyAddress || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      setAddressText(newAddress);

      // Save directly
      await updateLocationDetails(openLocation.id, newAddress, notesText, latitude, longitude, locationNameText);
      Alert.alert('Başarılı', 'Gittiğiniz lokasyonun konumu başarıyla işaretlendi!');
    } catch (error) {
      console.error(error);
      Alert.alert('Hata', 'Konum alınırken bir sorun oluştu. GPS servislerinizin açık olduğundan emin olun.');
    } finally {
      setIsFetchingLocation(false);
    }
  };

  // Open external maps application
  const handleOpenMap = () => {
    const query = locLatitude && locLongitude
      ? `${locLatitude},${locLongitude}`
      : encodeURIComponent(addressText);
    
    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`,
    });
    Linking.openURL(url!);
  };

  // Open external maps for a specific location
  const handleOpenLocationMap = (loc: LocationItem) => {
    const hasLocation = loc.address?.trim() || (loc.latitude && loc.longitude);
    if (!hasLocation) {
      Alert.alert(
        'Konum Bilgisi Yok',
        'Bu firmaya ait henüz adres veya koordinat bilgisi girilmemiştir. Firma detaylarındaki "Notlar & Medya" sekmesinden konum ekleyebilirsiniz.'
      );
      return;
    }

    const query = loc.latitude && loc.longitude
      ? `${loc.latitude},${loc.longitude}`
      : encodeURIComponent(loc.address || '');

    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`,
    });
    Linking.openURL(url!);
  };

  // Compile PDF report and trigger native share sheet
  const handleShareReport = async () => {
    if (!openLocation) return;
    try {
      setIsGeneratingPdf(true);
      // Ensure current text inputs are saved before exporting
      await updateLocationDetails(openLocation.id, addressText, notesText, locLatitude, locLongitude, locationNameText);
      // Construct updated location to avoid state update latency race condition
      const updatedLocation: LocationItem = {
        ...openLocation,
        name: locationNameText || openLocation.name,
        address: addressText,
        notes: notesText,
        latitude: locLatitude,
        longitude: locLongitude,
      };
      // Generate and share PDF
      await generateAndShareInstallationReport(updatedLocation);
    } catch (error) {
      console.error(error);
      Alert.alert('Hata', 'PDF Teslim Raporu oluşturulurken bir hata oluştu.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Camera integration
  const handleTakePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('İzin Gerekli', 'Fotoğraf çekebilmek için kameraya izin vermelisiniz.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const tempUri = result.assets[0].uri;
      try {
        const persistentUri = await savePhotoPersistently(tempUri);
        if (openLocation) {
          await addPhotoToLocation(openLocation.id, persistentUri);
        }
      } catch {
        Alert.alert('Hata', 'Fotoğraf kaydedilirken bir hata oluştu.');
      }
    }
  };

  // Photo library integration
  const handleSelectPhoto = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('İzin Gerekli', 'Galeriden görsel seçebilmek için izin vermelisiniz.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const tempUri = result.assets[0].uri;
      try {
        const persistentUri = await savePhotoPersistently(tempUri);
        if (openLocation) {
          await addPhotoToLocation(openLocation.id, persistentUri);
        }
      } catch {
        Alert.alert('Hata', 'Fotoğraf kaydedilirken bir hata oluştu.');
      }
    }
  };

  // Handle Photo Deletion
  const handleDeletePhoto = (photoUri: string) => {
    Alert.alert(
      'Fotoğrafı Sil',
      'Bu fotoğrafı kalıcı olarak silmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            if (openLocation) {
              await deletePhotoFromLocation(openLocation.id, photoUri);
              await deletePersistentPhoto(photoUri);
            }
          },
        },
      ]
    );
  };

  // Handle Custom Task Addition in Location
  const handleAddCustomTask = async () => {
    if (!openLocation || !newCustomTaskName.trim()) return;
    await addCustomTaskToLocation(openLocation.id, newCustomTaskName);
    setNewCustomTaskName('');
  };

  // Handle Custom Task Deletion from Location
  const handleDeleteCustomTask = (taskId: string, taskName: string) => {
    Alert.alert(
      'Görevi Sil',
      `"${taskName}" görevini bu lokasyondan silmek istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            if (openLocation) {
              await deleteCustomTaskFromLocation(openLocation.id, taskId);
            }
          },
        },
      ]
    );
  };

  // Progress calculations for individual locations
  const getLocationProgress = (location: LocationItem) => {
    const total = location.tasks.length;
    if (total === 0) {
      return {
        completedPct: 0,
        notPresentPct: 0,
        pendingPct: 0,
        completedCount: 0,
        notPresentCount: 0,
        totalCount: 0,
      };
    }
    
    const completed = location.tasks.filter((t) => t.status === 'completed').length;
    const notPresent = location.tasks.filter((t) => t.status === 'not_present').length;
    
    return {
      completedPct: (completed / total) * 100,
      notPresentPct: (notPresent / total) * 100,
      pendingPct: ((total - completed - notPresent) / total) * 100,
      completedCount: completed,
      notPresentCount: notPresent,
      totalCount: total,
    };
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header Section */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Saha Takip Raporu</Text>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Kurulumlar</Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => setAddModalVisible(true)}
        >
          <Ionicons name="add" size={24} color={scheme === 'dark' ? '#0F172A' : '#FFFFFF'} />
        </TouchableOpacity>
      </View>

      {/* General Stats Dashboard */}
      {locations.length > 0 && (
        <View style={[styles.statsCard, { backgroundColor: colors.backgroundElement }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.totalLocations}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Toplam Lokasyon</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.backgroundSelected }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.statusCompleted }]}>%{stats.completionRate}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Genel Tamamlanma</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.backgroundSelected }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.statusNotPresent }]}>%{stats.notPresentRate}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Mevcut Değil</Text>
          </View>
        </View>
      )}

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.backgroundElement }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Lokasyon ara..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Location List */}
      {isLoading ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.textSecondary }}>Yükleniyor...</Text>
        </View>
      ) : filteredLocations.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <View style={[styles.emptyIconBg, { backgroundColor: colors.backgroundSelected }]}>
            <Ionicons name="business" size={48} color={colors.textSecondary} />
          </View>
          <Text style={[styles.emptyText, { color: colors.text }]}>
            {searchQuery ? 'Aramayla eşleşen lokasyon bulunamadı.' : 'Henüz bir kurulum kaydı eklenmedi.'}
          </Text>
          <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
            {searchQuery ? 'Lütfen arama teriminizi kontrol edin.' : 'Başlamak için sağ üstteki buton ile yeni bir yer ekleyebilirsiniz.'}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
          {filteredLocations.map((loc) => {
            const progress = getLocationProgress(loc);
            return (
              <TouchableOpacity
                key={loc.id}
                style={[styles.locationCard, { backgroundColor: colors.backgroundElement }]}
                onPress={() => setSelectedLocation(loc)}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{loc.name}</Text>
                    <Text style={[styles.cardDate, { color: colors.textSecondary }]}>
                      {new Date(loc.createdAt).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.deleteCardButton, { marginRight: Spacing.two }]}
                    onPress={() => handleOpenLocationMap(loc)}
                  >
                    <Ionicons 
                      name="map-outline" 
                      size={20} 
                      color={(loc.address?.trim() || (loc.latitude && loc.longitude)) ? colors.primaryAccent : colors.textSecondary} 
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteCardButton}
                    onPress={() => handleDeleteLocation(loc)}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </TouchableOpacity>
                </View>

                {/* Progress Indicators */}
                <View style={styles.cardProgressContainer}>
                  <View style={styles.progressTextRow}>
                    <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                      {progress.completedCount} / {progress.totalCount} Tamamlandı
                    </Text>
                    {progress.notPresentCount > 0 && (
                      <Text style={[styles.progressText, { color: colors.statusNotPresent }]}>
                        {progress.notPresentCount} Mevcut Değil
                      </Text>
                    )}
                  </View>

                  {/* Modern stacked progress bar */}
                  <View style={[styles.progressBarContainer, { backgroundColor: colors.backgroundSelected }]}>
                    <View
                      style={[
                        styles.progressBarSegment,
                        {
                          backgroundColor: colors.statusCompleted,
                          width: `${progress.completedPct}%` as DimensionValue,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.progressBarSegment,
                        {
                          backgroundColor: colors.statusNotPresent,
                          width: `${progress.notPresentPct}%` as DimensionValue,
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Action hint */}
                <View style={styles.cardFooter}>
                  <Text style={[styles.cardFooterText, { color: colors.primaryAccent }]}>
                    Kurulum Kontrol / Notlar
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.primaryAccent} />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Modal - Add Location */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addModalVisible}
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.modalContent, { backgroundColor: colors.backgroundElement }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Yeni Kurulum Yeri</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.backgroundSelected }]}
              placeholder="Lokasyon veya Firma Adı (örn: Merkez Ofis, X Plaza)"
              placeholderTextColor={colors.textSecondary}
              value={newLocationName}
              onChangeText={setNewLocationName}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel, { borderColor: colors.backgroundSelected }]}
                onPress={() => setAddModalVisible(false)}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleCreateLocation}
              >
                <Text style={[styles.modalBtnText, { color: scheme === 'dark' ? '#0F172A' : '#FFFFFF', fontWeight: 'bold' }]}>
                  Ekle
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Slide-in Detail Checklist Modal */}
      {openLocation && (
        <Modal
          animationType="slide"
          transparent={false}
          visible={!!openLocation}
          onRequestClose={handleCloseDetail}
        >
          <SafeAreaView style={[styles.detailContainer, { backgroundColor: colors.background }]}>
            {/* Detail Header */}
            <View style={[styles.detailHeader, { borderBottomColor: colors.backgroundSelected }]}>
              <TouchableOpacity
                style={styles.detailBackBtn}
                onPress={handleCloseDetail}
              >
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
              <View style={{ flex: 1, marginHorizontal: Spacing.two }}>
                <Text style={[styles.detailHeaderTitle, { color: colors.text }]} numberOfLines={1}>
                  {locationNameText || openLocation.name}
                </Text>
                <Text style={[styles.detailHeaderSubtitle, { color: colors.textSecondary }]}>
                  Lokasyon Detayları
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.shareReportHeaderBtn, { marginRight: Spacing.two, backgroundColor: colors.primaryBg }]}
                onPress={handleShareReport}
              >
                <Ionicons name="share-social-outline" size={20} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteLocationHeaderBtn, { backgroundColor: colors.dangerBg }]}
                onPress={() => handleDeleteLocation(openLocation)}
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </TouchableOpacity>
            </View>

            {/* Detail Progress Bar */}
            {(() => {
              const progress = getLocationProgress(openLocation!);
              return (
                <View style={[styles.detailProgressBlock, { borderBottomColor: colors.backgroundSelected }]}>
                  <View style={styles.detailProgressInfo}>
                    <Text style={[styles.detailProgressPct, { color: colors.text }]}>
                      Kurulum İlerlemesi: %{Math.round(progress.completedPct)}
                    </Text>
                    <Text style={[styles.detailProgressCounts, { color: colors.textSecondary }]}>
                      {progress.completedCount} Tamamlandı • {progress.notPresentCount} Mevcut Değil
                    </Text>
                  </View>
                  <View style={[styles.progressBarContainer, { backgroundColor: colors.backgroundSelected }]}>
                    <View
                      style={[
                        styles.progressBarSegment,
                        {
                          backgroundColor: colors.statusCompleted,
                          width: `${progress.completedPct}%` as DimensionValue,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.progressBarSegment,
                        {
                          backgroundColor: colors.statusNotPresent,
                          width: `${progress.notPresentPct}%` as DimensionValue,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })()}

            {/* Sub Tabs Selector */}
            <View style={[styles.tabSelector, { borderBottomColor: colors.backgroundSelected }]}>
              <TouchableOpacity
                style={[
                  styles.tabSelectorBtn,
                  detailTab === 'checklist' && [styles.tabSelectorBtnActive, { borderBottomColor: colors.text }]
                ]}
                onPress={() => setDetailTab('checklist')}
              >
                <Ionicons
                  name="list"
                  size={18}
                  color={detailTab === 'checklist' ? colors.text : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.tabSelectorText,
                    { color: detailTab === 'checklist' ? colors.text : colors.textSecondary, fontWeight: detailTab === 'checklist' ? 'bold' : 'normal' }
                  ]}
                >
                  Kontrol Listesi
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabSelectorBtn,
                  detailTab === 'metadata' && [styles.tabSelectorBtnActive, { borderBottomColor: colors.text }]
                ]}
                onPress={() => setDetailTab('metadata')}
              >
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color={detailTab === 'metadata' ? colors.text : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.tabSelectorText,
                    { color: detailTab === 'metadata' ? colors.text : colors.textSecondary, fontWeight: detailTab === 'metadata' ? 'bold' : 'normal' }
                  ]}
                >
                  Notlar & Medya
                </Text>
              </TouchableOpacity>
            </View>

            {/* Content Tab 1: Checklist */}
            {detailTab === 'checklist' && (
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
              >
                {/* Task Search Input */}
                <View style={[styles.searchContainer, { backgroundColor: colors.backgroundElement, marginHorizontal: Spacing.three, marginTop: Spacing.two }]}>
                  <Ionicons name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Görevlerde ara..."
                    placeholderTextColor={colors.textSecondary}
                    value={taskSearchQuery}
                    onChangeText={setTaskSearchQuery}
                  />
                  {taskSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setTaskSearchQuery('')}>
                      <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Task List */}
                <ScrollView
                  contentContainerStyle={styles.detailListContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {openLocation.tasks
                    .filter((t) => t.name.toLowerCase().includes(taskSearchQuery.toLowerCase()))
                    .map((task) => (
                      <View
                        key={task.id}
                        style={[styles.taskItemCard, { backgroundColor: colors.backgroundElement }]}
                      >
                        <View style={styles.taskItemHeader}>
                          <Text style={[styles.taskItemName, { color: colors.text }]}>
                            {task.name}
                          </Text>
                          <TouchableOpacity
                            style={styles.deleteTaskBtn}
                            onPress={() => handleDeleteCustomTask(task.id, task.name)}
                          >
                            <Ionicons name="close" size={18} color={colors.danger} />
                          </TouchableOpacity>
                        </View>

                        {/* Status Selectors */}
                        <View style={[styles.segmentedControl, { backgroundColor: colors.backgroundSelected }]}>
                          <TouchableOpacity
                            style={[
                              styles.segmentButton,
                              task.status === 'pending' && [
                                styles.segmentActive,
                                { backgroundColor: colors.statusPending },
                              ],
                            ]}
                            onPress={() => updateTaskStatus(openLocation.id, task.id, 'pending')}
                          >
                            <Ionicons
                              name="time-outline"
                              size={14}
                              color={task.status === 'pending' ? '#FFFFFF' : colors.textSecondary}
                            />
                            <Text
                              style={[
                                styles.segmentText,
                                {
                                  color: task.status === 'pending' ? '#FFFFFF' : colors.textSecondary,
                                },
                              ]}
                            >
                              Beklemede
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.segmentButton,
                              task.status === 'completed' && [
                                styles.segmentActive,
                                { backgroundColor: colors.statusCompleted },
                              ],
                            ]}
                            onPress={() => updateTaskStatus(openLocation.id, task.id, 'completed')}
                          >
                            <Ionicons
                              name="checkmark"
                              size={14}
                              color={task.status === 'completed' ? '#FFFFFF' : colors.textSecondary}
                            />
                            <Text
                              style={[
                                styles.segmentText,
                                {
                                  color: task.status === 'completed' ? '#FFFFFF' : colors.textSecondary,
                                },
                              ]}
                            >
                              Tamamlandı
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.segmentButton,
                              task.status === 'not_present' && [
                                styles.segmentActive,
                                { backgroundColor: colors.statusNotPresent },
                              ],
                            ]}
                            onPress={() => updateTaskStatus(openLocation.id, task.id, 'not_present')}
                          >
                            <Ionicons
                              name="ban-outline"
                              size={14}
                              color={task.status === 'not_present' ? '#FFFFFF' : colors.textSecondary}
                            />
                            <Text
                              style={[
                                styles.segmentText,
                                {
                                  color: task.status === 'not_present' ? '#FFFFFF' : colors.textSecondary,
                                },
                              ]}
                            >
                              Mevcut Değil
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                </ScrollView>

                {/* Bottom Add Custom Task Field */}
                <View style={[styles.customTaskInputContainer, { borderTopColor: colors.backgroundSelected }]}>
                  <TextInput
                    style={[
                      styles.customTaskInput,
                      { color: colors.text, borderColor: colors.backgroundSelected, backgroundColor: colors.backgroundElement },
                    ]}
                    placeholder="Bu kurulum için özel bir görev ekle..."
                    placeholderTextColor={colors.textSecondary}
                    value={newCustomTaskName}
                    onChangeText={setNewCustomTaskName}
                  />
                  <TouchableOpacity
                    style={[styles.customTaskAddBtn, { backgroundColor: colors.primary }]}
                    onPress={handleAddCustomTask}
                  >
                    <Ionicons name="add" size={24} color={scheme === 'dark' ? '#0F172A' : '#FFFFFF'} />
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            )}

            {/* Content Tab 2: Metadata (Notes, Map, Photos) */}
            {detailTab === 'metadata' && (
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
              >
                <ScrollView
                  contentContainerStyle={styles.metadataContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Location Name Section */}
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Firma / Lokasyon Adı</Text>
                  <TextInput
                    style={[
                      styles.addressInput,
                      { color: colors.text, borderColor: colors.backgroundSelected, backgroundColor: colors.backgroundElement, marginBottom: Spacing.three },
                    ]}
                    placeholder="Firma veya Lokasyon adı girin..."
                    placeholderTextColor={colors.textSecondary}
                    value={locationNameText}
                    onChangeText={setLocationNameText}
                    onBlur={handleSaveDetails}
                  />

                  {/* Address Section */}
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Kurulum Adresi</Text>
                  <View style={styles.addressInputGroup}>
                    <TextInput
                      style={[
                        styles.addressInput,
                        { color: colors.text, borderColor: colors.backgroundSelected, backgroundColor: colors.backgroundElement },
                      ]}
                      placeholder="Firma/Kurulum adresi veya koordinatı..."
                      placeholderTextColor={colors.textSecondary}
                      value={addressText}
                      onChangeText={(text) => {
                        setAddressText(text);
                      }}
                      onBlur={handleSaveDetails}
                    />
                    <TouchableOpacity
                      style={[
                        styles.mapBtn,
                        { backgroundColor: isFetchingLocation ? colors.backgroundSelected : colors.primaryBg },
                      ]}
                      onPress={handleGetLocation}
                      disabled={isFetchingLocation}
                    >
                      <Ionicons
                        name={isFetchingLocation ? 'sync' : 'location'}
                        size={20}
                        color={colors.text}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.mapBtn,
                        { backgroundColor: addressText.trim() || locLatitude ? colors.primaryBg : colors.backgroundSelected },
                      ]}
                      onPress={handleOpenMap}
                      disabled={!addressText.trim() && !locLatitude}
                    >
                      <Ionicons
                        name="map"
                        size={20}
                        color={addressText.trim() || locLatitude ? colors.text : colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Coordinates Badge */}
                  {locLatitude && locLongitude && (
                    <View style={styles.coordinatesIndicatorRow}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.statusCompleted} />
                      <Text style={[styles.coordinatesIndicatorText, { color: colors.statusCompleted }]}>
                        Coğrafi konum işaretlendi ({locLatitude.toFixed(5)}, {locLongitude.toFixed(5)})
                      </Text>
                    </View>
                  )}

                  {/* Notes Section */}
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Müşteri ve Bağlantı Notları</Text>
                  <TextInput
                    style={[
                      styles.notesInput,
                      { color: colors.text, borderColor: colors.backgroundSelected, backgroundColor: colors.backgroundElement },
                    ]}
                    placeholder="Sunucu IP'leri, Wi-Fi şifreleri, yetkili kişi iletişim bilgileri ve diğer kurulum notları..."
                    placeholderTextColor={colors.textSecondary}
                    value={notesText}
                    onChangeText={setNotesText}
                    onBlur={handleSaveDetails}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                  />

                  {/* Photos Section */}
                  <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Fotoğraflar</Text>
                    <Text style={[styles.photoCountText, { color: colors.textSecondary }]}>
                      {(openLocation.photos || []).length} Adet
                    </Text>
                  </View>

                  {/* Photo Actions */}
                  <View style={styles.photoActionRow}>
                    <TouchableOpacity
                      style={[styles.photoActionBtn, { backgroundColor: colors.backgroundElement, borderColor: colors.backgroundSelected }]}
                      onPress={handleTakePhoto}
                    >
                      <Ionicons name="camera" size={20} color={colors.text} />
                      <Text style={[styles.photoActionText, { color: colors.text }]}>Fotoğraf Çek</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.photoActionBtn, { backgroundColor: colors.backgroundElement, borderColor: colors.backgroundSelected }]}
                      onPress={handleSelectPhoto}
                    >
                      <Ionicons name="images" size={20} color={colors.text} />
                      <Text style={[styles.photoActionText, { color: colors.text }]}>Galeriden Seç</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Photos Grid */}
                  <View style={styles.photoGrid}>
                    {(openLocation.photos || []).map((photoUri, index) => (
                      <View key={index} style={styles.photoWrapper}>
                        <TouchableOpacity
                          style={[styles.photoCardFrame, { backgroundColor: colors.backgroundSelected }]}
                          onPress={() => setLightboxPhoto(photoUri)}
                        >
                          <Image source={{ uri: photoUri }} style={styles.photoImage} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.photoDeleteBtn, { backgroundColor: colors.danger }]}
                          onPress={() => handleDeletePhoto(photoUri)}
                        >
                          <Ionicons name="close" size={14} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </KeyboardAvoidingView>
            )}
          </SafeAreaView>
        </Modal>
      )}

      {/* Lightbox full-screen photo Modal */}
      <Modal
        visible={!!lightboxPhoto}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setLightboxPhoto(null)}
      >
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity
            style={styles.lightboxCloseBtn}
            onPress={() => setLightboxPhoto(null)}
          >
            <Ionicons name="close-circle" size={38} color="#FFFFFF" />
          </TouchableOpacity>
          
          {lightboxPhoto && (
            <Image
              source={{ uri: lightboxPhoto }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          )}

          <TouchableOpacity
            style={[styles.lightboxDeleteBtn, { backgroundColor: colors.danger }]}
            onPress={() => {
              if (lightboxPhoto) {
                handleDeletePhoto(lightboxPhoto);
                setLightboxPhoto(null);
              }
            }}
          >
            <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
            <Text style={styles.lightboxDeleteText}>Fotoğrafı Sil</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Loading Overlay for PDF generation */}
      {isGeneratingPdf && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingOverlayText}>PDF Raporu Oluşturuluyor...</Text>
          <Text style={styles.loadingOverlaySubText}>Fotoğraflar ve tutanak derleniyor, lütfen bekleyin.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsCard: {
    flexDirection: 'row',
    marginHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    marginBottom: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: '100%',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.three,
    paddingHorizontal: Spacing.three,
    height: 44,
    borderRadius: Spacing.three,
    marginBottom: Spacing.two,
  },
  searchIcon: {
    marginRight: Spacing.two,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    paddingVertical: 0,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.six,
  },
  emptyIconBg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.one,
  },
  emptySubText: {
    fontSize: 13,
    textAlign: 'center',
  },
  listContainer: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
  },
  locationCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    marginBottom: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.two,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardDate: {
    fontSize: 11,
    marginTop: 2,
  },
  deleteCardButton: {
    padding: Spacing.one,
  },
  cardProgressContainer: {
    marginVertical: Spacing.two,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '500',
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressBarSegment: {
    height: '100%',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  cardFooterText: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: Spacing.four,
  },
  modalContent: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 48,
    fontSize: 14,
    marginBottom: Spacing.four,
    paddingVertical: 0,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  modalBtn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
    minWidth: 80,
    alignItems: 'center',
  },
  modalBtnCancel: {
    borderWidth: 1,
  },
  modalBtnText: {
    fontSize: 14,
  },
  detailContainer: {
    flex: 1,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
  detailBackBtn: {
    padding: Spacing.one,
  },
  detailHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  detailHeaderSubtitle: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  shareReportHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteLocationHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailProgressBlock: {
    padding: Spacing.three,
    borderBottomWidth: 1,
  },
  detailProgressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  detailProgressPct: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  detailProgressCounts: {
    fontSize: 11,
  },
  tabSelector: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    height: 48,
  },
  tabSelectorBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabSelectorBtnActive: {
    borderBottomWidth: 2,
  },
  tabSelectorText: {
    fontSize: 13,
  },
  detailListContent: {
    padding: Spacing.three,
    paddingBottom: Spacing.five,
  },
  taskItemCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    marginBottom: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  taskItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  taskItemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    paddingRight: Spacing.two,
  },
  deleteTaskBtn: {
    padding: 2,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: Spacing.two,
    padding: 3,
    height: 36,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Spacing.two - 2,
    gap: 4,
  },
  segmentActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 10,
    fontWeight: '600',
  },
  customTaskInputContainer: {
    flexDirection: 'row',
    padding: Spacing.three,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  customTaskInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 13,
    marginRight: Spacing.two,
    paddingVertical: 0,
  },
  customTaskAddBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metadataContent: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: Spacing.two,
    marginTop: Spacing.three,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  photoCountText: {
    fontSize: 13,
    fontWeight: '500',
  },
  addressInputGroup: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  addressInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 13,
    paddingVertical: 0,
  },
  mapBtn: {
    width: 44,
    height: 44,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coordinatesIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.three,
    paddingLeft: 2,
  },
  coordinatesIndicatorText: {
    fontSize: 11,
    fontWeight: '600',
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 13,
    height: 120,
    marginBottom: Spacing.three,
  },
  photoActionRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  photoActionBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 44,
    borderWidth: 1,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  photoActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  photoWrapper: {
    position: 'relative',
    width: '31%',
    aspectRatio: 1,
    marginBottom: Spacing.one,
  },
  photoCardFrame: {
    width: '100%',
    height: '100%',
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoDeleteBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImage: {
    width: '90%',
    height: '70%',
  },
  lightboxCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
  },
  lightboxDeleteBtn: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
  },
  lightboxDeleteText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loadingOverlayText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: Spacing.three,
  },
  loadingOverlaySubText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: Spacing.one,
  },
});
