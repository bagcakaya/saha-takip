import React, { useMemo, useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Building2,
  X,
  Filter,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Hourglass,
  MapPin,
} from 'lucide-react';
import { useStorage } from '../context/StorageContext';
import { LocationCard } from '../components/installations/LocationCard';
import { AddLocationModal } from '../components/installations/AddLocationModal';
import { LocationDetailModal } from '../components/installations/LocationDetailModal';
import { LocationItem } from '../types/storage';
import { useAuth } from '../context/AuthContext';
import { isUserAdmin } from '../types/auth';

export type LocationFilterType =
  | 'all'
  | 'in_progress'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'with_location';

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
  const isAdmin = isUserAdmin(currentUser);

  const currentCompanyCode = useMemo(() => {
    return (currentUser?.companyCode || 'POLATLAR').trim().toUpperCase();
  }, [currentUser?.companyCode]);

  const companyUsers = useMemo(() => {
    if (!users || users.length === 0) return [];
    return users.filter(
      (u) => (u.companyCode || 'POLATLAR').trim().toUpperCase() === currentCompanyCode
    );
  }, [users, currentCompanyCode]);

  const [searchQuery, setSearchQuery] = useState('');
  const filterStorageKey = `@saha_takip_installations_active_filter_${currentUser?.id || 'default'}`;

  const [activeFilter, setActiveFilterState] = useState<LocationFilterType>(() => {
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlFilter = urlParams.get('filter');
        if (
          urlFilter &&
          ['all', 'in_progress', 'pending_approval', 'approved', 'rejected', 'with_location'].includes(urlFilter)
        ) {
          return urlFilter as LocationFilterType;
        }

        const saved = localStorage.getItem(filterStorageKey);
        if (
          saved &&
          ['all', 'in_progress', 'pending_approval', 'approved', 'rejected', 'with_location'].includes(saved)
        ) {
          return saved as LocationFilterType;
        }
      } catch {
        // ignore
      }
    }
    return 'all';
  });

  const setActiveFilter = (filter: LocationFilterType) => {
    setActiveFilterState(filter);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(filterStorageKey, filter);
      } catch {
        // ignore
      }
    }
  };

  // Listen for global deep link filter change events
  useEffect(() => {
    const handleFilterChange = (e: any) => {
      const newFilter = e?.detail?.filter;
      if (
        newFilter &&
        ['all', 'in_progress', 'pending_approval', 'approved', 'rejected', 'with_location'].includes(newFilter)
      ) {
        setActiveFilter(newFilter as LocationFilterType);
      }
    };
    window.addEventListener('saha:set-installations-filter' as any, handleFilterChange);
    return () => {
      window.removeEventListener('saha:set-installations-filter' as any, handleFilterChange);
    };
  }, [filterStorageKey]);

  const [selectedCreatorId, setSelectedCreatorId] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  // Filter counts for pills
  const counts = useMemo(() => {
    let inProgressCount = 0;
    let pendingApprovalCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;

    locations.forEach((loc) => {
      if (loc.status === 'pending_approval') {
        pendingApprovalCount++;
      } else if (loc.status === 'approved') {
        approvedCount++;
      } else if (loc.status === 'rejected') {
        rejectedCount++;
      } else {
        inProgressCount++;
      }
    });

    return {
      inProgressCount,
      pendingApprovalCount,
      approvedCount,
      rejectedCount,
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
      if (activeFilter === 'pending_approval') return loc.status === 'pending_approval';
      if (activeFilter === 'approved') return loc.status === 'approved';
      if (activeFilter === 'rejected') return loc.status === 'rejected';
      if (activeFilter === 'in_progress') return !loc.status || loc.status === 'pending';
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
    <div className="space-y-5 pb-10 animate-in fade-in duration-200">
      {/* Search, Filter Pills & Add Button Toolbar */}
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
          {isAdmin && companyUsers.length > 1 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <User className="w-4 h-4 text-slate-400" />
              <select
                value={selectedCreatorId}
                onChange={(e) => setSelectedCreatorId(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tüm Personeller</option>
                {companyUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({isUserAdmin(u) ? 'Yönetici' : 'Saha Yetkilisi'})
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
            className={`px-3 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Tümü ({locations.length})
          </button>

          <button
            onClick={() => setActiveFilter('in_progress')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer ${
              activeFilter === 'in_progress'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>Devam Edenler ({counts.inProgressCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter('pending_approval')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer ${
              activeFilter === 'pending_approval'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60 hover:bg-amber-100'
            }`}
          >
            <Hourglass className="w-3.5 h-3.5 text-amber-500" />
            <span>Onay Bekleyenler ({counts.pendingApprovalCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter('approved')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer ${
              activeFilter === 'approved'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Onaylananlar ({counts.approvedCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter('rejected')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer ${
              activeFilter === 'rejected'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/60 hover:bg-rose-100'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>Reddedilenler ({counts.rejectedCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter('with_location')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer ${
              activeFilter === 'with_location'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-indigo-400" />
            <span>Konumlu ({counts.withLocationCount})</span>
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
              : 'Henüz kayıtlı bir kurulum yeri yok'}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm max-w-sm mx-auto mb-6">
            {searchQuery
              ? 'Farklı arama terimleri deneyebilir veya filtreleri temizleyebilirsiniz.'
              : 'Yeni bir kurulum yeri ekleyerek görev listesini takip etmeye başlayın.'}
          </p>
          {!searchQuery && activeFilter === 'all' && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>İlk Kurulumu Ekle</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {filteredLocations.map((location) => (
            <LocationCard
              key={location.id}
              location={location}
              onClick={() => setSelectedLocationId(location.id)}
              onDelete={() => deleteLocation(location.id)}
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
        isOpen={Boolean(selectedLocationId)}
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
        onDeleteCustomTask={(taskId) => {
          if (selectedLocationId) {
            deleteCustomTaskFromLocation(selectedLocationId, taskId);
          }
        }}
        onUpdateDetails={(address, notes, lat, lon, name) => {
          if (selectedLocationId) {
            updateLocationDetails(selectedLocationId, address, notes, lat, lon, name);
          }
        }}
        onAddPhoto={(photo) => {
          if (selectedLocationId) {
            addPhotoToLocation(selectedLocationId, photo);
          }
        }}
        onDeletePhoto={(photo) => {
          if (selectedLocationId) {
            deletePhotoFromLocation(selectedLocationId, photo);
          }
        }}
      />
    </div>
  );
};
