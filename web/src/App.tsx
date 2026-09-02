import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { StorageProvider, useStorage } from './context/StorageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/layout/Sidebar';
import { RightSummaryPanel } from './components/layout/RightSummaryPanel';
import { Header, TabType } from './components/layout/Header';
import { BottomNav } from './components/layout/BottomNav';
import { InstallationsView } from './views/InstallationsView';
import { NotesView } from './views/NotesView';
import { TemplateView } from './views/TemplateView';
import { LoginView } from './views/LoginView';
import { LocationItem } from './types/storage';
import { LocationDetailModal } from './components/installations/LocationDetailModal';
import { PwaInstallPrompt } from './components/common/PwaInstallPrompt';
import { ToastNotification } from './components/common/ToastNotification';

const MainApp: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('installations');
  const {
    notes,
    activeToast,
    dismissToast,
    deleteLocation,
    updateTaskStatus,
    addCustomTaskToLocation,
    deleteCustomTaskFromLocation,
    updateLocationDetails,
    addPhotoToLocation,
    deletePhotoFromLocation,
  } = useStorage();

  // Selected location for right summary panel preview / detail modal
  const [previewLocation, setPreviewLocation] = useState<LocationItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

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
      case 'installations':
        return {
          subtitle: 'Saha Takip Raporu',
          title: 'Kurulumlar',
        };
      case 'notes':
        return {
          subtitle: 'Not Defteri',
          title: 'Notlar & Hatırlatıcılar',
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
        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-5 lg:py-6">
          {activeTab === 'installations' && <InstallationsView />}
          {activeTab === 'notes' && <NotesView />}
          {activeTab === 'template' && <TemplateView />}
        </main>

        {/* Mobile Bottom Navigation Bar (< md screens) */}
        <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          notesCount={notes.length}
        />
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
          setActiveTab('notes');
          dismissToast();
        }}
      />
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
