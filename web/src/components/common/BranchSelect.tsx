import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Building2, Search, Check, X, ChevronDown, MapPin } from 'lucide-react';

export interface BranchOption {
  id: string;
  name: string;
  address?: string;
  staffCount?: number;
}

interface BranchSelectProps {
  options: BranchOption[];
  selectedBranchId: string; // 'all' or branch.id
  onChange: (branchId: string) => void;
  className?: string;
  totalCompanyStaffCount?: number;
}

export const BranchSelect: React.FC<BranchSelectProps> = ({
  options,
  selectedBranchId,
  onChange,
  className = '',
  totalCompanyStaffCount = 0,
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
    return options.filter((b) => {
      const nameMatch = b.name.toLocaleLowerCase('tr').includes(q);
      const addrMatch = b.address?.toLocaleLowerCase('tr').includes(q);
      return nameMatch || addrMatch;
    });
  }, [options, search]);

  const selectedBranch = useMemo(() => {
    if (selectedBranchId === 'all') return null;
    return options.find((b) => b.id === selectedBranchId) || null;
  }, [options, selectedBranchId]);

  // Label text for trigger button
  const triggerLabel = useMemo(() => {
    if (!selectedBranch || selectedBranchId === 'all') {
      return `Tüm Şubeler (${options.length})`;
    }
    return `${selectedBranch.name} (${selectedBranch.staffCount || 0} Personel)`;
  }, [selectedBranch, selectedBranchId, options.length]);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all select-none cursor-pointer ${
          isOpen
            ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
            : selectedBranchId !== 'all'
            ? 'border-emerald-500 dark:border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 shadow-xs'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 max-w-[240px] sm:max-w-[300px]">
          {selectedBranchId === 'all' ? (
            <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          )}
          <span className="truncate">{triggerLabel}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedBranchId !== 'all' && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange('all');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  onChange('all');
                }
              }}
              title="Tüm Şubelere Dön"
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
                placeholder="Şube ara..."
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

            <div className="flex items-center justify-between text-[11px] font-bold px-0.5 text-slate-500 dark:text-slate-400">
              <span>Şube Listesi</span>
              <span>{options.length} Şube Kayıtlı</span>
            </div>
          </div>

          {/* Branch Options List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1">
            {/* 1. Option: Tüm Şubeler */}
            <div
              onClick={() => {
                onChange('all');
                setIsOpen(false);
              }}
              className={`p-2.5 rounded-xl cursor-pointer transition-colors flex items-center justify-between gap-2 select-none ${
                selectedBranchId === 'all'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    selectedBranchId === 'all'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black truncate">Tüm Şubeler</div>
                  <div className="text-[10px] text-slate-400">Kurum geneli tüm personeller</div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {totalCompanyStaffCount} Personel
                </span>
                {selectedBranchId === 'all' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
              </div>
            </div>

            {/* Specific Branches */}
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Aramanıza uygun şube bulunamadı.
              </div>
            ) : (
              filteredOptions.map((b) => {
                const isSelected = selectedBranchId === b.id;
                return (
                  <div
                    key={b.id}
                    onClick={() => {
                      onChange(b.id);
                      setIsOpen(false);
                    }}
                    className={`p-2.5 rounded-xl cursor-pointer transition-colors flex items-center justify-between gap-2 select-none ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black truncate">{b.name}</div>
                        {b.address && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[170px]">
                            {b.address}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                        {b.staffCount || 0} Personel
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
