import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StickyNote,
  Plus,
  Pin,
  Trash2,
  Calendar,
  Clock,
  Search,
  Check,
  Lock,
  Palette,
  X,
  Sparkles,
} from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';
import { PersonalNote, PersonalNoteColor } from '../../types/storage';

const COLOR_STYLES: Record<
  PersonalNoteColor,
  {
    card: string;
    badge: string;
    border: string;
    dot: string;
    title: string;
  }
> = {
  amber: {
    card: 'bg-amber-50/90 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50',
    badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200',
    border: 'border-amber-400',
    dot: 'bg-amber-400',
    title: 'Sarı',
  },
  blue: {
    card: 'bg-blue-50/90 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50',
    badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200',
    border: 'border-blue-400',
    dot: 'bg-blue-400',
    title: 'Mavi',
  },
  emerald: {
    card: 'bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50',
    badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200',
    border: 'border-emerald-400',
    dot: 'bg-emerald-400',
    title: 'Yeşil',
  },
  purple: {
    card: 'bg-purple-50/90 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/50',
    badge: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200',
    border: 'border-purple-400',
    dot: 'bg-purple-400',
    title: 'Mor',
  },
  rose: {
    card: 'bg-rose-50/90 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50',
    badge: 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200',
    border: 'border-rose-400',
    dot: 'bg-rose-400',
    title: 'Kırmızı',
  },
  slate: {
    card: 'bg-slate-50/90 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800',
    badge: 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
    border: 'border-slate-400',
    dot: 'bg-slate-400',
    title: 'Gri',
  },
};

// Tek bir not kartı - Tamamen Butonsuz ve Doğrudan Metin Üzerinden İnline Düzenlenebilir
interface SingleNoteCardProps {
  note: PersonalNote;
  onUpdate: (id: string, updates: Partial<PersonalNote>) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
}

const SingleNoteCard: React.FC<SingleNoteCardProps> = ({
  note,
  onUpdate,
  onDelete,
  onTogglePin,
}) => {
  const [localTitle, setLocalTitle] = useState(note.title || '');
  const [localContent, setLocalContent] = useState(note.content || '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [remDate, setRemDate] = useState(note.reminderDate || '');
  const [remTime, setRemTime] = useState(note.reminderTime || '');

  const debounceTimerRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize textarea to fit text naturally
  const autoResizeTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 68)}px`;
    }
  };

  useEffect(() => {
    setLocalTitle(note.title || '');
    setLocalContent(note.content || '');
    setRemDate(note.reminderDate || '');
    setRemTime(note.reminderTime || '');
  }, [note.title, note.content, note.reminderDate, note.reminderTime]);

  useEffect(() => {
    autoResizeTextarea();
  }, [localContent]);

  // Debounced auto-save without ANY button clicks
  const triggerAutoSave = (newTitle: string, newContent: string) => {
    setSaveStatus('saving');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onUpdate(note.id, {
        title: newTitle,
        content: newContent,
      });
      setSaveStatus('saved');
      setTimeout(() => {
        setSaveStatus('idle');
      }, 1400);
    }, 400);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalTitle(val);
    triggerAutoSave(val, localContent);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalContent(val);
    triggerAutoSave(localTitle, val);
  };

  const handleBlur = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    onUpdate(note.id, {
      title: localTitle,
      content: localContent,
    });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 1200);
  };

  const handleColorSelect = (color: PersonalNoteColor) => {
    onUpdate(note.id, { color });
    setShowColorPicker(false);
  };

  const handleSaveReminder = () => {
    onUpdate(note.id, {
      reminderDate: remDate || undefined,
      reminderTime: remTime || undefined,
    });
    setShowReminderPicker(false);
  };

  const handleRemoveReminder = () => {
    setRemDate('');
    setRemTime('');
    onUpdate(note.id, {
      reminderDate: undefined,
      reminderTime: undefined,
    });
    setShowReminderPicker(false);
  };

  // Check if reminder is due or overdue
  const isReminderDue = useMemo(() => {
    if (!note.reminderDate) return false;
    const timeStr = note.reminderTime || '23:59';
    const target = new Date(`${note.reminderDate}T${timeStr}:00`).getTime();
    return !isNaN(target) && Date.now() >= target;
  }, [note.reminderDate, note.reminderTime]);

  const colorScheme = COLOR_STYLES[note.color || 'amber'];

  const formattedReminderDate = useMemo(() => {
    if (!note.reminderDate) return null;
    try {
      const parts = note.reminderDate.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const formatted = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
        return note.reminderTime ? `${formatted}, ${note.reminderTime}` : formatted;
      }
      return note.reminderDate;
    } catch {
      return note.reminderDate;
    }
  }, [note.reminderDate, note.reminderTime]);

  return (
    <div
      className={`group relative rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between ${colorScheme.card} ${
        note.isPinned ? 'ring-2 ring-amber-400/70 shadow-amber-500/10' : ''
      }`}
    >
      {/* Top Header: Pin & Action Bar */}
      <div className="flex items-center justify-between gap-2 mb-2">
        {/* Reminder Badge if exists */}
        {note.reminderDate ? (
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
              isReminderDue
                ? 'bg-rose-500 text-white animate-pulse shadow-sm shadow-rose-500/40'
                : `${colorScheme.badge} border border-black/5 dark:border-white/10`
            }`}
            title="Hatırlatıcı"
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>{formattedReminderDate}</span>
            {isReminderDue && <span className="ml-1 text-[10px] font-black uppercase tracking-wide">(Vakti Geldi!)</span>}
            <button
              type="button"
              onClick={handleRemoveReminder}
              className="ml-1 p-0.5 hover:bg-black/10 dark:hover:bg-white/20 rounded cursor-pointer"
              title="Hatırlatıcıyı Kaldır"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <Lock className="w-3 h-3 text-slate-400/80" />
            <span>Özel Not</span>
          </div>
        )}

        {/* Action icons (Pin, Color, Reminder, Delete) */}
        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          {/* Pin Button */}
          <button
            type="button"
            onClick={() => onTogglePin(note.id)}
            className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
              note.isPinned
                ? 'bg-amber-400/20 text-amber-600 dark:text-amber-400 font-bold'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            title={note.isPinned ? 'Sabitlemeyi Kaldır' : 'Başa Sabitle'}
          >
            <Pin className={`w-3.5 h-3.5 ${note.isPinned ? 'fill-current' : ''}`} />
          </button>

          {/* Color Selector Toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowColorPicker(!showColorPicker);
                setShowReminderPicker(false);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
              title="Not Rengini Değiştir"
            >
              <Palette className="w-3.5 h-3.5" />
            </button>

            {showColorPicker && (
              <div className="absolute right-0 top-8 z-30 p-2 rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 flex gap-1.5">
                {(Object.keys(COLOR_STYLES) as PersonalNoteColor[]).map((cKey) => (
                  <button
                    key={cKey}
                    type="button"
                    onClick={() => handleColorSelect(cKey)}
                    className={`w-5 h-5 rounded-full ${COLOR_STYLES[cKey].dot} border-2 ${
                      note.color === cKey ? 'border-black dark:border-white scale-110' : 'border-transparent'
                    } hover:scale-110 transition cursor-pointer`}
                    title={COLOR_STYLES[cKey].title}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Reminder / Clock Toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowReminderPicker(!showReminderPicker);
                setShowColorPicker(false);
              }}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                note.reminderDate
                  ? 'text-amber-600 dark:text-amber-400 font-bold'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              title="Tarih & Saat Hatırlatıcı Ekle"
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>

            {showReminderPicker && (
              <div className="absolute right-0 top-8 z-30 w-64 p-3 rounded-2xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 space-y-2.5 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 pb-1 border-b border-slate-100 dark:border-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    Hatırlatıcı Ayarla
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowReminderPicker(false)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                    Hatırlatma Tarihi
                  </label>
                  <input
                    type="date"
                    value={remDate}
                    onChange={(e) => setRemDate(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                    Hatırlatma Saati (Opsiyonel)
                  </label>
                  <input
                    type="time"
                    value={remTime}
                    onChange={(e) => setRemTime(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 dark:text-white"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveReminder}
                    className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition cursor-pointer text-center"
                  >
                    Kaydet
                  </button>
                  {note.reminderDate && (
                    <button
                      type="button"
                      onClick={handleRemoveReminder}
                      className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Kaldır
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Delete Button */}
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Bu kişisel notunuzu silmek istediğinize emin misiniz?')) {
                onDelete(note.id);
              }
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
            title="Notu Sil"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* INLINE EDITABLE TITLE (No button needed - just click and type!) */}
      <input
        type="text"
        value={localTitle}
        onChange={handleTitleChange}
        onBlur={handleBlur}
        placeholder="Not Başlığı (Tıkla ve yaz)..."
        className="w-full bg-transparent border-none p-0 text-sm sm:text-base font-bold text-slate-900 dark:text-white placeholder:text-slate-400/70 focus:outline-none focus:ring-0 mb-1.5"
      />

      {/* INLINE EDITABLE CONTENT (No button needed - just click and type!) */}
      <textarea
        ref={textareaRef}
        value={localContent}
        onChange={handleContentChange}
        onBlur={handleBlur}
        rows={2}
        placeholder="Notunuzu buraya yazın..."
        className="w-full bg-transparent border-none p-0 text-xs sm:text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400/60 focus:outline-none focus:ring-0 resize-none leading-relaxed"
      />

      {/* Footer: Live Auto-save indicator & timestamp */}
      <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-black/5 dark:border-white/5 text-[10px] text-slate-400">
        <span>
          {new Date(note.updatedAt || note.createdAt).toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>

        {/* Visual Save Status Indicator */}
        <div className="flex items-center gap-1 font-medium">
          {saveStatus === 'saving' && (
            <span className="text-amber-500 animate-pulse flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
              Kaydediliyor...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-emerald-500 flex items-center gap-1 font-bold animate-in fade-in duration-200">
              <Check className="w-3 h-3" />
              Kaydedildi
            </span>
          )}
          {saveStatus === 'idle' && (
            <span className="text-slate-400 opacity-60">Doğrudan düzenlenir</span>
          )}
        </div>
      </div>
    </div>
  );
};

export const PersonalNotesSection: React.FC = () => {
  const { user } = useAuth();
  const {
    personalNotes,
    addPersonalNote,
    updatePersonalNote,
    deletePersonalNote,
    togglePinPersonalNote,
  } = useStorage();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'pinned' | 'reminders'>('all');
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickContent, setQuickContent] = useState('');
  const [quickColor, setQuickColor] = useState<PersonalNoteColor>('amber');
  const [quickReminderDate, setQuickReminderDate] = useState('');
  const [quickReminderTime, setQuickReminderTime] = useState('');

  const quickInputRef = useRef<HTMLInputElement | null>(null);

  // Filter notes strictly for this logged-in user
  const userNotes = useMemo(() => {
    if (!user?.id) return [];
    return personalNotes.filter((n) => n && n.userId === user.id);
  }, [personalNotes, user?.id]);

  // Apply search and category filter
  const filteredNotes = useMemo(() => {
    let result = [...userNotes];

    // Filter by tab
    if (filterMode === 'pinned') {
      result = result.filter((n) => n.isPinned);
    } else if (filterMode === 'reminders') {
      result = result.filter((n) => Boolean(n.reminderDate));
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (n) =>
          (n.title && n.title.toLowerCase().includes(q)) ||
          (n.content && n.content.toLowerCase().includes(q))
      );
    }

    // Sort: Pinned first, then by updatedAt descending
    result.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
    });

    return result;
  }, [userNotes, filterMode, searchQuery]);

  // Handle Quick Add note
  const handleQuickAdd = async () => {
    if (!quickTitle.trim() && !quickContent.trim()) {
      setIsQuickAdding(false);
      return;
    }

    await addPersonalNote({
      title: quickTitle.trim(),
      content: quickContent.trim(),
      color: quickColor,
      reminderDate: quickReminderDate || undefined,
      reminderTime: quickReminderTime || undefined,
    });

    setQuickTitle('');
    setQuickContent('');
    setQuickReminderDate('');
    setQuickReminderTime('');
    setQuickColor('amber');
    setIsQuickAdding(false);
  };

  const handleCreateEmptyNote = async () => {
    await addPersonalNote({
      title: '',
      content: '',
      color: 'amber',
    });
  };

  return (
    <div id="personal-notes-section" className="rounded-3xl bg-white/70 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 shadow-xl space-y-4">
      {/* 1. Header with Privacy Shield Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400">
              <StickyNote className="w-5 h-5" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Kişisel Notlarım
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              {userNotes.length} Not
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Lock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>
              <strong>Tamamen Gizli:</strong> Bu notlar sadece size özeldir. Yöneticiler dahil başka kimse göremez.
            </span>
          </div>
        </div>

        {/* Quick Add Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsQuickAdding(true);
              setTimeout(() => quickInputRef.current?.focus(), 100);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-bold shadow-md shadow-amber-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Not Ekle</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive Quick Add Expandable Box */}
      {isQuickAdding && (
        <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-700/50 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Yeni Not Yazın
            </span>
            <button
              type="button"
              onClick={() => setIsQuickAdding(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <input
            ref={quickInputRef}
            type="text"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="Not Başlığı..."
            className="w-full text-sm font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />

          <textarea
            value={quickContent}
            onChange={(e) => setQuickContent(e.target.value)}
            rows={3}
            placeholder="Düşüncelerinizi, hatırlanacakları veya müşteri detaylarını yazın..."
            className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
          />

          {/* Quick Options: Color + Reminder */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Renk:</span>
              {(Object.keys(COLOR_STYLES) as PersonalNoteColor[]).map((cKey) => (
                <button
                  key={cKey}
                  type="button"
                  onClick={() => setQuickColor(cKey)}
                  className={`w-4 h-4 rounded-full ${COLOR_STYLES[cKey].dot} border-2 ${
                    quickColor === cKey ? 'border-black dark:border-white scale-125' : 'border-transparent'
                  } hover:scale-110 transition cursor-pointer`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="date"
                  value={quickReminderDate}
                  onChange={(e) => setQuickReminderDate(e.target.value)}
                  className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
                />
                <input
                  type="time"
                  value={quickReminderTime}
                  onChange={(e) => setQuickReminderTime(e.target.value)}
                  className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleQuickAdd}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
              >
                Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Search and Category Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterMode === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Tümü ({userNotes.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('pinned')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              filterMode === 'pinned'
                ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Pin className="w-3 h-3 fill-current" />
            Sabitlenenler ({userNotes.filter((n) => n.isPinned).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('reminders')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              filterMode === 'reminders'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-3 h-3" />
            Hatırlatıcılar ({userNotes.filter((n) => Boolean(n.reminderDate)).length})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Notlarda ara..."
            className="w-full text-xs pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 4. Notes Grid (Interactive, Inline-editable Cards) */}
      {filteredNotes.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-8 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center">
            <StickyNote className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {searchQuery
              ? 'Aradığınız kriterlere uygun not bulunamadı'
              : filterMode !== 'all'
              ? 'Bu filtrede henüz notunuz bulunmuyor'
              : 'Henüz kişisel bir not almadınız'}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Metne doğrudan tıklayarak düzenleyebilir, tarih ve saat hatırlatıcısı ekleyebilirsiniz.
          </p>
          <button
            type="button"
            onClick={handleCreateEmptyNote}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            İlk Notunuzu Yazın
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredNotes.map((note) => (
            <SingleNoteCard
              key={note.id}
              note={note}
              onUpdate={updatePersonalNote}
              onDelete={deletePersonalNote}
              onTogglePin={togglePinPersonalNote}
            />
          ))}
        </div>
      )}
    </div>
  );
};
