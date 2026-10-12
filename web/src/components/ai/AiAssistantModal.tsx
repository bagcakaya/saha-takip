import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sparkles,
  Mic,
  MicOff,
  Send,
  X,
  Check,
  Key,
  ExternalLink,
  ClipboardList,
  Wrench,
  Clock,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Settings2,
  Trash2,
  HelpCircle,
} from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';
import { AiService, AiParsedResponse, AiContextData } from '../../services/aiService';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  const { users } = useAuth();
  const {
    notes,
    services,
    accountingData,
    attendanceRecords,
    salaryRecords,
    leaveRequests,
    cariler,
    branches,
    addNote,
    addService,
    addAccountingTransaction,
    addTimedFollowUp,
  } = useStorage();

  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [parsedResponse, setParsedResponse] = useState<AiParsedResponse | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);

  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load API Key on Mount
  useEffect(() => {
    const currentKey = AiService.getApiKey();
    setHasApiKey(Boolean(currentKey));
    setApiKeyInput(currentKey);
  }, [isOpen]);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    } else {
      stopListening();
    }
  }, [isOpen]);

  // Context preparation for AI
  const aiContext: AiContextData = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayAttendance = (attendanceRecords || []).filter((r) => r.date === todayStr);

    const activeStaff = todayAttendance
      .filter((r) => r.status === 'checked_in')
      .map((r) => r.userName || r.userId);

    const completedStaff = todayAttendance
      .filter((r) => r.status === 'completed' || Boolean(r.checkOutTime))
      .map((r) => r.userName || r.userId);

    const monthlyIncome = (accountingData?.transactions || [])
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const monthlyExpense = (accountingData?.transactions || [])
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const todayCash = accountingData?.dailyBalances?.find((b) => b.date === todayStr);

    return {
      staffMembers: (users || []).map((u) => ({ id: u.id, name: u.name || u.username, role: u.role })),
      cariler: cariler || [],
      branches: (branches || []).map((b) => ({ id: b.id, name: b.name })),
      categories: (accountingData?.categories || []).map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        type: c.type,
      })),
      salaryRecords: (salaryRecords || []).map((s) => ({
        staffName: s.staffName,
        userId: s.userId,
        year: s.year,
        month: s.month,
        agreedAmount: s.agreedAmount,
        payments: (s.payments || []).map((p) => ({
          amount: Number(p.amount) || 0,
          paymentType: p.paymentMethod || 'bank',
          date: p.date,
          note: p.description,
        })),
      })),
      attendanceRecords: (attendanceRecords || []).map((r) => ({
        id: r.id,
        userId: r.userId,
        userName: r.userName || r.userId,
        date: r.date,
        checkInTime: r.checkInTime,
        checkOutTime: r.checkOutTime,
        status: r.status,
        workDurationMinutes: r.workDurationMinutes,
        totalBreakMinutes: r.totalBreakMinutes,
        branchName: r.branchName || r.assignedBranchName,
      })),
      leaveRequests: (leaveRequests || []).map((l) => ({
        id: l.id,
        userName: l.userName || l.userId,
        startDate: l.date,
        endDate: l.endDate,
        type: l.leaveType,
        status: l.status,
        reason: l.reason,
      })),
      notes: (notes || []).map((n) => ({
        id: n.id,
        content: n.content,
        cariName: n.cariName,
        targetUserNames: n.targetUserNames,
        reminderDate: n.reminderDate,
        status: n.status || 'pending',
        createdAt: n.createdAt,
      })),
      services: (services || []).map((s) => ({
        id: s.id,
        companyName: s.companyName,
        cariName: s.cariName,
        workDone: s.workDone,
        location: s.location,
        status: s.status || 'pending',
        date: s.date,
        createdByName: s.createdByName,
      })),
      accountingTransactions: (accountingData?.transactions || []).map((t) => ({
        id: t.id,
        type: t.type,
        categoryName: t.categoryName,
        amount: Number(t.amount) || 0,
        paymentMethod: t.paymentMethod,
        date: t.date,
        description: t.description,
      })),
      dailyBalances: (accountingData?.dailyBalances || []).map((b) => ({
        date: b.date,
        cashAmount: Number(b.cashAmount) || 0,
        bankAmount: Number(b.bankAmount) || 0,
        creditCardAmount: Number(b.creditCardAmount) || 0,
        totalAmount: Number(b.totalAmount) || 0,
        notes: b.notes,
      })),
      systemSummary: {
        today: todayStr,
        pendingNotesCount: (notes || []).filter((n) => !n.status || n.status === 'pending').length,
        pendingServicesCount: (services || []).filter((s) => !s.status || s.status === 'pending').length,
        activeStaffNames: activeStaff,
        completedStaffNames: completedStaff,
        monthlyIncome,
        monthlyExpense,
        cashBalance: todayCash?.totalAmount || 0,
        todayCash: todayCash?.cashAmount || 0,
        todayBank: todayCash?.bankAmount || 0,
        todayCreditCard: todayCash?.creditCardAmount || 0,
      },
    };
  }, [users, cariler, branches, accountingData, notes, services, attendanceRecords, salaryRecords, leaveRequests]);

  // --------------------------------------------------------------------------
  // Web Speech API Voice Recognition (Browser Native - Free & Unlimited)
  // --------------------------------------------------------------------------
  const startListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Tarayıcınız ses tanıma özelliğini desteklemiyor. Chrome veya Edge kullanmanızı öneririz.');
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'tr-TR';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('Ses tanıma hatası:', e);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Mikrofon başlatılamadı:', err);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // --------------------------------------------------------------------------
  // Process Prompt with AI
  // --------------------------------------------------------------------------
  const handleProcess = async (textToProcess?: string) => {
    const targetText = (textToProcess || prompt).trim();
    if (!targetText) return;

    stopListening();
    setIsProcessing(true);
    setParsedResponse(null);
    setActionSuccessMessage(null);

    try {
      const response = await AiService.processCommand(targetText, aiContext);
      setParsedResponse(response);
    } catch (err: any) {
      alert('Yapay zeka işleme sırasında bir hata oluştu: ' + (err?.message || err));
    } finally {
      setIsProcessing(false);
    }
  };

  // --------------------------------------------------------------------------
  // Commit Action to System Database
  // --------------------------------------------------------------------------
  const handleCommitAction = async () => {
    if (!parsedResponse) return;
    const { actionType, data } = parsedResponse;
    setIsProcessing(true);

    try {
      if (actionType === 'create_note') {
        const content = data.noteContent || prompt;
        const targetUserId = data.targetUserId;
        const targetUserName = data.targetUserName;
        const reminderDate = data.reminderDate;
        const reminderTime = data.reminderTime || '09:00';
        const reminderActive = Boolean(data.reminderActive && reminderDate);
        const combinedReminder = reminderActive && reminderDate ? `${reminderDate}T${reminderTime}` : undefined;

        await addNote(
          content,
          reminderActive,
          combinedReminder,
          targetUserId ? 'custom' : 'all',
          targetUserId ? [targetUserId] : undefined,
          targetUserName ? [targetUserName] : undefined,
          undefined,
          data.cariName
        );

        setActionSuccessMessage('İş emri ve görev başarıyla oluşturuldu!');
        if (onNavigateTab) onNavigateTab('notes');
      } else if (actionType === 'create_service') {
        await addService({
          companyName: data.customerName || data.cariName || 'Müşteri',
          cariName: data.cariName || data.customerName,
          location: data.address || '',
          workDone: data.serviceNotes || prompt,
          date: new Date().toISOString(),
          photos: [],
          status: 'pending',
        });

        setActionSuccessMessage('Teknik servis kaydı sisteme kaydedildi!');
        if (onNavigateTab) onNavigateTab('services');
      } else if (actionType === 'create_accounting') {
        const amt = Number(data.amount) || 0;
        if (amt <= 0) {
          alert('Geçerli bir tutar bulunamadı.');
          setIsProcessing(false);
          return;
        }

        await addAccountingTransaction({
          type: data.txType || 'expense',
          categoryId: data.categoryId || 'cat_genel',
          categoryCode: data.categoryCode || (data.txType === 'income' ? '600.01' : '770.01'),
          categoryName: data.categoryName || (data.txType === 'income' ? 'Hizmet Geliri' : 'Genel Masraf'),
          amount: amt,
          paymentMethod: data.paymentMethod || 'cash_register',
          date: data.txDate || new Date().toISOString().split('T')[0],
          description: data.txDescription || prompt,
        });

        setActionSuccessMessage(
          `${amt.toLocaleString('tr-TR')} ₺ tutarındaki ${data.txType === 'income' ? 'gelir' : 'gider'} kaydı muhasebeye işlendi!`
        );
        if (onNavigateTab) onNavigateTab('accounting');
      } else if (actionType === 'create_follow_up') {
        await addTimedFollowUp({
          cariName: data.followUpCari || 'Genel Cari',
          description: data.followUpDescription || prompt,
          dueDate: data.followUpDate || `${new Date().toISOString().split('T')[0]}T10:00`,
          soundAlarm: data.soundAlarm !== false,
          sendPush: true,
        });

        setActionSuccessMessage('Zaman ayarlı süreli takip ve cari alarmı oluşturuldu!');
        if (onNavigateTab) onNavigateTab('timed_follow_ups');
      }

      setPrompt('');
      setTimeout(() => {
        onClose();
        setActionSuccessMessage(null);
        setParsedResponse(null);
      }, 1400);
    } catch (err: any) {
      console.error('İşlem kaydetme hatası:', err);
      alert('İşlem kaydedilirken bir hata oluştu: ' + (err?.message || err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveApiKey = () => {
    AiService.setApiKey(apiKeyInput);
    setHasApiKey(Boolean(apiKeyInput.trim()));
    setIsSettingsOpen(false);
    alert('Google Gemini API Anahtarı başarıyla kaydedildi!');
  };

  const handleRemoveApiKey = () => {
    AiService.setApiKey('');
    setApiKeyInput('');
    setHasApiKey(false);
    alert('API Anahtarı kaldırıldı. Sistem dahili akıllı kurallarla (sıfır token) çalışmaya devam edecektir.');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Başlığı */}
        <div className="px-5 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight flex items-center gap-2">
                <span>Yapay Zekâ Asistanı</span>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
                  title="Model ayarları ve ücretsiz Gemini API anahtarı"
                >
                  {hasApiKey ? '⚡ Gemini 1.5 Flash' : '🧠 Akıllı Yerel NLP (⚙️)'}
                </button>
              </h2>
              <p className="text-xs text-white/80">
                Sesle konuşun veya yazın; iş emri, servis, masraf ve takipleri anında oluştursun.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              title="API ve Model Ayarları"
            >
              <Settings2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Gövdesi */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* API Ayarları Açılır Bölümü */}
          {isSettingsOpen && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3 animate-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-100">
                  <Key className="w-4 h-4 text-amber-500" />
                  <span>Google Gemini API Anahtarı (Tamamen Ücretsiz)</span>
                </div>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <span>Ücretsiz Anahtar Al</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Google Gemini Flash modeli günde <strong>1.500 isteğe kadar tamamen ücretsizdir</strong>. Kredi kartı istemez.
                Anahtar girmeseniz dahi dahili Türkçe kural motorumuz sıfır tokenle sorunsuz çalışır.
              </p>

              <div className="flex items-center gap-2">
                <input
                  type="password"
                  placeholder="AIzaSy... ile başlayan ücretsiz anahtarınızı yapıştırın"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleSaveApiKey}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Kaydet
                </button>
                {hasApiKey && (
                  <button
                    type="button"
                    onClick={handleRemoveApiKey}
                    className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition-colors"
                    title="Anahtarı Kaldır"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Başarı Mesajı Bildirimi */}
          {actionSuccessMessage && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center gap-3 animate-in zoom-in-95 duration-150">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-black">{actionSuccessMessage}</p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                  Sayfaya yönlendiriliyorsunuz...
                </p>
              </div>
            </div>
          )}

          {/* Giriş Alanı: Metin / Ses */}
          <div className="relative rounded-2xl border-2 border-indigo-200 dark:border-indigo-900/60 bg-slate-50 dark:bg-slate-800/40 p-3 focus-within:border-indigo-500 transition-colors">
            <textarea
              ref={inputRef}
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Örnek: Ahmet ustaya yarın sabah 10:00'da Maya Pastanesine acil fırın arızası iş emri aç... veya mikrofona konuşun."
              className="w-full bg-transparent border-0 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleProcess();
                }
              }}
            />

            <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 dark:border-slate-700/80">
              <div className="flex items-center gap-2">
                {/* Mikrofon ile Sesli Giriş */}
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    isListening
                      ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-500/30'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                  }`}
                  title={isListening ? 'Dinlemeyi Durdur' : 'Mikrofona Konuş'}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-3.5 h-3.5 text-white" />
                      <span>Dinleniyor...</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Sesle Konuş</span>
                    </>
                  )}
                </button>

                {prompt && (
                  <button
                    type="button"
                    onClick={() => {
                      setPrompt('');
                      setParsedResponse(null);
                    }}
                    className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    Temizle
                  </button>
                )}
              </div>

              {/* Gönder / İşle Butonu */}
              <button
                type="button"
                disabled={isProcessing || !prompt.trim()}
                onClick={() => handleProcess()}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-white transition-all cursor-pointer ${
                  isProcessing || !prompt.trim()
                    ? 'bg-slate-400 cursor-not-allowed opacity-60'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-indigo-500/25'
                }`}
              >
                {isProcessing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>İnceleniyor...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Yapay Zekâya Sor</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Hızlı Örnek Komut Çipleri */}
          {!parsedResponse && (
            <div className="space-y-2">
              <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                <span>Deneyebileceğiniz Örnek Komutlar:</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  {
                    label: '💼 İş Emri Aç',
                    text: "Ahmet ustaya yarın 10:00'da Maya Pastanesine fırın rezistansı arızası için iş emri aç",
                  },
                  {
                    label: '💰 Masraf Gir',
                    text: 'Bugün kasadan 450 TL öğle yemeği masrafı gir',
                  },
                  {
                    label: '🔧 Servis Kaydı',
                    text: 'Kadıköy Maya Pastanesi şubesine klima gaz basımı servis kaydı aç, tutar 1500 TL',
                  },
                  {
                    label: '⏰ Süreli Takip',
                    text: 'Maya Pastanesi ile Cuma günü sözleşme yenileme için görüş, alarm kur',
                  },
                  {
                    label: '📊 Canlı Rapor',
                    text: 'Bugün bekleyen işler, masraflar ve kasa durumu nedir?',
                  },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setPrompt(item.text);
                      handleProcess(item.text);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/40 text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors text-left"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Yapay Zeka Sonuç & Onay Kartı */}
          {parsedResponse && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md p-4 space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  {parsedResponse.actionType === 'create_note' && (
                    <div className="p-2 rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
                      <ClipboardList className="w-5 h-5" />
                    </div>
                  )}
                  {parsedResponse.actionType === 'create_service' && (
                    <div className="p-2 rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                      <Wrench className="w-5 h-5" />
                    </div>
                  )}
                  {parsedResponse.actionType === 'create_accounting' && (
                    <div
                      className={`p-2 rounded-xl ${
                        parsedResponse.data.txType === 'income'
                          ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                      }`}
                    >
                      {parsedResponse.data.txType === 'income' ? (
                        <TrendingUp className="w-5 h-5" />
                      ) : (
                        <TrendingDown className="w-5 h-5" />
                      )}
                    </div>
                  )}
                  {parsedResponse.actionType === 'create_follow_up' && (
                    <div className="p-2 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                      <Clock className="w-5 h-5" />
                    </div>
                  )}
                  {parsedResponse.actionType === 'system_query' && (
                    <div className="p-2 rounded-xl bg-teal-100 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400">
                      <HelpCircle className="w-5 h-5" />
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      {parsedResponse.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {parsedResponse.provider === 'gemini' ? 'Gemini 1.5 Flash tarafından ayrıştırıldı' : 'Dahili Akıllı Kural Motoru'}
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  Güven: %{Math.round(parsedResponse.confidence * 100)}
                </span>
              </div>

              {/* Açıklama & Yanıt */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line border border-slate-100 dark:border-slate-800">
                {parsedResponse.explanation}
              </div>

              {/* Ayrıştırılan Veri Alanları */}
              {parsedResponse.actionType !== 'system_query' && parsedResponse.actionType !== 'general_chat' && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {parsedResponse.data.cariName && (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Cari / Müşteri</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">
                        {parsedResponse.data.cariName}
                      </span>
                    </div>
                  )}

                  {parsedResponse.data.targetUserName && (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Atanan Personel</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">
                        {parsedResponse.data.targetUserName}
                      </span>
                    </div>
                  )}

                  {parsedResponse.data.amount !== undefined && (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Tutar & Tür</span>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                        {parsedResponse.data.amount.toLocaleString('tr-TR')} ₺ ({parsedResponse.data.txType === 'income' ? 'Gelir' : 'Gider'})
                      </span>
                    </div>
                  )}

                  {parsedResponse.data.categoryName && (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Kalem & Kod</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">
                        [{parsedResponse.data.categoryCode}] {parsedResponse.data.categoryName}
                      </span>
                    </div>
                  )}

                  {parsedResponse.data.reminderDate && (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Zaman / Alarm</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">
                        {parsedResponse.data.reminderDate} {parsedResponse.data.reminderTime || ''}
                      </span>
                    </div>
                  )}

                  {parsedResponse.data.paymentMethod && (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Ödeme Türü</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">
                        {parsedResponse.data.paymentMethod === 'cash_register' && 'Kasadan (Nakit)'}
                        {parsedResponse.data.paymentMethod === 'bank_transfer' && 'Havale / Banka'}
                        {parsedResponse.data.paymentMethod === 'credit_card' && 'Kredi Kartı'}
                        {parsedResponse.data.paymentMethod === 'out_of_pocket' && 'Cepten (Şahsi)'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Onayla ve Kaydet Butonları */}
              {parsedResponse.actionType !== 'system_query' && parsedResponse.actionType !== 'general_chat' && (
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setParsedResponse(null)}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Vazgeç
                  </button>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleCommitAction}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/25 transition-all cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Onayla ve Sisteme Kaydet</span>
                  </button>
                </div>
              )}

              {/* Soru & Rapor Yanıtları İçin Hızlı Yönlendirme ve Temizleme Çubuğu */}
              {(parsedResponse.actionType === 'system_query' || parsedResponse.actionType === 'general_chat') && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {parsedResponse.title.toLowerCase().includes('maaş') && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          if (onNavigateTab) onNavigateTab('staff_tracking');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200/80 dark:border-indigo-800 hover:bg-indigo-100 transition-colors cursor-pointer"
                      >
                        💳 Maaş Takibine Git
                      </button>
                    )}
                    {parsedResponse.title.toLowerCase().includes('servis') && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          if (onNavigateTab) onNavigateTab('services');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-xs font-bold border border-amber-200/80 dark:border-amber-800 hover:bg-amber-100 transition-colors cursor-pointer"
                      >
                        🔧 Servislere Git
                      </button>
                    )}
                    {parsedResponse.title.toLowerCase().includes('finans') && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          if (onNavigateTab) onNavigateTab('accounting');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200/80 dark:border-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
                      >
                        💰 Muhasebeye Git
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setParsedResponse(null);
                      setPrompt('');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Yeni Soru Sor
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
