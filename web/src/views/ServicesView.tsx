import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  X,
  Wrench,
} from 'lucide-react';
import { useStorage } from '../context/StorageContext';
import { ServiceCard } from '../components/services/ServiceCard';
import { ServiceModal } from '../components/services/ServiceModal';
import { ServiceItem } from '../types/storage';

export const ServicesView: React.FC = () => {
  const { services, addService, updateService, deleteService, isLoading } = useStorage();

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);

  const sortedServices = useMemo(() => {
    return [...services].sort((a, b) => b.createdAt - a.createdAt);
  }, [services]);

  const filteredServices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return sortedServices;

    return sortedServices.filter((srv) => {
      const matchCompany = srv.companyName.toLowerCase().includes(q);
      const matchLocation = srv.location ? srv.location.toLowerCase().includes(q) : false;
      const matchWork = srv.workDone.toLowerCase().includes(q);
      const matchStaff = srv.createdByName ? srv.createdByName.toLowerCase().includes(q) : false;
      return matchCompany || matchLocation || matchWork || matchStaff;
    });
  }, [sortedServices, searchQuery]);

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
    location?: string;
    latitude?: number;
    longitude?: number;
    workDone: string;
    date?: string;
  }) => {
    if (editingService) {
      await updateService(editingService.id, data);
    } else {
      await addService(data);
    }
  };

  return (
    <div className="space-y-5 pb-12 animate-in fade-in duration-300">
      {/* Top Toolbar: Search & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 rounded-3xl shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Firma, lokasyon, yapılan iş veya personel ara..."
            className="w-full pl-10 pr-9 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
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

        {/* Action Button & Count Badge */}
        <div className="flex items-center gap-2.5 shrink-0 justify-between sm:justify-end">
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200/80 dark:border-orange-900/60 text-xs font-bold">
            <Wrench className="w-3.5 h-3.5" />
            <span>{services.length} Servis</span>
          </div>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 active:from-orange-800 active:to-amber-800 text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Servis Ekle</span>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              {searchQuery ? 'Arama Sonucu Bulunamadı' : 'Henüz Servis Kaydı Eklenmemiş'}
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery
                ? `"${searchQuery}" aramasıyla eşleşen bir servis kaydı bulunamadı.`
                : 'Müşterilerinizde veya sahada yapılan teknik servis ve müdahaleleri kaydetmek için "Yeni Servis Ekle" butonunu kullanabilirsiniz.'}
            </p>
          </div>
          {!searchQuery && (
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
