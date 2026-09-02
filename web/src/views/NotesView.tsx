import React, { useMemo, useState } from 'react';
import { Plus, StickyNote, Search, X, Bell, Mail, Users } from 'lucide-react';
import { useStorage } from '../context/StorageContext';
import { NoteCard } from '../components/notes/NoteCard';
import { NoteModal } from '../components/notes/NoteModal';
import { GeneralNote, NoteTargetMode } from '../types/storage';
import { useAuth } from '../context/AuthContext';

export const NotesView: React.FC = () => {
  const { notes, isLoading, addNote, updateNote, deleteNote } = useStorage();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'reminders' | 'direct'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<GeneralNote | null>(null);

  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => b.createdAt - a.createdAt);
  }, [notes]);

  const remindersCount = useMemo(() => {
    return notes.filter((n) => n.reminderActive && n.reminderDate).length;
  }, [notes]);

  const directNotesCount = useMemo(() => {
    if (isAdmin) {
      return notes.filter(
        (n) =>
          n.targetMode === 'custom' ||
          (n.targetUserId && n.targetUserId !== 'self' && n.targetUserId !== 'all')
      ).length;
    }
    return notes.filter(
      (n) =>
        n.createdBy !== currentUser?.id &&
        ((n.targetMode === 'custom' && n.targetUserIds?.includes(currentUser?.id || '')) ||
          n.targetUserId === currentUser?.id)
    ).length;
  }, [notes, isAdmin, currentUser]);

  const filteredNotes = useMemo(() => {
    return sortedNotes.filter((n) => {
      const allTargetNames = (n.targetUserNames || []).join(' ');
      const matchesSearch =
        n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        allTargetNames.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.targetUserName && n.targetUserName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (n.createdByName && n.createdByName.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (activeFilter === 'reminders') {
        return Boolean(n.reminderActive && n.reminderDate);
      }
      if (activeFilter === 'direct') {
        if (isAdmin) {
          return (
            n.targetMode === 'custom' ||
            Boolean(n.targetUserId && n.targetUserId !== 'self' && n.targetUserId !== 'all')
          );
        }
        return (
          n.createdBy !== currentUser?.id &&
          ((n.targetMode === 'custom' && n.targetUserIds?.includes(currentUser?.id || '')) ||
            n.targetUserId === currentUser?.id)
        );
      }

      return true;
    });
  }, [sortedNotes, searchQuery, activeFilter, isAdmin, currentUser]);

  const handleOpenAdd = () => {
    setEditingNote(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (note: GeneralNote) => {
    setEditingNote(note);
    setIsModalOpen(true);
  };

  const handleSave = async (
    content: string,
    reminderActive: boolean,
    reminderDate?: string,
    targetMode?: NoteTargetMode,
    targetUserIds?: string[],
    targetUserNames?: string[]
  ) => {
    if (editingNote) {
      await updateNote(
        editingNote.id,
        content,
        reminderActive,
        reminderDate,
        targetMode,
        targetUserIds,
        targetUserNames
      );
    } else {
      await addNote(
        content,
        reminderActive,
        reminderDate,
        targetMode,
        targetUserIds,
        targetUserNames
      );
    }
  };

  return (
    <div className="space-y-5 pb-24 md:pb-12 animate-in fade-in duration-200">
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
              placeholder="Not veya personel adında ara..."
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

          {/* New Note Button */}
          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Yeni Not Ekle</span>
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
            Tüm Notlar ({notes.length})
          </button>

          <button
            onClick={() => setActiveFilter('reminders')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeFilter === 'reminders'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Alarmlı Hatırlatıcılar ({remindersCount})</span>
          </button>

          {directNotesCount > 0 && (
            <button
              onClick={() => setActiveFilter('direct')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeFilter === 'direct'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {isAdmin ? <Users className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
              <span>{isAdmin ? `Kişi(ler)e Özel Paylaşılanlar (${directNotesCount})` : `Bana Gelen Notlar (${directNotesCount})`}</span>
            </button>
          )}
        </div>
      </div>

      {/* Notes Grid (Responsive 1/2/3 columns) */}
      {isLoading ? (
        <div className="text-center py-20 text-slate-400 text-sm">Yükleniyor...</div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-8 max-w-xl mx-auto shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center mx-auto mb-4 text-blue-500">
            <StickyNote className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-1.5">
            {searchQuery
              ? 'Aramayla eşleşen not bulunamadı'
              : activeFilter === 'reminders'
              ? 'Henüz kurulmuş bir hatırlatıcı yok'
              : activeFilter === 'direct'
              ? 'Henüz bu filtrede not bulunmuyor'
              : 'Henüz not eklenmedi'}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-5">
            {searchQuery
              ? 'Lütfen arama teriminizi kontrol edin.'
              : 'Kendiniz için not alabilir veya seçtiğiniz kişi(ler)le özel not paylaşabilirsiniz.'}
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
              {activeFilter !== 'all' || searchQuery ? 'Filtreyi Temizle' : 'İlk Notu Ekle'}
            </span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={() => {
                if (isAdmin || note.createdBy === currentUser?.id) {
                  handleOpenEdit(note);
                }
              }}
              onDelete={() => {
                if (!isAdmin && note.createdBy !== currentUser?.id) {
                  alert('Bu not yönetici tarafından eklenmiştir. Yalnızca notu ekleyen yetkili silebilir.');
                  return;
                }
                if (window.confirm('Bu notu silmek istediğinize emin misiniz?')) {
                  deleteNote(note.id);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Note Modal */}
      <NoteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingNote={editingNote}
        onSave={handleSave}
      />
    </div>
  );
};
