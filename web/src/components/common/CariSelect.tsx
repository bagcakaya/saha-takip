import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Building2, Search, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useStorage } from '../../context/StorageContext';

interface CariSelectProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const CariSelect: React.FC<CariSelectProps> = ({
  value = '',
  onChange,
  placeholder = 'Cari seçiniz veya arayınız (İsteğe Bağlı)...',
  className = '',
}) => {
  const { cariler } = useStorage();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
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

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 60);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  // Filter cariler with Turkish locale support
  const filteredCariler = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    if (!q) return cariler;
    return cariler.filter((c) => c.toLocaleLowerCase('tr').includes(q));
  }, [cariler, search]);

  const handleSelect = (selectedCari: string) => {
    onChange(selectedCari);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`space-y-2 ${className}`}>
      {/* Trigger Button / Box */}
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40 dark:bg-blue-950/30'
            : value
            ? 'border-blue-300 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 hover:border-blue-400'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
          <div
            className={`p-1.5 rounded-lg shrink-0 ${
              value
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
            }`}
          >
            <Building2 className="w-4 h-4" />
          </div>

          {value ? (
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
                Seçilen Cari
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate block">
                {value}
              </span>
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 truncate block">
                {placeholder}
              </span>
            </div>
          )}
        </div>

        {/* Right action icons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {value ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen((prev) => !prev);
                }}
                className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                {isOpen ? 'Kapat' : 'Değiştir'}
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Cariyi Kaldır"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="text-slate-400 p-1">
              {isOpen ? <ChevronUp className="w-4 h-4 text-blue-500" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          )}
        </div>
      </div>

      {/* Downward Dropdown List with Search Inside */}
      {isOpen && (
        <div className="rounded-2xl border border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden animate-in fade-in duration-150 space-y-2 p-2.5">
          {/* Integrated Search Input right inside the dropdown list */}
          <div className="space-y-2">
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-blue-500 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Açılan listede cari adı ara..."
                className="w-full pl-9 pr-8 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  title="Aramayı Temizle"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* List Header / Quick actions */}
            <div className="flex items-center justify-between px-1 text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
              <span>{filteredCariler.length} Cari listeleniyor</span>
              <div className="flex items-center gap-2">
                {value && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSelect('')}
                      className="text-red-500 hover:text-red-600 dark:text-red-400 font-bold hover:underline cursor-pointer"
                    >
                      Boş Bırak
                    </button>
                    <span>•</span>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold hover:underline cursor-pointer"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable Cariler list */}
          <div className="max-h-60 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
            {filteredCariler.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 space-y-2 px-2">
                <div>"{search}" ile eşleşen kayıtlı cari bulunamadı.</div>
                {search.trim() && (
                  <button
                    type="button"
                    onClick={() => handleSelect(search.trim())}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors cursor-pointer"
                  >
                    ➕ "{search.trim()}" olarak seç
                  </button>
                )}
              </div>
            ) : (
              filteredCariler.map((name, index) => {
                const isSelected = name === value;
                return (
                  <div
                    key={name}
                    onClick={() => handleSelect(name)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                        : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                      <span
                        className={`w-6 text-[10px] text-right shrink-0 ${
                          isSelected ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {index + 1}.
                      </span>
                      <span className="truncate">{name}</span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 shrink-0 text-white" />}
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
