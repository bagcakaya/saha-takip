/**
 * AI Assistant Service for Saha Takip System
 * Powered by Google Gemini 1.5/2.0 Flash (Free Tier: 1,500 requests/day at zero cost)
 * with a built-in Offline / Local NLP Rule Engine as instant zero-setup fallback.
 */

export interface AiContextData {
  staffMembers: Array<{ id: string; name: string; role?: string }>;
  cariler: string[];
  branches: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; code: string; name: string; type: 'income' | 'expense' }>;
  salaryRecords?: Array<{
    staffName: string;
    userId: string;
    year: number;
    month: number;
    agreedAmount?: number;
    payments: Array<{ amount: number; paymentType: string; date?: string; note?: string }>;
  }>;
  attendanceRecords?: Array<{
    id: string;
    userId: string;
    userName: string;
    date: string;
    checkInTime: number;
    checkOutTime?: number;
    status: string;
    workDurationMinutes?: number;
    totalBreakMinutes?: number;
    branchName?: string;
  }>;
  leaveRequests?: Array<{
    id: string;
    userName: string;
    startDate: string;
    endDate?: string;
    type?: string;
    status: string;
    reason?: string;
  }>;
  notes?: Array<{
    id: string;
    content: string;
    cariName?: string;
    targetUserNames?: string[];
    reminderDate?: string;
    status?: string;
    createdAt?: number;
  }>;
  services?: Array<{
    id: string;
    companyName: string;
    cariName?: string;
    workDone: string;
    location?: string;
    status?: string;
    date?: string;
    createdByName?: string;
  }>;
  accountingTransactions?: Array<{
    id: string;
    type: 'income' | 'expense';
    categoryName: string;
    amount: number;
    paymentMethod: string;
    date: string;
    description?: string;
  }>;
  dailyBalances?: Array<{
    date: string;
    cashAmount: number;
    bankAmount: number;
    creditCardAmount: number;
    totalAmount: number;
    notes?: string;
  }>;
  systemSummary?: {
    today: string;
    pendingNotesCount: number;
    pendingServicesCount: number;
    activeStaffNames: string[];
    completedStaffNames?: string[];
    monthlyIncome: number;
    monthlyExpense: number;
    cashBalance: number;
    todayCash?: number;
    todayBank?: number;
    todayCreditCard?: number;
  };
}

export type AiActionType =
  | 'create_note'         // İş Emri / Not Açma
  | 'create_service'      // Servis Kaydı Açma
  | 'create_accounting'   // Muhasebe Gelir veya Gider
  | 'create_follow_up'    // Süreli Takip / Cari Hatırlatıcı
  | 'system_query'        // Sistem verileri hakkında soru sorma / özet
  | 'general_chat';       // Genel asistan sohbeti

export type AiModelId =
  | 'gemini-2.5-pro'
  | 'gemini-2.5-flash'
  | 'gemini-2.0-flash'
  | 'groq-llama-3.3-70b'
  | 'groq-deepseek-r1'
  | 'local-nlp';

export interface AiModelOption {
  id: AiModelId;
  name: string;
  badge: string;
  provider: 'gemini' | 'groq' | 'local_nlp';
  description: string;
  freeQuotaNote: string;
}

export const AI_MODEL_OPTIONS: AiModelOption[] = [
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    badge: '🧠 Gemini 2.5 Pro',
    provider: 'gemini',
    description: 'En üst düzey akıl yürütme (reasoning), karmaşık muhasebe/puantaj analizi. (Kota dolarsa 2.5 Flash\'a otomatik geçer)',
    freeQuotaNote: 'Google AI Studio Ücretsiz Kota',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    badge: '🚀 Gemini 2.5 Flash',
    provider: 'gemini',
    description: 'Yeni nesil hibrit model. 1.5 Flash\'tan çok daha zeki, çok hızlı ve geniş ücretsiz kullanım hakkı.',
    freeQuotaNote: 'Günde 1.500 İstek Ücretsiz',
  },
  {
    id: 'groq-llama-3.3-70b',
    name: 'Llama 3.3 70B (Groq)',
    badge: '🔥 Llama 3.3 70B',
    provider: 'groq',
    description: 'Meta\'nın 70 Milyar parametreli güçlü modeli. Groq LPU üzerinde saniyede ~500 kelime hızında çalışır.',
    freeQuotaNote: 'Groq Cloud Ücretsiz Kota',
  },
  {
    id: 'groq-deepseek-r1',
    name: 'DeepSeek R1 70B (Groq)',
    badge: '🧬 DeepSeek R1 70B',
    provider: 'groq',
    description: 'Adım adım derin düşünme (Chain-of-Thought) odaklı ileri analiz modeli.',
    freeQuotaNote: 'Groq Cloud Ücretsiz Kota',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    badge: '⚡ Gemini 2.0 Flash',
    provider: 'gemini',
    description: 'Düşük gecikmeli hızlı standart Google Gemini 2.0 modeli.',
    freeQuotaNote: 'Günde 1.500 İstek Ücretsiz',
  },
  {
    id: 'local-nlp',
    name: 'Dahili Akıllı Kural Motoru',
    badge: '🛡️ Yerel NLP (Çevrimdışı)',
    provider: 'local_nlp',
    description: 'API anahtarı veya internet gerektirmeden sıfır token ile çalışan yerleşik Türkçe kural motoru.',
    freeQuotaNote: 'Sınırsız & Anahtarsız',
  },
];

export interface AiParsedResponse {
  actionType: AiActionType;
  title: string;
  explanation: string;
  confidence: number;
  provider: 'gemini' | 'groq' | 'local_nlp';
  modelLabel?: string;
  data: {
    // create_note fields:
    noteContent?: string;
    cariName?: string;
    targetUserId?: string;
    targetUserName?: string;
    reminderDate?: string;
    reminderTime?: string;
    reminderActive?: boolean;

    // create_service fields:
    serviceTitle?: string;
    customerName?: string;
    address?: string;
    contactPerson?: string;
    contactPhone?: string;
    serviceNotes?: string;
    assignedTo?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';

    // create_accounting fields:
    txType?: 'income' | 'expense';
    amount?: number;
    categoryCode?: string;
    categoryName?: string;
    categoryId?: string;
    paymentMethod?: 'cash_register' | 'bank_transfer' | 'credit_card' | 'out_of_pocket';
    txDate?: string;
    txDescription?: string;

    // create_follow_up fields:
    followUpCari?: string;
    followUpDescription?: string;
    followUpDate?: string;
    soundAlarm?: boolean;

    // general query or text answer
    answer?: string;
  };
}

const STORAGE_KEY_GEMINI = '@saha_takip_gemini_api_key';
const STORAGE_KEY_GROQ = '@saha_takip_groq_api_key';
const STORAGE_KEY_SELECTED_MODEL = '@saha_takip_ai_selected_model';

export const AiService = {
  /**
   * Seçili AI modelini alır (Varsayılan: gemini-2.5-pro)
   */
  getSelectedModel(): AiModelId {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY_SELECTED_MODEL) as AiModelId | null;
      if (stored && AI_MODEL_OPTIONS.some((m) => m.id === stored)) {
        return stored;
      }
    }
    return 'gemini-2.5-pro';
  },

  /**
   * Seçili AI modelini kaydeder
   */
  setSelectedModel(modelId: AiModelId): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_SELECTED_MODEL, modelId);
    }
  },

  /**
   * Seçili modelin bilgilerini döndürür
   */
  getSelectedModelOption(): AiModelOption {
    const id = this.getSelectedModel();
    return AI_MODEL_OPTIONS.find((m) => m.id === id) || AI_MODEL_OPTIONS[0];
  },

  /**
   * Gemini API anahtarını alır (Önce localStorage, sonra env)
   */
  getApiKey(): string {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY_GEMINI);
      if (stored && stored.trim()) return stored.trim();
    }
    try {
      const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
      if (envKey && typeof envKey === 'string' && envKey.trim()) return envKey.trim();
    } catch {}
    return '';
  },

  /**
   * Gemini API anahtarını kaydeder
   */
  setApiKey(key: string): void {
    if (typeof localStorage !== 'undefined') {
      const trimmed = (key || '').trim();
      // Eğer kullanıcı yanlışlıkla gsk_ ile başlayan Groq anahtarını buraya yapıştırdıysa otomatik Groq'a da kaydet
      if (trimmed.startsWith('gsk_')) {
        localStorage.setItem(STORAGE_KEY_GROQ, trimmed);
        return;
      }
      if (trimmed) {
        localStorage.setItem(STORAGE_KEY_GEMINI, trimmed);
      } else {
        localStorage.removeItem(STORAGE_KEY_GEMINI);
      }
    }
  },

  /**
   * Groq Cloud API anahtarını alır (Önce localStorage, sonra env)
   */
  getGroqApiKey(): string {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY_GROQ);
      if (stored && stored.trim()) return stored.trim();
    }
    try {
      const envKey = (import.meta as any).env?.VITE_GROQ_API_KEY;
      if (envKey && typeof envKey === 'string' && envKey.trim()) return envKey.trim();
    } catch {}
    return '';
  },

  /**
   * Groq Cloud API anahtarını kaydeder
   */
  setGroqApiKey(key: string): void {
    if (typeof localStorage !== 'undefined') {
      const trimmed = (key || '').trim();
      if (trimmed.startsWith('AIza')) {
        localStorage.setItem(STORAGE_KEY_GEMINI, trimmed);
        return;
      }
      if (trimmed) {
        localStorage.setItem(STORAGE_KEY_GROQ, trimmed);
      } else {
        localStorage.removeItem(STORAGE_KEY_GROQ);
      }
    }
  },

  /**
   * Kullanıcının girdiği isteği seçili modele göre işler:
   * 1. Seçili model Gemini ise (2.5 Pro / 2.5 Flash / 2.0 Flash) Google AI Studio API'sine sorar.
   * 2. Seçili model Groq ise (Llama 3.3 70B / DeepSeek R1 70B) Groq Cloud LPU API'sine sorar.
   * 3. Seçili modelin anahtarı yoksa diğer sağlayıcıyı dener, o da yoksa dahili Akıllı Kural Motorunu (Local NLP) çalıştırır.
   */
  async processCommand(userPrompt: string, context: AiContextData): Promise<AiParsedResponse> {
    const trimmed = userPrompt.trim();
    if (!trimmed) {
      return {
        actionType: 'general_chat',
        title: 'Boş İstek',
        explanation: 'Lütfen bir komut, soru veya iş emri metni giriniz.',
        confidence: 0,
        provider: 'local_nlp',
        modelLabel: 'Dahili Akıllı Kural Motoru',
        data: {},
      };
    }

    const selectedModel = this.getSelectedModel();
    const geminiKey = this.getApiKey();
    const groqKey = this.getGroqApiKey();

    if (selectedModel === 'local-nlp') {
      return this.parseWithLocalRules(trimmed, context);
    }

    // 1. Kullanıcı Groq modeli seçtiyse önce Groq dene
    if (selectedModel.startsWith('groq-')) {
      if (groqKey) {
        try {
          const groqResult = await this.callGroqApi(trimmed, context, groqKey, selectedModel);
          if (groqResult) return groqResult;
        } catch (err) {
          console.warn('[AiService] Groq API çağrısı başarısız oldu, yedek modele geçiliyor:', err);
        }
      }
      // Groq anahtarı yoksa ama Gemini anahtarı varsa Gemini ile yanıtla
      if (geminiKey) {
        try {
          const geminiFallback = await this.callGeminiApi(trimmed, context, geminiKey, 'gemini-2.5-flash');
          if (geminiFallback) return geminiFallback;
        } catch {}
      }
    } else {
      // 2. Kullanıcı Gemini modeli seçtiyse önce Gemini dene
      if (geminiKey) {
        try {
          const geminiResult = await this.callGeminiApi(trimmed, context, geminiKey, selectedModel);
          if (geminiResult) return geminiResult;
        } catch (err) {
          console.warn('[AiService] Gemini API çağrısı başarısız oldu, yedek modele geçiliyor:', err);
        }
      }
      // Gemini anahtarı yoksa ama Groq anahtarı varsa Groq ile yanıtla
      if (groqKey) {
        try {
          const groqFallback = await this.callGroqApi(trimmed, context, groqKey, 'groq-llama-3.3-70b');
          if (groqFallback) return groqFallback;
        } catch {}
      }
    }

    // Yerel Kural Tabanlı Doğal Dil Ayrıştırıcısı (Sıfır Token / Çevrimdışı Çalışır)
    return this.parseWithLocalRules(trimmed, context);
  },

  /**
   * Ortak Türkçe Sistem Yönergesi (Gemini & Groq için)
   */
  buildSystemInstruction(context: AiContextData): string {
    const todayStr = new Date().toISOString().split('T')[0];
    const nowTimeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    return `
Sen Saha Takip ve Yönetim Sistemi için tasarlanmış uzman, pratik ve hızlı bir Türkçe Yapay Zeka Asistanısın.
Bugünün tarihi: ${todayStr}, saat: ${nowTimeStr}.

Sistemdeki Canlı Veriler:
- Personeller: ${JSON.stringify(context.staffMembers.map((s) => ({ id: s.id, name: s.name, role: s.role })))}
- Cariler / Müşteriler: ${JSON.stringify(context.cariler.slice(0, 40))}
- Masraf ve Gelir Kalemleri (ERP Kodlu): ${JSON.stringify(context.categories.map((c) => ({ id: c.id, code: c.code, name: c.name, type: c.type })))}
- Personel Mesai & Puantaj Kayıtları: ${JSON.stringify(
  (context.attendanceRecords || []).slice(0, 50).map((r) => {
    let diffMins = 0;
    if (r.workDurationMinutes && r.workDurationMinutes > 0) diffMins = r.workDurationMinutes;
    else if (r.checkOutTime && r.checkInTime) diffMins = Math.max(0, Math.round((r.checkOutTime - r.checkInTime) / 60000));
    else if (r.checkInTime) diffMins = Math.max(0, Math.round((Date.now() - r.checkInTime) / 60000));
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return {
      personel: r.userName,
      tarih: r.date,
      giris: r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : null,
      cikis: r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : null,
      durum: r.status === 'completed' || r.checkOutTime ? 'Mesaisi Bitti (Çıkış Yaptı)' : 'Halen İşte (Çalışıyor)',
      toplamMesai: `${h} sa ${m} dk`,
      molaDakika: r.totalBreakMinutes || 0,
      sube: r.branchName || 'Merkez Şube',
    };
  })
)}
- İzinli Personeller: ${JSON.stringify((context.leaveRequests || []).slice(0, 20).map((l) => ({ personel: l.userName, baslangic: l.startDate, bitis: l.endDate, tur: l.type, durum: l.status, sebep: l.reason })))}
- Bekleyen Teknik Servisler: ${JSON.stringify((context.services || []).filter((s) => s.status !== 'completed' && s.status !== 'approved').slice(0, 25).map((s) => ({ cari: s.cariName || s.companyName, is: s.workDone, konum: s.location, tarih: s.date })))}
- Bekleyen İş Emirleri & Görevler: ${JSON.stringify((context.notes || []).filter((n) => !n.status || n.status === 'pending').slice(0, 25).map((n) => ({ icerik: n.content, hedefPersoneller: n.targetUserNames, cari: n.cariName, tarih: n.reminderDate })))}
- Kasa & Finans: ${JSON.stringify({
    toplamKasa: context.systemSummary?.cashBalance || 0,
    nakit: context.systemSummary?.todayCash || 0,
    banka: context.systemSummary?.todayBank || 0,
    pos: context.systemSummary?.todayCreditCard || 0,
    aylikGelir: context.systemSummary?.monthlyIncome || 0,
    aylikGider: context.systemSummary?.monthlyExpense || 0,
    sonHareketler: (context.accountingTransactions || []).slice(0, 8).map((t) => ({ tur: t.type, kalem: t.categoryName, tutar: t.amount, yontem: t.paymentMethod, tarih: t.date, aciklama: t.description })),
  })}
- Maaş & Avans Ödemeleri: ${JSON.stringify(
  (context.salaryRecords || []).slice(0, 30).map((s) => ({
    personel: s.staffName,
    yil: s.year,
    ay: s.month,
    anlasilanMaas: s.agreedAmount,
    toplamOdenen: (s.payments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0),
    odemeler: s.payments,
  }))
)}
- Sistem Canlı Özeti: ${JSON.stringify(context.systemSummary || {})}

GÖREVİN:
Kullanıcının Türkçe komutunu, konuşmasını veya sorusunu incele.
ÖNEMLİ KURAL:
Eğer kullanıcı bir soru soruyorsa (örn: 'Bugün Mesaisi biten personel dahil Kim, ne kadar mesai yaptı', 'Eylül ayında kime ne kadar maaş verdik', 'Kaç bekleyen servis var', 'Kasa durumu nedir' vb.), 'actionType': 'system_query' seç ve cevabı 'explanation' alanında detaylı, kibar, maddeli ve biçimlendirilmiş Türkçe olarak açıkla. ASLA bir soruya 'create_note' (iş emri) açmaya kalkma!

Aşağıdaki 'actionType' seçeneklerinden en uygun olanını seç:
1. 'create_note': SADECE kullanıcı açıkça personele görev atamak veya iş emri/not açmak istediğinde ('Ahmet'e iş emri aç', 'görev ata', 'not ekle' vb.).
2. 'create_service': Müşteri/şube için teknik servis, müdahale veya montaj kaydı açma.
3. 'create_accounting': Gelir tahsilatı veya gider masrafı işleme. (Ödeme yöntemi: cash_register=kasadan, bank_transfer=havale, credit_card=kredi kartı, out_of_pocket=cepten).
4. 'create_follow_up': Cari bazlı zaman ayarlı randevu, arama veya ödeme takibi.
5. 'system_query': Sistem verilerini sorma (mesai ve puantaj, maaş dökümü, bekleyen servisler, iş emirleri, masraflar, kasa durumu vb.).
6. 'general_chat': Diğer genel sorular veya tebrik/selamlama.

ÇOK ÖNEMLİ KURALLAR:
- Yanıtı YALNIZCA geçerli bir JSON nesnesi olarak ver (Markdown kod blokları, backtick veya fazladan metin EKLEME).
- Şema:
{
  "actionType": "create_note" | "create_service" | "create_accounting" | "create_follow_up" | "system_query" | "general_chat",
  "title": "Kısa ve anlaşılır Türkçe başlık",
  "explanation": "Kullanıcıya gösterilecek kibar açıklama veya soruya verilen detaylı cevap",
  "confidence": 0.95,
  "data": {
    "noteContent": "...",
    "cariName": "...",
    "targetUserId": "...",
    "targetUserName": "...",
    "reminderDate": "YYYY-MM-DD",
    "reminderTime": "HH:mm",
    "reminderActive": true,
    "serviceTitle": "...",
    "customerName": "...",
    "address": "...",
    "serviceNotes": "...",
    "assignedTo": "...",
    "priority": "low" | "normal" | "high" | "urgent",
    "txType": "income" | "expense",
    "amount": 100.0,
    "categoryCode": "...",
    "categoryName": "...",
    "categoryId": "...",
    "paymentMethod": "cash_register" | "bank_transfer" | "credit_card" | "out_of_pocket",
    "txDate": "YYYY-MM-DD",
    "txDescription": "...",
    "followUpCari": "...",
    "followUpDescription": "...",
    "followUpDate": "YYYY-MM-DDTHH:mm",
    "soundAlarm": true,
    "answer": "..."
  }
}
`;
  },

  /**
   * Ham model metninden JSON nesnesini güvenli şekilde ayıklar
   */
  extractJsonFromText(rawText: string): any | null {
    let cleanText = rawText.trim();
    // DeepSeek R1 <think>...</think> bloklarını temizle
    cleanText = cleanText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json/i, '').replace(/```$/, '').trim();
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```/, '').replace(/```$/, '').trim();
    }
    try {
      return JSON.parse(cleanText);
    } catch {
      const firstBrace = cleanText.indexOf('{');
      const lastBrace = cleanText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        return JSON.parse(cleanText.slice(firstBrace, lastBrace + 1));
      }
      return null;
    }
  },

  /**
   * Google Gemini 2.5 Pro / 2.5 Flash / 2.0 Flash REST API Çağrısı
   */
  async callGeminiApi(
    userPrompt: string,
    context: AiContextData,
    apiKey: string,
    preferredModel: AiModelId = 'gemini-2.5-pro'
  ): Promise<AiParsedResponse | null> {
    const systemInstruction = this.buildSystemInstruction(context);

    let models: string[];
    if (preferredModel === 'gemini-2.5-pro') {
      models = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'];
    } else if (preferredModel === 'gemini-2.0-flash') {
      models = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'];
    } else {
      models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro'];
    }

    const modelLabels: Record<string, string> = {
      'gemini-2.5-pro': 'Gemini 2.5 Pro',
      'gemini-2.5-flash': 'Gemini 2.5 Flash',
      'gemini-2.0-flash': 'Gemini 2.0 Flash',
    };

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemInstruction}\n\nKullanıcı Komutu:\n"${userPrompt}"` }],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`[AiService] ${model} isteği başarısız:`, response.status, errText);
          continue;
        }

        const json = await response.json();
        const parts = json?.candidates?.[0]?.content?.parts || [];
        // Gemini 2.5 thinking modellerinde son part asıl JSON yanıtını içerir
        const textPart = [...parts].reverse().find((p: any) => typeof p?.text === 'string' && !p?.thought) || parts[0];
        const candidateText = textPart?.text;
        if (!candidateText) continue;

        const parsed = this.extractJsonFromText(candidateText);
        if (!parsed) continue;

        return {
          actionType: parsed.actionType || 'general_chat',
          title: parsed.title || 'Yapay Zeka Yanıtı',
          explanation: parsed.explanation || parsed.data?.answer || 'İşleminiz hazırlandı.',
          confidence: parsed.confidence || 0.97,
          provider: 'gemini',
          modelLabel: modelLabels[model] || model,
          data: parsed.data || {},
        };
      } catch (e) {
        console.warn(`[AiService] ${model} parse hatası:`, e);
      }
    }

    return null;
  },

  /**
   * Groq Cloud LPU REST API Çağrısı (Llama 3.3 70B & DeepSeek R1 Distill Llama 70B - Ücretsiz Tier)
   */
  async callGroqApi(
    userPrompt: string,
    context: AiContextData,
    groqKey: string,
    preferredModel: AiModelId = 'groq-llama-3.3-70b'
  ): Promise<AiParsedResponse | null> {
    const systemInstruction = this.buildSystemInstruction(context);

    const models =
      preferredModel === 'groq-deepseek-r1'
        ? [
            { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 70B (Groq)', useJsonFormat: false },
            { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Groq)', useJsonFormat: true },
          ]
        : [
            { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Groq)', useJsonFormat: true },
            { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Groq)', useJsonFormat: true },
          ];

    for (const modelObj of models) {
      try {
        const bodyPayload: any = {
          model: modelObj.id,
          temperature: 0.1,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: `Kullanıcı Komutu:\n"${userPrompt}"` },
          ],
        };
        if (modelObj.useJsonFormat) {
          bodyPayload.response_format = { type: 'json_object' };
        }

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify(bodyPayload),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`[AiService] Groq ${modelObj.id} isteği başarısız:`, response.status, errText);
          continue;
        }

        const json = await response.json();
        const content = json?.choices?.[0]?.message?.content;
        if (!content) continue;

        const parsed = this.extractJsonFromText(content);
        if (!parsed) continue;

        return {
          actionType: parsed.actionType || 'general_chat',
          title: parsed.title || 'Yapay Zeka Yanıtı',
          explanation: parsed.explanation || parsed.data?.answer || 'İşleminiz hazırlandı.',
          confidence: parsed.confidence || 0.96,
          provider: 'groq',
          modelLabel: modelObj.label,
          data: parsed.data || {},
        };
      } catch (e) {
        console.warn(`[AiService] Groq ${modelObj.id} parse hatası:`, e);
      }
    }

    return null;
  },

  /**
   * Yerel Kural Tabanlı Doğal Dil Ayrıştırıcısı (Local NLP Engine)
   * API anahtarı olmadan veya internet yokken de %100 çalışır.
   */
  parseWithLocalRules(prompt: string, context: AiContextData): AiParsedResponse {
    const lower = prompt.toLowerCase();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // 1. Tutar Tespiti (Örn: 450 TL, 1500 TL, 2500₺)
    let extractedAmount: number | undefined = undefined;
    const amountMatch = prompt.match(/(\d+(?:[.,]\d+)?)\s*(?:tl|₺|lira|bin|milyon)/i) || prompt.match(/(?:tutar[ıi]?\s*:?\s*)(\d+(?:[.,]\d+)?)/i);
    if (amountMatch) {
      let rawNum = amountMatch[1].replace(',', '.');
      let val = parseFloat(rawNum);
      if (prompt.toLowerCase().includes('bin') && val < 1000) val *= 1000;
      if (!isNaN(val) && val > 0) {
        extractedAmount = val;
      }
    }

    // 2. Personel Tespiti
    let matchedStaff: { id: string; name: string } | undefined = undefined;
    for (const staff of context.staffMembers) {
      const parts = staff.name.toLowerCase().split(' ');
      for (const p of parts) {
        if (p.length > 2 && lower.includes(p)) {
          matchedStaff = { id: staff.id, name: staff.name };
          break;
        }
      }
      if (matchedStaff) break;
    }

    // 3. Cari / Müşteri Tespiti
    let matchedCari: string | undefined = undefined;
    for (const cari of context.cariler) {
      if (cari && cari.length > 2 && lower.includes(cari.toLowerCase())) {
        matchedCari = cari;
        break;
      }
    }
    // Cari listede yoksa tırnak içi veya '... pastanesi/şubesi/firması' kalıbı
    if (!matchedCari) {
      const quoteMatch = prompt.match(/["']([^"']+)["']/);
      if (quoteMatch) {
        matchedCari = quoteMatch[1];
      } else {
        const cariPattern = /([A-ZÇĞİÖŞÜa-zçğıöşü0-9\s]{3,25})\s*(?:pastanesi|market|şube|şubesi|plaza|holding|ltd|a\.ş|eczane|hastane|fırın)/i;
        const cMatch = prompt.match(cariPattern);
        if (cMatch) {
          matchedCari = cMatch[0].trim();
        }
      }
    }

    // 4. Tarih ve Saat Tespiti
    let targetDate = todayStr;
    let targetTime = '09:00';
    let targetDateTime = `${todayStr}T09:00`;

    if (lower.includes('yarın')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      targetDate = tomorrow.toISOString().split('T')[0];
    } else if (lower.includes('pazartesi') || lower.includes('salı') || lower.includes('çarşamba') || lower.includes('perşembe') || lower.includes('cuma')) {
      // 2 gün sonra tahmini
      const next = new Date(today);
      next.setDate(next.getDate() + 2);
      targetDate = next.toISOString().split('T')[0];
    }

    const timeMatch = prompt.match(/(?:saat\s*)?(\d{1,2})[:.](\d{2})/i) || prompt.match(/saat\s*(\d{1,2})/i);
    if (timeMatch) {
      const hour = String(parseInt(timeMatch[1], 10)).padStart(2, '0');
      const min = timeMatch[2] ? String(parseInt(timeMatch[2], 10)).padStart(2, '0') : '00';
      targetTime = `${hour}:${min}`;
    }
    targetDateTime = `${targetDate}T${targetTime}`;

    // -------------------------------------------------------------
    // 5. SORU / SORGU TESPİTİ (Question / Query Detection)
    // -------------------------------------------------------------
    const isQuestion =
      prompt.trim().endsWith('?') ||
      lower.includes('kime') ||
      lower.includes('kimler') ||
      lower.includes('kim') ||
      lower.includes('ne kadar') ||
      lower.includes('hangi') ||
      lower.includes('nasıl') ||
      lower.includes('nerede') ||
      lower.includes('ne zaman') ||
      lower.includes('nedir') ||
      lower.includes('neler') ||
      lower.includes('mı') ||
      lower.includes('mi') ||
      lower.includes('mu') ||
      lower.includes('mü') ||
      lower.includes('mıyız') ||
      lower.includes('miyiz') ||
      lower.includes('misin') ||
      lower.includes('misiniz') ||
      lower.includes('kaç') ||
      lower.includes('kaçta') ||
      lower.includes('toplam') ||
      lower.includes('listele') ||
      lower.includes('göster') ||
      lower.includes('söyle') ||
      lower.includes('bilgi') ||
      lower.includes('özet') ||
      lower.includes('rapor') ||
      lower.includes('durum') ||
      lower.includes('verdik') ||
      lower.includes('ödedik') ||
      lower.includes('yapıldı') ||
      lower.includes('alındı');

    const isExplicitNoteCommand =
      lower.includes('iş emri') ||
      lower.includes('görev ata') ||
      lower.includes('görev ver') ||
      lower.includes('not ekle') ||
      lower.includes('not al') ||
      lower.includes('talimat ver') ||
      lower.includes('yapılacak');

    // -------------------------------------------------------------
    // AKSİYON 1: MAAŞ & AVANS & ÖDEME SORGUSU (Salary Questions)
    // -------------------------------------------------------------
    const isSalaryQuery =
      lower.includes('maaş') ||
      lower.includes('avans') ||
      lower.includes('hakediş') ||
      lower.includes('ücret') ||
      lower.includes('bordro') ||
      (isQuestion && lower.includes('ödeme'));

    if (isSalaryQuery) {
      const monthNames = [
        'ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran',
        'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'
      ];
      let targetMonthNum = today.getMonth() + 1; // Varsayılan: bu ay
      let targetMonthName = monthNames[today.getMonth()];

      // Belirtilen ayı bul
      for (let i = 0; i < monthNames.length; i++) {
        if (lower.includes(monthNames[i])) {
          targetMonthNum = i + 1;
          targetMonthName = monthNames[i];
          break;
        }
      }
      if (lower.includes('geçen ay')) {
        targetMonthNum = today.getMonth() === 0 ? 12 : today.getMonth();
        targetMonthName = monthNames[targetMonthNum - 1];
      }

      // Belirtilen yılı bul (örn: 2025, 2026)
      const yearMatch = prompt.match(/\b(202\d)\b/);
      const targetYearNum = yearMatch ? parseInt(yearMatch[1], 10) : today.getFullYear();
      const capMonthName = targetMonthName.charAt(0).toUpperCase() + targetMonthName.slice(1);

      // context.salaryRecords içinde ara
      const allSalary = context.salaryRecords || [];
      const matchedMonthRecords = allSalary.filter(
        (r) => r.month === targetMonthNum && (yearMatch ? r.year === targetYearNum : true)
      );

      if (matchedMonthRecords.length > 0) {
        let grandTotal = 0;
        const lines: string[] = [];

        matchedMonthRecords.forEach((r) => {
          const totalPaid = (r.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
          grandTotal += totalPaid;

          const nakit = (r.payments || []).filter((p) => p.paymentType === 'cash').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
          const banka = (r.payments || []).filter((p) => p.paymentType === 'bank').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

          let paymentDetail = '';
          if (nakit > 0 && banka > 0) {
            paymentDetail = ` (Banka: ${banka.toLocaleString('tr-TR')} ₺, Nakit: ${nakit.toLocaleString('tr-TR')} ₺)`;
          } else if (banka > 0) {
            paymentDetail = ` (Banka: ${banka.toLocaleString('tr-TR')} ₺)`;
          } else if (nakit > 0) {
            paymentDetail = ` (Nakit: ${nakit.toLocaleString('tr-TR')} ₺)`;
          }

          const agreedText = r.agreedAmount ? ` [Maaş: ${r.agreedAmount.toLocaleString('tr-TR')} ₺]` : '';
          lines.push(`• **${r.staffName}:** ${totalPaid.toLocaleString('tr-TR')} ₺${paymentDetail}${agreedText}`);
        });

        const explanation =
          `📊 **${capMonthName} ${targetYearNum} Maaş & Ödeme Dökümü:**\n\n` +
          lines.join('\n') +
          `\n\n💰 **Toplam Ödenen:** ${grandTotal.toLocaleString('tr-TR')} ₺\n` +
          `👥 **Ödeme Yapılan Personel:** ${matchedMonthRecords.length} kişi`;

        return {
          actionType: 'system_query',
          title: `${capMonthName} ${targetYearNum} Maaş Raporu`,
          explanation,
          confidence: 0.95,
          provider: 'local_nlp',
          data: { answer: explanation },
        };
      } else {
        // Kayıt bulunamadı
        const existingMonths = Array.from(new Set(allSalary.map((s) => `${monthNames[(s.month || 1) - 1]} ${s.year}`)));
        const availableText = existingMonths.length > 0 ? `Sistemde kayıtlı dönemler: ${existingMonths.join(', ')}.` : 'Sistemde henüz girilmiş bir maaş ödeme kaydı bulunmuyor.';

        const explanation =
          `📅 **${capMonthName} ${targetYearNum}** dönemine ait henüz sisteme kaydedilmiş bir maaş veya avans ödemesi bulunamadı.\n\n` +
          `${availableText}\n\n` +
          `*(Ödeme girmek veya kontrol etmek için Personel Takibi > Maaş Takibi sekmesini kullanabilirsiniz.)*`;

        return {
          actionType: 'system_query',
          title: `${capMonthName} Maaş Bilgisi Bulunamadı`,
          explanation,
          confidence: 0.9,
          provider: 'local_nlp',
          data: { answer: explanation },
        };
      }
    }

    // -------------------------------------------------------------
    // AKSİYON 2: KAPSAMLI SİSTEM SORULARI (Mesai, Puantaj, Servis, Görev, Kasa)
    // -------------------------------------------------------------
    if (isQuestion && !isExplicitNoteCommand) {
      const s = context.systemSummary;

      // 1. PERSONEL / MESAİ / PUANTAJ / GİRİŞ-ÇIKIŞ / İZİN SORULARI
      const isAttendanceQuery =
        lower.includes('mesai') ||
        lower.includes('puantaj') ||
        lower.includes('giriş') ||
        lower.includes('çıkış') ||
        lower.includes('kaç saat') ||
        lower.includes('ne kadar çalıştı') ||
        lower.includes('kimler geldi') ||
        lower.includes('kim geldi') ||
        lower.includes('işte kimler') ||
        lower.includes('kimler var') ||
        lower.includes('kim ne kadar') ||
        lower.includes('çalışan') ||
        lower.includes('vardiya') ||
        lower.includes('izinli') ||
        lower.includes('izin') ||
        lower.includes('raporlu') ||
        (lower.includes('kim') && (lower.includes('personel') || lower.includes('geldi') || lower.includes('yaptı')));

      if (isAttendanceQuery) {
        let queryDate = todayStr;
        let queryDateLabel = 'Bugün';

        if (lower.includes('dün')) {
          const yDate = new Date(today);
          yDate.setDate(yDate.getDate() - 1);
          queryDate = yDate.toISOString().split('T')[0];
          queryDateLabel = 'Dün';
        }

        const dateFormatted = queryDate.split('-').reverse().join('.');

        // 1a. İzin kontrolü
        const activeLeaves = (context.leaveRequests || []).filter(
          (l) => l.status === 'approved' && l.startDate <= queryDate && (!l.endDate || l.endDate >= queryDate)
        );

        // 1b. Puantaj ve Mesai kayıtları
        const records = (context.attendanceRecords || []).filter((r) => r.date === queryDate);

        // Belirli bir personel adı sorulduysa filtrele
        let filteredRecords = records;
        if (matchedStaff) {
          filteredRecords = records.filter(
            (r) => r.userId === matchedStaff?.id || r.userName.toLowerCase().includes(matchedStaff!.name.toLowerCase())
          );
        }

        if (filteredRecords.length > 0) {
          const completedList: string[] = [];
          const activeList: string[] = [];

          filteredRecords.forEach((r) => {
            const checkInStr = r.checkInTime
              ? new Date(r.checkInTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
              : '—';
            const checkOutStr = r.checkOutTime
              ? new Date(r.checkOutTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
              : null;

            // Çalışma süresi hesapla
            let diffMins = 0;
            if (r.workDurationMinutes && r.workDurationMinutes > 0) {
              diffMins = r.workDurationMinutes;
            } else if (r.checkOutTime && r.checkInTime) {
              diffMins = Math.max(0, Math.round((r.checkOutTime - r.checkInTime) / 60000));
            } else if (r.checkInTime) {
              diffMins = Math.max(0, Math.round((Date.now() - r.checkInTime) / 60000));
            }

            const h = Math.floor(diffMins / 60);
            const m = diffMins % 60;
            const durationText = h > 0 ? `${h} sa ${m} dk` : `${m} dk`;
            const breakText = r.totalBreakMinutes ? ` (Mola: ${r.totalBreakMinutes} dk)` : '';
            const branchText = r.branchName ? ` [${r.branchName}]` : '';

            if (checkOutStr || r.status === 'completed') {
              completedList.push(
                `• 🏁 **${r.userName}:** Giriş: ${checkInStr} | Çıkış: ${checkOutStr || 'Tamamlandı'} ➔ Toplam Mesai: **${durationText}**${breakText}${branchText}`
              );
            } else {
              activeList.push(
                `• 🟢 **${r.userName}:** Giriş: ${checkInStr} | Çıkış: — (**Halen Mesai Yapıyor**) ➔ Şu Anki Süre: **${durationText}**${breakText}${branchText}`
              );
            }
          });

          let ans = `👥 **${queryDateLabel} (${dateFormatted}) Personel Mesai & Puantaj Raporu:**\n\n`;

          if (completedList.length > 0) {
            ans += `🏁 **Mesaisi Biten Personeller (${completedList.length} Kişi):**\n` + completedList.join('\n') + '\n\n';
          }

          if (activeList.length > 0) {
            ans += `🟢 **Halen Çalışan / İşte Olan Personeller (${activeList.length} Kişi):**\n` + activeList.join('\n') + '\n\n';
          }

          if (activeLeaves.length > 0) {
            ans +=
              `🏖️ **İzinli / Raporlu Personeller (${activeLeaves.length} Kişi):**\n` +
              activeLeaves.map((l) => `• 🏖️ ${l.userName} (${l.type || 'İzinli'}${l.reason ? ` - ${l.reason}` : ''})`).join('\n') +
              '\n\n';
          }

          ans +=
            `───────────────────────────\n` +
            `📊 **Özet:** Toplam **${records.length}** personel giriş yaptı, **${completedList.length}** personelin mesaisi tamamlandı, **${activeList.length}** personel aktif çalışmaya devam ediyor.`;

          return {
            actionType: 'system_query',
            title: `${queryDateLabel} Personel Mesai Raporu`,
            explanation: ans,
            confidence: 0.95,
            provider: 'local_nlp',
            data: { answer: ans },
          };
        } else {
          // O güne ait giriş kaydı yoksa
          let ans = `👥 **${queryDateLabel} (${dateFormatted}) Personel Mesai Bilgisi:**\n`;
          ans += `${queryDateLabel.toLowerCase()} sisteme henüz giriş yapmış veya mesaisini tamamlamış bir personel kaydı bulunmuyor.\n\n`;

          if (activeLeaves.length > 0) {
            ans +=
              `🏖️ **Bugün İzinli Olan Personeller (${activeLeaves.length} Kişi):**\n` +
              activeLeaves.map((l) => `• ${l.userName} (${l.type || 'İzinli'})`).join('\n') +
              '\n\n';
          }

          const staffList = context.staffMembers.map((st) => st.name + (st.role ? ` (${st.role})` : ''));
          if (staffList.length > 0) {
            ans += `📋 **Sistemdeki Kayıtlı Personeller (${staffList.length} Kişi):**\n• ` + staffList.join('\n• ') + '\n\n';
          }

          ans += `💡 *Personeller mobil uygulamadan veya web puantaj ekranından QR kod ya da konumla 'Giriş Yap' butonuna bastığında giriş-çıkış saatleri ve mesai süreleri burada canlı olarak listelenir.*`;

          return {
            actionType: 'system_query',
            title: `${queryDateLabel} Personel Mesai Bilgisi`,
            explanation: ans,
            confidence: 0.9,
            provider: 'local_nlp',
            data: { answer: ans },
          };
        }
      }

      // 2. TEKNİK SERVİS SORULARI
      const isServiceQuery =
        lower.includes('servis') ||
        lower.includes('arıza') ||
        lower.includes('tamir') ||
        lower.includes('montaj');

      if (isServiceQuery) {
        const pendingServices = (context.services || []).filter(
          (svc) => svc.status !== 'completed' && svc.status !== 'approved'
        );
        const completedServices = (context.services || []).filter(
          (svc) => svc.status === 'completed' || svc.status === 'approved'
        );

        let ans = `🔧 **Teknik Servis Durum Raporu:**\n\n`;
        if (pendingServices.length > 0) {
          ans += `⏳ **Sahada İşlem Bekleyen Servisler (${pendingServices.length} Adet):**\n`;
          pendingServices.slice(0, 8).forEach((svc, idx) => {
            ans += `${idx + 1}. **${svc.cariName || svc.companyName}**${svc.location ? ` - ${svc.location}` : ''}\n   • İş: ${svc.workDone || 'Servis müdahalesi'}${svc.date ? ` | Tarih: ${svc.date}` : ''}\n`;
          });
          if (pendingServices.length > 8) {
            ans += `*(Ve ${pendingServices.length - 8} bekleyen servis daha...)*\n`;
          }
        } else {
          ans += `✅ Şu anda sahada işlem bekleyen açık teknik servis kaydı bulunmamaktadır. Tüm servisler tamamlanmıştır.\n`;
        }

        ans += `\n📊 Toplam **${completedServices.length}** adet tamamlanmış, **${pendingServices.length}** adet bekleyen servis mevcuttur.`;

        return {
          actionType: 'system_query',
          title: 'Teknik Servis Durumu',
          explanation: ans,
          confidence: 0.95,
          provider: 'local_nlp',
          data: { answer: ans },
        };
      }

      // 3. İŞ EMİRLERİ VE GÖREV SORULARI
      const isNoteQuery =
        lower.includes('iş emri') ||
        lower.includes('iş emirleri') ||
        lower.includes('görev') ||
        lower.includes('notlar') ||
        lower.includes('yapılacak');

      if (isNoteQuery) {
        let pendingNotes = (context.notes || []).filter((n) => !n.status || n.status === 'pending');
        if (matchedStaff) {
          pendingNotes = pendingNotes.filter((n) =>
            n.targetUserNames?.some((name) => name.toLowerCase().includes(matchedStaff!.name.toLowerCase()))
          );
        }

        let ans = `📝 **İş Emirleri ve Görevler Raporu:**\n\n`;
        if (pendingNotes.length > 0) {
          ans += `📋 **Aktif / Bekleyen Görevler (${pendingNotes.length} Adet):**\n`;
          pendingNotes.slice(0, 8).forEach((n, idx) => {
            const cariTag = n.cariName ? `[${n.cariName}] ` : '';
            const staffTag = n.targetUserNames?.length ? `(Atanan: ${n.targetUserNames.join(', ')}) ` : '';
            ans += `${idx + 1}. **${cariTag}${staffTag}**${n.content}${n.reminderDate ? ` ➔ ${n.reminderDate}` : ''}\n`;
          });
          if (pendingNotes.length > 8) {
            ans += `*(Ve ${pendingNotes.length - 8} bekleyen iş emri daha...)*\n`;
          }
        } else {
          ans += matchedStaff
            ? `✅ ${matchedStaff.name} personeli üzerinde bekleyen açık bir iş emri bulunmamaktadır.`
            : `✅ Sistemde bekleyen açık iş emri bulunmamaktadır.`;
        }

        return {
          actionType: 'system_query',
          title: 'İş Emirleri Durumu',
          explanation: ans,
          confidence: 0.95,
          provider: 'local_nlp',
          data: { answer: ans },
        };
      }

      // 4. FİNANS, KASA, MASRAF VE GELİR SORULARI
      const isFinQuery =
        lower.includes('kasa') ||
        lower.includes('masraf') ||
        lower.includes('gelir') ||
        lower.includes('gider') ||
        lower.includes('bakiye') ||
        lower.includes('nakit') ||
        lower.includes('pos') ||
        lower.includes('para');

      if (isFinQuery) {
        const cash = s?.todayCash || 0;
        const bank = s?.todayBank || 0;
        const pos = s?.todayCreditCard || 0;
        const total = s?.cashBalance || cash + bank + pos;

        const recentTxs = (context.accountingTransactions || []).slice(0, 5);

        let ans = `💼 **Finans ve Kasa Durum Raporu:**\n\n`;
        ans += `💰 **Bugünkü Kasa Mevcudu (Toplam: ${total.toLocaleString('tr-TR')} ₺):**\n`;
        ans += `• 💵 **Nakit Kasa:** ${cash.toLocaleString('tr-TR')} ₺\n`;
        ans += `• 🏦 **Banka / Havale:** ${bank.toLocaleString('tr-TR')} ₺\n`;
        ans += `• 💳 **Kredi Kartı / POS:** ${pos.toLocaleString('tr-TR')} ₺\n\n`;

        ans += `📊 **Bu Ayki Finansal Özet:**\n`;
        ans += `• 📈 **Toplam Gelir / Tahsilat:** ${(s?.monthlyIncome || 0).toLocaleString('tr-TR')} ₺\n`;
        ans += `• 📉 **Toplam Masraf / Gider:** ${(s?.monthlyExpense || 0).toLocaleString('tr-TR')} ₺\n`;
        const diff = (s?.monthlyIncome || 0) - (s?.monthlyExpense || 0);
        ans += `• ⚖️ **Net Fark:** ${diff >= 0 ? '+' : ''}${diff.toLocaleString('tr-TR')} ₺\n`;

        if (recentTxs.length > 0) {
          ans += `\n🧾 **Son Muhasebe Hareketleri:**\n`;
          recentTxs.forEach((t) => {
            const icon = t.type === 'income' ? '🟢 Gelir' : '🔴 Gider';
            ans += `• ${icon}: ${t.amount.toLocaleString('tr-TR')} ₺ - ${t.categoryName || 'Genel'} (${t.description || t.date})\n`;
          });
        }

        return {
          actionType: 'system_query',
          title: 'Kasa ve Muhasebe Durumu',
          explanation: ans,
          confidence: 0.95,
          provider: 'local_nlp',
          data: { answer: ans },
        };
      }

      // 5. GENEL CANLI SİSTEM ÖZETİ
      if (s) {
        const ans =
          `📊 **Saha Takip Canlı Sistem Özeti (${todayStr})**:\n` +
          `• 📝 **Bekleyen İş Emirleri:** ${s.pendingNotesCount} adet\n` +
          `• 🔧 **Bekleyen Servisler:** ${s.pendingServicesCount} adet\n` +
          `• 👥 **Şu An İşte Olan Personeller (${s.activeStaffNames.length}):** ${s.activeStaffNames.join(', ') || 'Henüz giriş yapan yok'}\n` +
          `• 🏁 **Bugün Mesaisi Bitenler (${(s.completedStaffNames || []).length}):** ${(s.completedStaffNames || []).join(', ') || 'Henüz çıkış yapan yok'}\n` +
          `• 💰 **Bu Ay Toplam Gelir:** ${s.monthlyIncome.toLocaleString('tr-TR')} ₺\n` +
          `• 💸 **Bu Ay Toplam Gider:** ${s.monthlyExpense.toLocaleString('tr-TR')} ₺\n` +
          `• 💼 **Bugünkü Kasa Mevcudu:** ${s.cashBalance.toLocaleString('tr-TR')} ₺`;

        return {
          actionType: 'system_query',
          title: 'Canlı Sistem Durumu',
          explanation: ans,
          confidence: 0.9,
          provider: 'local_nlp',
          data: { answer: ans },
        };
      }
    }

    // -------------------------------------------------------------
    // AKSİYON 3: MUHASEBE GELİR / GİDER EKLEME (create_accounting)
    // -------------------------------------------------------------
    const isAccountingAction =
      !isQuestion &&
      extractedAmount !== undefined &&
      (lower.includes('masraf') ||
        lower.includes('gider') ||
        lower.includes('gelir') ||
        lower.includes('ödedik') ||
        lower.includes('harcadık') ||
        lower.includes('kasadan') ||
        lower.includes('tahsil') ||
        lower.includes('fatura') ||
        lower.includes('yemek') ||
        lower.includes('benzin') ||
        lower.includes('havale'));

    if (isAccountingAction && extractedAmount !== undefined) {
      const isIncome = lower.includes('gelir') || lower.includes('tahsil') || lower.includes('aldık') || lower.includes('para geldi');
      const txType: 'income' | 'expense' = isIncome ? 'income' : 'expense';

      let paymentMethod: 'cash_register' | 'bank_transfer' | 'credit_card' | 'out_of_pocket' = 'cash_register';
      if (lower.includes('havale') || lower.includes('banka') || lower.includes('hesab')) {
        paymentMethod = 'bank_transfer';
      } else if (lower.includes('kart') || lower.includes('kredi kart')) {
        paymentMethod = 'credit_card';
      } else if (lower.includes('cepten') || lower.includes('şahsi')) {
        paymentMethod = 'out_of_pocket';
      }

      // Kalem eşleştirme
      let matchedCategory = context.categories.find((c) => c.type === txType && lower.includes(c.name.toLowerCase()));
      if (!matchedCategory) {
        if (lower.includes('yemek') || lower.includes('öğle')) {
          matchedCategory = context.categories.find((c) => c.name.toLowerCase().includes('yemek'));
        } else if (lower.includes('benzin') || lower.includes('mazot') || lower.includes('yakıt')) {
          matchedCategory = context.categories.find((c) => c.name.toLowerCase().includes('ulaşım') || c.name.toLowerCase().includes('akaryakıt'));
        }
      }
      if (!matchedCategory) {
        matchedCategory = context.categories.find((c) => c.type === txType) || {
          id: 'cat_genel',
          code: isIncome ? '600.01' : '770.01',
          name: isIncome ? 'Hizmet Gelirleri' : 'Genel Yönetim & Çeşitli Masraflar',
          type: txType,
        };
      }

      return {
        actionType: 'create_accounting',
        title: isIncome ? 'Gelir / Tahsilat Kaydı' : 'Gider / Masraf Kaydı',
        explanation: `${extractedAmount.toLocaleString('tr-TR')} ₺ tutarındaki ${isIncome ? 'gelir' : 'masraf'} ${matchedCategory.name} kalemi olarak hazırlandı.`,
        confidence: 0.85,
        provider: 'local_nlp',
        data: {
          txType,
          amount: extractedAmount,
          categoryCode: matchedCategory.code,
          categoryName: matchedCategory.name,
          categoryId: matchedCategory.id,
          paymentMethod,
          txDate: targetDate,
          txDescription: prompt,
        },
      };
    }

    // -------------------------------------------------------------
    // AKSİYON 4: TEKNİK SERVİS AÇMA (create_service)
    // -------------------------------------------------------------
    const isServiceAction =
      !isQuestion &&
      (lower.includes('servis aç') ||
        lower.includes('servis kayd') ||
        lower.includes('arıza kayd') ||
        lower.includes('servis gir') ||
        (matchedCari && (lower.includes('arıza') || lower.includes('tamir') || lower.includes('klima') || lower.includes('fırın'))));

    if (isServiceAction) {
      let priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal';
      if (lower.includes('acil') || lower.includes('önemli')) priority = 'urgent';

      return {
        actionType: 'create_service',
        title: 'Teknik Servis Kaydı',
        explanation: `${matchedCari || 'Müşteri'} için teknik servis müdahalesi kaydı oluşturuldu.`,
        confidence: 0.85,
        provider: 'local_nlp',
        data: {
          serviceTitle: matchedCari ? `${matchedCari} - Servis & Arıza Müdahalesi` : 'Servis & Arıza Müdahalesi',
          customerName: matchedCari || 'Belirtilmedi',
          address: matchedCari ? `${matchedCari} Adresi` : '',
          serviceNotes: prompt,
          assignedTo: matchedStaff?.name || 'Genel Teknik Servis Ekibi',
          priority,
        },
      };
    }

    // -------------------------------------------------------------
    // AKSİYON 5: SÜRELİ TAKİP (create_follow_up)
    // -------------------------------------------------------------
    const isFollowUpAction =
      !isQuestion &&
      (lower.includes('görüş') ||
        lower.includes('ara') ||
        lower.includes('hatırlat') ||
        lower.includes('randevu') ||
        lower.includes('süreli takip') ||
        lower.includes('alarm kur')) &&
      matchedCari;

    if (isFollowUpAction) {
      return {
        actionType: 'create_follow_up',
        title: 'Süreli Cari Takibi & Alarm',
        explanation: `${matchedCari} için ${targetDate} tarihine zaman ayarlı takip hazırlandı.`,
        confidence: 0.85,
        provider: 'local_nlp',
        data: {
          followUpCari: matchedCari,
          followUpDescription: prompt,
          followUpDate: targetDateTime,
          soundAlarm: true,
        },
      };
    }

    // -------------------------------------------------------------
    // AKSİYON 6: İŞ EMRİ / NOT AÇMA (Sadece açıkça istenirse veya personele atanırsa)
    // -------------------------------------------------------------
    if (isExplicitNoteCommand || (matchedStaff && !isQuestion)) {
      return {
        actionType: 'create_note',
        title: 'İş Emri / Görev Atama',
        explanation: `${matchedStaff?.name ? matchedStaff.name + ' personeline ' : ''}${matchedCari ? matchedCari + ' carisi için ' : ''}iş emri hazırlandı.`,
        confidence: 0.85,
        provider: 'local_nlp',
        data: {
          noteContent: prompt,
          cariName: matchedCari,
          targetUserId: matchedStaff?.id,
          targetUserName: matchedStaff?.name,
          reminderDate: targetDate,
          reminderTime: targetTime,
          reminderActive: true,
        },
      };
    }

    // -------------------------------------------------------------
    // GENEL YANIT (Asla soruya yanlışlıkla iş emri açmaz!)
    // -------------------------------------------------------------
    const defaultAnswer =
      `"${prompt}" talebiniz incelendi.\n\n` +
      `💡 **Yapabileceğiniz İşlemler:**\n` +
      `• **Soru Sormak:** "Eylül ayında kime ne kadar maaş verdik?", "Bugün kimler geldi?", "Kaç servis bekliyor?"\n` +
      `• **İş Emri Açmak:** "Ahmet ustaya yarın 10:00'da Maya Pastanesine iş emri aç"\n` +
      `• **Masraf Girmek:** "Bugün kasadan 450 TL yemek masrafı gir"\n` +
      `• **Servis Kaydetmek:** "Maya Pastanesi Kadıköy için klima gaz dolumu servis kaydı aç"`;

    return {
      actionType: 'system_query',
      title: 'Yapay Zekâ Bilgilendirme',
      explanation: defaultAnswer,
      confidence: 0.9,
      provider: 'local_nlp',
      data: { answer: defaultAnswer },
    };
  },
};
