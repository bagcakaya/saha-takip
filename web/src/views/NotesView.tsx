import React, { useMemo, useState } from 'react';
import {
  Plus,
  ClipboardList,
  Search,
  X,
  Bell,
  Mail,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  CheckCheck,
  CheckSquare,
  Loader2,
  Send,
} from 'lucide-react';
import { useStorage } from '../context/StorageContext';
import { NoteCard } from '../components/notes/NoteCard';
import { NoteModal } from '../components/notes/NoteModal';
import { GeneralNote, NoteTargetMode } from '../types/storage';
import { useAuth } from '../context/AuthContext';
import { isUserAdmin } from '../types/auth';

export const NotesView: React.FC = () => {
  const {
    notes,
    isLoading,
    addNote,
    updateNote,
    deleteNote,
    approveMultipleNotes,
    completeMultipleNotes,
  } = useStorage();
  const { user: currentUser } = useAuth();
  const isAdmin = isUserAdmin(currentUser);

  const [searchQuery, setSearchQuery] = useState('');

  type NoteFilterType = 'all' | 'pending' | 'approved' | 'rejected' | 'reminders' | 'direct';
  const filterStorageKey = `@saha_takip_notes_active_filter_${currentUser?.id || 'default'}`;

  const [activeFilter, setActiveFilterState] = useState<NoteFilterType>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(
          `@saha_takip_notes_active_filter_${currentUser?.id || 'default'}`
        );
        if (
          saved &&
          ['all', 'pending', 'approved', 'rejected', 'reminders', 'direct'].includes(saved)
        ) {
          return saved as NoteFilterType;
        }
      } catch {
        // ignore
      }
    }
    return 'all';
  });

  const setActiveFilter = (filter: NoteFilterType) => {
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
  React.useEffect(() => {
    const handleFilterChange = (e: any) => {
      const newFilter = e?.detail?.filter;
      if (
        newFilter &&
        ['all', 'pending', 'approved', 'rejected', 'reminders', 'direct'].includes(newFilter)
      ) {
        setActiveFilter(newFilter as NoteFilterType);
      }
    };
    window.addEventListener('saha:set-notes-filter' as any, handleFilterChange);
    return () => {
      window.removeEventListener('saha:set-notes-filter' as any, handleFilterChange);
    };
  }, [filterStorageKey]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<GeneralNote | null>(null);

  // Bulk Actions & Multi-selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [isBulkCompleteModalOpen, setIsBulkCompleteModalOpen] = useState(false);
  const [bulkCompletionNote, setBulkCompletionNote] = useState('');

  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      // 1. Onaylananlar sekmesinde en son onaylanan iş emri en üstte
      if (activeFilter === 'approved') {
        const aAppr = a.approvedAt || a.completedAt || a.createdAt || 0;
        const bAppr = b.approvedAt || b.completedAt || b.createdAt || 0;
        return bAppr - aAppr;
      }

      // 2. Diğer sekmelerde (Tümü vb.):
      // Onaylanmışsa onay zamanı, bekleyen onay ise tamamlanma zamanı, değilse oluşturulma zamanı
      const aTime =
        a.status === 'approved' && a.approvedAt
          ? a.approvedAt
          : a.status === 'pending_approval' && a.completedAt
          ? a.completedAt
          : a.createdAt || 0;

      const bTime =
        b.status === 'approved' && b.approvedAt
          ? b.approvedAt
          : b.status === 'pending_approval' && b.completedAt
          ? b.completedAt
          : b.createdAt || 0;

      return bTime - aTime;
    });
  }, [notes, activeFilter]);

  const pendingNotesCount = useMemo(() => {
    return notes.filter(
      (n) => !n.status || n.status === 'pending' || n.status === 'pending_approval'
    ).length;
  }, [notes]);

  const pendingApprovalNotes = useMemo(() => {
    return notes.filter((n) => n.status === 'pending_approval');
  }, [notes]);

  const approvedNotesCount = useMemo(() => {
    return notes.filter((n) => n.status === 'approved').length;
  }, [notes]);

  const rejectedNotesCount = useMemo(() => {
    return notes.filter((n) => n.status === 'rejected').length;
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
        (n.cariName && n.cariName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        allTargetNames.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.targetUserName && n.targetUserName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (n.createdByName && n.createdByName.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (activeFilter === 'pending') {
        return !n.status || n.status === 'pending' || n.status === 'pending_approval';
      }
      if (activeFilter === 'approved') {
        return n.status === 'approved';
      }
      if (activeFilter === 'rejected') {
        return n.status === 'rejected';
      }
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

  const selectableNotes = useMemo(() => {
    if (isAdmin) {
      const approvable = filteredNotes.filter(
        (n) => n.status === 'pending_approval' || n.status === 'rejected'
      );
      return approvable.length > 0 ? approvable : filteredNotes;
    }
    const completable = filteredNotes.filter(
      (n) => !n.status || n.status === 'pending' || n.status === 'rejected'
    );
    return completable.length > 0 ? completable : filteredNotes;
  }, [filteredNotes, isAdmin]);

  const handleToggleSelect = (noteId: string) => {
    setSelectedIds((prev) =>
      prev.includes(noteId) ? prev.filter((id) => id !== noteId) : [...prev, noteId]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === selectableNotes.length && selectableNotes.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableNotes.map((n) => n.id));
    }
  };

  const handleApproveAllPending = async () => {
    if (pendingApprovalNotes.length === 0 || isBulkProcessing) return;
    if (
      !window.confirm(
        `Onay bekleyen ${pendingApprovalNotes.length} iş emrinin tümünü onaylamak istediğinize emin misiniz?`
      )
    ) {
      return;
    }
    const idsToApprove = pendingApprovalNotes.map((n) => n.id);
    setIsBulkProcessing(true);
    try {
      await approveMultipleNotes(idsToApprove);
    } catch (err) {
      console.error('Toplu onaylama hatası:', err);
      alert('Toplu onaylama sırasında bir hata oluştu.');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleApproveSelected = async () => {
    if (selectedIds.length === 0 || isBulkProcessing) return;
    if (
      !window.confirm(
        `Seçilen ${selectedIds.length} iş emrini onaylamak istediğinize emin misiniz?`
      )
    ) {
      return;
    }
    const idsToApprove = [...selectedIds];
    setSelectionMode(false);
    setSelectedIds([]);
    setIsBulkProcessing(true);
    try {
      await approveMultipleNotes(idsToApprove);
    } catch (err) {
      console.error('Seçilenleri onaylama hatası:', err);
      alert('İşlem sırasında bir hata oluştu.');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleConfirmBulkComplete = async () => {
    if (selectedIds.length === 0 || isBulkProcessing) return;
    const idsToComplete = [...selectedIds];
    const noteText = bulkCompletionNote.trim() || undefined;
    setIsBulkCompleteModalOpen(false);
    setBulkCompletionNote('');
    setSelectionMode(false);
    setSelectedIds([]);
    setIsBulkProcessing(true);
    try {
      await completeMultipleNotes(idsToComplete, noteText);
    } catch (err) {
      console.error('Toplu tamamlama hatası:', err);
      alert('Onaya gönderme sırasında bir hata oluştu.');
    } finally {
      setIsBulkProcessing(false);
    }
  };

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
    targetUserNames?: string[],
    photos?: string[],
    cariName?: string
  ) => {
    if (editingNote) {
      await updateNote(
        editingNote.id,
        content,
        reminderActive,
        reminderDate,
        targetMode,
        targetUserIds,
        targetUserNames,
        photos,
        cariName
      );
    } else {
      await addNote(
        content,
        reminderActive,
        reminderDate,
        targetMode,
        targetUserIds,
        targetUserNames,
        photos,
        cariName
      );
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
              placeholder="İş emri veya personel adında ara..."
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

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {!selectionMode && (
              <button
                type="button"
                onClick={() => {
                  setSelectionMode(true);
                  if (isAdmin) {
                    const ids = pendingApprovalNotes.map((n) => n.id);
                    setSelectedIds(ids.length > 0 ? ids : selectableNotes.map((n) => n.id));
                  } else {
                    const completable = filteredNotes
                      .filter((n) => !n.status || n.status === 'pending' || n.status === 'rejected')
                      .map((n) => n.id);
                    setSelectedIds(completable);
                  }
                }}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold text-xs sm:text-sm shadow-xs transition-all active:scale-95 cursor-pointer"
                title="Birden fazla iş emrini seçerek işlem yapın"
              >
                <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>{isAdmin ? 'Toplu Seçim' : 'Toplu Onaya Gönder'}</span>
              </button>
            )}

            {/* New Note Button */}
            <button
              onClick={handleOpenAdd}
              className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Yeni İş Emri Ekle</span>
            </button>
          </div>
        </div>

        {/* Filter Pills with Approval/Pending/Rejected categories */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/60 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeFilter === 'all'
                ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Tüm İş Emirleri ({notes.length})
          </button>

          <button
            onClick={() => setActiveFilter('pending')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeFilter === 'pending'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/40'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Bekleyenler ({pendingNotesCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter('approved')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeFilter === 'approved'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Onaylananlar ({approvedNotesCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter('rejected')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeFilter === 'rejected'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/40'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Reddedilenler ({rejectedNotesCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter('reminders')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeFilter === 'reminders'
                ? 'bg-indigo-600 text-white shadow-xs'
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
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {isAdmin ? <Users className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
              <span>
                {isAdmin
                  ? `Personele Atanan İş Emirleri (${directNotesCount})`
                  : `Bana Atanan İş Emirleri (${directNotesCount})`}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Admin Quick Approval Banner */}
      {isAdmin && pendingApprovalNotes.length > 0 && !selectionMode && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-950 dark:text-amber-100 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black">
                Onay Bekleyen {pendingApprovalNotes.length} İş Emri Var
              </div>
              <div className="text-xs text-amber-700 dark:text-amber-300">
                Personellerin tamamladığı iş emirlerini tek tuşla topluca onaylayabilir veya seçerek inceleyebilirsiniz.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              disabled={isBulkProcessing}
              onClick={handleApproveAllPending}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              {isBulkProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCheck className="w-4 h-4" />
              )}
              <span>Tümünü Onayla ({pendingApprovalNotes.length})</span>
            </button>
            <button
              onClick={() => {
                setSelectionMode(true);
                setSelectedIds(pendingApprovalNotes.map((n) => n.id));
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100/50 dark:hover:bg-amber-900/40 text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              <CheckSquare className="w-4 h-4" />
              <span>Kutucuklarla Seç</span>
            </button>
          </div>
        </div>
      )}

      {/* Active Selection Mode Bar */}
      {selectionMode && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border-2 border-blue-500 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100">
                Toplu İşlem Modu: {selectedIds.length} / {selectableNotes.length} seçildi
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Kartların sol üstündeki kutucukları işaretleyerek işlemi tamamlayın.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={handleToggleSelectAll}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
            >
              {selectedIds.length === selectableNotes.length && selectableNotes.length > 0
                ? 'Seçimi Bırak'
                : 'Tümünü Seç'}
            </button>

            {isAdmin ? (
              <button
                disabled={selectedIds.length === 0 || isBulkProcessing}
                onClick={handleApproveSelected}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                {isBulkProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCheck className="w-4 h-4" />
                )}
                <span>Seçilenleri Onayla ({selectedIds.length})</span>
              </button>
            ) : (
              <button
                disabled={selectedIds.length === 0 || isBulkProcessing}
                onClick={() => setIsBulkCompleteModalOpen(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Seçilenleri Onaya Gönder ({selectedIds.length})</span>
              </button>
            )}

            <button
              onClick={() => {
                setSelectionMode(false);
                setSelectedIds([]);
              }}
              className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-all cursor-pointer"
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {/* Notes Grid (Responsive 1/2/3 columns) */}
      {isLoading ? (
        <div className="text-center py-20 text-slate-400 text-sm">Yükleniyor...</div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-8 max-w-xl mx-auto shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center mx-auto mb-4 text-blue-500">
            <ClipboardList className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-1.5">
            {searchQuery
              ? 'Aramayla eşleşen iş emri bulunamadı'
              : activeFilter === 'pending'
              ? 'Bekleyen iş emri bulunmuyor'
              : activeFilter === 'approved'
              ? 'Henüz onaylanan iş emri bulunmuyor'
              : activeFilter === 'rejected'
              ? 'Reddedilen iş emri bulunmuyor'
              : activeFilter === 'reminders'
              ? 'Henüz kurulmuş bir hatırlatıcı yok'
              : activeFilter === 'direct'
              ? 'Henüz bu filtrede iş emri bulunmuyor'
              : 'Henüz iş emri eklenmedi'}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-5">
            {searchQuery
              ? 'Lütfen arama teriminizi kontrol edin.'
              : activeFilter === 'pending'
              ? 'Tüm iş emirleri tamamlanmış veya onaylanmış durumdadır.'
              : activeFilter === 'approved'
              ? 'Personel tarafından tamamlanan ve yönetici tarafından onaylanan işler burada listelenir.'
              : activeFilter === 'rejected'
              ? 'Yönetici tarafından eksik görülerek reddedilen iş emirleri burada listelenir.'
              : 'Kendiniz için iş emri oluşturabilir veya personele iş emri atayabilirsiniz.'}
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
              {activeFilter !== 'all' || searchQuery ? 'Filtreyi Temizle' : 'İlk İş Emrini Ekle'}
            </span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              selectionMode={selectionMode}
              isSelected={selectedIds.includes(note.id)}
              onToggleSelect={() => handleToggleSelect(note.id)}
              onEdit={() => {
                if (isAdmin || note.createdBy === currentUser?.id) {
                  handleOpenEdit(note);
                }
              }}
              onDelete={() => {
                if (!isAdmin && note.createdBy !== currentUser?.id) {
                  alert(
                    'Bu iş emri yönetici tarafından eklenmiştir. Yalnızca oluşturan yetkili silebilir.'
                  );
                  return;
                }
                if (window.confirm('Bu iş emrini silmek istediğinize emin misiniz?')) {
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

      {/* Bulk Complete Modal for Staff */}
      {isBulkCompleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-black text-base">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span>Toplu Onaya Gönder ({selectedIds.length} İş Emri)</span>
              </div>
              <button
                onClick={() => setIsBulkCompleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Seçtiğiniz {selectedIds.length} adet iş emri yönetici onayına sunulacaktır. İsteğe bağlı olarak ortak bir tamamlama açıklaması ekleyebilirsiniz.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Tamamlama Açıklaması (İsteğe Bağlı)
              </label>
              <textarea
                value={bulkCompletionNote}
                onChange={(e) => setBulkCompletionNote(e.target.value)}
                rows={3}
                placeholder="Örn: Belirtilen kurulumlar eksiksiz tamamlandı..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none font-medium"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkCompleteModalOpen(false)}
                disabled={isBulkProcessing}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkComplete}
                disabled={isBulkProcessing}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isBulkProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>{isBulkProcessing ? 'Gönderiliyor...' : 'Onaya Gönder'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
