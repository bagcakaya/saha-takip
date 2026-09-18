import React from 'react';
import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { StorageProvider } from '../context/StorageContext';
import { ThemeProvider, useAppTheme } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import LoginScreen from './login';

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const { isDark } = useAppTheme();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: isDark ? '#020617' : '#f8fafc',
        }}
      >
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

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