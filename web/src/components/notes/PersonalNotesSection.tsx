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
  Bell,
  Loader2,
  Repeat,
} from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';
import { PersonalNote, PersonalNoteColor } from '../../types/storage';
import { NotificationService } from '../../services/notificationService';
import { OneSignalService } from '../../services/oneSignalService';

// Tekrarlı hatırlatıcı etiket metni üretici
export const getRepeatLabel = (repeat?: string, repeatMinutes?: number): string | null => {
  if (!repeat || repeat === 'none' || !repeatMinutes) return null;
  if (repeat === '15m' || repeatMinutes === 15) return '15 Dk';
  if (repeat === '30m' || repeatMinutes === 30) return '30 Dk';
  if (repeat === '1h' || repeatMinutes === 60) return 'Her Saat';
  if (repeat === '2h' || repeatMinutes === 120) return '2 Saat';
  if (repeat === '3h' || repeatMinutes === 180) return '3 Saat';
  if (repeat === '4h' || repeatMinutes === 240) return '4 Saat';
  if (repeat === '6h' || repeatMinutes === 360) return '6 Saat';
  if (repeat === '8h' || repeatMinutes === 480) return '8 Saat';
  if (repeat === '12h' || repeatMinutes === 720) return '12 Saat';
  if (repeat === '24h' || repeatMinutes === 1440) return 'Her Gün';

  if (repeatMinutes % 60 === 0) {
    const hours = repeatMinutes / 60;
    return hours === 24 ? 'Her Gün' : `${hours} Saat`;
  }
  return `${repeatMinutes} Dk`;
};

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
  const [isFocused, setIsFocused] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [remDate, setRemDate] = useState(note.reminderDate || '');
  const [remTime, setRemTime] = useState(note.reminderTime || '');
  const [remRepeat, setRemRepeat] = useState<string>(note.reminderRepeat || 'none');
  const [customRepeatValue, setCustomRepeatValue] = useState<number>(() => {
    if (note.reminderRepeat === 'custom' && note.reminderRepeatMinutes) {
      if (note.reminderRepeatMinutes % 60 === 0 && note.reminderRepeatMinutes <= 1440) {
        return note.reminderRepeatMinutes / 60;
      }
      return note.reminderRepeatMinutes;
    }
    return 1;
  });
  const [customRepeatUnit, setCustomRepeatUnit] = useState<'minutes' | 'hours'>(() => {
    if (note.reminderRepeat === 'custom' && note.reminderRepeatMinutes) {
      if (note.reminderRepeatMinutes % 60 === 0 && note.reminderRepeatMinutes <= 1440) {
        return 'hours';
      }
      return 'minutes';
    }
    return 'hours';
  });

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Anında kayıt takibi için ref'ler
  const lastSavedTitleRef = useRef(note.title || '');
  const lastSavedContentRef = useRef(note.content || '');
  const lastSaveTimeRef = useRef(0);
  const lastCancelTimeRef = useRef(0);

  // Klavyeyi ve odaklanmayı mobilde kesin olarak kapatan yardımcı
  const dismissKeyboard = () => {
    setIsFocused(false);
    if (titleInputRef.current) {
      titleInputRef.current.blur();
    }
    if (textareaRef.current) {
      textareaRef.current.blur();
    }
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  // Auto-resize textarea to fit text naturally
  const autoResizeTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 68)}px`;
    }
  };

  const hasChanges = useMemo(() => {
    // Yeni kaydedilmiş değerlerle birebir aynıysa değişiklik yok
    if (
      localTitle === lastSavedTitleRef.current &&
      localContent === lastSavedContentRef.current
    ) {
      return false;
    }
    return (
      localTitle !== (note.title || '') ||
      localContent !== (note.content || '')
    );
  }, [localTitle, localContent, note.title, note.content]);

  useEffect(() => {
    if (!isFocused && !hasChanges) {
      setLocalTitle(note.title || '');
      setLocalContent(note.content || '');
      lastSavedTitleRef.current = note.title || '';
      lastSavedContentRef.current = note.content || '';
      setRemDate(note.reminderDate || '');
      setRemTime(note.reminderTime || '');
      setRemRepeat(note.reminderRepeat || 'none');
      if (note.reminderRepeat === 'custom' && note.reminderRepeatMinutes) {
        if (note.reminderRepeatMinutes % 60 === 0 && note.reminderRepeatMinutes <= 1440) {
          setCustomRepeatValue(note.reminderRepeatMinutes / 60);
          setCustomRepeatUnit('hours');
        } else {
          setCustomRepeatValue(note.reminderRepeatMinutes);
          setCustomRepeatUnit('minutes');
        }
      }
    }
  }, [note.title, note.content, note.reminderDate, note.reminderTime, note.reminderRepeat, note.reminderRepeatMinutes, isFocused, hasChanges]);

  useEffect(() => {
    autoResizeTextarea();
  }, [localContent]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalTitle(e.target.value);
    setSavedSuccess(false);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalContent(e.target.value);
    setSavedSuccess(false);
  };

  const handleSave = () => {
    const now = Date.now();
    if (now - lastSaveTimeRef.current < 300) return;
    lastSaveTimeRef.current = now;

    const trimmedTitle = localTitle.trim();
    const trimmedContent = localContent.trim();

    // 1. Son kaydedilen değerleri hemen güncelle (hasChanges anında false olsun)
    lastSavedTitleRef.current = trimmedTitle;
    lastSavedContentRef.current = trimmedContent;
    setLocalTitle(trimmedTitle);
    setLocalContent(trimmedContent);

    // 2. Klavyeyi ve odaklanmayı anında kapat
    dismissKeyboard();

    // 3. UI'ı anında "Kaydedildi" durumuna geçir (butonlar yok olur, yeşil onay çıkar)
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 2000);

    // 4. Bulut ve context kaydı (fire-and-forget)
    onUpdate(note.id, {
      title: trimmedTitle,
      content: trimmedContent,
    });
  };

  const handleCancel = () => {
    const now = Date.now();
    if (now - lastCancelTimeRef.current < 300) return;
    lastCancelTimeRef.current = now;

    dismissKeyboard();

    // Eğer bu not yeni oluşturulmuş ve henüz hiç içeriği kaydedilmemiş boş bir notsa,
    // vazgeçince doğrudan silebiliriz (gereksiz boş not kalmasın)
    const isNewEmptyNote = !note.title && !note.content;
    if (isNewEmptyNote) {
      onDelete(note.id);
      return;
    }

    const resetTitle = note.title || '';
    const resetContent = note.content || '';
    lastSavedTitleRef.current = resetTitle;
    lastSavedContentRef.current = resetContent;
    setLocalTitle(resetTitle);
    setLocalContent(resetContent);
    setSavedSuccess(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape' && (isFocused || hasChanges)) {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Kart içindeki butonlara tıklandığında hemen odak durumunu kapatma
    if (cardRef.current && cardRef.current.contains(e.relatedTarget as Node)) {
      return;
    }
    setTimeout(() => {
      if (!hasChanges) {
        setIsFocused(false);
      }
    }, 150);
  };

  const handleColorSelect = (color: PersonalNoteColor) => {
    onUpdate(note.id, { color });
    setShowColorPicker(false);
  };

  const handleSaveReminder = async () => {
    try {
      await NotificationService.requestPermission();
      await OneSignalService.requestPermission();
    } catch (e) {
      console.warn('Permission request error:', e);
    }

    let finalRepeat = remRepeat;
    let finalMinutes: number | undefined = undefined;

    if (remRepeat === '15m') finalMinutes = 15;
    else if (remRepeat === '30m') finalMinutes = 30;
    else if (remRepeat === '1h') finalMinutes = 60;
    else if (remRepeat === '2h') finalMinutes = 120;
    else if (remRepeat === '3h') finalMinutes = 180;
    else if (remRepeat === '4h') finalMinutes = 240;
    else if (remRepeat === '6h') finalMinutes = 360;
    else if (remRepeat === '8h') finalMinutes = 480;
    else if (remRepeat === '12h') finalMinutes = 720;
    else if (remRepeat === '24h') finalMinutes = 1440;
    else if (remRepeat === 'custom') {
      const val = Math.max(1, Number(customRepeatValue) || 1);
      if (customRepeatUnit === 'hours') {
        const clampedHours = Math.min(24, val);
        finalMinutes = clampedHours * 60;
      } else {
        const clampedMins = Math.min(1440, val);
        finalMinutes = clampedMins;
      }
      if (finalMinutes === 1440) {
        finalRepeat = '24h';
      }
    } else {
      finalRepeat = 'none';
      finalMinutes = undefined;
    }

    await onUpdate(note.id, {
      reminderDate: remDate || undefined,
      reminderTime: remTime || undefined,
      reminderRepeat: finalRepeat !== 'none' ? finalRepeat : undefined,
      reminderRepeatMinutes: finalMinutes,
      notified: false,
    });
    setShowReminderPicker(false);
  };

  const handleRemoveReminder = () => {
    setRemDate('');
    setRemTime('');
    setRemRepeat('none');
    onUpdate(note.id, {
      reminderDate: undefined,
      reminderTime: undefined,
      reminderRepeat: undefined,
      reminderRepeatMinutes: undefined,
      notified: false,
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
      ref={cardRef}
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
            {getRepeatLabel(note.reminderRepeat, note.reminderRepeatMinutes) && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/15 text-[10px] font-black tracking-tight">
                <Repeat className="w-2.5 h-2.5 shrink-0 text-amber-600 dark:text-amber-300" />
                <span>{getRepeatLabel(note.reminderRepeat, note.reminderRepeatMinutes)}</span>
              </span>
            )}
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
                if (!showReminderPicker && !remDate) {
                  const future = new Date(Date.now() + 3 * 60 * 60 * 1000);
                  const year = future.getFullYear();
                  const month = String(future.getMonth() + 1).padStart(2, '0');
                  const day = String(future.getDate()).padStart(2, '0');
                  setRemDate(`${year}-${month}-${day}`);
                  const hh = String(future.getHours()).padStart(2, '0');
                  const mm = String(future.getMinutes()).padStart(2, '0');
                  setRemTime(`${hh}:${mm}`);
                }
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
              <div className="absolute right-0 top-8 z-30 w-72 sm:w-80 p-3.5 rounded-2xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 space-y-3 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 pb-1 border-b border-slate-100 dark:border-slate-700">
                  <span className="flex items-center gap-1.5 font-black">
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

                {/* Hatırlatma Tekrarı */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Repeat className="w-3 h-3 text-amber-500" />
                      Hatırlatma Tekrarı
                    </span>
                  </label>
                  <select
                    value={remRepeat}
                    onChange={(e) => setRemRepeat(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 dark:text-white font-medium cursor-pointer"
                  >
                    <option value="none">Tek Seferlik (Tekrar Yok)</option>
                    <option value="15m">15 Dakikada Bir</option>
                    <option value="30m">30 Dakikada Bir</option>
                    <option value="1h">Her Saat (1 Saatte Bir)</option>
                    <option value="2h">2 Saatte Bir</option>
                    <option value="3h">3 Saatte Bir</option>
                    <option value="4h">4 Saatte Bir</option>
                    <option value="6h">6 Saatte Bir</option>
                    <option value="8h">8 Saatte Bir</option>
                    <option value="12h">12 Saatte Bir</option>
                    <option value="24h">Her Gün Aynı Saatte (24 Saat)</option>
                    <option value="custom">Özel Süre Belirle (Dk / Saat)...</option>
                  </select>
                </div>

                {remRepeat === 'custom' && (
                  <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={customRepeatUnit === 'hours' ? 24 : 1440}
                        value={customRepeatValue}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 1);
                          const maxAllowed = customRepeatUnit === 'hours' ? 24 : 1440;
                          setCustomRepeatValue(Math.min(maxAllowed, val));
                        }}
                        className="w-20 text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-center text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <div className="flex-1 flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            setCustomRepeatUnit('minutes');
                            if (customRepeatUnit === 'hours') {
                              setCustomRepeatValue(Math.min(1440, customRepeatValue * 60));
                            }
                          }}
                          className={`flex-1 py-1.5 transition text-center cursor-pointer ${
                            customRepeatUnit === 'minutes'
                              ? 'bg-amber-500 text-white'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          Dakika
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomRepeatUnit('hours');
                            if (customRepeatUnit === 'minutes') {
                              setCustomRepeatValue(Math.min(24, Math.max(1, Math.round(customRepeatValue / 60))));
                            }
                          }}
                          className={`flex-1 py-1.5 transition text-center cursor-pointer ${
                            customRepeatUnit === 'hours'
                              ? 'bg-amber-500 text-white'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          Saat
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-amber-700 dark:text-amber-300/80 font-medium">
                      {customRepeatUnit === 'hours'
                        ? `Maksimum 24 saat seçebilirsiniz. (Her ${customRepeatValue} saatte bir tekrarlanır)`
                        : `Maksimum 1440 dakika (24 saat). (Her ${customRepeatValue} dakikada bir tekrarlanır)`}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveReminder}
                    className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition cursor-pointer text-center shadow-sm"
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

      {/* INLINE EDITABLE TITLE */}
      <input
        ref={titleInputRef}
        type="text"
        value={localTitle}
        onChange={handleTitleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="Not Başlığı (Tıkla ve yaz)..."
        className="w-full bg-transparent border-none p-0 text-sm sm:text-base font-bold text-slate-900 dark:text-white placeholder:text-slate-400/70 focus:outline-none focus:ring-0 mb-1.5"
      />

      {/* INLINE EDITABLE CONTENT */}
      <textarea
        ref={textareaRef}
        value={localContent}
        onChange={handleContentChange}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        rows={2}
        placeholder="Notunuzu buraya yazın..."
        className="w-full bg-transparent border-none p-0 text-xs sm:text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400/60 focus:outline-none focus:ring-0 resize-none leading-relaxed"
      />

      {/* Footer: Date timestamp & Kaydet / Vazgeç Action Buttons */}
      <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-black/5 dark:border-white/5 text-[10px] text-slate-400 min-h-[34px]">
        <span>
          {new Date(note.updatedAt || note.createdAt).toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>

        {/* Action Buttons: Kaydedildi Bildirimi veya Kaydet & Vazgeç Butonları */}
        <div className="flex items-center gap-1.5 font-medium">
          {savedSuccess ? (
            <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1 animate-in fade-in duration-150">
              <Check className="w-3.5 h-3.5" />
              Kaydedildi
            </span>
          ) : isFocused || hasChanges ? (
            <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleCancel();
                }}
                onClick={handleCancel}
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 transition active:scale-95 flex items-center gap-1 cursor-pointer"
                title="Değişikliklerden vazgeç (Esc)"
              >
                <X className="w-3.5 h-3.5" />
                <span>Vazgeç</span>
              </button>

              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleSave();
                }}
                onClick={handleSave}
                className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition shadow-xs flex items-center gap-1 cursor-pointer"
                title="Notu kaydet (Ctrl+Enter)"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Kaydet</span>
              </button>
            </div>
          ) : null}
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
  const [isQuickSaving, setIsQuickSaving] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickContent, setQuickContent] = useState('');
  const [quickColor, setQuickColor] = useState<PersonalNoteColor>('amber');
  const [quickReminderDate, setQuickReminderDate] = useState('');
  const [quickReminderTime, setQuickReminderTime] = useState('');
  const [quickReminderRepeat, setQuickReminderRepeat] = useState<string>('none');
  const [hasPermission, setHasPermission] = useState<boolean>(() => {
    return typeof Notification !== 'undefined' && Notification.permission === 'granted';
  });

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setHasPermission(Notification.permission === 'granted');
    }
  }, []);

  const quickInputRef = useRef<HTMLInputElement | null>(null);
  const quickTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const dismissQuickKeyboard = () => {
    setIsQuickAdding(false);
    if (quickInputRef.current) quickInputRef.current.blur();
    if (quickTextareaRef.current) quickTextareaRef.current.blur();
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

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
      dismissQuickKeyboard();
      return;
    }

    dismissQuickKeyboard();

    try {
      setIsQuickSaving(true);
      if (quickReminderDate) {
        try {
          await NotificationService.requestPermission();
          await OneSignalService.requestPermission();
        } catch (e) {
          console.warn('Permission request error:', e);
        }
      }

      let finalRepeat = quickReminderRepeat;
      let finalMinutes: number | undefined = undefined;

      if (quickReminderDate && quickReminderRepeat !== 'none') {
        if (quickReminderRepeat === '15m') finalMinutes = 15;
        else if (quickReminderRepeat === '30m') finalMinutes = 30;
        else if (quickReminderRepeat === '1h') finalMinutes = 60;
        else if (quickReminderRepeat === '2h') finalMinutes = 120;
        else if (quickReminderRepeat === '3h') finalMinutes = 180;
        else if (quickReminderRepeat === '4h') finalMinutes = 240;
        else if (quickReminderRepeat === '6h') finalMinutes = 360;
        else if (quickReminderRepeat === '8h') finalMinutes = 480;
        else if (quickReminderRepeat === '12h') finalMinutes = 720;
        else if (quickReminderRepeat === '24h') finalMinutes = 1440;
      } else {
        finalRepeat = 'none';
        finalMinutes = undefined;
      }

      await addPersonalNote({
        title: quickTitle.trim(),
        content: quickContent.trim(),
        color: quickColor,
        reminderDate: quickReminderDate || undefined,
        reminderTime: quickReminderTime || undefined,
        reminderRepeat: finalRepeat !== 'none' ? finalRepeat : undefined,
        reminderRepeatMinutes: finalMinutes,
      });

      setQuickTitle('');
      setQuickContent('');
      setQuickReminderDate('');
      setQuickReminderTime('');
      setQuickReminderRepeat('none');
      setQuickColor('amber');
    } catch (err) {
      console.error('Hızlı not eklenirken hata oluştu:', err);
    } finally {
      setIsQuickSaving(false);
    }
  };

  const handleQuickCancel = () => {
    dismissQuickKeyboard();
    setQuickTitle('');
    setQuickContent('');
    setQuickReminderDate('');
    setQuickReminderTime('');
    setQuickReminderRepeat('none');
    setQuickColor('amber');
  };

  const handleQuickKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleQuickAdd();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleQuickCancel();
    }
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

      {/* 1.5 Notification Permission Activation Notice */}
      {!hasPermission && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 shrink-0 text-amber-500 animate-pulse" />
            <span>
              <strong>Uygulama Kapalıyken Alarmların Çalması İçin:</strong> Cihazınızda bildirim iznini aktif etmelisiniz.
            </span>
          </div>
          <button
            type="button"
            onClick={async () => {
              const ok = await OneSignalService.requestPermission(user || undefined);
              if (ok) setHasPermission(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs shrink-0 cursor-pointer shadow-sm transition text-center"
          >
            Bildirim İznini Aç
          </button>
        </div>
      )}

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
            onKeyDown={handleQuickKeyDown}
            placeholder="Not Başlığı..."
            className="w-full text-sm font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />

          <textarea
            ref={quickTextareaRef}
            value={quickContent}
            onChange={(e) => setQuickContent(e.target.value)}
            onKeyDown={handleQuickKeyDown}
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
                  onChange={(e) => {
                    setQuickReminderDate(e.target.value);
                    if (!quickReminderTime) {
                      const future = new Date(Date.now() + 3 * 60 * 60 * 1000);
                      const hh = String(future.getHours()).padStart(2, '0');
                      const mm = String(future.getMinutes()).padStart(2, '0');
                      setQuickReminderTime(`${hh}:${mm}`);
                    }
                  }}
                  className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
                />
                <input
                  type="time"
                  value={quickReminderTime}
                  onFocus={() => {
                    if (!quickReminderTime) {
                      const future = new Date(Date.now() + 3 * 60 * 60 * 1000);
                      const hh = String(future.getHours()).padStart(2, '0');
                      const mm = String(future.getMinutes()).padStart(2, '0');
                      setQuickReminderTime(`${hh}:${mm}`);
                    }
                  }}
                  onChange={(e) => setQuickReminderTime(e.target.value)}
                  className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
                />
                {quickReminderDate && (
                  <div className="flex items-center gap-1 text-xs">
                    <Repeat className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <select
                      value={quickReminderRepeat}
                      onChange={(e) => setQuickReminderRepeat(e.target.value)}
                      className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                      title="Hatırlatma Tekrarı"
                    >
                      <option value="none">Tek Sefer</option>
                      <option value="15m">15 Dk</option>
                      <option value="30m">30 Dk</option>
                      <option value="1h">Her Saat</option>
                      <option value="2h">2 Saat</option>
                      <option value="3h">3 Saat</option>
                      <option value="4h">4 Saat</option>
                      <option value="6h">6 Saat</option>
                      <option value="8h">8 Saat</option>
                      <option value="12h">12 Saat</option>
                      <option value="24h">Her Gün (24s)</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleQuickCancel();
                  }}
                  onClick={handleQuickCancel}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition active:scale-95 cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Vazgeç</span>
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleQuickAdd();
                  }}
                  onClick={handleQuickAdd}
                  disabled={isQuickSaving}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
                  title="Notu kaydet (Ctrl+Enter)"
                >
                  {isQuickSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Kaydediliyor...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Kaydet</span>
                    </>
                  )}
                </button>
              </div>
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
