import React, { useMemo, useState } from 'react';
import { Search, Plus, Building2, X, Filter, User } from 'lucide-react';
import { useStorage } from '../context/StorageContext';
import { StatsCard } from '../components/installations/StatsCard';
import { LocationCard } from '../components/installations/LocationCard';
import { AddLocationModal } from '../components/installations/AddLocationModal';
import { LocationDetailModal } from '../components/installations/LocationDetailModal';
import { LocationItem } from '../types/storage';
import { useAuth } from '../context/AuthContext';

export const InstallationsView: React.FC = () => {
  const {
    locations,
    isLoading,
    addLocation,
    deleteLocation,
    updateTaskStatus,
    addCustomTaskToLocation,
    deleteCustomTaskFromLocation,
    updateLocationDetails,
    addPhotoToLocation,
    deletePhotoFromLocation,
  } = useStorage();

  const { user: currentUser, users } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'in_progress' | 'completed' | 'with_location'>('all');
  const [selectedCreatorId, setSelectedCreatorId] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  // Stats calculation (based on visible locations)
  const stats = useMemo(() => {
    let totalTasks = 0;
    let completedTasks = 0;
    let notPresentTasks = 0;
    let fullyCompletedLocations = 0;
    let inProgressLocations = 0;

    locations.forEach((loc) => {
      let locCompleted = 0;
      let locNotPresent = 0;
      loc.tasks.forEach((task) => {
        totalTasks++;
        if (task.status === 'completed') {
          completedTasks++;
          locCompleted++;
        }
        if (task.status === 'not_present') {
          notPresentTasks++;
          locNotPresent++;
        }
      });

      if (loc.tasks.length > 0 && locCompleted + locNotPresent === loc.tasks.length) {
        fullyCompletedLocations++;
      } else {
        inProgressLocations++;
      }
    });

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const notPresentRate = totalTasks > 0 ? Math.round((notPresentTasks / totalTasks) * 100) : 0;

    return {
      totalLocations: locations.length,
      completionRate,
      notPresentRate,
      fullyCompletedLocations,
      inProgressLocations,
      withLocationCount: locations.filter(
        (l) => Boolean(l.address?.trim() || (l.latitude && l.longitude))
      ).length,
    };
  }, [locations]);

  // Filtered locations (Search + Tab + Creator)
  const filteredLocations = useMemo(() => {
    return locations.filter((loc) => {
      // 1. Creator filter (for Admin)
      if (isAdmin && selectedCreatorId !== 'all') {
        if (loc.createdBy !== selectedCreatorId) return false;
      }

      // 2. Search Query
      const matchesSearch =
        loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (loc.address && loc.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (loc.createdByName && loc.createdByName.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // 3. Tab Filter
      if (activeFilter === 'all') return true;

      const total = loc.tasks.length;
      const completed = loc.tasks.filter((t) => t.status === 'completed').length;
      const notPresent = loc.tasks.filter((t) => t.status === 'not_present').length;
      const isDone = total > 0 && completed + notPresent === total;

      if (activeFilter === 'completed') return isDone;
      if (activeFilter === 'in_progress') return !isDone;
      if (activeFilter === 'with_location') {
        return Boolean(loc.address?.trim() || (loc.latitude && loc.longitude));
      }

      return true;
    });
  }, [locations, searchQuery, activeFilter, selectedCreatorId, isAdmin]);

  const selectedLocation: LocationItem | null = useMemo(() => {
    if (!selectedLocationId) return null;
    return locations.find((l) => l.id === selectedLocationId) || null;
  }, [locations, selectedLocationId]);

  return (
    <div className="space-y-5 pb-24 md:pb-12 animate-in fade-in duration-200">
      {/* 1. Executive Stats Cards Bar */}
      <StatsCard
        totalLocations={stats.totalLocations}
        completionRate={stats.completionRate}
        notPresentRate={stats.notPresentRate}
        activeFilter={activeFilter}
        onFilterSelect={(f) => {
          if (f === 'completed') setActiveFilter('completed');
          else if (f === 'all') setActiveFilter('all');
        }}
      />

      {/* 2. Search, Filter Pills & Add Button Toolbar */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-3.5 sm:p-4 shadow-xs border border-slate-200/80 dark:border-slate-700/80 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isAdmin
                  ? 'Firma, adres veya personel adı ara...'
                  : 'Kurulum veya adres ara...'
              }
              className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Admin Creator Selector */}
          {isAdmin && users.length > 1 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <User className="w-4 h-4 text-slate-400" />
              <select
                value={selectedCreatorId}
                onChange={(e) => setSelectedCreatorId(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tüm Personeller</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role === 'admin' ? 'Yönetici' : 'Saha Yetkilisi'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* New Location Button */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Yeni Kurulum Ekle</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold pt-1 border-t border-slate-100 dark:border-slate-700/60 scrollbar-none">
          <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1 mr-1 text-[11px] uppercase tracking-wider shrink-0">
            <Filter className="w-3 h-3" /> Filtre:
          </span>

          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl transition-all shrink-0 ${
              activeFilter === 'all'
                ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Tümü ({locations.length})
          </button>

          <button
            onClick={() => setActiveFilter('in_progress')}
            className={`px-3 py-1.5 rounded-xl transition-all shrink-0 ${
              activeFilter === 'in_progress'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Devam Edenler ({stats.inProgressLocations})
          </button>

          <button
            onClick={() => setActiveFilter('completed')}
            className={`px-3 py-1.5 rounded-xl transition-all shrink-0 ${
              activeFilter === 'completed'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Tamamlananlar ({stats.fullyCompletedLocations})
          </button>

          <button
            onClick={() => setActiveFilter('with_location')}
            className={`px-3 py-1.5 rounded-xl transition-all shrink-0 ${
              activeFilter === 'with_location'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Konumlu ({stats.withLocationCount})
          </button>
        </div>
      </div>

      {/* 3. Locations Grid (Responsive 1/2/3 Columns) */}
      {isLoading ? (
        <div className="text-center py-20 text-slate-400 text-sm">Yükleniyor...</div>
      ) : filteredLocations.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-8 max-w-xl mx-auto shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center mx-auto mb-4 text-blue-500">
            <Building2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-1.5">
            {searchQuery
              ? 'Aramayla eşleşen kurulum bulunamadı'
              : activeFilter !== 'all' || selectedCreatorId !== 'all'
              ? 'Bu filtreye uygun kurulum bulunmuyor'
              : !isAdmin
              ? 'Henüz adınıza kayıtlı bir kurulum bulunmuyor'
              : 'Henüz kurulum kaydı eklenmedi'}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-5">
            {searchQuery
              ? 'Lütfen arama terimini kontrol edin veya filtreleri temizleyin.'
              : !isAdmin
              ? 'Yeni bir kurulum ekleyerek kendi saha görev listenizi ve teslim raporlarınızı oluşturabilirsiniz.'
              : 'Yeni bir kurulum yeri ekleyerek görev kontrol listesini, fotoğrafları ve teslim raporunu oluşturabilirsiniz.'}
          </p>
          <button
            onClick={() => {
              if (activeFilter !== 'all' || searchQuery || selectedCreatorId !== 'all') {
                setActiveFilter('all');
                setSelectedCreatorId('all');
                setSearchQuery('');
              } else {
                setIsAddModalOpen(true);
              }
            }}
            className="px-5 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>
              {activeFilter !== 'all' || searchQuery || selectedCreatorId !== 'all'
                ? 'Filtreleri Sıfırla'
                : 'İlk Kurulumu Ekle'}
            </span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredLocations.map((loc) => (
            <LocationCard
              key={loc.id}
              location={loc}
              onClick={() => setSelectedLocationId(loc.id)}
              onDelete={() => {
                if (
                  window.confirm(
                    `"${loc.name}" kurulum kaydını silmek istediğinize emin misiniz?`
                  )
                ) {
                  deleteLocation(loc.id);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Add Location Modal */}
      <AddLocationModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={addLocation}
      />

      {/* Location Detail Modal */}
      <LocationDetailModal
        location={selectedLocation}
        isOpen={Boolean(selectedLocation)}
        onClose={() => setSelectedLocationId(null)}
        onDelete={() => {
          if (selectedLocationId) {
            deleteLocation(selectedLocationId);
            setSelectedLocationId(null);
          }
        }}
        onUpdateStatus={(taskId, status) => {
          if (selectedLocationId) {
            updateTaskStatus(selectedLocationId, taskId, status);
          }
        }}
        onAddCustomTask={(taskName) => {
          if (selectedLocationId) {
            addCustomTaskToLocation(selectedLocationId, taskName);
          }
        }}
        onDeleteCustomTask={(taskId, taskName) => {
          if (
            selectedLocationId &&
            window.confirm(`"${taskName}" görevini silmek istediğinize emin misiniz?`)
          ) {
            deleteCustomTaskFromLocation(selectedLocationId, taskId);
          }
        }}
        onUpdateDetails={(addr, notes, lat, lon, name) => {
          if (selectedLocationId) {
            updateLocationDetails(selectedLocationId, addr, notes, lat, lon, name);
          }
        }}
        onAddPhoto={(photoUrl) => {
          if (selectedLocationId) {
            addPhotoToLocation(selectedLocationId, photoUrl);
          }
        }}
        onDeletePhoto={(photoUrl) => {
          if (selectedLocationId) {
            deletePhotoFromLocation(selectedLocationId, photoUrl);
          }
        }}
      />
    </div>
  );
};
