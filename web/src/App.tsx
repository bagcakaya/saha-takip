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
import { SecurityLogsView } from './views/SecurityLogsView';
import { TemplateView } from './views/TemplateView';
import { HomeDashboardView } from './views/HomeDashboardView';
import { StaffTrackingView } from './views/StaffTrackingView';
import { RemindersView } from './views/RemindersView';
import { BranchesView } from './views/BranchesView';
import { TimedFollowUpsView } from './views/TimedFollowUpsView';
import { LoginView } from './views/LoginView';
import { LicenseLockedView } from './components/licensing/LicenseLockedView';
import { LocationItem } from './types/storage';
import { LocationDetailModal } from './components/installations/LocationDetailModal';
import { PwaInstallPrompt } from './components/common/PwaInstallPrompt';
import { ToastNotification } from './components/common/ToastNotification';
import { CariAlarmRingingModal } from './components/timedFollowUps/CariAlarmRingingModal';
import { isUserAdmin } from './types/auth';
import {
  normalizeTab,
  extractTabAndFilterFromUrl,
} from './utils/navigationUtils';

const MainApp: React.FC = () => {
  const { isAuthenticated, user, licenseInfo } = useAuth();
  const isAdmin = isUserAdmin(user);

  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (typeof window !== 'undefined') {
      try {
        const { tab: urlTab } = extractTabAndFilterFromUrl(window.location.href);
        if (urlTab) {
          return urlTab;
        }
        const pendingTab = normalizeTab(sessionStorage.getItem('@saha_takip_pending_tab'));
        if (pendingTab) {
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

  // Guard against non-admin accessing branches tab
  React.useEffect(() => {
    if (user && !isAdmin && activeTab === 'branches') {
      setActiveTab('home');
    }
  }, [user, isAdmin, activeTab]);

  // Deep-linking URL handler (for push notifications opened from lock screen / notification drawer)
  React.useEffect(() => {
    const handleDeepLink = () => {
      if (typeof window === 'undefined') return;
      try {
        const { tab: urlTab, filter: urlFilter } = extractTabAndFilterFromUrl(window.location.href);
        const pendingTab = normalizeTab(sessionStorage.getItem('@saha_takip_pending_tab'));
        const pendingFilter = sessionStorage.getItem('@saha_takip_pending_filter');

        const resolvedTab = urlTab || pendingTab;
        const resolvedFilter = urlFilter || pendingFilter;

        if (pendingTab) sessionStorage.removeItem('@saha_takip_pending_tab');
        if (pendingFilter) sessionStorage.removeItem('@saha_takip_pending_filter');

        if (resolvedTab) {
          setActiveTab(resolvedTab);
        }

        if (resolvedFilter) {
          if (user?.id) {
            try {
              localStorage.setItem(`@saha_takip_notes_active_filter_${user.id}`, resolvedFilter);
            } catch {
              // ignore
            }
          }
          window.dispatchEvent(
            new CustomEvent('saha:set-notes-filter', { detail: { filter: resolvedFilter } })
          );
        }

        if (window.location.search && (urlTab || urlFilter)) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (err) {
        console.warn('Deep link parse error:', err);
      }
    };

    handleDeepLink();
    window.addEventListener('popstate', handleDeepLink);
    window.addEventListener('focus', handleDeepLink);

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        handleDeepLink();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // In-app navigation event handler (e.g. from OneSignal SDK foreground click or window notification click)
    const handleNavigate = (e: any) => {
      const rawTab = e.detail?.tab;
      const filter = e.detail?.filter;
      const tab = normalizeTab(rawTab);
      if (tab) {
        setActiveTab(tab);
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
        const { tab: rawTab, filter, url } = event.data;
        let tab = normalizeTab(rawTab);
        let activeFilter = filter;
        if (!tab && url) {
          const parsed = extractTabAndFilterFromUrl(url);
          tab = parsed.tab;
          if (!activeFilter) activeFilter = parsed.filter;
        }
        if (tab) {
          setActiveTab(tab);
        }
        if (activeFilter) {
          if (user?.id) {
            try {
              localStorage.setItem(`@saha_takip_notes_active_filter_${user.id}`, activeFilter);
            } catch {}
          }
          window.dispatchEvent(
            new CustomEvent('saha:set-notes-filter', { detail: { filter: activeFilter } })
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
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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

  // If company license is expired or suspended, show License Locked Paywall (POLATLAR is always exempt)
  if (!licenseInfo.active) {
    return (
      <>
        <LicenseLockedView />
        <PwaInstallPrompt />
      </>
    );
  }

  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'home':
        return {
          subtitle: 'İş Takip Portalı',
          title: 'Ana Menü',
        };
      case 'branches':
        return {
          subtitle: 'Kurum, Şube & Personel Yönetimi',
          title: 'Kurum ve Şubeler',
        };
      case 'installations':
        return {
          subtitle: 'İş Takip Sistemi',
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
      case 'timed_follow_ups':
        return {
          subtitle: 'Zaman Ayarlı Cari Alarmları',
          title: 'Süreli Takipler',
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
      case 'logs':
        return {
          subtitle: 'Güvenlik & Cihaz Denetimi',
          title: 'Log Kayıtları',
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex w-full transition-colors overflow-x-hidden max-w-[100vw]">
      {/* 1. Left Sidebar (Desktop lg/xl/2xl) */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* 2. Center Content Area (Fluid full width) */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto overflow-x-hidden w-full max-w-full">
        {/* Mobile / Tablet Header (< lg screens) */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          subtitle={headerInfo.subtitle}
          title={headerInfo.title}
        />

        {/* Main Content */}
        <main
          className="flex-1 w-full max-w-full px-3.5 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6 overflow-x-hidden"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)',
          }}
        >
          {activeTab === 'home' && <HomeDashboardView onNavigate={(tab) => setActiveTab(tab)} />}
          {activeTab === 'branches' &&
            (isAdmin ? (
              <BranchesView />
            ) : (
              <HomeDashboardView onNavigate={(tab) => setActiveTab(tab)} />
            ))}
          {activeTab === 'installations' && <InstallationsView />}
          {activeTab === 'services' && <ServicesView />}
          {activeTab === 'notes' && <NotesView />}
          {activeTab === 'staff_tracking' && <StaffTrackingView />}
          {activeTab === 'timed_follow_ups' &&
            (isAdmin ? (
              <TimedFollowUpsView />
            ) : (
              <HomeDashboardView onNavigate={(tab) => setActiveTab(tab)} />
            ))}
          {activeTab === 'reminders' && <RemindersView />}
          {activeTab === 'returns' && <ReturnWarrantyView />}
          {activeTab === 'logs' && <SecurityLogsView />}
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

      {/* Global Ringing Alarm Modal for Managers */}
      {isAdmin && <CariAlarmRingingModal />}
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
