import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { TouchableOpacity, Text } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useAppTheme } from '../../context/ThemeContext';

export default function TabLayout() {
  const { isDark } = useAppTheme();
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { display: 'none' },
        headerStyle: {
          backgroundColor: isDark ? '#0b1329' : '#ffffff',
          shadowOpacity: 0,
          elevation: 0,
        },
        headerTintColor: isDark ? '#f8fafc' : '#0f172a',
        headerTitleStyle: {
          fontWeight: '900',
          fontSize: 17,
        },
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginLeft: 14,
              backgroundColor: '#2563eb',
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 10,
            }}
            activeOpacity={0.8}
          >
            <ArrowLeft size={16} color="#ffffff" />
            <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 12 }}>Ana Menü</Text>
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ana Menü',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="installations"
        options={{
          title: 'Kurulumlar',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: 'Servisler',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="work-orders"
        options={{
          title: 'İş Emirleri',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Personel Takibi & GPS',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="returns"
        options={{
          title: 'İade & Garanti',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil & Cari',
        }}
      />
      <Tabs.Screen
        name="timed-follow-ups"
        options={{
          title: 'Süreli Takipler',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: 'Hatırlatmalar',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="security-logs"
        options={{
          title: 'Log Kayıtları',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="templates"
        options={{
          title: 'Şablon Yönetimi',
          headerShown: false,
        }}
      />
    </Tabs>
  );
}

