import React, { useState, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Scale,
  Edit2,
  Trash2,
  Check,
  X,
  Download,
  Phone,
  MapPin,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';
import { DebtReceivableRecord, DebtReceivableType } from '../../types/storage';
import * as XLSX from 'xlsx';

export const DebtsReceivablesSection: React.FC = () => {
  const { user, company } = useAuth();
  const {
    accountingData,
    cariItems,
    cariler,
    addCariItem,
    addDebtReceivable,
    updateDebtReceivable,
    deleteDebtReceivable,
    toggleDebtReceivableStatus,
  } = useStorage();

  const activeCompCode = (company?.code || user?.companyCode || 'POLATLAR').trim().toUpperCase();
  const activeCompanyName =
    company?.name || (activeCompCode === 'POLATLAR' ? 'Polatlar' : activeCompCode);

  // Two main tabs: 'debt' (Borçlar) and 'receivable' (Alacaklar)
  const [activeSubTab, setActiveSubTab] = useState<DebtReceivableType>('debt');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [selectedCariFilter, setSelectedCariFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DebtReceivableRecord | null>(null);
  const [formType, setFormType] = useState<DebtReceivableType>('debt');
  const [formCariName, setFormCariName] = useState('');
  const [cariSearchText, setCariSearchText] = useState('');
  const [isCariDropdownOpen, setIsCariDropdownOpen] = useState(false);
  const [formAmount, setFormAmount] = useState('');
  const [formMaturity, setFormMaturity] = useState('');
  const [formDueDate, setFormDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formDescription, setFormDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Quick inline Cari creation inside the modal
  const [isQuickAddCariOpen, setIsQuickAddCariOpen] = useState(false);
  const [quickCariName, setQuickCariName] = useState('');
  const [quickCariPhone, setQuickCariPhone] = useState('');

  const allRecords = accountingData.debtsReceivables || [];
  const todayStr = new Date().toISOString().split('T')[0];

  // Unified Cari options from Cariler module
  const availableCariler = useMemo(() => {
    if (cariItems && cariItems.length > 0) {
      return cariItems;
    }
    return (cariler || []).map((name, i) => ({
      id: `legacy_${i}`,
      name,
      address: '',
      phone: '',
      tcNo: '',
      taxNo: '',
      createdAt: 0,
    }));
  }, [cariItems, cariler]);

  const filteredCariOptions = useMemo(() => {
    const q = cariSearchText.trim().toLocaleLowerCase('tr-TR');
    if (!q) return availableCariler;
    return availableCariler.filter(
      (c) =>
        c.name.toLocaleLowerCase('tr-TR').includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.taxNo && c.taxNo.includes(q)) ||
        (c.tcNo && c.tcNo.includes(q))
    );
  }, [availableCariler, cariSearchText]);

  // Totals Calculation
  const summary = useMemo(() => {
    let pendingDebt = 0;
    let totalDebt = 0;
    let pendingReceivable = 0;
    let totalReceivable = 0;
    let overdueCount = 0;

    allRecords.forEach((r) => {
      const amt = Number(r.amount) || 0;
      if (r.type === 'debt') {
        totalDebt += amt;
        if (r.status === 'pending') {
          pendingDebt += amt;
          if (r.dueDate && r.dueDate < todayStr) overdueCount++;
        }
      } else {
        totalReceivable += amt;
        if (r.status === 'pending') {
          pendingReceivable += amt;
          if (r.dueDate && r.dueDate < todayStr) overdueCount++;
        }
      }
    });

    const netPosition = pendingReceivable - pendingDebt;
    return {
      pendingDebt,
      totalDebt,
      pendingReceivable,
      totalReceivable,
      netPosition,
      overdueCount,
      debtCount: allRecords.filter((r) => r.type === 'debt').length,
      receivableCount: allRecords.filter((r) => r.type === 'receivable').length,
    };
  }, [allRecords, todayStr]);

  // Filtered records for current active tab ('debt' or 'receivable')
  const filteredRecords = useMemo(() => {
    return allRecords
      .filter((r) => {
        if (r.type !== activeSubTab) return false;
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (selectedCariFilter !== 'all' && r.cariName !== selectedCariFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLocaleLowerCase('tr-TR');
          const inCari = (r.cariName || '').toLocaleLowerCase('tr-TR').includes(q);
          const inDesc = (r.description || '').toLocaleLowerCase('tr-TR').includes(q);
          const inMat = (r.maturity || '').toLocaleLowerCase('tr-TR').includes(q);
          if (!inCari && !inDesc && !inMat) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Pending first, then by dueDate ascending
        if (a.status !== b.status) {
          return a.status === 'pending' ? -1 : 1;
        }
        if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
          return a.dueDate.localeCompare(b.dueDate);
        }
        return b.createdAt - a.createdAt;
      });
  }, [allRecords, activeSubTab, statusFilter, selectedCariFilter, searchQuery]);

  // Totals for the currently displayed (filtered) Borçlar or Alacaklar tab
  const filteredTotals = useMemo(() => {
    let total = 0;
    let pending = 0;
    let paid = 0;
    filteredRecords.forEach((r) => {
      const amt = Number(r.amount) || 0;
      total += amt;
      if (r.status === 'paid') {
        paid += amt;
      } else {
        pending += amt;
      }
    });
    return { total, pending, paid, count: filteredRecords.length };
  }, [filteredRecords]);

  const openAddModal = (type: DebtReceivableType) => {
    setEditingItem(null);
    setFormType(type);
    setFormCariName('');
    setCariSearchText('');
    setIsCariDropdownOpen(false);
    setFormAmount('');
    setFormMaturity('');
    setFormDueDate(new Date().toISOString().split('T')[0]);
    setFormDescription('');
    setFormError(null);
    setIsQuickAddCariOpen(false);
    setIsModalOpen(true);
  };

  const openEditModal = (item: DebtReceivableRecord) => {
    setEditingItem(item);
    setFormType(item.type);
    setFormCariName(item.cariName);
    setCariSearchText(item.cariName);
    setIsCariDropdownOpen(false);
    setFormAmount(String(item.amount));
    setFormMaturity(item.maturity || '');
    setFormDueDate(item.dueDate || new Date().toISOString().split('T')[0]);
    setFormDescription(item.description || '');
    setFormError(null);
    setIsQuickAddCariOpen(false);
    setIsModalOpen(true);
  };

  const handleQuickCreateCari = async () => {
    const clean = quickCariName.trim();
    if (!clean) return;
    try {
      const created = await addCariItem({
        name: clean,
        phone: quickCariPhone.replace(/\D/g, ''),
      });
      setFormCariName(created.name);
      setCariSearchText(created.name);
      setQuickCariName('');
      setQuickCariPhone('');
      setIsQuickAddCariOpen(false);
      setIsCariDropdownOpen(false);
    } catch (err: any) {
      alert(err?.message || 'Cari eklenirken hata oluştu.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCari = formCariName.trim() || cariSearchText.trim();
    if (!cleanCari) {
      setFormError('Lütfen listeden bir Cari seçiniz.');
      return;
    }

    const parsedAmount = parseFloat(String(formAmount).replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError(
        `Lütfen geçerli bir ${formType === 'debt' ? 'Borç Tutarı' : 'Alacak Tutarı'} giriniz.`
      );
      return;
    }

    if (!formDueDate) {
      setFormError('Lütfen Son Ödeme Tarihi seçiniz.');
      return;
    }

    const matchedCari = availableCariler.find(
      (c) => c.name.toLocaleLowerCase('tr-TR') === cleanCari.toLocaleLowerCase('tr-TR')
    );

    try {
      setIsSaving(true);
      setFormError(null);

      if (editingItem) {
        await updateDebtReceivable({
          ...editingItem,
          type: formType,
          cariId: matchedCari?.id,
          cariName: matchedCari ? matchedCari.name : cleanCari,
          amount: parsedAmount,
          maturity: formMaturity.trim() || undefined,
          dueDate: formDueDate,
          description: formDescription.trim() || undefined,
        });
      } else {
        await addDebtReceivable({
          type: formType,
          cariId: matchedCari?.id,
          cariName: matchedCari ? matchedCari.name : cleanCari,
          amount: parsedAmount,
          maturity: formMaturity.trim() || undefined,
          dueDate: formDueDate,
          description: formDescription.trim() || undefined,
        });
      }

      setActiveSubTab(formType);
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'Kayıt sırasında bir hata oluştu.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: DebtReceivableRecord) => {
    const label = item.type === 'debt' ? 'borç' : 'alacak';
    if (
      window.confirm(
        `"${item.cariName}" carisine ait ${item.amount.toLocaleString('tr-TR')} ₺ tutarındaki ${label} kaydını silmek istediğinize emin misiniz?`
      )
    ) {
      await deleteDebtReceivable(item.id);
    }
  };

  const handleExportExcel = () => {
    if (filteredRecords.length === 0) {
      alert('Dışa aktarılacak kayıt bulunamadı.');
      return;
    }
    const rows = filteredRecords.map((r) => ({
      Tür: r.type === 'debt' ? 'Borç' : 'Alacak',
      'Cari İsmi': r.cariName,
      'Tutar (₺)': r.amount,
      'Vadesi (Varsa)': r.maturity || '-',
      'Son Ödeme Tarihi': r.dueDate || '-',
      Durum:
        r.status === 'paid'
          ? r.type === 'debt'
            ? 'Ödendi'
            : 'Tahsil Edildi'
          : 'Bekliyor',
      Açıklama: r.description || '-',
      'Ekleyen Kullanıcı': r.createdByName || '-',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 12 },
      { wch: 38 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 36 },
      { wch: 20 },
    ];
    const wb = XLSX.utils.book_new();
    const sheetTitle = activeSubTab === 'debt' ? 'Borclar' : 'Alacaklar';
    XLSX.utils.book_append_sheet(wb, ws, sheetTitle);
    XLSX.writeFile(
      wb,
      `Muhasebe_${sheetTitle}_${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  const getDueStatusBadge = (item: DebtReceivableRecord) => {
    if (item.status === 'paid') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-3 h-3" />
          <span>{item.type === 'debt' ? 'Ödendi' : 'Tahsil Edildi'}</span>
        </span>
      );
    }
    if (!item.dueDate) return null;
    const diffMs = new Date(item.dueDate).getTime() - new Date(todayStr).getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse">
          <AlertCircle className="w-3 h-3" />
          <span>{Math.abs(diffDays)} Gün Gecikti</span>
        </span>
      );
    }
    if (diffDays === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          <Clock className="w-3 h-3" />
          <span>Bugün Son Gün</span>
        </span>
      );
    }
    if (diffDays <= 7) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <Clock className="w-3 h-3" />
          <span>{diffDays} Gün Kaldı</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
        <Clock className="w-3 h-3 text-blue-500" />
        <span>{diffDays} Gün Var</span>
      </span>
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. Üst Başlık & Hızlı Ekleme Kartı */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Borçlar & Alacaklar Modülü
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                {activeCompanyName}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cariler modülündeki carilerinize ait borç, alacak, vade ve son ödeme tarihi takibi
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openAddModal('debt')}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs sm:text-sm font-black shadow-md shadow-rose-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Borç Ekle</span>
          </button>

          <button
            type="button"
            onClick={() => openAddModal('receivable')}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs sm:text-sm font-black shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Alacak Ekle</span>
          </button>
        </div>
      </div>

      {/* 2. Borç / Alacak KPI Özet Kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Kalan Borçlar */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border border-rose-500/30 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-rose-800 dark:text-rose-400 tracking-wide">
              Toplam Kalan Borç
            </span>
            <div className="w-7 h-7 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-rose-700 dark:text-rose-300 mt-2">
            {summary.pendingDebt.toLocaleString('tr-TR')} ₺
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
            Toplam: {summary.totalDebt.toLocaleString('tr-TR')} ₺ ({summary.debtCount} kayıt)
          </span>
        </div>

        {/* Kalan Alacaklar */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-emerald-800 dark:text-emerald-400 tracking-wide">
              Toplam Kalan Alacak
            </span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-2">
            {summary.pendingReceivable.toLocaleString('tr-TR')} ₺
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
            Toplam: {summary.totalReceivable.toLocaleString('tr-TR')} ₺ ({summary.receivableCount} kayıt)
          </span>
        </div>

        {/* Net Alacak / Borç Farkı */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent border border-blue-500/30 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-blue-800 dark:text-blue-400 tracking-wide">
              Net Bakiye (Alacak - Borç)
            </span>
            <div className="w-7 h-7 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <p
            className={`text-xl sm:text-2xl font-black mt-2 ${
              summary.netPosition >= 0
                ? 'text-blue-700 dark:text-blue-300'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {summary.netPosition >= 0 ? '+' : ''}
            {summary.netPosition.toLocaleString('tr-TR')} ₺
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
            Bekleyen alacak ve borç dengesi
          </span>
        </div>

        {/* Vadesi Geçen & Cari Sayısı */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-transparent border border-amber-500/30 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-amber-800 dark:text-amber-400 tracking-wide">
              Geciken Ödeme / Tahsilat
            </span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-300 mt-2">
            {summary.overdueCount} Kayıt
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
            Seçilebilir Cari: {availableCariler.length} adet
          </span>
        </div>
      </div>

      {/* 3. İki Ayrı Sekme: BORÇLAR ve ALACAKLAR */}
      <div className="grid grid-cols-2 gap-3 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <button
          type="button"
          onClick={() => setActiveSubTab('debt')}
          className={`flex flex-wrap items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeSubTab === 'debt'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <TrendingDown className="w-4 h-4 shrink-0" />
          <span>Borçlar</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
              activeSubTab === 'debt'
                ? 'bg-white/20 text-white'
                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
            }`}
          >
            {summary.debtCount}
          </span>
          {summary.totalDebt > 0 && (
            <span
              className={`px-2 py-0.5 rounded-lg text-[11px] font-black ${
                activeSubTab === 'debt'
                  ? 'bg-slate-950/25 text-white'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}
            >
              {summary.pendingDebt.toLocaleString('tr-TR')} ₺
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('receivable')}
          className={`flex flex-wrap items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeSubTab === 'receivable'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4 shrink-0" />
          <span>Alacaklar</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
              activeSubTab === 'receivable'
                ? 'bg-white/20 text-white'
                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {summary.receivableCount}
          </span>
          {summary.totalReceivable > 0 && (
            <span
              className={`px-2 py-0.5 rounded-lg text-[11px] font-black ${
                activeSubTab === 'receivable'
                  ? 'bg-slate-950/25 text-white'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {summary.pendingReceivable.toLocaleString('tr-TR')} ₺
            </span>
          )}
        </button>
      </div>

      {/* 4. Filtre ve Arama Çubuğu */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`${
                activeSubTab === 'debt' ? 'Borçlu olunan cari' : 'Alacaklı olunan cari'
              }, vade veya açıklama ara...`}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-black border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-500" />
            <span>Excel İndir</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {/* Durum Filtresi */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Tümü
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-300 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Bekleyenler
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('paid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'paid'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {activeSubTab === 'debt' ? 'Ödenenler' : 'Tahsil Edilenler'}
            </button>
          </div>

          {/* Cari Filtresi */}
          <select
            value={selectedCariFilter}
            onChange={(e) => setSelectedCariFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none max-w-xs truncate"
          >
            <option value="all">Cari: Tümü ({availableCariler.length})</option>
            {availableCariler.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 5. Borçlar veya Alacaklar Listesi */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-12 border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-4">
          <div
            className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center ${
              activeSubTab === 'debt'
                ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-500'
                : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500'
            }`}
          >
            {activeSubTab === 'debt' ? (
              <TrendingDown className="w-7 h-7" />
            ) : (
              <TrendingUp className="w-7 h-7" />
            )}
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
              {activeSubTab === 'debt'
                ? 'Kayıtlı Borç Bulunamadı'
                : 'Kayıtlı Alacak Bulunamadı'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Cariler modülündeki carilerinizden birini seçerek tutar, vade (varsa), son ödeme tarihi ve açıklama ile hemen yeni kayıt ekleyebilirsiniz.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openAddModal(activeSubTab)}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-black shadow-md transition-all cursor-pointer ${
              activeSubTab === 'debt'
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>{activeSubTab === 'debt' ? 'Yeni Borç Ekle' : 'Yeni Alacak Ekle'}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Eklendiğinde Görünen Sekme Toplam Özeti (Üst Toplam Barı) */}
          <div
            className={`p-4 sm:p-5 rounded-3xl border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              activeSubTab === 'debt'
                ? 'bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-white dark:to-slate-900 border-rose-500/30'
                : 'bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-white dark:to-slate-900 border-emerald-500/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  activeSubTab === 'debt'
                    ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                    : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {activeSubTab === 'debt' ? (
                  <TrendingDown className="w-5 h-5" />
                ) : (
                  <TrendingUp className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  {activeSubTab === 'debt' ? 'Borçlar Toplam Özeti' : 'Alacaklar Toplam Özeti'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Listelenen {filteredTotals.count} adet {activeSubTab === 'debt' ? 'borç' : 'alacak'} kaydının toplam tutarları
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="px-3 py-2 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-right">
                <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 block">
                  {activeSubTab === 'debt' ? 'Genel Toplam Borç' : 'Genel Toplam Alacak'}
                </span>
                <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  {filteredTotals.total.toLocaleString('tr-TR')} ₺
                </span>
              </div>

              <div className="px-3 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-right">
                <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 block">
                  {activeSubTab === 'debt' ? 'Ödenen Borç' : 'Tahsil Edilen'}
                </span>
                <span className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-300">
                  {filteredTotals.paid.toLocaleString('tr-TR')} ₺
                </span>
              </div>

              <div
                className={`px-3 py-2 rounded-2xl border text-right ${
                  activeSubTab === 'debt'
                    ? 'bg-rose-500/15 border-rose-500/30'
                    : 'bg-amber-500/15 border-amber-500/30'
                }`}
              >
                <span
                  className={`text-[10px] font-black uppercase block ${
                    activeSubTab === 'debt'
                      ? 'text-rose-700 dark:text-rose-300'
                      : 'text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {activeSubTab === 'debt' ? 'Kalan Borç' : 'Kalan Alacak'}
                </span>
                <span
                  className={`text-sm sm:text-base font-black ${
                    activeSubTab === 'debt'
                      ? 'text-rose-700 dark:text-rose-300'
                      : 'text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {filteredTotals.pending.toLocaleString('tr-TR')} ₺
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredRecords.map((item) => {
            const cariDetail = availableCariler.find(
              (c) => c.name.toLocaleLowerCase('tr-TR') === item.cariName.toLocaleLowerCase('tr-TR')
            );
            const isPaid = item.status === 'paid';
            const formattedDue = item.dueDate
              ? new Date(item.dueDate).toLocaleDateString('tr-TR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })
              : 'Belirtilmedi';

            return (
              <div
                key={item.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border transition-all flex flex-col justify-between gap-3.5 shadow-xs ${
                  isPaid
                    ? 'border-slate-200/70 dark:border-slate-800/70 opacity-80'
                    : item.type === 'debt'
                    ? 'border-rose-200/80 dark:border-rose-900/50 hover:border-rose-400'
                    : 'border-emerald-200/80 dark:border-emerald-900/50 hover:border-emerald-400'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Row: Cari Badge & Amount */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                            item.type === 'debt'
                              ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300'
                              : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {item.type === 'debt' ? 'BORÇ' : 'ALACAK'}
                        </span>
                        {getDueStatusBadge(item)}
                      </div>

                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
                        <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white break-words">
                          {item.cariName}
                        </h3>
                      </div>

                      {cariDetail && (cariDetail.phone || cariDetail.address) && (
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          {cariDetail.phone && (
                            <a
                              href={`tel:${cariDetail.phone}`}
                              className="inline-flex items-center gap-1 font-mono hover:text-blue-500"
                            >
                              <Phone className="w-3 h-3 text-emerald-500" />
                              <span>{cariDetail.phone}</span>
                            </a>
                          )}
                          {cariDetail.address && (
                            <span className="inline-flex items-center gap-1 truncate max-w-[220px]">
                              <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                              <span className="truncate">{cariDetail.address}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-lg sm:text-xl font-black block ${
                          isPaid
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : item.type === 'debt'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {item.amount.toLocaleString('tr-TR')} ₺
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {item.type === 'debt' ? 'Borç Tutarı' : 'Alacak Tutarı'}
                      </span>
                    </div>
                  </div>

                  {/* Middle Row: Vade & Son Ödeme Tarihi */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        {item.type === 'debt' ? 'Borcun Vadesi' : 'Alacağın Vadesi'}
                      </span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">
                        {item.maturity || 'Belirtilmedi'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Son Ödeme Tarihi
                      </span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>{formattedDue}</span>
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  {item.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50/70 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 leading-relaxed break-words">
                      <strong className="text-slate-700 dark:text-slate-200">Açıklama:</strong>{' '}
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => toggleDebtReceivableStatus(item.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      isPaid
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-600'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                    }`}
                  >
                    {isPaid ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Bekleyene Geri Al</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>
                          {item.type === 'debt' ? 'Ödendi İşaretle' : 'Tahsil Edildi İşaretle'}
                        </span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="p-2 rounded-xl text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                      title="Düzenle"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>

          {/* Liste Sonu Alt Toplam Barı */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <span className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-300">
              Toplam {filteredTotals.count} Adet {activeSubTab === 'debt' ? 'Borç Kaydı' : 'Alacak Kaydı'}
            </span>
            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm font-black">
              <span className="text-slate-600 dark:text-slate-300">
                Genel Toplam: <strong className="text-slate-900 dark:text-white">{filteredTotals.total.toLocaleString('tr-TR')} ₺</strong>
              </span>
              <span className={activeSubTab === 'debt' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                {activeSubTab === 'debt' ? 'Kalan Ödenecek Borç: ' : 'Kalan Tahsil Edilecek Alacak: '}
                <strong>{filteredTotals.pending.toLocaleString('tr-TR')} ₺</strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 6. Borç / Alacak Ekleme & Düzenleme Modalı */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl text-white shadow-sm ${
                    formType === 'debt' ? 'bg-rose-600' : 'bg-emerald-600'
                  }`}
                >
                  {formType === 'debt' ? (
                    <TrendingDown className="w-5 h-5" />
                  ) : (
                    <TrendingUp className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                    {editingItem
                      ? formType === 'debt'
                        ? 'Borç Kaydını Düzenle'
                        : 'Alacak Kaydını Düzenle'
                      : formType === 'debt'
                      ? 'Yeni Borç Ekle'
                      : 'Yeni Alacak Ekle'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cariler modülünden cari seçerek borç/alacak bilgilerini giriniz
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold">
                  {formError}
                </div>
              )}

              {/* Tür Seçimi: Borç / Alacak */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setFormType('debt')}
                  className={`py-2 px-3 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    formType === 'debt'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Borç Kaydı
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('receivable')}
                  className={`py-2 px-3 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    formType === 'receivable'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Alacak Kaydı
                </button>
              </div>

              {/* 1. Cari Seçimi (Cariler Modülünden Seçilebilir) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                    Cari Seçimi <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsQuickAddCariOpen((prev) => !prev)}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {isQuickAddCariOpen ? 'Vazgeç' : '+ Yeni Cari Tanımla'}
                  </button>
                </div>

                {/* Hızlı Cari Ekleme Kutusu */}
                {isQuickAddCariOpen && (
                  <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/70 space-y-2">
                    <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 block">
                      Cariler Modülüne Hızlı Cari Ekle
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={quickCariName}
                        onChange={(e) => setQuickCariName(e.target.value)}
                        placeholder="Cari İsmi *"
                        className="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                      />
                      <input
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={quickCariPhone}
                        onChange={(e) => setQuickCariPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="Telefon (Opsiyonel - Sadece Rakam)"
                        className="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleQuickCreateCari}
                      className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Cariyi Kaydet ve Seç
                    </button>
                  </div>
                )}

                {/* Aranabilir Cari Seçim Listesi */}
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={cariSearchText}
                    onFocus={() => setIsCariDropdownOpen(true)}
                    onChange={(e) => {
                      setCariSearchText(e.target.value);
                      setFormCariName(e.target.value);
                      setIsCariDropdownOpen(true);
                    }}
                    placeholder={
                      availableCariler.length > 0
                        ? `Cariler modülünden seçin veya arayın (${availableCariler.length} Cari)...`
                        : 'Cari ismi yazın veya yukarıdan yeni cari tanımlayın...'
                    }
                    className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setIsCariDropdownOpen((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {isCariDropdownOpen && availableCariler.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl divide-y divide-slate-100 dark:divide-slate-700/60">
                      {filteredCariOptions.length === 0 ? (
                        <div className="p-3 text-xs text-slate-500 dark:text-slate-400 text-center">
                          Eşleşen cari bulunamadı.
                        </div>
                      ) : (
                        filteredCariOptions.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setFormCariName(c.name);
                              setCariSearchText(c.name);
                              setIsCariDropdownOpen(false);
                            }}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block truncate">
                                {c.name}
                              </span>
                              {(c.phone || c.address) && (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate">
                                  {[c.phone && `Tel: ${c.phone}`, c.address].filter(Boolean).join(' • ')}
                                </span>
                              )}
                            </div>
                            {formCariName === c.name && (
                              <Check className="w-4 h-4 text-blue-600 shrink-0" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Borç / Alacak Tutarı (₺) */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-1.5">
                  {formType === 'debt' ? 'Borç Tutarı (₺)' : 'Alacak Tutarı (₺)'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="Örn: 15000"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 3. Borcun Vadesi (Varsa) & 4. Son Ödeme Tarihi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {formType === 'debt' ? 'Borcun Vadesi (Varsa)' : 'Alacağın Vadesi (Varsa)'}
                    </label>
                    <span className="text-[10px] font-semibold text-slate-400">Opsiyonel</span>
                  </div>
                  <input
                    type="text"
                    value={formMaturity}
                    onChange={(e) => setFormMaturity(e.target.value)}
                    placeholder="Örn: 30 Gün, 3 Taksit, Çek..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {['15 Gün', '30 Gün', '60 Gün', '90 Gün'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setFormMaturity(preset);
                          const days = parseInt(preset, 10);
                          if (!isNaN(days)) {
                            const d = new Date();
                            d.setDate(d.getDate() + days);
                            setFormDueDate(d.toISOString().split('T')[0]);
                          }
                        }}
                        className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-1.5">
                    Son Ödeme Tarihi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* 5. Açıklama */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Açıklama
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Fatura no, alınan malzeme/hizmet veya ödeme detayı..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200/80 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-50 ${
                    formType === 'debt'
                      ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                      : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                  }`}
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    {isSaving
                      ? 'Kaydediliyor...'
                      : editingItem
                      ? 'Değişiklikleri Kaydet'
                      : formType === 'debt'
                      ? 'Borcu Kaydet'
                      : 'Alacağı Kaydet'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
