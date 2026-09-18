import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useStorage } from '../context/StorageContext';
import { Calendar, Clock, Send } from 'lucide-react-native';

export default function LeaveRequestScreen() {
  const { requestLeave } = useStorage();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';

  const todayStr = new Date().toISOString().split('T')[0];
  const [leaveType, setLeaveType] = useState<'daily' | 'hourly'>('daily');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [durationText, setDurationText] = useState('1 Gün');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!reason.trim()) {
      Alert.alert('Uyarı', 'Lütfen izin alma gerekçenizi / mazeretinizi belirtin.');
      return;
    }

    setSaving(true);
    const res = await requestLeave({
      startDate,
      endDate: leaveType === 'daily' ? endDate : startDate,
      leaveType,
      durationText,
      reason: reason.trim(),
    });
    setSaving(false);

    if (res.success) {
      Alert.alert('Talebiniz Alındı', res.message, [
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
      {/* 1. Leave Type */}
      <Text style={[styles.label, { color: isDark ? '#cbd5e1' : '#475569' }]}>İZİN TÜRÜ</Text>
      <View style={styles.typeRow}>
        <TouchableOpacity
          style={[
            styles.typeBtn,
            leaveType === 'daily' && styles.typeBtnActive,
            { borderColor: leaveType === 'daily' ? '#059669' : isDark ? '#334155' : '#cbd5e1' },
          ]}
          onPress={() => {
            setLeaveType('daily');
            setDurationText('1 Gün');
          }}
        >
          <Calendar size={18} color={leaveType === 'daily' ? '#059669' : '#64748b'} />
          <Text
            style={[
              styles.typeBtnText,
              { color: leaveType === 'daily' ? '#059669' : '#64748b' },
            ]}
          >
            Günlük İzin
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.typeBtn,
            leaveType === 'hourly' && styles.typeBtnActive,
            { borderColor: leaveType === 'hourly' ? '#059669' : isDark ? '#334155' : '#cbd5e1' },
          ]}
          onPress={() => {
            setLeaveType('hourly');
            setDurationText('2 Saat');
          }}
        >
          <Clock size={18} color={leaveType === 'hourly' ? '#059669' : '#64748b'} />
          <Text
            style={[
              styles.typeBtnText,
              { color: leaveType === 'hourly' ? '#059669' : '#64748b' },
            ]}
          >
            Saatlik İzin
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. Dates */}
      <Text style={[styles.label, { color: isDark ? '#cbd5e1' : '#475569', marginTop: 14 }]}>
        {leaveType === 'daily' ? 'BAŞLANGIÇ TARİHİ' : 'İZİN TARİHİ'}
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
        value={startDate}
        onChangeText={setStartDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#94a3b8"
      />

      {leaveType === 'daily' ? (
        <>
          <Text style={[styles.label, { color: isDark ? '#cbd5e1' : '#475569', marginTop: 14 }]}>
            BİTİŞ TARİHİ
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
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94a3b8"
          />
        </>
      ) : null}

      {/* 3. Duration */}
      <Text style={[styles.label, { color: isDark ? '#cbd5e1' : '#475569', marginTop: 14 }]}>
        SÜRE (Örn: 1 Gün, 3 Gün, 2 Saat)
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
        value={durationText}
        onChangeText={setDurationText}
        placeholder="1 Gün"
        placeholderTextColor="#94a3b8"
      />

      {/* 4. Reason */}
      <Text style={[styles.label, { color: isDark ? '#cbd5e1' : '#475569', marginTop: 14 }]}>
        İZİN GEREKÇESİ / MAZERET *
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
        placeholder="İzin gerekçenizi detaylı olarak açıklayın..."
        placeholderTextColor="#94a3b8"
        multiline
        numberOfLines={4}
        value={reason}
        onChangeText={setReason}
      />

      {/* 5. Submit Button */}
      <TouchableOpacity
        style={[styles.submitBtn, saving && styles.btnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <>
            <Send size={18} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.submitBtnText}>İzin Talebini İlet</Text>
          </>
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
  typeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  typeBtnActive: {
    backgroundColor: '#ecfdf5',
  },
  typeBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 100,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: '#059669',
    height: 50,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
