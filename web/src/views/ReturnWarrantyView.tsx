import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  X,
  ShieldCheck,
  RotateCcw,
  Clock,
  Hourglass,
  Boxes,
} from 'lucide-react';
import { useStorage } from '../context/StorageContext';
import { ReturnWarrantyCard } from '../components/returns/ReturnWarrantyCard';
import { ReturnWarrantyModal } from '../components/returns/ReturnWarrantyModal';
import { ReturnWarrantyItem } from '../types/storage';

export const ReturnWarrantyView: React.FC = () => {
  const {
    returnWarrantyItems,
    isLoading,
    addReturnWarrantyItem,
    updateReturnWarrantyItem,
    deleteReturnWarrantyItem,
  } = useStorage();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'warranty' | 'return' | 'pending' | 'due'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReturnWarrantyItem | null>(null);

  const sortedItems = useMemo(() => {
    return [...returnWarrantyItems].sort((a, b) => {
      // Pending first, then by sentDate descending
      if (a.status === 'pending' && b.status === 'completed') return -1;
      if (a.status === 'completed' && b.status === 'pending') return 1;
      return new Date(b.sentDate).getTime() - new Date(a.sentDate).getTime();
    });
  }, [returnWarrantyItems]);

  const warrantyCount = useMemo(() => {
    return returnWarrantyItems.filter((i) => i.type === 'warranty').length;
  }, [returnWarrantyItems]);

  const returnCount = useMemo(() => {
    return returnWarrantyItems.filter((i) => i.type === 'return').length;
  }, [returnWarrantyItems]);

  const pendingCount = useMemo(() => {
    return returnWarrantyItems.filter((i) => i.status === 'pending').length;
  }, [returnWarrantyItems]);

  const dueCount = useMemo(() => {
    const now = Date.now();
    return returnWarrantyItems.filter(
      (i) =>
        i.status === 'pending' &&
        i.reminderDate &&
        new Date(i.reminderDate).getTime() <= now
    ).length;
  }, [returnWarrantyItems]);

  const filteredItems = useMemo(() => {
    return sortedItems.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        item.companyName.toLowerCase().includes(q) ||
        (item.serialNumber && item.serialNumber.toLowerCase().includes(q)) ||
        (item.trackingCode && item.trackingCode.toLowerCase().includes(q)) ||
        (item.createdByName && item.createdByName.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (activeFilter === 'warranty') return item.type === 'warranty';
      if (activeFilter === 'return') return item.type === 'return';
      if (activeFilter === 'pending') return item.status === 'pending';
      if (activeFilter === 'due') {
        const now = Date.now();
        return (
          item.status === 'pending' &&
          item.reminderDate &&
          new Date(item.reminderDate).getTime() <= now
        );
      }

      return true;
    });
  }, [sortedItems, searchQuery, activeFilter]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: ReturnWarrantyItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleSave = async (
    data: Omit<ReturnWarrantyItem, 'id' | 'createdAt' | 'createdBy' | 'createdByName'>
  ) => {
    if (editingItem) {
      await updateReturnWarrantyItem(editingItem.id, data);
    } else {
      await addReturnWarrantyItem(data);
    }
  };

  return (
    <div className="space-y-5 pb-10 animate-in fade-in duration-200">
      {/* Search and Toolbar */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-3.5 sm:p-4 shadow-xs border border-slate-200/80 dark:border-slate-700/80 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Firma, seri no, kargo kodu veya personel adında ara..."
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

          {/* New Item Button */}
          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Yeni İade / Garanti Ekle</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/60 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeFilter === 'all'
                ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Tümü ({returnWarrantyItems.length})
          </button>

          <button
            onClick={() => setActiveFilter('warranty')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeFilter === 'warranty'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Garantiler ({warrantyCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter('return')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeFilter === 'return'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>İadeler ({returnCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter('pending')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeFilter === 'pending'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Hourglass className="w-3.5 h-3.5" />
            <span>Süreçte ({pendingCount})</span>
          </button>

          {dueCount > 0 && (
            <button
              onClick={() => setActiveFilter('due')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 animate-pulse ${
                activeFilter === 'due'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 hover:bg-red-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Takip Süresi Dolanlar ({dueCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid of Cards (Responsive 1/2/3 cols) */}
      {isLoading ? (
        <div className="text-center py-20 text-slate-400 text-sm">Yükleniyor...</div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-8 max-w-xl mx-auto shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center mx-auto mb-4 text-blue-500">
            <Boxes className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-1.5">
            {searchQuery
              ? 'Aramayla eşleşen iade / garanti kaydı bulunamadı'
              : activeFilter === 'due'
              ? 'Takip süresi dolan bir kayıt bulunmuyor'
              : 'Henüz iade veya garanti kaydı eklenmedi'}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-5">
            {searchQuery
              ? 'Lütfen arama terimini kontrol edin.'
              : 'Garantiye veya iadeye gönderdiğiniz cihazların seri no ve kargo fişi fotoğraflarını ekleyerek kolayca takip edebilirsiniz.'}
          </p>
          <button
            onClick={() => {
              if (activeFilter !== 'all' || searchQuery) {
                setActiveFilter('all');
                setSearchQuery('');
              } else {
                handleOpenAdd();
              }
            }}
            className="px-5 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>
              {activeFilter !== 'all' || searchQuery ? 'Filtreyi Temizle' : 'İlk Kaydı Ekle'}
            </span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredItems.map((item) => (
            <ReturnWarrantyCard
              key={item.id}
              item={item}
              onEdit={() => handleOpenEdit(item)}
              onDelete={() => {
                if (window.confirm(`${item.companyName} firmasına ait bu kaydı silmek istediğinize emin misiniz?`)) {
                  deleteReturnWarrantyItem(item.id);
                }
              }}
              onToggleStatus={() => {
                const newStatus = item.status === 'completed' ? 'pending' : 'completed';
                updateReturnWarrantyItem(item.id, { status: newStatus });
              }}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <ReturnWarrantyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingItem={editingItem}
        onSave={handleSave}
      />
    </div>
  );
};
