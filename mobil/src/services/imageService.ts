import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export const ImageService = {
  async takePhoto(): Promise<string | null> {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Fotoğraf çekebilmek için kamera izni gereklidir.');
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.5, // High compression to save data & network bandwidth
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          return `data:image/jpeg;base64,${asset.base64}`;
        }
        return asset.uri;
      }
      return null;
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Fotoğraf çekilirken bir sorun oluştu.');
      return null;
    }
  },

  async pickImage(): Promise<string | null> {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Galeriden seçim yapabilmek için fotoğraf erişim izni gereklidir.');
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          return `data:image/jpeg;base64,${asset.base64}`;
        }
        return asset.uri;
      }
      return null;
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Galeriden görsel seçilirken bir sorun oluştu.');
      return null;
    }
  },
};
