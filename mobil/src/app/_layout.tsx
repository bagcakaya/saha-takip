import 'react-native-reanimated';
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { StorageProvider } from '../context/StorageContext';
import { ThemeProvider, useAppTheme } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const { isDark } = useAppTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inLogin = segments[0] === 'login';

    if (!isAuthenticated && !inLogin) {
      router.replace('/login');
    } else if (isAuthenticated && inLogin) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: isDark ? '#0b1329' : '#ffffff',
          },
          headerTintColor: isDark ? '#f8fafc' : '#0f172a',
          headerTitleStyle: {
            fontWeight: '700',
          },
          contentStyle: {
            backgroundColor: isDark ? '#020617' : '#f8fafc',
          },
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="new-task"
          options={{
            presentation: 'modal',
            title: 'Yeni İş Emri / Keşif',
            headerBackTitle: 'Geri',
          }}
        />
        <Stack.Screen
          name="new-service"
          options={{
            presentation: 'modal',
            title: 'Yeni Teknik Servis',
            headerBackTitle: 'Geri',
          }}
        />
        <Stack.Screen
          name="new-return"
          options={{
            presentation: 'modal',
            title: 'Yeni İade / Garanti',
            headerBackTitle: 'Geri',
          }}
        />
        <Stack.Screen
          name="leave-request"
          options={{
            presentation: 'modal',
            title: 'İzin Talebi Oluştur',
            headerBackTitle: 'Geri',
          }}
        />
      </Stack>

      {isLoading && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: isDark ? '#020617' : '#f8fafc',
            zIndex: 9999,
          }}
        >
          <ActivityIndicator size="large" color="#059669" />
        </View>
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <StorageProvider>
          <RootNavigator />
        </StorageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}