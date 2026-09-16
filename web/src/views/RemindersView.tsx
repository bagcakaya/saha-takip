import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  X,
  Bell,
  BookOpen,
  AlertTriangle,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { useStorage } from '../context/StorageContext';
import { useAuth } from '../context/AuthContext';
import { isUserAdmin } from '../types/auth';
import { ReminderCard } from '../components/reminders/ReminderCard';
import { ReminderModal } from '../components/reminders/ReminderModal';
import { AdminReminder, AdminReminderCategory } from '../types/storage';

export const RemindersView: React.FC = () => {
  const {
    adminReminders,
    addAdminReminder,
    updateAdminReminder,
    deleteAdminReminder,
    markReminderAsRead,
  } = useStorage();
  const { user } = useAuth();
  const isAdmin = isUserAdmin(user);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AdminReminderCategory | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<AdminReminder | null>(null);

  // Sorting: Pinned first, then newest
  const sortedReminders = useMemo(() => {
    return [...adminReminders].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.createdAt - a.createdAt;
    });
  }, [adminReminders]);

  // Filtering
  const filteredReminders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return sortedReminders.filter((rem) => {
      const matchCat = selectedCategory === 'all' || rem.category === selectedCategory;
      const matchText =
        !q ||
        rem.title.toLowerCase().includes(q) ||
        rem.content.toLowerCase().includes(q) ||
        (rem.createdByName && rem.createdByName.toLowerCase().includes(q));
      return matchCat && matchText;
    });
  }, [sortedReminders, searchQuery, selectedCategory]);

  const unreadCount = useMemo(() => {
    if (!user?.id || isAdmin) return 0;
    return adminReminders.filter((r) => !r.readBy?.includes(user.id)).length;
  }, [adminReminders, user, isAdmin]);

  const handleOpenAdd = () => {
    setEditingReminder(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (reminder: AdminReminder) => {
    setEditingReminder(reminder);
    setIsModalOpen(true);
  };

  const handleSaveReminder = async (data: {
    title: string;
    content: string;
    category?: AdminReminderCategory;
    isPinned?: boolean;
    photos?: string[];
    sendPush?: boolean;
  }) => {
    if (editingReminder) {
      await updateAdminReminder(editingReminder.id, data);
    } else {
      await addAdminReminder(data);
    }
  };

  const categoryFilters: { key: AdminReminderCategory | 'all'; label: string; icon: any }[] = [
    { key: 'all', label: 'Tümü', icon: Bell },
    { key: 'procedure', label: 'Prosedürler', icon: BookOpen },
    { key: 'rule', label: 'Kurallar', icon: AlertTriangle },
    { key: 'urgent', label: 'Acil Uyarılar', icon: ShieldAlert },
    { key: 'general', label: 'Genel', icon: Info },
  ];

  return (
    <div className="space-y-5 pb-12 animate-in fade-in duration-300 max-w-5xl mx-auto">
      {/* Top Banner: Description */}
      <div className="rounded-3xl bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 p-5 sm:p-6 text-white border border-indigo-800 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-indigo-500/25 text-indigo-300 border border-indigo-400/30">
              Yönetici Talimatları & Duyuruları
            </span>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Hatırlatmalar & Çalışma Kuralları 📌
            </h2>
            <p className="text-xs sm:text-sm text-indigo-200/90 leading-relaxed max-w-2xl">
              Yönetici tarafından personele iletilen standart prosedürler, dikkat edilecek noktalar ve iş kuralları.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="px-3.5 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center">
              <span className="text-[10px] font-bold text-indigo-200 block uppercase">Toplam</span>
              <span className="text-base sm:text-lg font-black text-white">{adminReminders.length}</span>
            </div>
            {!isAdmin && (
              <div className="px-3.5 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center">
                <span className="text-[10px] font-bold text-indigo-200 block uppercase">Okunmamış</span>
                <span className={`text-base sm:text-lg font-black ${unreadCount > 0 ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`}>
                  {unreadCount}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar: Search & Category Pills & Add Button */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 rounded-3xl shadow-xs">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Talimat, kural veya yönetici ara..."
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
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

          {/* Add Button (Admin Only) */}
          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 active:from-indigo-800 active:to-blue-800 text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Talimat / Hatırlatma Ekle</span>
            </button>
          )}
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 px-1 scrollbar-none">
          {categoryFilters.map((flt) => {
            const Icon = flt.icon;
            const isSelected = selectedCategory === flt.key;
            return (
              <button
                key={flt.key}
                type="button"
                onClick={() => setSelectedCategory(flt.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{flt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards List */}
      <div className="space-y-3.5">
        {filteredReminders.length > 0 ? (
          filteredReminders.map((rem) => (
            <ReminderCard
              key={rem.id}
              reminder={rem}
              onEdit={handleOpenEdit}
              onDelete={deleteAdminReminder}
              onMarkAsRead={markReminderAsRead}
            />
          ))
        ) : (
          <div className="p-8 sm:p-12 text-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/40 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
              <Bell className="w-6 h-6" />
            </div>
            <h4 className="text-base font-black text-slate-900 dark:text-slate-100">
              {searchQuery ? 'Aramanızla Eşleşen Talimat Bulunamadı' : 'Henüz Hatırlatma / Talimat Eklenmemiş'}
            </h4>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {isAdmin
                ? 'Yöneticiler buradan personele çalışma prosedürleri, kurallar ve yönergeler yayınlayabilir.'
                : 'Yöneticiniz tarafından yeni bir talimat yayınlandığında burada görüntülenecektir.'}
            </p>
            {isAdmin && !searchQuery && (
              <button
                type="button"
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>İlk Talimatı Ekle</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <ReminderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingReminder={editingReminder}
        onSave={handleSaveReminder}
      />
    </div>
  );
};
