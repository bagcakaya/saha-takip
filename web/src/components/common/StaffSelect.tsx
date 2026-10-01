import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Users, Search, Check, X, ChevronDown, User } from 'lucide-react';

export interface StaffOption {
  id: string;
  name: string;
  role?: string;
}

interface StaffSelectProps {
  options: StaffOption[];
  selectedStaffIds: string[];
  onChange: (staffIds: string[]) => void;
  className?: string;
  placeholder?: string;
}

export const StaffSelect: React.FC<StaffSelectProps> = ({
  options,
  selectedStaffIds,
  onChange,
  className = '',
  placeholder = 'Tüm Personeller',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
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

  // Filter options by search
  const filteredOptions = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    if (!q) return options;
    return options.filter((s) => {
      const nameMatch = s.name.toLocaleLowerCase('tr').includes(q);
      const roleMatch = s.role?.toLocaleLowerCase('tr').includes(q);
      return nameMatch || roleMatch;
    });
  }, [options, search]);

  const selectedStaff = useMemo(() => {
    if (selectedStaffIds.length === 1) {
      return options.find((s) => s.id === selectedStaffIds[0]) || null;
    }
    return null;
  }, [options, selectedStaffIds]);

  const triggerLabel = useMemo(() => {
    if (selectedStaffIds.length === 0) {
      return `${placeholder} (${options.length})`;
    }
    if (selectedStaffIds.length === 1) {
      return selectedStaff ? selectedStaff.name : '1 Personel Seçili';
    }
    return `${selectedStaffIds.length} Personel Seçili`;
  }, [selectedStaffIds, selectedStaff, placeholder, options.length]);

  const handleSelect = (staffId: string) => {
    if (staffId === 'all') {
      onChange([]);
      setIsOpen(false);
      return;
    }

    if (selectedStaffIds.includes(staffId)) {
      // Toggle off -> become 'all'
      onChange([]);
    } else {
      // Select this staff
      onChange([staffId]);
    }
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const hasSelection = selectedStaffIds.length > 0;

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all select-none cursor-pointer ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
            : hasSelection
            ? 'border-indigo-500 dark:border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 shadow-xs'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 max-w-[240px] sm:max-w-[300px]">
          {hasSelection ? (
            <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          ) : (
            <Users className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
          )}
          <span className="truncate">{triggerLabel}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {hasSelection && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded-md hover:bg-indigo-200/80 dark:hover:bg-indigo-800/80 text-indigo-700 dark:text-indigo-300 transition-colors"
              title="Seçimi Temizle"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-150 ${
              isOpen ? 'rotate-180 text-indigo-600' : 'text-slate-400'
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-72 sm:w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header & Search */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span>Personel Filtrele</span>
              </span>
              <span className="text-[10px] font-semibold text-slate-400">
                {filteredOptions.length} / {options.length} Personel
              </span>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="İsim veya role göre ara..."
                className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5 overscroll-contain divide-y divide-slate-100 dark:divide-slate-800/60">
            {/* 'Tüm Personeller' option */}
            <button
              type="button"
              onClick={() => handleSelect('all')}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                !hasSelection
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 font-bold'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    !hasSelection
                      ? 'bg-indigo-600 text-white font-black'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-bold text-xs">Tüm Personeller</div>
                  <div className="text-[10px] text-slate-400">
                    Tüm kurum çalışanlarının mesaileri
                  </div>
                </div>
              </div>
              {!hasSelection && (
                <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              )}
            </button>

            {/* Individual staff */}
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 font-medium">
                Aranan kriterde personel bulunamadı.
              </div>
            ) : (
              filteredOptions.map((staff) => {
                const isSelected = selectedStaffIds.includes(staff.id);
                return (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => handleSelect(staff.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 font-bold'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-black ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300'
                        }`}
                      >
                        {staff.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs truncate">{staff.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {staff.role === 'admin' ? 'Yönetici' : 'Personel'}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer note */}
          {hasSelection && (
            <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-medium">
                {selectedStaff?.name || `${selectedStaffIds.length} personel`} filtrelendi
              </span>
              <button
                type="button"
                onClick={() => handleSelect('all')}
                className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
              >
                Filtreyi Temizle
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
