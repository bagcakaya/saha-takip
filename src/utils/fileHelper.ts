import {
  copyAsync,
  deleteAsync,
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
} from 'expo-file-system/legacy';

const PHOTOS_DIR = `${documentDirectory}gorev_tamamlama_photos/`;

/**
 * Ensures that the persistent directory for storing photos exists.
 */
const ensureDirExists = async () => {
  const dirInfo = await getInfoAsync(PHOTOS_DIR);
  if (!dirInfo.exists) {
    await makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  }
};

/**
 * Copies a temporary image file (e.g. from camera/picker) to the persistent document directory.
 * @param tempUri Temporary source file URI
 * @returns Persistent target file URI
 */
export const savePhotoPersistently = async (tempUri: string): Promise<string> => {
  try {
    await ensureDirExists();
    const filename = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.jpg`;
    const targetUri = `${PHOTOS_DIR}${filename}`;
    
    await copyAsync({
      from: tempUri,
      to: targetUri,
    });
    
    return targetUri;
  } catch (error) {
    console.error('Fotoğraf kalıcı olarak kaydedilirken hata oluştu:', error);
    throw error;
  }
};

/**
 * Deletes a file from the persistent document directory.
 * @param fileUri Persistent file URI to delete
 */
export const deletePersistentPhoto = async (fileUri: string): Promise<void> => {
  try {
    const fileInfo = await getInfoAsync(fileUri);
    if (fileInfo.exists) {
      await deleteAsync(fileUri, { idempotent: true });
    }
  } catch (error) {
    console.error('Fotoğraf kalıcı hafızadan silinirken hata oluştu:', error);
    throw error;
  }
};
