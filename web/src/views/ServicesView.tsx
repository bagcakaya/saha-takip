import React, { useMemo, useState, useEffect } from 'react';
import {
  Plus,
  Search,
  X,
  Wrench,
  Clock,
  CheckCircle2,
  AlertCircle,
  Hourglass,
} from 'lucide-react';
import { useStorage } from '../context/StorageContext';
import { ServiceCard } from '../components/services/ServiceCard';
import { ServiceModal } from '../components/services/ServiceModal';
import { ServiceItem } from '../types/storage';
import { useAuth } from '../context/AuthContext';

export type ServiceFilterType = 'all' | 'pending' | 'pending_approval' | 'approved' | 'rejected';

export const ServicesView: React.FC = () => {
  const { services, addService, updateService, deleteService, isLoading } = useStorage();
  const { user: currentUser } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);

  const filterStorageKey = `@saha_takip_services_active_filter_${currentUser?.id || 'default'}`;

  const [activeFilter, setActiveFilterState] = useState<ServiceFilterType>(() => {
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlFilter = urlParams.get('filter');
        if (urlFilter && ['all', 'pending', 'pending_approval', 'approved', 'rejected'].includes(urlFilter)) {
          return urlFilter as ServiceFilterType;
        }

        const saved = localStorage.getItem(filterStorageKey);
        if (saved && ['all', 'pending', 'pending_approval', 'approved', 'rejected'].includes(saved)) {
          return saved as ServiceFilterType;
        }
      } catch {
        // ignore
      }
    }
    return 'all';
  });

  const setActiveFilter = (filter: ServiceFilterType) => {
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
        ['all', 'pending', 'pending_approval', 'approved', 'rejected'].includes(newFilter)
      ) {
        setActiveFilter(newFilter as ServiceFilterType);
      }
    };
    window.addEventListener('saha:set-services-filter' as any, handleFilterChange);
    return () => {
      window.removeEventListener('saha:set-services-filter' as any, handleFilterChange);
    };
  }, [filterStorageKey]);

  const sortedServices = useMemo(() => {
    return [...services].sort((a, b) => b.createdAt - a.createdAt);
  }, [services]);

  // Counts
  const pendingServicesCount = useMemo(() => {
    return services.filter((s) => !s.status || s.status === 'pending').length;
  }, [services]);

  const pendingApprovalCount = useMemo(() => {
    return services.filter((s) => s.status === 'pending_approval').length;
  }, [services]);

  const approvedServicesCount = useMemo(() => {
    return services.filter((s) => s.status === 'approved').length;
  }, [services]);

  const rejectedServicesCount = useMemo(() => {
    return services.filter((s) => s.status === 'rejected').length;
  }, [services]);

  // Filter by active tab & search
  const filteredServices = useMemo(() => {
    let list = sortedServices;

    if (activeFilter === 'pending') {
      list = list.filter((s) => !s.status || s.status === 'pending');
    } else if (activeFilter === 'pending_approval') {
      list = list.filter((s) => s.status === 'pending_approval');
    } else if (activeFilter === 'approved') {
      list = list.filter((s) => s.status === 'approved');
    } else if (activeFilter === 'rejected') {
      list = list.filter((s) => s.status === 'rejected');
    }

    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;

    return list.filter((srv) => {
      const matchCompany = srv.companyName.toLowerCase().includes(q);
      const matchCari = srv.cariName ? srv.cariName.toLowerCase().includes(q) : false;
      const matchLocation = srv.location ? srv.location.toLowerCase().includes(q) : false;
      const matchWork = srv.workDone.toLowerCase().includes(q);
      const matchStaff = srv.createdByName ? srv.createdByName.toLowerCase().includes(q) : false;
      return matchCompany || matchCari || matchLocation || matchWork || matchStaff;
    });
  }, [sortedServices, activeFilter, searchQuery]);

  const handleOpenAddModal = () => {
    setEditingService(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (service: ServiceItem) => {
    setEditingService(service);
    setIsModalOpen(true);
  };

  const handleSaveService = async (data: {
    companyName: string;
    cariName?: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    workDone: string;
    date?: string;
    photos?: string[];
  }) => {
    if (editingService) {
      await updateService(editingService.id, data);
    } else {
      await addService(data);
    }
  };

  return (
    <div className="space-y-5 pb-12 animate-in fade-in duration-300 w-full max-w-full overflow-hidden">
      {/* Top Toolbar: Search & Add Button */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 rounded-3xl shadow-xs w-full max-w-full overflow-hidden space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Firma, lokasyon, yapılan iş veya personel ara..."
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all min-w-0"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 active:from-orange-800 active:to-amber-800 text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Servis Ekle</span>
          </button>
        </div>

        {/* Filter Pills with Approval/Pending/Rejected categories */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-slate-900 dark:bg-orange-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Tüm Servisler ({services.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('pending')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeFilter === 'pending'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Beklemede ({pendingServicesCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('pending_approval')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeFilter === 'pending_approval'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/40'
            }`}
          >
            <Hourglass className="w-3.5 h-3.5 text-amber-500" />
            <span>Onay Bekleyenler ({pendingApprovalCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('approved')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeFilter === 'approved'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Onaylananlar ({approvedServicesCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('rejected')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeFilter === 'rejected'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/40'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>Reddedilenler ({rejectedServicesCount})</span>
          </button>
        </div>
      </div>

      {/* Services List / Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          <p className="text-xs text-slate-400">Servis kayıtları yükleniyor...</p>
        </div>
      ) : filteredServices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-full">
          {filteredServices.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onEdit={handleOpenEditModal}
              onDelete={deleteService}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 rounded-3xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shadow-xs">
            <Wrench className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100">
              {searchQuery ? 'Arama Sonucu Bulunamadı' : 'Bu Filtrede Servis Kaydı Yok'}
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery
                ? `"${searchQuery}" aramasıyla eşleşen bir servis kaydı bulunamadı.`
                : activeFilter !== 'all'
                ? 'Seçilen filtre kriterine uygun servis kaydı bulunmuyor.'
                : 'Müşterilerinizde veya sahada yapılan teknik servis ve müdahaleleri kaydetmek için "Yeni Servis Ekle" butonunu kullanabilirsiniz.'}
            </p>
          </div>
          {!searchQuery && activeFilter === 'all' && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>İlk Servisi Ekle</span>
            </button>
          )}
        </div>
      )}

      {/* Service Modal (Add / Edit) */}
      <ServiceModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingService(null);
        }}
        onSave={handleSaveService}
        editingService={editingService}
      />
    </div>
  );
};
