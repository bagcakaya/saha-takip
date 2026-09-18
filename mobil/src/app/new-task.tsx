import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useStorage } from '../context/StorageContext';
import { LocationService } from '../services/locationService';
import { ImageService } from '../services/imageService';
import {
  Building2,
  FileText,
  MapPin,
  Camera,
  Plus,
  X,
  Navigation,
  CheckSquare,
} from 'lucide-react-native';

export default function NewTaskScreen() {
  const { cariler, addLocation } = useStorage();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';

  const [name, setName] = useState('');
  const [cariName, setCariName] = useState('');
  const [cariSuggestions, setCariSuggestions] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [taskItemInput, setTaskItemInput] = useState('');
  const [tasks, setTasks] = useState<string[]>(['Keşif yapılması', 'Montaj yapılması']);
  const [loadingGps, setLoadingGps] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCariChange = (text: string) => {
    setCariName(text);
    if (text.trim().length > 1) {
      const q = text.toLowerCase();
      const filtered = cariler.filter((c) => c.toLowerCase().includes(q)).slice(0, 5);
      setCariSuggestions(filtered);
    } else {
      setCariSuggestions([]);
    }
  };

  const handleGetCurrentLocation = async () => {
    setLoadingGps(true);
    try {
      const pos = await LocationService.getCurrentPosition();
      setLatitude(pos.latitude);
      setLongitude(pos.longitude);
      if (pos.address) {
        setAddress(pos.address);
      }
    } catch (e: any) {
      Alert.alert('Konum Alınamadı', e?.message || 'Lütfen GPS iznini kontrol edin.');
    } finally {
      setLoadingGps(false);
    }
  };

  const handleTakePhoto = async () => {
    const photo = await ImageService.takePhoto();
    if (photo) {
      setPhotos((prev) => [...prev, photo]);
    }
  };

  const handlePickPhoto = async () => {
    const photo = await ImageService.pickImage();
    if (photo) {
      setPhotos((prev) => [...prev, photo]);
    }
  };

  const handleAddTaskItem = () => {
    if (taskItemInput.trim()) {
      setTasks((prev) => [...prev, taskItemInput.trim()]);
      setTaskItemInput('');
    }
  };

  const handleRemoveTaskItem = (index: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Uyarı', 'Lütfen iş emri başlığını girin.');
      return;
    }

    setSaving(true);
    const res = await addLocation({
      name: name.trim(),
      cariName: cariName.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
      photos,
      tasks,
      latitude,
      longitude,
    });
    setSaving(false);

    if (res.success) {
      Alert.alert('Başarılı', 'İş emri oluşturuldu.', [
        { text: 'Tamam', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('Hata', res.message);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* 1. Task Name */}
      <Text style={[styles.label, { color: isDark ? '#cbd5e1' : '#475569' }]}>
        İŞ EMRİ BAŞLIĞI *
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderColor: isDark ? '#334155' : '#cbd5e1',
            color: isDark ? '#f8fafc' : '#0f172a',
          },
        ]}
        placeholder="Örn: Kadıköy Şube Kamera Montajı"
        placeholderTextColor="#94a3b8"
        value={name}
        onChangeText={setName}
      />

      {/* 2. Cari Name */}
      <Text style={[styles.label, { color: isDark ? '#cbd5e1' : '#475569', marginTop: 14 }]}>
        İLGİLİ CARİ / MÜŞTERİ
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderColor: isDark ? '#334155' : '#cbd5e1',
            color: isDark ? '#f8fafc' : '#0f172a',
          },
        ]}
        placeholder="Cari adı aramak için yazın..."
        placeholderTextColor="#94a3b8"
        value={cariName}
        onChangeText={handleCariChange}
      />
      {cariSuggestions.length > 0 && (
        <View style={[styles.suggestionBox, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
          {cariSuggestions.map((s, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.suggestionItem}
              onPress={() => {
                setCariName(s);
                setCariSuggestions([]);
              }}
            >
              <Building2 size={13} color="#059669" />
              <Text style={[styles.suggestionText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                {s}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 3. Address & Auto GPS */}
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: isDark ? '#cbd5e1' : '#475569' }]}>ADRES</Text>
        <TouchableOpacity
          style={styles.gpsBtn}
          onPress={handleGetCurrentLocation}
          disabled={loadingGps}
        >
          {loadingGps ? (
            <ActivityIndicator size="small" color="#059669" />
          ) : (
            <>
              <Navigation size={12} color="#059669" />
              <Text style={styles.gpsBtnText}>Mevcut Konumu Getir</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderColor: isDark ? '#334155' : '#cbd5e1',
            color: isDark ? '#f8fafc' : '#0f172a',
          },
        ]}
        placeholder="Adres veya konum açıklaması"
        placeholderTextColor="#94a3b8"
        value={address}
        onChangeText={setAddress}
      />

      {/* 4. Notes */}
      <Text style={[styles.label, { color: isDark ? '#cbd5e1' : '#475569', marginTop: 14 }]}>
        AÇIKLAMA & NOTLAR
      </Text>
      <TextInput
        style={[
          styles.textArea,
          {
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderColor: isDark ? '#334155' : '#cbd5e1',
            color: isDark ? '#f8fafc' : '#0f172a',
          },
        ]}
        placeholder="Gereken malzemeler, kontak kişi vb."
        placeholderTextColor="#94a3b8"
        multiline
        numberOfLines={3}
        value={notes}
        onChangeText={setNotes}
      />

      {/* 5. Checklist items */}
      <Text style={[styles.label, { color: isDark ? '#cbd5e1' : '#475569', marginTop: 14 }]}>
        KONTROL MADDELERİ
      </Text>
      <View style={styles.taskAddRow}>
        <TextInput
          style={[
            styles.taskInput,
            {
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              borderColor: isDark ? '#334155' : '#cbd5e1',
              color: isDark ? '#f8fafc' : '#0f172a',
            },
          ]}
          placeholder="Yeni görev maddesi ekle..."
          placeholderTextColor="#94a3b8"
          value={taskItemInput}
          onChangeText={setTaskItemInput}
        />
        <TouchableOpacity style={styles.taskAddBtn} onPress={handleAddTaskItem}>
          <Plus size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>
      <View style={styles.taskList}>
        {tasks.map((t, idx) => (
          <View
            key={idx}
            style={[styles.taskItem, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}
          >
            <CheckSquare size={16} color="#059669" />
            <Text style={[styles.taskText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>{t}</Text>
            <TouchableOpacity onPress={() => handleRemoveTaskItem(idx)}>
              <X size={16} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* 6. Photos */}
      <Text style={[styles.label, { color: isDark ? '#cbd5e1' : '#475569', marginTop: 14 }]}>
        FOTOĞRAFLAR
      </Text>
      <View style={styles.photoActions}>
        <TouchableOpacity style={styles.photoActionBtn} onPress={handleTakePhoto}>
          <Camera size={18} color="#059669" />
          <Text style={styles.photoActionText}>Fotoğraf Çek</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.photoActionBtn} onPress={handlePickPhoto}>
          <Plus size={18} color="#059669" />
          <Text style={styles.photoActionText}>Galeriden Seç</Text>
        </TouchableOpacity>
      </View>
      {photos.length > 0 && (
        <View style={styles.photosGrid}>
          {photos.map((uri, idx) => (
            <View key={idx} style={{ position: 'relative' }}>
              <Image source={{ uri }} style={styles.thumb} />
              <TouchableOpacity
                style={styles.photoRemoveBtn}
                onPress={() => setPhotos((p) => p.filter((_, i) => i !== idx))}
              >
                <X size={12} color="#ffffff" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* 7. Save Button */}
      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.btnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={styles.saveBtnText}>İş Emrini Oluştur</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 6,
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  gpsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 14,
  },
  suggestionBox: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    marginTop: 4,
    padding: 6,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  taskAddRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  taskInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
  },
  taskAddBtn: {
    backgroundColor: '#059669',
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskList: {
    gap: 6,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
  },
  taskText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  photoActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  photoActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  photoActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  thumb: {
    width: 70,
    height: 70,
    borderRadius: 8,
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    backgroundColor: '#059669',
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
