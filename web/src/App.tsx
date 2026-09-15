import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { StorageProvider, useStorage } from './context/StorageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/layout/Sidebar';
import { RightSummaryPanel } from './components/layout/RightSummaryPanel';
import { Header, TabType } from './components/layout/Header';
import { InstallationsView } from './views/InstallationsView';
import { ServicesView } from './views/ServicesView';
import { NotesView } from './views/NotesView';
import { ReturnWarrantyView } from './views/ReturnWarrantyView';
import { TemplateView } from './views/TemplateView';
import { HomeDashboardView } from './views/HomeDashboardView';
import { StaffTrackingView } from './views/StaffTrackingView';
import { RemindersView } from './views/RemindersView';
import { LoginView } from './views/LoginView';
import { LocationItem } from './types/storage';
import { LocationDetailModal } from './components/installations/LocationDetailModal';
import { PwaInstallPrompt } from './components/common/PwaInstallPrompt';
import { ToastNotification } from './components/common/ToastNotification';

const MainApp: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const validTabs: TabType[] = [
    'home',
    'installations',
    'services',
    'notes',
    'staff_tracking',
    'reminders',
    'returns',
    'template',
  ];

  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab') as TabType;
        if (tabParam && validTabs.includes(tabParam)) {
          return tabParam;
        }
        const pendingTab = sessionStorage.getItem('@saha_takip_pending_tab') as TabType;
        if (pendingTab && validTabs.includes(pendingTab)) {
          sessionStorage.removeItem('@saha_takip_pending_tab');
          return pendingTab;
        }
      } catch (err) {
        console.warn('Initial tab parse error:', err);
      }
    }
    return 'home';
  });
  const {
    activeToast,
    dismissToast,
    deleteLocation,
    updateTaskStatus,
    addCustomTaskToLocation,
    deleteCustomTaskFromLocation,
    updateLocationDetails,
    addPhotoToLocation,
    deletePhotoFromLocation,
    cariler,
  } = useStorage();

  // Selected location for right summary panel preview / detail modal
  const [previewLocation, setPreviewLocation] = useState<LocationItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Deep-linking URL handler (for push notifications opened from lock screen / notification drawer)
  React.useEffect(() => {
    const handleDeepLink = () => {
      if (typeof window === 'undefined') return;
      try {
        const search = window.location.search;
        let tabParam: string | null = null;
        let filterParam: string | null = null;

        if (search) {
          const params = new URLSearchParams(search);
          tabParam = params.get('tab');
          filterParam = params.get('filter');
        }

        // Fallback to sessionStorage if not in URL
        if (!tabParam) {
          tabParam = sessionStorage.getItem('@saha_takip_pending_tab');
          if (tabParam) sessionStorage.removeItem('@saha_takip_pending_tab');
        }
        if (!filterParam) {
          filterParam = sessionStorage.getItem('@saha_takip_pending_filter');
          if (filterParam) sessionStorage.removeItem('@saha_takip_pending_filter');
        }

        if (tabParam && validTabs.includes(tabParam as TabType)) {
          setActiveTab(tabParam as TabType);
        }

        if (filterParam) {
          if (user?.id) {
            try {
              localStorage.setItem(`@saha_takip_notes_active_filter_${user.id}`, filterParam);
            } catch {
              // ignore
            }
          }
          window.dispatchEvent(
            new CustomEvent('saha:set-notes-filter', { detail: { filter: filterParam } })
          );
        }

        if (search && (tabParam || filterParam)) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (err) {
        console.warn('Deep link parse error:', err);
      }
    };

    handleDeepLink();
    window.addEventListener('popstate', handleDeepLink);
    window.addEventListener('focus', handleDeepLink);

    // In-app navigation event handler (e.g. from OneSignal SDK foreground click)
    const handleNavigate = (e: any) => {
      const { tab, filter } = e.detail || {};
      if (tab && validTabs.includes(tab as TabType)) {
        setActiveTab(tab as TabType);
      }
      if (filter) {
        if (user?.id) {
          try {
            localStorage.setItem(`@saha_takip_notes_active_filter_${user.id}`, filter);
          } catch {
            // ignore
          }
        }
        window.dispatchEvent(
          new CustomEvent('saha:set-notes-filter', { detail: { filter } })
        );
      }
    };

    // Service worker postMessage navigation handler
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'saha:navigate') {
        const { tab, filter } = event.data;
        if (tab && validTabs.includes(tab as TabType)) {
          setActiveTab(tab as TabType);
        }
        if (filter) {
          if (user?.id) {
            try {
              localStorage.setItem(`@saha_takip_notes_active_filter_${user.id}`, filter);
            } catch {}
          }
          window.dispatchEvent(
            new CustomEvent('saha:set-notes-filter', { detail: { filter } })
          );
        }
      }
    };

    window.addEventListener('saha:navigate' as any, handleNavigate);
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    return () => {
      window.removeEventListener('popstate', handleDeepLink);
      window.removeEventListener('focus', handleDeepLink);
      window.removeEventListener('saha:navigate' as any, handleNavigate);
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, [user]);

  // If user is not authenticated, show Login Screen
  if (!isAuthenticated) {
    return (
      <>
        <LoginView />
        <PwaInstallPrompt />
      </>
    );
  }

  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'home':
        return {
          subtitle: 'Saha Takip Portalı',
          title: 'Ana Menü',
        };
      case 'installations':
        return {
          subtitle: 'Saha Takip Raporu',
          title: 'Kurulumlar',
        };
      case 'services':
        return {
          subtitle: 'Teknik Servis & Müdahale',
          title: 'Servis Kayıtları',
        };
      case 'notes':
        return {
          subtitle: 'Görev & Takip',
          title: 'İş Emirleri & Hatırlatıcılar',
        };
      case 'staff_tracking':
        return {
          subtitle: 'Giriş & Çıkış Takibi',
          title: 'Personel Takibi',
        };
      case 'reminders':
        return {
          subtitle: 'Yönetici Talimat & Prosedürleri',
          title: 'Hatırlatmalar',
        };
      case 'returns':
        return {
          subtitle: 'Ürün & Kargo Takibi',
          title: 'İade & Garanti Yönetimi',
        };
      case 'template':
        return {
          subtitle: 'Şablon Yönetimi',
          title: 'Standart Görevler',
        };
    }
  };

  const headerInfo = getHeaderInfo();

  const handleOpenDetailModal = (location: LocationItem) => {
    setPreviewLocation(location);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex w-full transition-colors overflow-x-hidden">
      {/* 1. Left Sidebar (Desktop lg/xl/2xl) */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* 2. Center Content Area (Fluid full width) */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Mobile / Tablet Header (< lg screens) */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          subtitle={headerInfo.subtitle}
          title={headerInfo.title}
        />

        {/* Main Content */}
        <main
          className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-5 lg:py-6"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)',
          }}
        >
          {activeTab === 'home' && <HomeDashboardView onNavigate={(tab) => setActiveTab(tab)} />}
          {activeTab === 'installations' && <InstallationsView />}
          {activeTab === 'services' && <ServicesView />}
          {activeTab === 'notes' && <NotesView />}
          {activeTab === 'staff_tracking' && <StaffTrackingView />}
          {activeTab === 'reminders' && <RemindersView />}
          {activeTab === 'returns' && <ReturnWarrantyView />}
          {activeTab === 'template' && <TemplateView />}
        </main>
      </div>

      {/* 3. Right Live Summary & Map Panel (Desktop xl/2xl) */}
      {activeTab === 'installations' && (
        <RightSummaryPanel
          selectedLocation={previewLocation}
          onOpenDetailModal={handleOpenDetailModal}
        />
      )}

      {/* Quick Modal Trigger from Right Panel */}
      <LocationDetailModal
        location={previewLocation}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onDelete={() => {
          if (previewLocation) {
            deleteLocation(previewLocation.id);
            setIsDetailModalOpen(false);
            setPreviewLocation(null);
          }
        }}
        onUpdateStatus={(taskId, status) => {
          if (previewLocation) {
            updateTaskStatus(previewLocation.id, taskId, status);
          }
        }}
        onAddCustomTask={(taskName) => {
          if (previewLocation) {
            addCustomTaskToLocation(previewLocation.id, taskName);
          }
        }}
        onDeleteCustomTask={(taskId, taskName) => {
          if (
            previewLocation &&
            window.confirm(`"${taskName}" görevini silmek istediğinize emin misiniz?`)
          ) {
            deleteCustomTaskFromLocation(previewLocation.id, taskId);
          }
        }}
        onUpdateDetails={(addr, notes, lat, lon, name) => {
          if (previewLocation) {
            updateLocationDetails(previewLocation.id, addr, notes, lat, lon, name);
          }
        }}
        onAddPhoto={(photoUrl) => {
          if (previewLocation) {
            addPhotoToLocation(previewLocation.id, photoUrl);
          }
        }}
        onDeletePhoto={(photoUrl) => {
          if (previewLocation) {
            deletePhotoFromLocation(previewLocation.id, photoUrl);
          }
        }}
      />

      {/* PWA Home Screen Install & Notification Prompt */}
      <PwaInstallPrompt />

      {/* Realtime In-App Toast Notification Popup */}
      <ToastNotification
        toast={activeToast}
        onClose={dismissToast}
        onClick={() => {
          if (activeToast?.tab) {
            setActiveTab(activeToast.tab);
          } else {
            setActiveTab('notes');
          }
          if (activeToast?.filter) {
            if (user?.id) {
              try {
                localStorage.setItem(
                  `@saha_takip_notes_active_filter_${user.id}`,
                  activeToast.filter
                );
              } catch {
                // ignore
              }
            }
            window.dispatchEvent(
              new CustomEvent('saha:set-notes-filter', {
                detail: { filter: activeToast.filter },
              })
            );
          }
          dismissToast();
        }}
      />

      {/* Global Datalist for Cari Autocomplete across all forms */}
      <datalist id="cari-names-list">
        {cariler.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <StorageProvider>
          <MainApp />
        </StorageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
