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
  systemSummary?: {
    today: string;
    pendingNotesCount: number;
    pendingServicesCount: number;
    activeStaffNames: string[];
    monthlyIncome: number;
    monthlyExpense: number;
    cashBalance: number;
  };
}

export type AiActionType =
  | 'create_note'         // İş Emri / Not Açma
  | 'create_service'      // Servis Kaydı Açma
  | 'create_accounting'   // Muhasebe Gelir veya Gider
  | 'create_follow_up'    // Süreli Takip / Cari Hatırlatıcı
  | 'system_query'        // Sistem verileri hakkında soru sorma / özet
  | 'general_chat';       // Genel asistan sohbeti

export interface AiParsedResponse {
  actionType: AiActionType;
  title: string;
  explanation: string;
  confidence: number;
  provider: 'gemini' | 'local_nlp';
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

export const AiService = {
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
      if (key && key.trim()) {
        localStorage.setItem(STORAGE_KEY_GEMINI, key.trim());
      } else {
        localStorage.removeItem(STORAGE_KEY_GEMINI);
      }
    }
  },

  /**
   * Kullanıcının girdiği isteği işler:
   * 1. API key varsa Google Gemini 1.5/2.0 Flash'a sorar (Ücretsiz kota).
   * 2. API key yoksa veya ağ hatası olursa dahili Akıllı Kural Motorunu (Local NLP) çalıştırır.
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
        data: {},
      };
    }

    const apiKey = this.getApiKey();

    if (apiKey) {
      try {
        const geminiResult = await this.callGeminiApi(trimmed, context, apiKey);
        if (geminiResult) {
          return geminiResult;
        }
      } catch (err) {
        console.warn('[AiService] Gemini API çağrısı başarısız oldu, yerel NLP motoruna geçiliyor:', err);
      }
    }

    // Yerel Kural Tabanlı Doğal Dil Ayrıştırıcısı (Sıfır Token / Çevrimdışı Çalışır)
    return this.parseWithLocalRules(trimmed, context);
  },

  /**
   * Google Gemini 1.5/2.0 Flash REST API Çağrısı (Ücretsiz Tier: Günde 1500 istek bedava)
   */
  async callGeminiApi(
    userPrompt: string,
    context: AiContextData,
    apiKey: string
  ): Promise<AiParsedResponse | null> {
    const todayStr = new Date().toISOString().split('T')[0];
    const nowTimeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const systemInstruction = `
Sen Saha Takip ve Yönetim Sistemi için tasarlanmış uzman, pratik ve hızlı bir Türkçe Yapay Zeka Asistanısın.
Bugünün tarihi: ${todayStr}, saat: ${nowTimeStr}.

Sistemdeki Mevcut Veriler:
- Personeller: ${JSON.stringify(context.staffMembers.map((s) => ({ id: s.id, name: s.name, role: s.role })))}
- Cariler / Müşteriler (Örnekler): ${JSON.stringify(context.cariler.slice(0, 40))}
- Masraf ve Gelir Kalemleri (ERP Kodlu): ${JSON.stringify(context.categories.map((c) => ({ id: c.id, code: c.code, name: c.name, type: c.type })))}
- Sistem Canlı Özeti: ${JSON.stringify(context.systemSummary || {})}

GÖREVİN:
Kullanıcının Türkçe komutunu, konuşmasını veya sorusunu incele.
Aşağıdaki 'actionType' seçeneklerinden en uygun olanını seç:
1. 'create_note': Personele görev atama, anlık iş emri veya hatırlatıcı oluşturma.
2. 'create_service': Müşteri/şube için teknik servis, müdahale veya montaj kaydı açma.
3. 'create_accounting': Gelir tahsilatı veya gider masrafı işleme. (Ödeme yöntemi: cash_register=kasadan, bank_transfer=havale, credit_card=kredi kartı, out_of_pocket=cepten).
4. 'create_follow_up': Cari bazlı zaman ayarlı randevu, arama veya ödeme takibi.
5. 'system_query': Sistem verilerini sorma (bekleyen işler, masraflar, kasa durumu, personel kimler geldi vb.).
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

    // Try models in order: gemini-1.5-flash then gemini-2.0-flash
    const models = ['gemini-1.5-flash', 'gemini-2.0-flash'];

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
        const candidateText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) continue;

        let cleanText = candidateText.trim();
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```/, '').replace(/```$/, '').trim();
        }

        const parsed = JSON.parse(cleanText);
        return {
          actionType: parsed.actionType || 'general_chat',
          title: parsed.title || 'Yapay Zeka Yanıtı',
          explanation: parsed.explanation || parsed.data?.answer || 'İşleminiz hazırlandı.',
          confidence: parsed.confidence || 0.95,
          provider: 'gemini',
          data: parsed.data || {},
        };
      } catch (e) {
        console.warn(`[AiService] ${model} parse hatası:`, e);
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
    // AKSİYON 1: SİSTEM SORGULAMA (system_query)
    // -------------------------------------------------------------
    if (
      lower.includes('kaç') ||
      lower.includes('durum') ||
      lower.includes('özet') ||
      lower.includes('rapor') ||
      lower.includes('kimler geldi') ||
      lower.includes('ne kadar masraf') ||
      lower.includes('kasa mevcudu')
    ) {
      const s = context.systemSummary;
      let ans = 'Sistem canlı durumu:\n';
      if (s) {
        ans = `📊 **Saha Takip Canlı Durum Özeti (${todayStr})**:\n` +
          `• 📝 **Bekleyen İş Emirleri:** ${s.pendingNotesCount} adet\n` +
          `• 🔧 **Bekleyen Servisler:** ${s.pendingServicesCount} adet\n` +
          `• 👥 **Şu An İşte Olan Personeller (${s.activeStaffNames.length}):** ${s.activeStaffNames.join(', ') || 'Henüz giriş yapan yok'}\n` +
          `• 💰 **Bu Ay Toplam Gelir:** ${s.monthlyIncome.toLocaleString('tr-TR')} ₺\n` +
          `• 💸 **Bu Ay Toplam Gider:** ${s.monthlyExpense.toLocaleString('tr-TR')} ₺\n` +
          `• 💼 **Bugünkü Kasa Mevcudu:** ${s.cashBalance.toLocaleString('tr-TR')} ₺`;
      } else {
        ans = 'Sistemde kayıtlı işlemleriniz aktif durumdadır.';
      }

      return {
        actionType: 'system_query',
        title: 'Sistem Durumu & Canlı Rapor',
        explanation: ans,
        confidence: 0.9,
        provider: 'local_nlp',
        data: { answer: ans },
      };
    }

    // -------------------------------------------------------------
    // AKSİYON 2: MUHASEBE GELİR / GİDER (create_accounting)
    // -------------------------------------------------------------
    const isAccounting =
      lower.includes('masraf') ||
      lower.includes('gider') ||
      lower.includes('gelir') ||
      lower.includes('ödedik') ||
      lower.includes('harcadık') ||
      lower.includes('kasadan') ||
      lower.includes('tahsil') ||
      (extractedAmount !== undefined && (lower.includes('fatura') || lower.includes('yemek') || lower.includes('benzin') || lower.includes('havale')));

    if (isAccounting && extractedAmount !== undefined) {
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

      // Uygun masraf/gelir kalemi eşleştirme
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
    // AKSİYON 3: TEKNİK SERVİS (create_service)
    // -------------------------------------------------------------
    const isService =
      lower.includes('servis') ||
      lower.includes('arıza') ||
      lower.includes('tamir') ||
      lower.includes('klima') ||
      lower.includes('fırın') ||
      lower.includes('parça') ||
      lower.includes('montaj');

    if (isService) {
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
    // AKSİYON 4: SÜRELİ TAKİP (create_follow_up)
    // -------------------------------------------------------------
    const isFollowUp =
      lower.includes('görüş') ||
      lower.includes('ara') ||
      lower.includes('hatırlat') ||
      lower.includes('randevu') ||
      lower.includes('süreli') ||
      lower.includes('vade');

    if (isFollowUp && matchedCari) {
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
    // AKSİYON 5: İŞ EMRİ / NOT (create_note - Varsayılan Aksiyon)
    // -------------------------------------------------------------
    return {
      actionType: 'create_note',
      title: 'İş Emri / Görev Atama',
      explanation: `${matchedStaff?.name ? matchedStaff.name + ' personeline ' : ''}${matchedCari ? matchedCari + ' carisi için ' : ''}iş emri hazırlandı.`,
      confidence: 0.8,
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
  },
};
