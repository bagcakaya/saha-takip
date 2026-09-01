import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

export type TaskStatus = 'pending' | 'completed' | 'not_present';

export interface Task {
  id: string;
  name: string;
  status: TaskStatus;
}

export interface LocationItem {
  id: string;
  name: string;
  address?: string;
  notes?: string;
  photos?: string[];
  latitude?: number;
  longitude?: number;
  createdAt: number;
  tasks: Task[];
}

interface StorageContextType {
  locations: LocationItem[];
  standardTasks: string[];
  isLoading: boolean;
  addLocation: (name: string) => Promise<void>;
  deleteLocation: (id: string) => Promise<void>;
  updateTaskStatus: (locationId: string, taskId: string, status: TaskStatus) => Promise<void>;
  addCustomTaskToLocation: (locationId: string, taskName: string) => Promise<void>;
  deleteCustomTaskFromLocation: (locationId: string, taskId: string) => Promise<void>;
  addStandardTask: (taskName: string) => Promise<void>;
  deleteStandardTask: (index: number) => Promise<void>;
  resetStandardTasks: () => Promise<void>;
  updateLocationDetails: (locationId: string, address: string, notes: string, latitude?: number, longitude?: number, name?: string) => Promise<void>;
  addPhotoToLocation: (locationId: string, photoUri: string) => Promise<void>;
  deletePhotoFromLocation: (locationId: string, photoUri: string) => Promise<void>;
  importBackupData: (backupData: { locations: LocationItem[]; standardTasks: string[] }) => Promise<void>;
}

const StorageContext = createContext<StorageContextType | undefined>(undefined);

const LOCATIONS_STORAGE_KEY = '@gorev_tamamlama_locations';
const STANDARD_TASKS_STORAGE_KEY = '@gorev_tamamlama_standard_tasks';

const DEFAULT_STANDARD_TASKS = [
  'POS cihazı Entegre edildi mi?',
  'POS cihazından kart ve nakit denendi mi?',
  'Banka Listesine ilgili banka eklendi mi?',
  'Firma Sabitleri Pos kısmından “Ürün seçerek tahsilat yapılamaz” işaretlendi mi?',
  'Firma Sabitleri Pos kısmından Fiş Limiti 12000₺ olarak belirlendi mi?',
  'Fiş Yazıcı kuruldu mu?',
  'Fiş Yazıcı test edildi mi?',
  'Barkod yazıcı kuruldu mu?',
  'Barkod yazıcı test edildi mi?',
  'Dokunmatik Ekran çift ekran ise arka ekran ayarlandı mı?',
  'Cat kablo kullanıldı mı?',
  'Ürünler teraziye gönderildi mi?',
];

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

export const StorageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [standardTasks, setStandardTasks] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const storedLocations = await AsyncStorage.getItem(LOCATIONS_STORAGE_KEY);
        const storedStandardTasks = await AsyncStorage.getItem(STANDARD_TASKS_STORAGE_KEY);

        if (storedLocations) {
          setLocations(JSON.parse(storedLocations));
        }

        if (storedStandardTasks) {
          setStandardTasks(JSON.parse(storedStandardTasks));
        } else {
          // Initialize standard tasks with defaults if empty
          await AsyncStorage.setItem(STANDARD_TASKS_STORAGE_KEY, JSON.stringify(DEFAULT_STANDARD_TASKS));
          setStandardTasks(DEFAULT_STANDARD_TASKS);
        }
      } catch (error) {
        console.error('Veriler yüklenirken hata oluştu:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Save locations helper
  const saveLocations = async (newLocations: LocationItem[]) => {
    try {
      await AsyncStorage.setItem(LOCATIONS_STORAGE_KEY, JSON.stringify(newLocations));
      setLocations(newLocations);
    } catch (error) {
      console.error('Lokasyonlar kaydedilirken hata oluştu:', error);
    }
  };

  // Save standard tasks helper
  const saveStandardTasks = async (newTasks: string[]) => {
    try {
      await AsyncStorage.setItem(STANDARD_TASKS_STORAGE_KEY, JSON.stringify(newTasks));
      setStandardTasks(newTasks);
    } catch (error) {
      console.error('Standart görevler kaydedilirken hata oluştu:', error);
    }
  };

  // Add location
  const addLocation = async (name: string) => {
    const newLocation: LocationItem = {
      id: generateId(),
      name: name.trim(),
      createdAt: Date.now(),
      tasks: standardTasks.map((taskName) => ({
        id: generateId(),
        name: taskName,
        status: 'pending',
      })),
    };
    const newLocations = [newLocation, ...locations];
    await saveLocations(newLocations);
  };

  // Delete location
  const deleteLocation = async (id: string) => {
    const newLocations = locations.filter((loc) => loc.id !== id);
    await saveLocations(newLocations);
  };

  // Update task status inside a location
  const updateTaskStatus = async (locationId: string, taskId: string, status: TaskStatus) => {
    const newLocations = locations.map((loc) => {
      if (loc.id === locationId) {
        return {
          ...loc,
          tasks: loc.tasks.map((task) => {
            if (task.id === taskId) {
              return { ...task, status };
            }
            return task;
          }),
        };
      }
      return loc;
    });
    await saveLocations(newLocations);
  };

  // Add custom task to specific location
  const addCustomTaskToLocation = async (locationId: string, taskName: string) => {
    if (!taskName.trim()) return;
    const newLocations = locations.map((loc) => {
      if (loc.id === locationId) {
        return {
          ...loc,
          tasks: [
            ...loc.tasks,
            {
              id: generateId(),
              name: taskName.trim(),
              status: 'pending' as TaskStatus,
            },
          ],
        };
      }
      return loc;
    });
    await saveLocations(newLocations);
  };

  // Delete custom task from specific location
  const deleteCustomTaskFromLocation = async (locationId: string, taskId: string) => {
    const newLocations = locations.map((loc) => {
      if (loc.id === locationId) {
        return {
          ...loc,
          tasks: loc.tasks.filter((task) => task.id !== taskId),
        };
      }
      return loc;
    });
    await saveLocations(newLocations);
  };

  // Add standard task to template
  const addStandardTask = async (taskName: string) => {
    if (!taskName.trim()) return;
    const newTasks = [...standardTasks, taskName.trim()];
    await saveStandardTasks(newTasks);
  };

  // Delete standard task from template
  const deleteStandardTask = async (index: number) => {
    const newTasks = standardTasks.filter((_, idx) => idx !== index);
    await saveStandardTasks(newTasks);
  };

  // Reset standard tasks to default template
  const resetStandardTasks = async () => {
    await saveStandardTasks(DEFAULT_STANDARD_TASKS);
  };

  // Update location address, notes, and optionally name
  const updateLocationDetails = async (locationId: string, address: string, notes: string, latitude?: number, longitude?: number, name?: string) => {
    const newLocations = locations.map((loc) => {
      if (loc.id === locationId) {
        return {
          ...loc,
          name: name !== undefined ? name.trim() : loc.name,
          address: address,
          notes: notes,
          latitude: latitude !== undefined ? latitude : loc.latitude,
          longitude: longitude !== undefined ? longitude : loc.longitude,
        };
      }
      return loc;
    });
    await saveLocations(newLocations);
  };

  // Add photo to location
  const addPhotoToLocation = async (locationId: string, photoUri: string) => {
    const newLocations = locations.map((loc) => {
      if (loc.id === locationId) {
        const photos = loc.photos || [];
        return {
          ...loc,
          photos: [...photos, photoUri],
        };
      }
      return loc;
    });
    await saveLocations(newLocations);
  };

  // Delete photo from location
  const deletePhotoFromLocation = async (locationId: string, photoUri: string) => {
    const newLocations = locations.map((loc) => {
      if (loc.id === locationId) {
        const photos = loc.photos || [];
        return {
          ...loc,
          photos: photos.filter((uri) => uri !== photoUri),
        };
      }
      return loc;
    });
    await saveLocations(newLocations);
  };

  // Import backup data (merges or overwrites)
  const importBackupData = async (backupData: { locations: LocationItem[]; standardTasks: string[] }) => {
    if (backupData.locations) {
      await saveLocations(backupData.locations);
    }
    if (backupData.standardTasks) {
      await saveStandardTasks(backupData.standardTasks);
    }
  };

  return (
    <StorageContext.Provider
      value={{
        locations,
        standardTasks,
        isLoading,
        addLocation,
        deleteLocation,
        updateTaskStatus,
        addCustomTaskToLocation,
        deleteCustomTaskFromLocation,
        addStandardTask,
        deleteStandardTask,
        resetStandardTasks,
        updateLocationDetails,
        addPhotoToLocation,
        deletePhotoFromLocation,
        importBackupData,
      }}>
      {children}
    </StorageContext.Provider>
  );
};

export const useStorage = () => {
  const context = useContext(StorageContext);
  if (context === undefined) {
    throw new Error('useStorage hooku StorageProvider içinde kullanılmalıdır.');
  }
  return context;
};
