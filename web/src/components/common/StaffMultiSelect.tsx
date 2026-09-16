import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Users, Search, Check, X, ChevronDown } from 'lucide-react';

export interface StaffOption {
  id: string;
  name: string;
  role?: string;
  branchName?: string;
}

interface StaffMultiSelectProps {
  options: StaffOption[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  className?: string;
  placeholder?: string;
}

export const StaffMultiSelect: React.FC<StaffMultiSelectProps> = ({
  options,
  selectedIds,
  onChange,
  className = '',
  placeholder = 'Tüm Personeller',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 60);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  // Filter options by search text (Turkish locale aware)
  const filteredOptions = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    if (!q) return options;
    return options.filter((s) => {
      const nameMatch = s.name.toLocaleLowerCase('tr').includes(q);
      const roleMatch = s.role?.toLocaleLowerCase('tr').includes(q);
      const branchMatch = s.branchName?.toLocaleLowerCase('tr').includes(q);
      return nameMatch || roleMatch || branchMatch;
    });
  }, [options, search]);

  // Toggle single staff selection
  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  // Select all currently visible options
  const handleSelectAllVisible = () => {
    const visibleIds = filteredOptions.map((o) => o.id);
    const combined = Array.from(new Set([...selectedIds, ...visibleIds]));
    onChange(combined);
  };

  // Clear all selections (revert to "Tümü")
  const handleClearAll = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange([]);
  };

  // Label text for trigger button
  const triggerLabel = useMemo(() => {
    if (selectedIds.length === 0) {
      return `👥 ${placeholder} (${options.length})`;
    }
    if (selectedIds.length === 1) {
      const single = options.find((o) => o.id === selectedIds[0]);
      if (single) {
        const roleLabel = single.role === 'admin' ? 'Yönetici' : 'Saha Yetkilisi';
        return `${single.name} (${roleLabel})`;
      }
      return '1 Personel Seçili';
    }
    const firstSelected = options.find((o) => o.id === selectedIds[0]);
    if (firstSelected) {
      return `${firstSelected.name} (+${selectedIds.length - 1})`;
    }
    return `${selectedIds.length} Personel Seçili`;
  }, [selectedIds, options, placeholder]);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all select-none cursor-pointer ${
          isOpen
            ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
            : selectedIds.length > 0
            ? 'border-emerald-400 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 hover:border-emerald-500'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 max-w-[220px] sm:max-w-[280px]">
          <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="truncate">{triggerLabel}</span>
          {selectedIds.length > 1 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-emerald-600 text-white shrink-0">
              {selectedIds.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedIds.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClearAll}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleClearAll();
                }
              }}
              title="Seçimi Temizle (Tümü)"
              className="p-0.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-rose-500 cursor-pointer transition-colors"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-emerald-600' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-72 sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl shadow-slate-900/10 dark:shadow-black/50 z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Search Header */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Personel ara..."
                className="w-full pl-8 pr-7 py-1.5 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 border-none text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Quick Actions (Select All / Clear) */}
            <div className="flex items-center justify-between text-[11px] font-bold px-0.5">
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 cursor-pointer flex items-center gap-1"
              >
                <span>✓ Tümünü Seç</span>
                <span className="text-[10px] text-slate-400">({filteredOptions.length})</span>
              </button>

              <button
                type="button"
                onClick={() => onChange([])}
                className="text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 cursor-pointer"
              >
                Temizle (Tümü)
              </button>
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 divide-y divide-slate-100 dark:divide-slate-800/40">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Aramanızla eşleşen personel bulunamadı.
              </div>
            ) : (
              filteredOptions.map((s) => {
                const isSelected = selectedIds.includes(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => handleToggle(s.id)}
                    className={`flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer select-none ${
                      isSelected
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 text-slate-900 dark:text-slate-100'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all shrink-0 ${
                        isSelected
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>

                    {/* Avatar initial */}
                    <div className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-black text-[11px] shrink-0">
                      {s.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Name & Role */}
                    <div className="min-w-0 flex-1">
                      <div className={`truncate ${isSelected ? 'font-black text-emerald-950 dark:text-emerald-200' : 'font-semibold'}`}>
                        {s.name}
                      </div>
                      {s.branchName && (
                        <div className="text-[10px] text-slate-400 truncate">
                          {s.branchName}
                        </div>
                      )}
                    </div>

                    {/* Role Badge */}
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold shrink-0 ${
                        s.role === 'admin'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      }`}
                    >
                      {s.role === 'admin' ? 'Yönetici' : 'Saha Yetkilisi'}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 pl-1">
              {selectedIds.length === 0
                ? 'Tüm personeller seçili'
                : `${selectedIds.length} / ${options.length} seçildi`}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer"
            >
              Tamam
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
