import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import { PersonalNotesView } from './views/PersonalNotesView';
import { JobApplicationsView } from './views/JobApplicationsView';
import { LoginView } from './views/LoginView';
import { LicenseLockedView } from './components/licensing/LicenseLockedView';
import { LocationItem } from './types/storage';
import { LocationDetailModal } from './components/installations/LocationDetailModal';
import { PublicSalarySlipViewer } from './components/salary/PublicSalarySlipViewer';
import { PwaInstallPrompt } from './components/common/PwaInstallPrompt';
import { ToastNotification } from './components/common/ToastNotification';
import { CariAlarmRingingModal } from './components/timedFollowUps/CariAlarmRingingModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { isUserAdmin, canUserManageInstitutionsAndBranches, isModulePermitted } from './types/auth';
import {
  normalizeTab,
  extractTabAndFilterFromUrl,
  VALID_TABS,
} from './utils/navigationUtils';

const MainApp: React.FC = () => {
  const { isAuthenticated, user, company, licenseInfo } = useAuth();
  const isAdmin = isUserAdmin(user);
  const canManageInstitutionsAndBranches = canUserManageInstitutionsAndBranches(user);

  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (typeof window !== 'undefined') {
      try {
        const { tab: urlTab } = extractTabAndFilterFromUrl(window.location.href);
        if (urlTab) {
          return urlTab;
        }
        const pendingTab = normalizeTab(
          sessionStorage.getItem('@saha_takip_pending_tab') ||
          localStorage.getItem('@saha_takip_pending_tab')
        );
        if (pendingTab) {
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
  const mainScrollRef = useRef<HTMLDivElement>(null);

  // --- 1. History & Navigation Management for Android Back Button & iOS Swipe Back ---
  const navigateToTab = useCallback((nextTab: TabType, options?: { replace?: boolean; filter?: string }) => {
    setActiveTab((prev) => {
      const isSame = prev === nextTab;
      if (typeof window !== 'undefined') {
        const filterSuffix = options?.filter ? `&filter=${options.filter}` : '';
        const url = nextTab === 'home' ? window.location.pathname : `?tab=${nextTab}${filterSuffix}`;
        try {
          if (options?.replace) {
            window.history.replaceState({ tab: nextTab, isRoot: nextTab === 'home' }, '', url);
          } else if (!isSame) {
            window.history.pushState({ tab: nextTab, isRoot: nextTab === 'home' }, '', url);
          }
        } catch (err) {
          console.warn('History navigation error:', err);
        }
      }
      return nextTab;
    });
  }, []);

  const handleBackToHome = useCallback(() => {
    if (typeof window !== 'undefined') {
      if (window.history.length > 1 && !window.history.state?.isRoot) {
        window.history.back();
        return;
      }
    }
    navigateToTab('home', { replace: true });
  }, [navigateToTab]);

  // Initial history state & filter synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const { tab: urlTab, filter: urlFilter } = extractTabAndFilterFromUrl(window.location.href);
      const pendingTab = normalizeTab(
        sessionStorage.getItem('@saha_takip_pending_tab') ||
        localStorage.getItem('@saha_takip_pending_tab')
      );
      const pendingFilter =
        sessionStorage.getItem('@saha_takip_pending_filter') ||
        localStorage.getItem('@saha_takip_pending_filter');

      const targetTab = urlTab || pendingTab || activeTab || 'home';
      const targetFilter = urlFilter || pendingFilter;

      // Clean pending once consumed
      sessionStorage.removeItem('@saha_takip_pending_tab');
      sessionStorage.removeItem('@saha_takip_pending_filter');
      localStorage.removeItem('@saha_takip_pending_tab');
      localStorage.removeItem('@saha_takip_pending_filter');
      localStorage.removeItem('@saha_takip_pending_tab_time');

      if (targetTab === 'home') {
        window.history.replaceState({ tab: 'home', isRoot: true }, '', window.location.pathname);
      } else {
        // If opened on sub-tab directly from push notification or link,
        // set root state to 'home' and push active sub-tab so Android Back button returns to Ana Menü!
        const filterSuffix = targetFilter ? `&filter=${targetFilter}` : '';
        window.history.replaceState({ tab: 'home', isRoot: true }, '', window.location.pathname);
        window.history.pushState(
          { tab: targetTab, isRoot: false },
          '',
          `?tab=${targetTab}${filterSuffix}`
        );
        if (targetTab !== activeTab) {
          setActiveTab(targetTab);
        }
      }

      if (targetFilter) {
        if (user?.id) {
          try {
            localStorage.setItem(`@saha_takip_notes_active_filter_${user.id}`, targetFilter);
          } catch {}
        }
        window.dispatchEvent(
          new CustomEvent('saha:set-notes-filter', { detail: { filter: targetFilter } })
        );
        window.dispatchEvent(
          new CustomEvent('saha:set-installations-filter', { detail: { filter: targetFilter } })
        );
        window.dispatchEvent(
          new CustomEvent('saha:set-staff-subtab', { detail: { subTab: targetFilter } })
        );
      }
    } catch (e) {
      console.warn('Initial history setup error:', e);
    }
  }, [user]);

  // Popstate Listener (Hardware Back Button & System Back Gesture)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // If modal was open and user pressed back, close modal first
      if (isDetailModalOpen) {
        setIsDetailModalOpen(false);
        setPreviewLocation(null);
        return;
      }

      const stateTab = event.state?.tab;
      if (stateTab && VALID_TABS.includes(stateTab)) {
        setActiveTab(stateTab);
      } else {
        const { tab: urlTab } = extractTabAndFilterFromUrl(window.location.href);
        setActiveTab(urlTab || 'home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isDetailModalOpen]);

  // Redirect to 'home' if activeTab is forbidden for current user's role or company
  useEffect(() => {
    if (activeTab === 'home') return;
    if (activeTab === 'branches') {
      if (!canManageInstitutionsAndBranches || (company && company.code !== 'POLATLAR')) {
        navigateToTab('home', { replace: true });
      }
      return;
    }
    if (!isModulePermitted(activeTab, user, company)) {
      navigateToTab('home', { replace: true });
    }
  }, [activeTab, user, company, canManageInstitutionsAndBranches, navigateToTab]);

  // Swipe Right Gesture for Mobile / iOS PWA
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let touchStartTarget: EventTarget | null = null;

    const isInsideHorizontalScrollContainer = (target: EventTarget | null): boolean => {
      let el = target as HTMLElement | null;
      while (el && el !== document.body) {
        const tagName = el.tagName?.toUpperCase();
        if (['TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD'].includes(tagName)) {
          return true;
        }
        if (
          el.classList?.contains('overflow-x-auto') ||
          el.classList?.contains('overflow-x-scroll') ||
          el.getAttribute?.('data-no-swipe') === 'true'
        ) {
          return true;
        }
        try {
          const style = window.getComputedStyle(el);
          if (
            (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
            el.scrollWidth > el.clientWidth
          ) {
            return true;
          }
        } catch {
          // ignore
        }
        el = el.parentElement;
      }
      return false;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
        touchStartTarget = e.touches[0].target;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Home has nowhere to go back to, and staff_tracking has internal sub-section swipe logic
      if (activeTab === 'home' || activeTab === 'staff_tracking') return;
      if (e.changedTouches && e.changedTouches.length > 0) {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        const timeDiff = Date.now() - touchStartTime;
        const touchEndTarget = e.changedTouches[0].target;

        // Yatay kaydırılabilir tablo veya konteyner içinden yapılan kaydırmalarda geri dönmeyi engelle
        if (
          isInsideHorizontalScrollContainer(touchStartTarget) ||
          isInsideHorizontalScrollContainer(touchEndTarget)
        ) {
          return;
        }

        // Edge swipe right: starts within first 35px from left edge, moves > 50px right, horizontal
        if (touchStartX <= 35 && deltaX > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4 && timeDiff < 650) {
          handleBackToHome();
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [activeTab, handleBackToHome]);

  // Automatically scroll back to top when switching tabs (prevents mobile/iOS Safari viewport offset glitches)
  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }, [activeTab]);

  // Guard against non-admin accessing branches tab
  useEffect(() => {
    if (user && !isAdmin && activeTab === 'branches') {
      navigateToTab('home', { replace: true });
    }
  }, [user, isAdmin, activeTab, navigateToTab]);

  // Deep-linking URL handler & in-app navigation (BroadcastChannel, ServiceWorker, Storage, Focus)
  useEffect(() => {
    const handleDeepNavigation = (tab: TabType, filter?: string | null) => {
      if (!tab) return;
      setActiveTab(tab);

      if (typeof window !== 'undefined') {
        const filterSuffix = filter ? `&filter=${filter}` : '';
        const newUrl = tab === 'home' ? window.location.pathname : `?tab=${tab}${filterSuffix}`;
        try {
          window.history.pushState({ tab, isRoot: tab === 'home' }, '', newUrl);
        } catch {}
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
        window.dispatchEvent(
          new CustomEvent('saha:set-installations-filter', { detail: { filter } })
        );
        window.dispatchEvent(
          new CustomEvent('saha:set-staff-subtab', { detail: { subTab: filter } })
        );
      }
    };

    const checkPendingNavigation = () => {
      if (typeof window === 'undefined') return;
      try {
        const { tab: urlTab, filter: urlFilter } = extractTabAndFilterFromUrl(window.location.href);
        const pendingTab = normalizeTab(
          sessionStorage.getItem('@saha_takip_pending_tab') ||
          localStorage.getItem('@saha_takip_pending_tab')
        );
        const pendingFilter =
          sessionStorage.getItem('@saha_takip_pending_filter') ||
          localStorage.getItem('@saha_takip_pending_filter');

        const targetTab = urlTab || pendingTab;
        const targetFilter = urlFilter || pendingFilter;

        if (pendingTab) sessionStorage.removeItem('@saha_takip_pending_tab');
        if (pendingFilter) sessionStorage.removeItem('@saha_takip_pending_filter');
        if (localStorage.getItem('@saha_takip_pending_tab')) {
          localStorage.removeItem('@saha_takip_pending_tab');
          localStorage.removeItem('@saha_takip_pending_filter');
          localStorage.removeItem('@saha_takip_pending_tab_time');
        }

        if (targetTab && targetTab !== activeTab) {
          handleDeepNavigation(targetTab, targetFilter);
        } else if (targetFilter) {
          if (user?.id) {
            try {
              localStorage.setItem(`@saha_takip_notes_active_filter_${user.id}`, targetFilter);
            } catch {}
          }
          window.dispatchEvent(
            new CustomEvent('saha:set-notes-filter', { detail: { filter: targetFilter } })
          );
          window.dispatchEvent(
            new CustomEvent('saha:set-installations-filter', { detail: { filter: targetFilter } })
          );
          window.dispatchEvent(
            new CustomEvent('saha:set-staff-subtab', { detail: { subTab: targetFilter } })
          );
        }
      } catch (err) {
        console.warn('Deep link check error:', err);
      }
    };

    // 1. Window focus & document visibility (When returning from lock screen or background)
    window.addEventListener('focus', checkPendingNavigation);
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        checkPendingNavigation();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 2. Custom DOM event (saha:navigate)
    const handleNavigate = (e: any) => {
      const rawTab = e.detail?.tab;
      const filter = e.detail?.filter;
      const tab = normalizeTab(rawTab);
      if (tab) {
        handleDeepNavigation(tab, filter);
      }
    };
    window.addEventListener('saha:navigate' as any, handleNavigate);

    // 3. Service Worker postMessage
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
          handleDeepNavigation(tab, activeFilter);
        }
      }
    };
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    // 4. BroadcastChannel (Cross-tab and Worker-to-Client broadcast)
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('saha_takip_channel');
        bc.onmessage = (event) => {
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
              handleDeepNavigation(tab, activeFilter);
            }
          }
        };
      }
    } catch {}

    // 5. Cross-tab Storage Event
    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key === '@saha_takip_pending_tab' && event.newValue) {
        const tab = normalizeTab(event.newValue);
        const filter = localStorage.getItem('@saha_takip_pending_filter');
        if (tab) {
          handleDeepNavigation(tab, filter);
          localStorage.removeItem('@saha_takip_pending_tab');
          localStorage.removeItem('@saha_takip_pending_filter');
          localStorage.removeItem('@saha_takip_pending_tab_time');
        }
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      window.removeEventListener('focus', checkPendingNavigation);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('saha:navigate' as any, handleNavigate);
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
      if (bc) {
        bc.close();
      }
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [user, activeTab]);

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
      case 'personal_notes':
        return {
          subtitle: 'Kişisel & Gizli Not Defteri',
          title: 'Notlarım',
        };
      case 'staff_tracking':
        return {
          subtitle: 'Giriş & Çıkış Takibi',
          title: 'Personel Takibi',
        };
      case 'job_applications':
        return {
          subtitle: 'Aday Değerlendirme & Personel Dönüştürme',
          title: 'İş Başvuruları',
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
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState({ tab: activeTab, modal: 'location_detail' }, '', window.location.href);
      } catch {}
    }
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setPreviewLocation(null);
    if (typeof window !== 'undefined' && window.history.state?.modal === 'location_detail') {
      window.history.back();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex w-full transition-colors overflow-x-hidden max-w-[100vw]">
      {/* 1. Left Sidebar (Desktop lg/xl/2xl) */}
      <Sidebar activeTab={activeTab} setActiveTab={navigateToTab} />

      {/* 2. Center Content Area (Fluid full width) */}
      <div
        ref={mainScrollRef}
        className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto overflow-x-hidden w-full max-w-full"
      >
        {/* Mobile / Tablet Header (< lg screens) */}
        <Header
          activeTab={activeTab}
          setActiveTab={navigateToTab}
          onBackToHome={handleBackToHome}
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
          <ErrorBoundary onReset={() => navigateToTab('home')}>
            {activeTab === 'home' && <HomeDashboardView onNavigate={(tab) => navigateToTab(tab)} />}
            {activeTab === 'branches' &&
              (canManageInstitutionsAndBranches ? (
                <BranchesView />
              ) : (
                <HomeDashboardView onNavigate={(tab) => navigateToTab(tab)} />
              ))}
            {activeTab === 'installations' &&
              (isModulePermitted('installations', user, company) ? (
                <InstallationsView />
              ) : (
                <HomeDashboardView onNavigate={(tab) => navigateToTab(tab)} />
              ))}
            {activeTab === 'services' &&
              (isModulePermitted('services', user, company) ? (
                <ServicesView />
              ) : (
                <HomeDashboardView onNavigate={(tab) => navigateToTab(tab)} />
              ))}
            {activeTab === 'notes' &&
              (isModulePermitted('notes', user, company) ? (
                <NotesView />
              ) : (
                <HomeDashboardView onNavigate={(tab) => navigateToTab(tab)} />
              ))}
            {activeTab === 'personal_notes' &&
              (isModulePermitted('personal_notes', user, company) ? (
                <PersonalNotesView />
              ) : (
                <HomeDashboardView onNavigate={(tab) => navigateToTab(tab)} />
              ))}
            {activeTab === 'staff_tracking' &&
              (isModulePermitted('staff_tracking', user, company) ? (
                <StaffTrackingView />
              ) : (
                <HomeDashboardView onNavigate={(tab) => navigateToTab(tab)} />
              ))}
            {activeTab === 'job_applications' &&
              (isModulePermitted('job_applications', user, company) ? (
                <JobApplicationsView />
              ) : (
                <HomeDashboardView onNavigate={(tab) => navigateToTab(tab)} />
              ))}
            {activeTab === 'timed_follow_ups' &&
              (isModulePermitted('timed_follow_ups', user, company) ? (
                <TimedFollowUpsView />
              ) : (
                <HomeDashboardView onNavigate={(tab) => navigateToTab(tab)} />
              ))}
            {activeTab === 'reminders' &&
              (isModulePermitted('reminders', user, company) ? (
                <RemindersView />
              ) : (
                <HomeDashboardView onNavigate={(tab) => navigateToTab(tab)} />
              ))}
            {activeTab === 'returns' &&
              (isModulePermitted('returns', user, company) ? (
                <ReturnWarrantyView />
              ) : (
                <HomeDashboardView onNavigate={(tab) => navigateToTab(tab)} />
              ))}
            {activeTab === 'logs' &&
              (isModulePermitted('logs', user, company) ? (
                <SecurityLogsView />
              ) : (
                <HomeDashboardView onNavigate={(tab) => navigateToTab(tab)} />
              ))}
            {activeTab === 'template' &&
              (isModulePermitted('template', user, company) ? (
                <TemplateView />
              ) : (
                <HomeDashboardView onNavigate={(tab) => navigateToTab(tab)} />
              ))}
          </ErrorBoundary>
        </main>
      </div>

      {/* 3. Right Live Summary & Map Panel (Desktop xl/2xl) */}
      {activeTab === 'installations' && isModulePermitted('installations', user, company) && (
        <RightSummaryPanel
          selectedLocation={previewLocation}
          onOpenDetailModal={handleOpenDetailModal}
        />
      )}

      {/* Quick Modal Trigger from Right Panel */}
      <LocationDetailModal
        location={previewLocation}
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        onDelete={() => {
          if (previewLocation) {
            deleteLocation(previewLocation.id);
            handleCloseDetailModal();
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
            navigateToTab(activeToast.tab);
          } else {
            navigateToTab('notes');
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
  const isPusula = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('pusula');
  if (isPusula) {
    return <PublicSalarySlipViewer />;
  }

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
