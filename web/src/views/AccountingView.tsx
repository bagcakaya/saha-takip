import React, { useState, useMemo, useRef } from 'react';
import {
  Calculator,
  Plus,
  Minus,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  Tag,
  Search,
  Calendar,
  Download,
  Check,
  X,
  Edit2,
  Trash2,
  Building2,
  CreditCard,
  Banknote,
  Landmark,
  UserCheck,
  Eye,
  FileText,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { useStorage } from '../context/StorageContext';
import { useAuth } from '../context/AuthContext';
import {
  AccountingTransaction,
  AccountingTransactionType,
  AccountingPaymentMethod,
  AccountingCategory,
  DailyCashBalance,
} from '../types/storage';
import * as XLSX from 'xlsx';

type AccountingTab = 'transactions' | 'cash_register' | 'categories' | 'registers';

export const AccountingView: React.FC = () => {
  const { user, company } = useAuth();
  const {
    accountingData,
    addAccountingTransaction,
    updateAccountingTransaction,
    deleteAccountingTransaction,
    addAccountingCategory,
    updateAccountingCategory,
    deleteAccountingCategory,
    saveDailyCashBalance,
    addCashRegister,
    deleteCashRegister,
    branches,
  } = useStorage();

  const [activeTab, setActiveTab] = useState<AccountingTab>('transactions');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Transaction Modal State
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<AccountingTransaction | null>(null);
  const [txType, setTxType] = useState<AccountingTransactionType>('expense');
  const [txCategoryId, setTxCategoryId] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txPaymentMethod, setTxPaymentMethod] = useState<AccountingPaymentMethod>('cash_register');
  const [txCashRegister, setTxCashRegister] = useState('');
  const [txDate, setTxDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [txDescription, setTxDescription] = useState('');
  const [txReceiptNumber, setTxReceiptNumber] = useState('');
  const [txReceiptPhoto, setTxReceiptPhoto] = useState<string | undefined>(undefined);
  const [txBranchId, setTxBranchId] = useState('');

  // Daily Cash Register Entry Form State
  const [cashDate, setCashDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [cashRegisterName, setCashRegisterName] = useState(() => {
    return accountingData.cashRegisters?.[0]?.name || 'Merkez Kasa';
  });
  const [cashNakit, setCashNakit] = useState('');
  const [cashHavale, setCashHavale] = useState('');
  const [cashKrediKarti, setCashKrediKarti] = useState('');
  const [cashNotes, setCashNotes] = useState('');
  const [cashSuccessToast, setCashSuccessToast] = useState(false);

  // Category Modal State
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<AccountingCategory | null>(null);
  const [catCode, setCatCode] = useState('');
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<AccountingTransactionType>('expense');
  const [catDescription, setCatDescription] = useState('');

  // New Cash Register Modal
  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [newRegName, setNewRegName] = useState('');
  const [newRegDescription, setNewRegDescription] = useState('');

  // Receipt image preview modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeCompCode = (company?.code || user?.companyCode || 'POLATLAR').trim().toUpperCase();
  const activeCompanyName = company?.name || (activeCompCode === 'POLATLAR' ? 'Polatlar' : activeCompCode);

  // Fallback defaults
  const transactions = accountingData.transactions || [];
  const categories = accountingData.categories || [];
  const cashRegisters = accountingData.cashRegisters || [];
  const dailyBalances = accountingData.dailyBalances || [];

  // Helper date filtering
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // 1. Type
      if (filterType !== 'all' && t.type !== filterType) return false;

      // 2. Payment Method
      if (filterPaymentMethod !== 'all' && t.paymentMethod !== filterPaymentMethod) return false;

      // 3. Category
      if (filterCategory !== 'all' && t.categoryId !== filterCategory) return false;

      // 4. Period
      if (filterPeriod === 'today') {
        if (t.date !== todayStr) return false;
      } else if (filterPeriod === 'week') {
        const itemDate = new Date(t.date);
        const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays < 0 || diffDays > 7) return false;
      } else if (filterPeriod === 'month') {
        const itemDate = new Date(t.date);
        if (itemDate.getMonth() !== now.getMonth() || itemDate.getFullYear() !== now.getFullYear()) {
          return false;
        }
      } else if (filterPeriod === 'year') {
        const itemDate = new Date(t.date);
        if (itemDate.getFullYear() !== now.getFullYear()) return false;
      } else if (filterPeriod === 'custom') {
        if (customStartDate && t.date < customStartDate) return false;
        if (customEndDate && t.date > customEndDate) return false;
      }

      // 5. Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inCat = (t.categoryName || '').toLowerCase().includes(q);
        const inCode = (t.categoryCode || '').toLowerCase().includes(q);
        const inDesc = (t.description || '').toLowerCase().includes(q);
        const inReceipt = (t.receiptNumber || '').toLowerCase().includes(q);
        const inUser = (t.createdByName || '').toLowerCase().includes(q);
        if (!inCat && !inCode && !inDesc && !inReceipt && !inUser) return false;
      }

      return true;
    });
  }, [
    transactions,
    filterType,
    filterPaymentMethod,
    filterCategory,
    filterPeriod,
    customStartDate,
    customEndDate,
    searchQuery,
    todayStr,
  ]);

  // Overall Financial Totals
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;

    filteredTransactions.forEach((t) => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') {
        income += amt;
      } else {
        expense += amt;
      }
    });

    const balance = income - expense;
    return { income, expense, balance };
  }, [filteredTransactions]);

  // Today's Cash Register Balance (Total = Nakit + Havale + Kredi Kartı)
  const todayDailyBalance = useMemo(() => {
    const todayItems = dailyBalances.filter((b) => b.date === todayStr);
    let cash = 0;
    let bank = 0;
    let card = 0;
    let total = 0;
    todayItems.forEach((b) => {
      cash += Number(b.cashAmount) || 0;
      bank += Number(b.bankAmount) || 0;
      card += Number(b.creditCardAmount) || 0;
      total += Number(b.totalAmount) || 0;
    });
    return { cash, bank, card, total, count: todayItems.length };
  }, [dailyBalances, todayStr]);

  // Live calculation for the Cash Register entry card
  const liveCashNakit = Number(cashNakit) || 0;
  const liveCashHavale = Number(cashHavale) || 0;
  const liveCashKrediKarti = Number(cashKrediKarti) || 0;
  const liveCashTotal = liveCashNakit + liveCashHavale + liveCashKrediKarti;

  // Handlers for Transaction Modal
  const openNewTxModal = (type: AccountingTransactionType) => {
    setEditingTx(null);
    setTxType(type);
    const availableCats = categories.filter((c) => c.type === type && c.isActive);
    setTxCategoryId(availableCats[0]?.id || '');
    setTxAmount('');
    setTxPaymentMethod('cash_register');
    setTxCashRegister(cashRegisters[0]?.name || 'Merkez Kasa');
    setTxDate(new Date().toISOString().split('T')[0]);
    setTxDescription('');
    setTxReceiptNumber('');
    setTxReceiptPhoto(undefined);
    setTxBranchId('');
    setIsTxModalOpen(true);
  };

  const openEditTxModal = (tx: AccountingTransaction) => {
    setEditingTx(tx);
    setTxType(tx.type);
    setTxCategoryId(tx.categoryId);
    setTxAmount(String(tx.amount));
    setTxPaymentMethod(tx.paymentMethod);
    setTxCashRegister(tx.cashRegisterName || cashRegisters[0]?.name || 'Merkez Kasa');
    setTxDate(tx.date);
    setTxDescription(tx.description || '');
    setTxReceiptNumber(tx.receiptNumber || '');
    setTxReceiptPhoto(tx.receiptPhoto);
    setTxBranchId(tx.branchId || '');
    setIsTxModalOpen(true);
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(txAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Lütfen geçerli bir tutar giriniz.');
      return;
    }
    const cat = categories.find((c) => c.id === txCategoryId);
    if (!cat) {
      alert('Lütfen bir kalem (masraf/gelir) seçiniz.');
      return;
    }

    const branchObj = branches?.find((b) => b.id === txBranchId);

    if (editingTx) {
      await updateAccountingTransaction({
        ...editingTx,
        type: txType,
        categoryId: cat.id,
        categoryCode: cat.code,
        categoryName: cat.name,
        amount: amt,
        paymentMethod: txPaymentMethod,
        cashRegisterName: txCashRegister,
        date: txDate,
        description: txDescription.trim(),
        receiptNumber: txReceiptNumber.trim() || undefined,
        receiptPhoto: txReceiptPhoto,
        branchId: txBranchId || undefined,
        branchName: branchObj?.name,
      });
    } else {
      await addAccountingTransaction({
        type: txType,
        categoryId: cat.id,
        categoryCode: cat.code,
        categoryName: cat.name,
        amount: amt,
        paymentMethod: txPaymentMethod,
        cashRegisterName: txCashRegister,
        date: txDate,
        description: txDescription.trim(),
        receiptNumber: txReceiptNumber.trim() || undefined,
        receiptPhoto: txReceiptPhoto,
        branchId: txBranchId || undefined,
        branchName: branchObj?.name,
      });
    }
    setIsTxModalOpen(false);
  };

  const handleDeleteTx = async (tx: AccountingTransaction) => {
    if (confirm(`"${tx.categoryName}" (${tx.amount.toLocaleString('tr-TR')} ₺) kaydını silmek istediğinize emin misiniz?`)) {
      await deleteAccountingTransaction(tx.id);
    }
  };

  // Image upload handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Lütfen sadece resim dosyası seçiniz.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setTxReceiptPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handlers for Daily Cash Balance
  const handleSaveCashBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashRegisterName.trim()) {
      alert('Lütfen kasa adı seçiniz.');
      return;
    }
    await saveDailyCashBalance({
      cashRegisterName: cashRegisterName.trim(),
      date: cashDate,
      cashAmount: liveCashNakit,
      bankAmount: liveCashHavale,
      creditCardAmount: liveCashKrediKarti,
      totalAmount: liveCashTotal,
      notes: cashNotes.trim() || undefined,
    });
    setCashSuccessToast(true);
    setTimeout(() => setCashSuccessToast(false), 3000);
  };

  // Pre-fill cash balance when clicking a past record or selecting date
  const handleSelectBalanceForEdit = (b: DailyCashBalance) => {
    setCashRegisterName(b.cashRegisterName);
    setCashDate(b.date);
    setCashNakit(String(b.cashAmount || ''));
    setCashHavale(String(b.bankAmount || ''));
    setCashKrediKarti(String(b.creditCardAmount || ''));
    setCashNotes(b.notes || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handlers for Category Modal
  const openNewCategoryModal = (type: AccountingTransactionType) => {
    setEditingCat(null);
    setCatType(type);
    setCatCode(type === 'expense' ? '770.' : '600.');
    setCatName('');
    setCatDescription('');
    setIsCatModalOpen(true);
  };

  const openEditCategoryModal = (cat: AccountingCategory) => {
    setEditingCat(cat);
    setCatType(cat.type);
    setCatCode(cat.code);
    setCatName(cat.name);
    setCatDescription(cat.description || '');
    setIsCatModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catCode.trim() || !catName.trim()) {
      alert('Lütfen ERP kodunu ve kalem adını giriniz.');
      return;
    }
    if (editingCat) {
      await updateAccountingCategory({
        ...editingCat,
        code: catCode.trim(),
        name: catName.trim(),
        type: catType,
        description: catDescription.trim() || undefined,
      });
    } else {
      await addAccountingCategory({
        code: catCode.trim(),
        name: catName.trim(),
        type: catType,
        description: catDescription.trim() || undefined,
        isActive: true,
      });
    }
    setIsCatModalOpen(false);
  };

  const handleDeleteCategory = async (cat: AccountingCategory) => {
    if (confirm(`"${cat.code} - ${cat.name}" kalemini silmek istediğinize emin misiniz?`)) {
      await deleteAccountingCategory(cat.id);
    }
  };

  // Cash Register Management
  const handleAddRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegName.trim()) return;
    await addCashRegister(newRegName.trim(), newRegDescription.trim() || undefined);
    setNewRegName('');
    setNewRegDescription('');
    setIsRegModalOpen(false);
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredTransactions.length === 0) {
      alert('Dışa aktarılacak işlem bulunamadı.');
      return;
    }

    const rows = filteredTransactions.map((t) => ({
      Tarih: t.date,
      Tür: t.type === 'income' ? 'Gelir' : 'Gider',
      'ERP Kodu': t.categoryCode || '-',
      'Kalem Adı': t.categoryName || '-',
      'Ödeme Yöntemi':
        t.paymentMethod === 'cash_register'
          ? 'Kasadan (Nakit)'
          : t.paymentMethod === 'bank_transfer'
          ? 'Havale / Banka'
          : t.paymentMethod === 'credit_card'
          ? 'Kredi Kartı'
          : 'Cepten (Şahsi)',
      'Kasa Adı': t.cashRegisterName || '-',
      'Tutar (₺)': t.amount,
      'Fiş / Belge No': t.receiptNumber || '-',
      Açıklama: t.description || '-',
      Şube: t.branchName || '-',
      'İşlemi Yapan': t.createdByName || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Gelir-Gider');
    XLSX.writeFile(wb, `Muhasebe_Gelir_Gider_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. Üst Başlık & Aksiyon Çubuğu */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Muhasebe Modülü
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                {activeCompanyName}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Gelir & gider hareketleri, masraf kalemleri (ERP kodlu) ve günlük kasa takibi
            </p>
          </div>
        </div>

        {/* Aksiyon Butonları (Gelir Ekle, Gider Ekle, Kasa) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Gelir Ekle Butonu */}
          <button
            type="button"
            onClick={() => openNewTxModal('income')}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs sm:text-sm font-black shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Gelir Ekle</span>
          </button>

          {/* Gider Ekle Butonu */}
          <button
            type="button"
            onClick={() => openNewTxModal('expense')}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs sm:text-sm font-black shadow-md shadow-rose-600/20 transition-all cursor-pointer"
          >
            <Minus className="w-4 h-4" />
            <span>Gider Ekle</span>
          </button>

          {/* Kasa Butonu */}
          <button
            type="button"
            onClick={() => setActiveTab('cash_register')}
            className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-black border transition-all cursor-pointer ${
              activeTab === 'cash_register'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/25'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
          >
            <Wallet className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            <span>Kasa Girişi</span>
          </button>

          {/* Kalemler Butonu */}
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-black border transition-all cursor-pointer ${
              activeTab === 'categories'
                ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/25'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
            title="Masraf ve Gelir Kalemlerini Tanımla (ERP Kodları)"
          >
            <Tag className="w-4 h-4 text-purple-500 dark:text-purple-400" />
            <span className="hidden sm:inline">Kalemler</span>
          </button>
        </div>
      </div>

      {/* 2. Finansal KPI Özet Kartları (4'lü) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Toplam Gelir */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 dark:border-emerald-500/30 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-emerald-800 dark:text-emerald-400 tracking-wide">
              Toplam Gelir
            </span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-2">
            {totals.income.toLocaleString('tr-TR')} ₺
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
            {filterPeriod === 'month' ? 'Bu ay tahsil edilen' : 'Seçili döneme ait'}
          </span>
        </div>

        {/* Toplam Gider */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border border-rose-500/30 dark:border-rose-500/30 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-rose-800 dark:text-rose-400 tracking-wide">
              Toplam Gider
            </span>
            <div className="w-7 h-7 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-rose-700 dark:text-rose-300 mt-2">
            {totals.expense.toLocaleString('tr-TR')} ₺
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
            {filterPeriod === 'month' ? 'Bu ay yapılan masraflar' : 'Seçili döneme ait'}
          </span>
        </div>

        {/* Net Kâr / Bakiye */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent border border-blue-500/30 dark:border-blue-500/30 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-blue-800 dark:text-blue-400 tracking-wide">
              Net Bakiye (Kâr)
            </span>
            <div className="w-7 h-7 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <p
            className={`text-xl sm:text-2xl font-black mt-2 ${
              totals.balance >= 0
                ? 'text-blue-700 dark:text-blue-300'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {totals.balance >= 0 ? '+' : ''}
            {totals.balance.toLocaleString('tr-TR')} ₺
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
            Gelir - Gider farkı
          </span>
        </div>

        {/* Bugünkü Kasa Mevcudu (Toplam = Nakit + Havale + Kart) */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-transparent border border-amber-500/30 dark:border-amber-500/30 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-amber-800 dark:text-amber-400 tracking-wide">
              Bugünkü Kasa Mevcudu
            </span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-300 mt-2">
            {todayDailyBalance.total.toLocaleString('tr-TR')} ₺
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            <span>💵 {todayDailyBalance.cash.toLocaleString('tr-TR')} ₺</span>
            <span>•</span>
            <span>🏦 {todayDailyBalance.bank.toLocaleString('tr-TR')} ₺</span>
            <span>•</span>
            <span>💳 {todayDailyBalance.card.toLocaleString('tr-TR')} ₺</span>
          </div>
        </div>
      </div>

      {/* 3. Sekme Gezinme Çubuğu */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('transactions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'transactions'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Gelir & Gider Hareketleri</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white/20">
            {filteredTransactions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cash_register')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'cash_register'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Kasa & Günlük Mevcut</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white/20">
            {dailyBalances.length} Gün
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'categories'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>Kalem Tanımları (ERP)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white/20">
            {categories.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('registers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'registers'
              ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Kasa Tanımları</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white/20">
            {cashRegisters.length}
          </span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 4. SEKME 1: GELİR & GİDER HAREKETLERİ LİSTESİ             */}
      {/* ========================================================= */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {/* Filtre ve Arama Çubuğu */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Arama Inputu */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Kalem adı, ERP kodu, açıklama veya fiş no ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                title="Listeyi Excel olarak indir"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Excel İndir</span>
              </button>
            </div>

            {/* Hızlı Filtre Butonları */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {/* Tür Filtresi */}
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    filterType === 'all'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Tümü
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('income')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    filterType === 'income'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  🟢 Gelirler
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('expense')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    filterType === 'expense'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  🔴 Giderler
                </button>
              </div>

              {/* Dönem Filtresi */}
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setFilterPeriod('today')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    filterPeriod === 'today'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  Bugün
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPeriod('week')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    filterPeriod === 'week'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  Bu Hafta
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPeriod('month')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    filterPeriod === 'month'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  Bu Ay
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPeriod('year')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    filterPeriod === 'year'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  Bu Yıl
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPeriod('all')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    filterPeriod === 'all'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  Tüm Zamanlar
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPeriod('custom')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    filterPeriod === 'custom'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  Özel
                </button>
              </div>

              {/* Özel Tarih Aralığı */}
              {filterPeriod === 'custom' && (
                <div className="flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1" />
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-2 py-0.5 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 text-[11px] font-bold text-slate-700 dark:text-slate-200"
                  />
                  <span className="text-slate-400">-</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-2 py-0.5 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 text-[11px] font-bold text-slate-700 dark:text-slate-200"
                  />
                </div>
              )}

              {/* Ödeme Yöntemi Filtresi */}
              <select
                value={filterPaymentMethod}
                onChange={(e) => setFilterPaymentMethod(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">Ödeme Türü: Tümü</option>
                <option value="cash_register">Kasadan / Kasa</option>
                <option value="bank_transfer">Havale / Banka</option>
                <option value="credit_card">Kredi Kartı</option>
                <option value="out_of_pocket">Cepten (Şahsi)</option>
              </select>

              {/* Kalem Filtresi */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 focus:outline-none cursor-pointer max-w-[200px]"
              >
                <option value="all">Kalem: Tümü</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.code}] {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Hareketler Listesi / Tablosu */}
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3 border border-emerald-100 dark:border-emerald-900/50">
                <Receipt className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                Kayıtlı Hareket Bulunamadı
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
                Seçili filtrelerde gelir veya gider işlemi bulunamadı. Yukarıdaki butonlardan yeni işlem ekleyebilirsiniz.
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => openNewTxModal('income')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-sm"
                >
                  + Gelir Ekle
                </button>
                <button
                  type="button"
                  onClick={() => openNewTxModal('expense')}
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-sm"
                >
                  - Gider Ekle
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">
                      <th className="py-3 px-4">Tarih</th>
                      <th className="py-3 px-4">Tür</th>
                      <th className="py-3 px-4">ERP Kodu & Kalem</th>
                      <th className="py-3 px-4">Ödeme / Kasa</th>
                      <th className="py-3 px-4">Açıklama / Belge</th>
                      <th className="py-3 px-4 text-right">Tutar</th>
                      <th className="py-3 px-4 text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {filteredTransactions.map((tx) => {
                      const isIncome = tx.type === 'income';
                      return (
                        <tr
                          key={tx.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          {/* Tarih */}
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {tx.date}
                          </td>

                          {/* Tür */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                isIncome
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                              }`}
                            >
                              {isIncome ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                              <span>{isIncome ? 'GELİR' : 'GİDER'}</span>
                            </span>
                          </td>

                          {/* ERP Kodu & Kalem */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                                {tx.categoryCode || 'ERP'}
                              </span>
                              <span className="font-bold text-slate-900 dark:text-white">
                                {tx.categoryName}
                              </span>
                            </div>
                          </td>

                          {/* Ödeme / Kasa */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                                {tx.paymentMethod === 'cash_register' && <Banknote className="w-3.5 h-3.5 text-amber-500" />}
                                {tx.paymentMethod === 'bank_transfer' && <Landmark className="w-3.5 h-3.5 text-blue-500" />}
                                {tx.paymentMethod === 'credit_card' && <CreditCard className="w-3.5 h-3.5 text-purple-500" />}
                                {tx.paymentMethod === 'out_of_pocket' && <UserCheck className="w-3.5 h-3.5 text-rose-500" />}
                                <span>
                                  {tx.paymentMethod === 'cash_register' && 'Kasadan (Nakit)'}
                                  {tx.paymentMethod === 'bank_transfer' && 'Havale / Banka'}
                                  {tx.paymentMethod === 'credit_card' && 'Kredi Kartı'}
                                  {tx.paymentMethod === 'out_of_pocket' && 'Cepten (Şahsi)'}
                                </span>
                              </span>
                              {tx.cashRegisterName && (
                                <span className="text-[10px] text-slate-400">
                                  {tx.cashRegisterName}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Açıklama & Belge */}
                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-slate-800 dark:text-slate-200 truncate" title={tx.description}>
                                {tx.description || '-'}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                {tx.receiptNumber && <span>Fiş/Ftr: #{tx.receiptNumber}</span>}
                                {tx.receiptPhoto && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewImage(tx.receiptPhoto!)}
                                    className="text-blue-500 hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Görsel</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Tutar */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap font-black font-mono text-sm">
                            <span
                              className={
                                isIncome
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }
                            >
                              {isIncome ? '+' : '-'}
                              {tx.amount.toLocaleString('tr-TR')} ₺
                            </span>
                          </td>

                          {/* İşlemler */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditTxModal(tx)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Düzenle"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTx(tx)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Sil"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. SEKME 2: KASA TAKİBİ & GÜNLÜK MEVCUT                   */}
      {/* ========================================================= */}
      {activeTab === 'cash_register' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Sol Kolon: Günlük Kasa Mevcudu Giriş Kartı */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-900/40">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                      Günlük Kasa Mevcudu Girişi
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Nakit, havale ve kredi kartı tutarlarını girerek bugünkü mevcudu sabitleyin.
                    </p>
                  </div>
                </div>
              </div>

              {cashSuccessToast && (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Kasa mevcudu başarıyla kaydedildi!</span>
                </div>
              )}

              <form onSubmit={handleSaveCashBalance} className="space-y-3.5">
                {/* Kasa Adı ve Tarih Seçimi */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Kasa Adı
                    </label>
                    <select
                      value={cashRegisterName}
                      onChange={(e) => setCashRegisterName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      {cashRegisters.map((reg) => (
                        <option key={reg.id} value={reg.name}>
                          {reg.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Tarih
                    </label>
                    <input
                      type="date"
                      value={cashDate}
                      onChange={(e) => setCashDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* 1. Nakit Girişi */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Banknote className="w-3.5 h-3.5 text-amber-500" />
                      <span>Elden Nakit Tutarı</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Fiziki Para</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={cashNakit}
                      onChange={(e) => setCashNakit(e.target.value)}
                      className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      ₺
                    </span>
                  </div>
                </div>

                {/* 2. Havale / Banka Girişi */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Landmark className="w-3.5 h-3.5 text-blue-500" />
                      <span>Havale / Banka Tutarı</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Hesap Bakiyesi</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={cashHavale}
                      onChange={(e) => setCashHavale(e.target.value)}
                      className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      ₺
                    </span>
                  </div>
                </div>

                {/* 3. Kredi Kartı / POS Girişi */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-purple-500" />
                      <span>Kredi Kartı / POS Tutarı</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Gün Sonu POS</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={cashKrediKarti}
                      onChange={(e) => setCashKrediKarti(e.target.value)}
                      className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      ₺
                    </span>
                  </div>
                </div>

                {/* CANLI TOPLAM KARTI (Nakit + Havale + Kredi Kartı) */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-teal-700 text-white shadow-lg shadow-blue-600/15 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-100">
                      Toplam Kasa Mevcudu
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20">
                      3'lü Toplam
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono">
                    {liveCashTotal.toLocaleString('tr-TR')} ₺
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-blue-100 pt-1 border-t border-white/20">
                    <span>Nakit: {liveCashNakit.toLocaleString('tr-TR')} ₺</span>
                    <span>Havale: {liveCashHavale.toLocaleString('tr-TR')} ₺</span>
                    <span>POS: {liveCashKrediKarti.toLocaleString('tr-TR')} ₺</span>
                  </div>
                </div>

                {/* Not */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Gün Sonu / Kasa Notu (İsteğe Bağlı)
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: Akşam kapanış sayımı yapıldı..."
                    value={cashNotes}
                    onChange={(e) => setCashNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Kaydet Butonu */}
                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Kasa Mevcudunu Kaydet</span>
                </button>
              </form>
            </div>
          </div>

          {/* Sağ Kolon: Gün Gün Kasa Mevcutları Geçmiş Listesi */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Gün Gün Kasa Mevcutları</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                    {dailyBalances.length} Kayıt
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Her gün için sisteme işlenen Nakit, Havale ve Kredi Kartı dökümleri
                </p>
              </div>
            </div>

            {dailyBalances.length === 0 ? (
              <div className="text-center py-12 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800">
                <Wallet className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Henüz kaydedilmiş günlük kasa mevcudu bulunmuyor.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Soldaki formdan bugünkü kasa sayımını girebilirsiniz.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {dailyBalances.map((b) => {
                  const isToday = b.date === todayStr;
                  return (
                    <div
                      key={b.id || `${b.cashRegisterName}_${b.date}`}
                      className={`p-4 rounded-3xl border transition-all ${
                        isToday
                          ? 'bg-gradient-to-r from-blue-50/80 via-white to-blue-50/40 dark:from-blue-950/40 dark:via-slate-900 dark:to-slate-900 border-blue-400/80 dark:border-blue-600/60 shadow-sm'
                          : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs ${
                              isToday
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-black text-slate-900 dark:text-white">
                                {b.date}
                              </span>
                              {isToday && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                                  BUGÜN
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {b.cashRegisterName}
                              </span>
                            </div>
                            {b.notes && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {b.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Toplam Tutar */}
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400">
                            Toplam Mevcut
                          </span>
                          <p className="text-lg font-black text-slate-900 dark:text-white font-mono">
                            {b.totalAmount.toLocaleString('tr-TR')} ₺
                          </p>
                        </div>
                      </div>

                      {/* 3'lü Kasa Dağılım Kutucukları */}
                      <div className="grid grid-cols-3 gap-2 mt-3 pt-1">
                        <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
                          <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                            <Banknote className="w-3 h-3" />
                            <span>Nakit</span>
                          </span>
                          <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5">
                            {b.cashAmount.toLocaleString('tr-TR')} ₺
                          </p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40">
                          <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1">
                            <Landmark className="w-3 h-3" />
                            <span>Havale</span>
                          </span>
                          <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5">
                            {b.bankAmount.toLocaleString('tr-TR')} ₺
                          </p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40">
                          <span className="text-[10px] font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1">
                            <CreditCard className="w-3 h-3" />
                            <span>Kredi Kartı</span>
                          </span>
                          <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5">
                            {b.creditCardAmount.toLocaleString('tr-TR')} ₺
                          </p>
                        </div>
                      </div>

                      {/* Düzenleme Butonu */}
                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => handleSelectBalanceForEdit(b)}
                          className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Bu Günü Düzenle</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. SEKME 3: KALEM TANIMLARI (ERP KODLU)                   */}
      {/* ========================================================= */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Masraf & Gelir Kalemleri</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300">
                  ERP Kod Uyumlu
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sistemdeki tüm masraf ve gelir kalemlerini tanımlayın. İleride ERP entegrasyonu yapıldığında bu kodlar eşleşecektir.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openNewCategoryModal('expense')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Masraf Kalemi</span>
              </button>
              <button
                type="button"
                onClick={() => openNewCategoryModal('income')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Gelir Kalemi</span>
              </button>
            </div>
          </div>

          {/* Kalem Kartları Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories.map((cat) => {
              const isIncome = cat.type === 'income';
              return (
                <div
                  key={cat.id}
                  className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-start justify-between gap-3 hover:border-purple-300 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                        isIncome
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isIncome ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700">
                          {cat.code}
                        </span>
                        <span
                          className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                            isIncome
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                          }`}
                        >
                          {isIncome ? 'GELİR' : 'MASRAF/GİDER'}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white mt-1">
                        {cat.name}
                      </h4>
                      {cat.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {cat.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditCategoryModal(cat)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="Düzenle"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. SEKME 4: KASA TANIMLARI                                */}
      {/* ========================================================= */}
      {activeTab === 'registers' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Kasa Tanımları</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300">
                  {cashRegisters.length} Kasa
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Şirket merkez kasası, mağaza kasaları veya banka hesap kasaları
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsRegModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yeni Kasa Ekle</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {cashRegisters.map((reg) => (
              <div
                key={reg.id}
                className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                      {reg.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {reg.description || (reg.isDefault ? 'Varsayılan Ana Kasa' : 'Kayıtlı Kasa')}
                    </p>
                  </div>
                </div>

                {!reg.isDefault && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`"${reg.name}" kasasını silmek istediğinize emin misiniz?`)) {
                        deleteCashRegister(reg.id);
                      }
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    title="Kasayı Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: GELİR / GİDER EKLEME & DÜZENLEME MODALI          */}
      {/* ========================================================= */}
      {isTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Başlık */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${
                    txType === 'income' ? 'bg-emerald-600' : 'bg-rose-600'
                  }`}
                >
                  {txType === 'income' ? <Plus className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {editingTx
                      ? 'İşlemi Düzenle'
                      : txType === 'income'
                      ? 'Yeni Gelir Kaydı Ekle'
                      : 'Yeni Gider / Masraf Kaydı Ekle'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    ERP kodlu kalem seçimi ve ödeme yöntemi ile kayıt
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTxModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveTransaction} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
              {/* Tür Seçimi (Gelir / Gider) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  İşlem Türü
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTxType('income');
                      const firstInc = categories.find((c) => c.type === 'income' && c.isActive);
                      if (firstInc) setTxCategoryId(firstInc.id);
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                      txType === 'income'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>🟢 GELİR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTxType('expense');
                      const firstExp = categories.find((c) => c.type === 'expense' && c.isActive);
                      if (firstExp) setTxCategoryId(firstExp.id);
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                      txType === 'expense'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5" />
                    <span>🔴 GİDER / MASRAF</span>
                  </button>
                </div>
              </div>

              {/* Tutar */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tutar (₺) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    required
                    className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-base font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    ₺
                  </span>
                </div>
              </div>

              {/* Kalem Seçimi (Masraf Kalemi / Gelir Kalemi) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {txType === 'income' ? 'Gelir Kalemi *' : 'Masraf / Gider Kalemi *'}
                  </label>
                  <button
                    type="button"
                    onClick={() => openNewCategoryModal(txType)}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    + Yeni Kalem Tanımla
                  </button>
                </div>
                <select
                  value={txCategoryId}
                  onChange={(e) => setTxCategoryId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="">-- Kalem Seçiniz --</option>
                  {categories
                    .filter((c) => c.type === txType && c.isActive)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        [{cat.code}] {cat.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Ödeme / Tahsilat Yöntemi (Havale, Kasadan, Cepten, Kredi Kartı) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {txType === 'income' ? 'Tahsilat Yöntemi' : 'Ödeme Yöntemi'} *
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                  {/* Kasadan */}
                  <button
                    type="button"
                    onClick={() => setTxPaymentMethod('cash_register')}
                    className={`py-2 px-2.5 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                      txPaymentMethod === 'cash_register'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>Kasadan (Nakit)</span>
                  </button>

                  {/* Havale / EFT */}
                  <button
                    type="button"
                    onClick={() => setTxPaymentMethod('bank_transfer')}
                    className={`py-2 px-2.5 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                      txPaymentMethod === 'bank_transfer'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Landmark className="w-3.5 h-3.5" />
                    <span>Havale / Banka</span>
                  </button>

                  {/* Kredi Kartı */}
                  <button
                    type="button"
                    onClick={() => setTxPaymentMethod('credit_card')}
                    className={`py-2 px-2.5 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                      txPaymentMethod === 'credit_card'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Kredi Kartı / POS</span>
                  </button>

                  {/* Cepten (Şahsi) */}
                  <button
                    type="button"
                    onClick={() => setTxPaymentMethod('out_of_pocket')}
                    className={`py-2 px-2.5 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                      txPaymentMethod === 'out_of_pocket'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Cepten (Şahsi)</span>
                  </button>
                </div>
              </div>

              {/* Kasa Seçimi (Eğer Kasadan ise) */}
              {txPaymentMethod === 'cash_register' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    İlgili Kasa
                  </label>
                  <select
                    value={txCashRegister}
                    onChange={(e) => setTxCashRegister(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    {cashRegisters.map((reg) => (
                      <option key={reg.id} value={reg.name}>
                        {reg.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tarih & Belge No */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    İşlem Tarihi
                  </label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Fiş / Fatura No
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: A-012345"
                    value={txReceiptNumber}
                    onChange={(e) => setTxReceiptNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Açıklama */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Açıklama / Detay
                </label>
                <textarea
                  rows={2}
                  placeholder="İşlemle ilgili açıklama..."
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              {/* Fiş/Fatura Görseli */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Fiş / Fatura Belgesi Görseli
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 cursor-pointer flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{txReceiptPhoto ? 'Görseli Değiştir' : 'Fotoğraf Seç'}</span>
                  </button>
                  {txReceiptPhoto && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewImage(txReceiptPhoto)}
                        className="text-xs text-blue-500 font-bold hover:underline"
                      >
                        Önizle
                      </button>
                      <button
                        type="button"
                        onClick={() => setTxReceiptPhoto(undefined)}
                        className="text-xs text-rose-500 font-bold hover:underline"
                      >
                        Kaldır
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Kaydet Butonu */}
              <div className="pt-2">
                <button
                  type="submit"
                  className={`w-full py-3 px-4 rounded-2xl text-white font-black text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    txType === 'income'
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                      : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>{editingTx ? 'Değişiklikleri Kaydet' : txType === 'income' ? 'Geliri Kaydet' : 'Gideri Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: KALEM EKLEME & DÜZENLEME (ERP KODLU)             */}
      {/* ========================================================= */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {editingCat ? 'Kalemi Düzenle' : 'Yeni Kalem Tanımla (ERP)'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    ERP hesap kodları ile masraf veya gelir kalemi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCatModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-4 sm:p-5 space-y-3.5">
              {/* Kalem Türü */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kalem Türü
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCatType('expense');
                      if (!editingCat) setCatCode('770.');
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                      catType === 'expense'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    🔴 Masraf / Gider
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCatType('income');
                      if (!editingCat) setCatCode('600.');
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                      catType === 'income'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    🟢 Gelir
                  </button>
                </div>
              </div>

              {/* ERP Muhasebe Kodu */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ERP Muhasebe / Masraf Kodu *
                </label>
                <input
                  type="text"
                  placeholder="Örn: 770.01, GDR-01, GLR-01..."
                  value={catCode}
                  onChange={(e) => setCatCode(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Kalem Adı */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kalem Adı *
                </label>
                <input
                  type="text"
                  placeholder="Örn: Yemek Masrafı, Yol Gideri, Servis Geliri..."
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Açıklama */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Açıklama (İsteğe Bağlı)
                </label>
                <input
                  type="text"
                  placeholder="Kalemle ilgili ek detay..."
                  value={catDescription}
                  onChange={(e) => setCatDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-sm shadow-md shadow-purple-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingCat ? 'Kalemi Güncelle' : 'Kalemi Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: YENİ KASA TANIMLAMA                              */}
      {/* ========================================================= */}
      {isRegModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                Yeni Kasa Tanımla
              </h3>
              <button
                type="button"
                onClick={() => setIsRegModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddRegister} className="p-4 sm:p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kasa Adı *
                </label>
                <input
                  type="text"
                  placeholder="Örn: Mağaza Kasası, 2. Şube Kasası..."
                  value={newRegName}
                  onChange={(e) => setNewRegName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Açıklama (İsteğe Bağlı)
                </label>
                <input
                  type="text"
                  placeholder="Kasa hakkında not..."
                  value={newRegDescription}
                  onChange={(e) => setNewRegDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Kasayı Kaydet</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: FİŞ / FATURA GÖRSEL ÖNİZLEME                     */}
      {/* ========================================================= */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md cursor-pointer animate-in fade-in"
        >
          <div className="relative max-w-2xl max-h-[90vh] bg-slate-900 p-2 rounded-2xl border border-slate-800 shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-950/80 text-white hover:bg-rose-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImage}
              alt="Fiş / Fatura Belgesi"
              className="max-h-[82vh] w-auto max-w-full rounded-xl object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
};
