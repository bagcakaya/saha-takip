import React, { useState, useMemo } from 'react';
import {
  CalendarClock,
  Plus,
  Search,
  Calendar,
  Clock,
  CheckCircle2,
  Edit2,
  Trash2,
  X,
  Check,
  Tag,
  Download,
  RotateCcw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';
import { FixedExpenseRecord } from '../../types/storage';
import * as XLSX from 'xlsx';

const MONTH_NAMES_TR = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

export const FixedExpensesSection: React.FC = () => {
  const { user, company } = useAuth();
  const {
    accountingData,
    addFixedExpense,
    updateFixedExpense,
    deleteFixedExpense,
    toggleFixedExpenseStatus,
    addAccountingCategory,
  } = useStorage();

  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthKey = todayStr.slice(0, 7); // Örn: '2026-11'

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const shiftMonth = (delta: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const nextY = d.getFullYear();
    const nextM = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${nextY}-${nextM}`);
  };

  const selectedMonthLabel = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return `${MONTH_NAMES_TR[(m || 1) - 1]} ${y}`;
  }, [selectedMonth]);

  // Helper: Check if a fixed expense is paid in the selected month
  const isPaidInMonth = (item: FixedExpenseRecord, monthKey: string): boolean => {
    if (Array.isArray(item.paidMonths)) {
      return item.paidMonths.includes(monthKey);
    }
    return monthKey === currentMonthKey && item.status === 'paid';
  };

  // Helper: Project the item's due date day into the selected month (e.g. 2026-11-15 -> 2026-12-15)
  const getMonthlyDueDate = (dueDate: string | undefined, monthKey: string): string | undefined => {
    if (!dueDate) return undefined;
    const parts = dueDate.split('-');
    if (parts.length !== 3) return dueDate;
    const day = parseInt(parts[2], 10);
    if (isNaN(day)) return dueDate;
    const [y, m] = monthKey.split('-').map(Number);
    const maxDayInMonth = new Date(y, m, 0).getDate();
    const clampedDay = String(Math.min(day, maxDayInMonth)).padStart(2, '0');
    return `${monthKey}-${clampedDay}`;
  };

  // Add / Edit Fixed Expense Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FixedExpenseRecord | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [maturityInput, setMaturityInput] = useState('');
  const [dueDateInput, setDueDateInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');

  // Inline "+ Yeni Kalem Tanımla" Modal State
  const [isNewCatModalOpen, setIsNewCatModalOpen] = useState(false);
  const [newCatCode, setNewCatCode] = useState('770.');
  const [newCatName, setNewCatName] = useState('');
  const [newCatDescription, setNewCatDescription] = useState('');

  const activeCompCode = (company?.code || user?.companyCode || 'POLATLAR').trim().toUpperCase();
  const activeCompanyName = company?.name || (activeCompCode === 'POLATLAR' ? 'Polatlar' : activeCompCode);

  const categories = accountingData.categories || [];
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense' && c.isActive),
    [categories]
  );

  const allRecords = accountingData.fixedExpenses || [];

  const stats = useMemo(() => {
    let totalAmount = 0;
    let paidAmount = 0;
    let pendingAmount = 0;
    let paidCount = 0;
    let pendingCount = 0;

    allRecords.forEach((r) => {
      const amt = Number(r.amount) || 0;
      const paid = isPaidInMonth(r, selectedMonth);
      totalAmount += amt;
      if (paid) {
        paidAmount += amt;
        paidCount++;
      } else {
        pendingAmount += amt;
        pendingCount++;
      }
    });

    return {
      totalAmount,
      paidAmount,
      pendingAmount,
      paidCount,
      pendingCount,
      totalCount: allRecords.length,
    };
  }, [allRecords, selectedMonth]);

  const filteredRecords = useMemo(() => {
    return allRecords
      .filter((r) => {
        const paid = isPaidInMonth(r, selectedMonth);
        if (statusFilter === 'paid' && !paid) return false;
        if (statusFilter === 'pending' && paid) return false;
        if (categoryFilter !== 'all' && r.categoryId !== categoryFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const inName = (r.categoryName || '').toLowerCase().includes(q);
          const inCode = (r.categoryCode || '').toLowerCase().includes(q);
          const inDesc = (r.description || '').toLowerCase().includes(q);
          const inMat = (r.maturity || '').toLowerCase().includes(q);
          if (!inName && !inCode && !inDesc && !inMat) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aPaid = isPaidInMonth(a, selectedMonth);
        const bPaid = isPaidInMonth(b, selectedMonth);
        if (aPaid !== bPaid) {
          return aPaid ? 1 : -1;
        }
        const aDue = getMonthlyDueDate(a.dueDate, selectedMonth);
        const bDue = getMonthlyDueDate(b.dueDate, selectedMonth);
        if (aDue && bDue) {
          return aDue.localeCompare(bDue);
        }
        if (aDue) return -1;
        if (bDue) return 1;
        return b.createdAt - a.createdAt;
      });
  }, [allRecords, statusFilter, categoryFilter, searchQuery, selectedMonth]);

  const filteredTotals = useMemo(() => {
    let total = 0;
    let pending = 0;
    let paid = 0;
    filteredRecords.forEach((r) => {
      const amt = Number(r.amount) || 0;
      total += amt;
      if (isPaidInMonth(r, selectedMonth)) paid += amt;
      else pending += amt;
    });
    return { total, pending, paid };
  }, [filteredRecords, selectedMonth]);

  // Numeric sanitizer for Tutar input
  const sanitizeNumericAmount = (val: string) => {
    const normalized = val.replace(',', '.').replace(/[^0-9.]/g, '');
    const parts = normalized.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    return normalized;
  };

  const openNewModal = () => {
    setEditingItem(null);
    setSelectedCategoryId('');
    setAmountInput('');
    setMaturityInput('');
    setDueDateInput('');
    setDescriptionInput('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: FixedExpenseRecord) => {
    setEditingItem(item);
    setSelectedCategoryId(item.categoryId);
    setAmountInput(String(item.amount));
    setMaturityInput(item.maturity || '');
    setDueDateInput(item.dueDate || '');
    setDescriptionInput(item.description || '');
    setIsModalOpen(true);
  };

  const handleSaveFixedExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const cat =
      expenseCategories.find((c) => c.id === selectedCategoryId) ||
      categories.find((c) => c.id === selectedCategoryId);
    if (!cat) {
      alert('Lütfen Masraf / Gider Kalemi seçiniz.');
      return;
    }

    const parsedAmount = parseFloat(amountInput);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Lütfen geçerli bir Sabit Masraf Tutarı giriniz.');
      return;
    }

    if (editingItem) {
      await updateFixedExpense({
        ...editingItem,
        categoryId: cat.id,
        categoryCode: cat.code,
        categoryName: cat.name,
        amount: parsedAmount,
        maturity: maturityInput.trim() || undefined,
        dueDate: dueDateInput || undefined,
        description: descriptionInput.trim() || undefined,
      });
    } else {
      await addFixedExpense({
        categoryId: cat.id,
        categoryCode: cat.code,
        categoryName: cat.name,
        amount: parsedAmount,
        maturity: maturityInput.trim() || undefined,
        dueDate: dueDateInput || undefined,
        description: descriptionInput.trim() || undefined,
        status: 'pending',
        paidMonths: [],
      });
    }

    setIsModalOpen(false);
  };

  const handleCreateNewCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatCode.trim() || !newCatName.trim()) {
      alert('Lütfen ERP kodunu ve kalem adını giriniz.');
      return;
    }
    await addAccountingCategory({
      code: newCatCode.trim(),
      name: newCatName.trim(),
      type: 'expense',
      description: newCatDescription.trim() || undefined,
      isActive: true,
    });
    setIsNewCatModalOpen(false);
    setNewCatCode('770.');
    setNewCatName('');
    setNewCatDescription('');
  };

  const handleDelete = async (item: FixedExpenseRecord) => {
    if (
      confirm(
        `"[${item.categoryCode}] ${item.categoryName}" (${item.amount.toLocaleString('tr-TR')} ₺) aylık sabit masraf kalemini tamamen silmek istediğinize emin misiniz?`
      )
    ) {
      await deleteFixedExpense(item.id);
    }
  };

  const handleExportExcel = () => {
    if (filteredRecords.length === 0) {
      alert('Dışa aktarılacak kayıt bulunamadı.');
      return;
    }

    const rows = filteredRecords.map((r) => {
      const paid = isPaidInMonth(r, selectedMonth);
      const monthlyDue = getMonthlyDueDate(r.dueDate, selectedMonth);
      return {
        Dönem: selectedMonthLabel,
        'ERP Kodu': r.categoryCode || '-',
        'Masraf / Gider Kalemi': r.categoryName || '-',
        'Aylık Sabit Masraf Tutarı (₺)': r.amount,
        Vade: r.maturity || '-',
        'Bu Ayki Son Ödeme Tarihi': monthlyDue || '-',
        'Bu Ayki Durum': paid ? 'Ödendi' : 'Bekliyor',
        Açıklama: r.description || '-',
        Ekleyen: r.createdByName || '-',
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sabit Masraflar');
    XLSX.writeFile(wb, `Muhasebe_Sabit_Masraflar_${selectedMonth}.xlsx`);
  };

  const getDueDateBadge = (item: FixedExpenseRecord) => {
    const paid = isPaidInMonth(item, selectedMonth);
    if (paid) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3" />
          {selectedMonthLabel} Ödendi
        </span>
      );
    }
    const monthlyDue = getMonthlyDueDate(item.dueDate, selectedMonth);
    if (!monthlyDue) return null;

    const due = new Date(monthlyDue + 'T00:00:00');
    const now = new Date(todayStr + 'T00:00:00');
    const diffDays = Math.round((due.getTime() - now.getTime()) / (1000 * 3600 * 24));

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
          <Clock className="w-3 h-3" />
          {Math.abs(diffDays)} Gün Gecikti
        </span>
      );
    }
    if (diffDays === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
          <Clock className="w-3 h-3" />
          Bugün Son Gün
        </span>
      );
    }
    if (diffDays <= 5) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
          <Clock className="w-3 h-3" />
          {diffDays} Gün Kaldı
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
        <Clock className="w-3 h-3" />
        {diffDays} Gün Var
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* 1. Üst Başlık, Aylık Dönem Seçici ve + Sabit Masraf Ekle Butonu */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0">
            <CalendarClock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Sabit Masraflar Modülü
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                {activeCompanyName}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                Her Ay Otomatik Yenilenir
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Eklediğiniz sabit masraflar her ay otomatik olarak görünür ve her ayın ödemesi ayrı takip edilir
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5">
          {/* Aylık Dönem Seçici */}
          <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="p-1.5 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Önceki Ay"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-2.5 py-1 text-xs sm:text-sm font-black text-slate-900 dark:text-white min-w-[115px] text-center">
              {selectedMonthLabel}
            </div>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="p-1.5 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Sonraki Ay"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {selectedMonth !== currentMonthKey && (
              <button
                type="button"
                onClick={() => setSelectedMonth(currentMonthKey)}
                className="px-2 py-1 rounded-xl bg-purple-600 text-white text-[10px] font-black cursor-pointer mr-0.5"
              >
                Bu Ay
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={openNewModal}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-xs sm:text-sm font-black shadow-md shadow-purple-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Sabit Masraf Ekle</span>
          </button>
        </div>
      </div>

      {/* 2. Özet KPI Kartları (Seçili Ay İçin) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Aylık Toplam Sabit Masraf */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-transparent border border-purple-500/30 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-purple-800 dark:text-purple-400 tracking-wide">
              {selectedMonthLabel} Sabit Masraf
            </span>
            <div className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <CalendarClock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-purple-700 dark:text-purple-300 mt-2">
            {stats.totalAmount.toLocaleString('tr-TR')} ₺
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
            Her ay sabit {stats.totalCount} masraf kalemi
          </span>
        </div>

        {/* Bu Ay Kalan Ödenecek */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border border-rose-500/30 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-rose-800 dark:text-rose-400 tracking-wide">
              {selectedMonthLabel} Kalan
            </span>
            <div className="w-7 h-7 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-rose-700 dark:text-rose-300 mt-2">
            {stats.pendingAmount.toLocaleString('tr-TR')} ₺
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
            {stats.pendingCount} bekleyen ödeme
          </span>
        </div>

        {/* Bu Ay Ödenen */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-emerald-800 dark:text-emerald-400 tracking-wide">
              {selectedMonthLabel} Ödenen
            </span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-2">
            {stats.paidAmount.toLocaleString('tr-TR')} ₺
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
            {stats.paidCount} tamamlanan ödeme
          </span>
        </div>
      </div>

      {/* 3. Arama ve Filtre Çubuğu */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Arama */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Masraf kalemi, ERP kodu, vade veya açıklama ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Excel İndir */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-purple-600" />
            <span>Excel İndir</span>
          </button>
        </div>

        {/* Durum ve Kalem Filtresi */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 text-xs font-bold">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Tümü ({allRecords.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              ⏳ Bekleyenler ({stats.pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('paid')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'paid'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              ✅ Ödenenler ({stats.paidCount})
            </button>
          </div>

          {/* Masraf Kalemi Filtresi */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="all">Kalem: Tümü</option>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                [{c.code}] {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. Sabit Masraflar Listesi (Çekmece / Collapsible Yapısı + Toplamlar) */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-10 text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3 bg-purple-500/10 text-purple-500">
            <CalendarClock className="w-7 h-7" />
          </div>
          <h3 className="text-base font-black text-slate-900 dark:text-white">
            Kayıtlı Sabit Masraf Bulunamadı
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Eklediğiniz sabit masraflar her ay otomatik olarak bu listede yer alır. Kira, fatura, yazılım, aidat gibi aylık sabit ödemelerinizi hemen ekleyebilirsiniz.
          </p>
          <button
            type="button"
            onClick={openNewModal}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black shadow-md shadow-purple-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Sabit Masraf Ekle</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Toplam Özet Barı */}
          <div className="p-4 sm:p-5 rounded-3xl border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-purple-500/10 border-purple-500/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-purple-500/20 text-purple-600 dark:text-purple-400">
                <CalendarClock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">
                  {selectedMonthLabel} Sabit Masraflar Toplam Özeti ({filteredRecords.length} Kalem)
                </span>
                <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  Aylık Genel Toplam: {filteredTotals.total.toLocaleString('tr-TR')} ₺
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex-1 sm:flex-initial px-3.5 py-2 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Kalan Ödenecek
                </span>
                <span className="text-sm sm:text-base font-black text-rose-600 dark:text-rose-400">
                  {filteredTotals.pending.toLocaleString('tr-TR')} ₺
                </span>
              </div>

              <div className="flex-1 sm:flex-initial px-3.5 py-2 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Ödenen Toplam
                </span>
                <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400">
                  {filteredTotals.paid.toLocaleString('tr-TR')} ₺
                </span>
              </div>
            </div>
          </div>

          {/* Çekmece (Collapsible) Kartlar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredRecords.map((item) => {
              const isPaid = isPaidInMonth(item, selectedMonth);
              const isExpanded = !!expandedIds[item.id];
              const monthlyDue = getMonthlyDueDate(item.dueDate, selectedMonth);
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl bg-white dark:bg-slate-900 border transition-all overflow-hidden ${
                    isPaid
                      ? 'border-slate-200/60 dark:border-slate-800/60 opacity-80'
                      : 'border-purple-500/30 dark:border-purple-500/25 shadow-sm'
                  }`}
                >
                  {/* Çekmece Başlığı: Sadece Kalem İsmi ve Tutar görünür */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(item.id)}
                    className="w-full p-3.5 sm:p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          isPaid ? 'bg-emerald-500' : 'bg-purple-500'
                        }`}
                      />
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-black bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
                        {item.categoryCode}
                      </span>
                      <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                        {item.categoryName}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span
                        className={`text-base sm:text-lg font-black ${
                          isPaid
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-purple-600 dark:text-purple-400'
                        }`}
                      >
                        {Number(item.amount).toLocaleString('tr-TR')} ₺
                      </span>
                      <div
                        className={`w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-transform duration-200 ${
                          isExpanded ? 'rotate-180 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white' : ''
                        }`}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </button>

                  {/* Çekmece İçeriği: Tıklayınca Açılan Detaylar */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                            AYLIK SABİT MASRAF
                          </span>
                          {getDueDateBadge(item)}
                        </div>
                        <span className="text-[11px] font-semibold text-slate-400">
                          {selectedMonthLabel} Dönemi
                        </span>
                      </div>

                      {/* Vade ve Son Ödeme Tarihi */}
                      <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 text-xs">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            Vade (Opsiyonel)
                          </span>
                          <span className="font-bold text-slate-700 dark:text-slate-200 mt-0.5 block">
                            {item.maturity || 'Belirtilmedi'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            Son Ödeme Tarihi ({selectedMonthLabel})
                          </span>
                          <span className="font-bold text-slate-700 dark:text-slate-200 mt-0.5 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {monthlyDue
                              ? new Date(monthlyDue + 'T00:00:00').toLocaleDateString('tr-TR', {
                                  day: '2-digit',
                                  month: 'long',
                                  year: 'numeric',
                                })
                              : 'Belirtilmedi'}
                          </span>
                        </div>
                      </div>

                      {/* Açıklama */}
                      {item.description && (
                        <div className="px-3 py-2 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800/60 text-xs text-slate-600 dark:text-slate-300">
                          <span className="font-bold text-slate-700 dark:text-slate-200">Açıklama: </span>
                          {item.description}
                        </div>
                      )}

                      {/* Alt Aksiyonlar */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => toggleFixedExpenseStatus(item.id, selectedMonth)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            isPaid
                              ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                          }`}
                        >
                          {isPaid ? (
                            <>
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>{selectedMonthLabel} Bekleyene Al</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>{selectedMonthLabel} Ödendi İşaretle</span>
                            </>
                          )}
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
                            title="Düzenle"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                            title="Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: SABİT MASRAF EKLE / DÜZENLE                      */}
      {/* ========================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            {/* Modal Başlık */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-purple-50/60 dark:bg-purple-950/30">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {editingItem ? 'Sabit Masraf Kalemini Düzenle' : 'Yeni Aylık Sabit Masraf Ekle'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Eklediğiniz sabit masraf her ay otomatik olarak listede görünür
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFixedExpense} className="p-4 sm:p-5 space-y-4">
              {/* 1. Masraf / Gider Kalemi * (Görsel-1 ile Birebir Uyumlu) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Masraf / Gider Kalemi *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCatCode('770.');
                      setNewCatName('');
                      setNewCatDescription('');
                      setIsNewCatModalOpen(true);
                    }}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    + Yeni Kalem Tanımla
                  </button>
                </div>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="">-- Kalem Seçiniz --</option>
                  {expenseCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      [{cat.code}] {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Tutar (Numeric) * */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Aylık Sabit Tutar (₺) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amountInput}
                    onChange={(e) => setAmountInput(sanitizeNumericAmount(e.target.value))}
                    required
                    className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-base font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    ₺
                  </span>
                </div>
              </div>

              {/* 3. Vade (Opsiyonel) & 4. Son Ödeme Tarihi (Opsiyonel) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Vade (Opsiyonel)
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: Her Ayın 15'i, 30 Gün..."
                    value={maturityInput}
                    onChange={(e) => setMaturityInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {["Her Ayın 1'i", "Her Ayın 15'i", 'Ay Sonu', '30 Gün'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setMaturityInput(preset)}
                        className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Son Ödeme Tarihi (Opsiyonel)
                  </label>
                  <input
                    type="date"
                    value={dueDateInput}
                    onChange={(e) => setDueDateInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Seçilen gün her ay otomatik olarak o aya uyarlanır
                  </span>
                </div>
              </div>

              {/* 5. Açıklama (Opsiyonel) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Açıklama (Opsiyonel)
                </label>
                <textarea
                  rows={2}
                  placeholder="Sabit masraf ile ilgili not veya detay..."
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Kaydet Butonu */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-sm shadow-md shadow-purple-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {editingItem ? 'Değişiklikleri Kaydet' : 'Aylık Sabit Masrafı Kaydet'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: + YENİ KALEM TANIMLA (ERP KODLU)                 */}
      {/* ========================================================= */}
      {isNewCatModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    Yeni Masraf / Gider Kalemi Tanımla
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    ERP hesap kodu ile yeni masraf kalemi ekleyin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewCatModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewCategory} className="p-4 sm:p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ERP Muhasebe / Masraf Kodu *
                </label>
                <input
                  type="text"
                  placeholder="Örn: 770.11, GDR-01..."
                  value={newCatCode}
                  onChange={(e) => setNewCatCode(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kalem Adı *
                </label>
                <input
                  type="text"
                  placeholder="Örn: Kira & Aidat Gideri, İnternet Faturası..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Açıklama (Opsiyonel)
                </label>
                <input
                  type="text"
                  placeholder="Kalemle ilgili ek detay..."
                  value={newCatDescription}
                  onChange={(e) => setNewCatDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-sm shadow-md shadow-purple-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Kalemi Kaydet</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
