import React, { useState, useMemo } from 'react';
import {
  Banknote,
  Wallet,
  CreditCard,
  Plus,
  Trash2,
  X,
  Phone,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Send,
  Search,
  Building2,
  User,
  FileDown,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStorage } from '../../context/StorageContext';
import {
  StaffSalaryMonthRecord,
  SalaryPaymentMethod,
  SalaryPaymentType,
} from '../../types/storage';
import { BranchSelect, BranchOption } from '../common/BranchSelect';

const MONTH_NAMES = [
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

interface StaffSalaryModuleProps {
  onBack: () => void;
}

export const StaffSalaryModule: React.FC<StaffSalaryModuleProps> = ({ onBack }) => {
  const { user, users, company } = useAuth();
  const {
    branches,
    salaryRecords,
    addSalaryPayment,
    deleteSalaryPayment,
    updateMonthSalarySettings,
  } = useStorage();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');

  // Hangi personelin çekmecesi (drawer) açık?
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);

  // Hangi ayın detay kartı (blur modal) açık?
  const [activeModalData, setActiveModalData] = useState<{
    staff: any;
    year: number;
    month: number;
  } | null>(null);

  // Yeni ödeme ekleme form durumu (modal içinde)
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<SalaryPaymentMethod>('bank');
  const [paymentType, setPaymentType] = useState<SalaryPaymentType>('salary');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [paymentDesc, setPaymentDesc] = useState('');
  const [paymentBranchId, setPaymentBranchId] = useState<string>('');
  const [paymentReceipt, setPaymentReceipt] = useState<string | undefined>(undefined);

  // İsteğe bağlı o ay için hedef hak ediş düzenleme
  const [editingAgreedAmount, setEditingAgreedAmount] = useState<string>('');
  const [isEditingAgreed, setIsEditingAgreed] = useState(false);

  // Dekont büyük önizleme
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);

  // PDF üretiliyor mu?
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Bildirim toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Şirket kodu ve adı
  const activeCompanyCode = (company?.code || user?.companyCode || 'POLATLAR')
    .trim()
    .toUpperCase();
  const activeCompanyName = company?.name || activeCompanyCode;

  // Şirket personelleri
  const companyStaff = useMemo(() => {
    if (!users || !Array.isArray(users)) return [];
    return users.filter((u) => {
      const uComp = (u.companyCode || 'POLATLAR').trim().toUpperCase();
      return uComp === activeCompanyCode;
    });
  }, [users, activeCompanyCode]);

  // BranchSelect seçenekleri
  const branchOptions = useMemo<BranchOption[]>(() => {
    if (!branches || !Array.isArray(branches)) return [];
    return branches.map((b) => {
      const assignedIds = new Set(b.assignedUserIds || []);
      companyStaff.forEach((u) => {
        if (u.branchId === b.id) {
          assignedIds.add(u.id);
        }
      });
      return {
        id: b.id,
        name: b.name,
        address: b.address,
        staffCount: assignedIds.size,
      };
    });
  }, [branches, companyStaff]);

  // Filtrelenmiş personel listesi (Şube & Arama)
  const filteredStaff = useMemo(() => {
    return companyStaff.filter((st) => {
      if (selectedBranchId !== 'all') {
        const matchesBranch =
          st.branchId === selectedBranchId ||
          (branches &&
            branches.some(
              (b) =>
                b.id === selectedBranchId &&
                b.assignedUserIds &&
                b.assignedUserIds.includes(st.id)
            ));
        if (!matchesBranch) return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        st.name?.toLowerCase().includes(q) ||
        st.username?.toLowerCase().includes(q) ||
        (st.phone && st.phone.toLowerCase().includes(q))
      );
    });
  }, [companyStaff, selectedBranchId, searchQuery, branches]);

  // Yıllık Finansal İstatistikler (Seçili şubeye göre dinamik hesaplanır)
  const annualStats = useMemo(() => {
    let totalPaid = 0;
    let totalCash = 0;
    let totalBank = 0;
    let totalPaymentsCount = 0;

    const targetStaffIds = new Set(filteredStaff.map((s) => s.id));

    (salaryRecords || []).forEach((rec) => {
      if (
        rec.year === selectedYear &&
        rec.companyCode === activeCompanyCode &&
        targetStaffIds.has(rec.userId)
      ) {
        (rec.payments || []).forEach((p) => {
          totalPaid += p.amount || 0;
          if (p.paymentMethod === 'cash') totalCash += p.amount || 0;
          if (p.paymentMethod === 'bank') totalBank += p.amount || 0;
          totalPaymentsCount += 1;
        });
      }
    });

    return { totalPaid, totalCash, totalBank, totalPaymentsCount };
  }, [salaryRecords, selectedYear, activeCompanyCode, filteredStaff]);

  // Belirli bir personel ve ay için kayıt getirici
  const getMonthRecord = (
    userId: string,
    year: number,
    month: number
  ): StaffSalaryMonthRecord | undefined => {
    return (salaryRecords || []).find(
      (r) =>
        r.companyCode === activeCompanyCode &&
        r.userId === userId &&
        r.year === year &&
        r.month === month
    );
  };

  // Bir personelin seçili yıldaki toplam ödemeleri
  const getStaffYearlySummary = (userId: string, year: number) => {
    let totalPaid = 0;
    let totalCash = 0;
    let totalBank = 0;
    let paymentsCount = 0;

    (salaryRecords || []).forEach((r) => {
      if (
        r.companyCode === activeCompanyCode &&
        r.userId === userId &&
        r.year === year
      ) {
        (r.payments || []).forEach((p) => {
          totalPaid += p.amount || 0;
          if (p.paymentMethod === 'cash') totalCash += p.amount || 0;
          if (p.paymentMethod === 'bank') totalBank += p.amount || 0;
          paymentsCount += 1;
        });
      }
    });

    return { totalPaid, totalCash, totalBank, paymentsCount };
  };

  // Seçili ayın kaydı (modal için)
  const currentModalRecord = useMemo(() => {
    if (!activeModalData) return undefined;
    return getMonthRecord(
      activeModalData.staff.id,
      activeModalData.year,
      activeModalData.month
    );
  }, [activeModalData, salaryRecords, activeCompanyCode]);

  // Modal içindeki ay hesaplamaları
  const currentMonthCalc = useMemo(() => {
    const payments = currentModalRecord?.payments || [];
    let totalPaid = 0;
    let totalCash = 0;
    let totalBank = 0;

    payments.forEach((p) => {
      totalPaid += p.amount || 0;
      if (p.paymentMethod === 'cash') totalCash += p.amount || 0;
      if (p.paymentMethod === 'bank') totalBank += p.amount || 0;
    });

    const agreed = currentModalRecord?.agreedAmount;
    const remaining = agreed !== undefined ? Math.max(0, agreed - totalPaid) : null;

    return { totalPaid, totalCash, totalBank, agreed, remaining, payments };
  }, [currentModalRecord]);

  // Modal açıldığında varsayılan ödeme şubesini ayarla
  const handleOpenMonthModal = (staff: any, year: number, month: number) => {
    setActiveModalData({ staff, year, month });
    setIsAddingPayment(false);
    setIsEditingAgreed(false);
    // Personelin şubesi varsa onu, yoksa ilk şubeyi veya boş bırak
    setPaymentBranchId(staff.branchId || (branches && branches.length > 0 ? branches[0].id : ''));
  };

  // Yeni ödeme kaydetme
  const handleSavePayment = async () => {
    if (!activeModalData) return;
    const amountNum = parseFloat(paymentAmount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Lütfen geçerli bir ödeme tutarı giriniz.');
      return;
    }

    const assignedBranch = branches?.find((b) => b.id === paymentBranchId);

    await addSalaryPayment(
      activeModalData.staff.id,
      activeModalData.staff.name || activeModalData.staff.username,
      activeModalData.year,
      activeModalData.month,
      {
        amount: amountNum,
        paymentMethod,
        paymentType,
        date: paymentDate || new Date().toISOString().split('T')[0],
        description: paymentDesc.trim() || undefined,
        branchId: paymentBranchId || undefined,
        branchName: assignedBranch?.name || undefined,
        receiptUrl: paymentReceipt,
      }
    );

    // Formu sıfırla
    setPaymentAmount('');
    setPaymentDesc('');
    setPaymentReceipt(undefined);
    setIsAddingPayment(false);
  };

  // Hızlı kalanı kapat
  const handleSettleRemaining = async (method: SalaryPaymentMethod) => {
    if (!activeModalData || currentMonthCalc.remaining === null || currentMonthCalc.remaining <= 0) return;

    if (
      window.confirm(
        `Kalan ${currentMonthCalc.remaining.toLocaleString(
          'tr-TR'
        )} ₺ tutar "${method === 'cash' ? 'Nakit' : 'Banka'}" olarak kapatılsın mı?`
      )
    ) {
      const staffBranch = branches?.find((b) => b.id === activeModalData.staff.branchId);

      await addSalaryPayment(
        activeModalData.staff.id,
        activeModalData.staff.name || activeModalData.staff.username,
        activeModalData.year,
        activeModalData.month,
        {
          amount: currentMonthCalc.remaining,
          paymentMethod: method,
          paymentType: 'salary',
          date: new Date().toISOString().split('T')[0],
          description: `Kalan maaş kapatıldı (${method === 'cash' ? 'Nakit' : 'Banka'})`,
          branchId: staffBranch?.id,
          branchName: staffBranch?.name,
        }
      );
    }
  };

  // Anlaşılan tutarı güncelleme
  const handleSaveAgreedAmount = async () => {
    if (!activeModalData) return;
    const val = editingAgreedAmount.trim();
    const agreedNum = val ? parseFloat(val.replace(',', '.')) : undefined;

    await updateMonthSalarySettings(
      activeModalData.staff.id,
      activeModalData.staff.name || activeModalData.staff.username,
      activeModalData.year,
      activeModalData.month,
      agreedNum,
      currentModalRecord?.notes
    );

    setIsEditingAgreed(false);
  };

  // Dekont dosya yükleme
  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Görsel boyutu en fazla 5MB olabilir.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPaymentReceipt(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // =========================================================
  // 📄 RESMİ MAAŞ PUSULASI HTML ŞABLONU OLUŞTURUCU
  // =========================================================
  const generateSalarySlipHtml = (
    staff: any,
    year: number,
    month: number,
    calc: typeof currentMonthCalc
  ) => {
    const monthName = MONTH_NAMES[month - 1];
    const staffBranch = branches?.find((b) => b.id === staff.branchId);
    const dateFormatted = new Date().toLocaleDateString('tr-TR');

    const paymentRows = calc.payments.map((p, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 8px 10px; text-align: center; color: #64748b;">${idx + 1}</td>
        <td style="padding: 8px 10px; font-weight: bold; color: #1e293b;">${p.date}</td>
        <td style="padding: 8px 10px; color: #334155;">
          ${
            p.paymentType === 'advance'
              ? 'Avans'
              : p.paymentType === 'salary'
              ? 'Maaş'
              : p.paymentType === 'bonus'
              ? 'Prim'
              : 'Diğer'
          }
        </td>
        <td style="padding: 8px 10px;">
          <span style="display: inline-block; padding: 2px 6px; border-radius: 6px; font-size: 10px; font-weight: bold; ${
            p.paymentMethod === 'bank'
              ? 'background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;'
              : 'background: #fffbeb; color: #b45309; border: 1px solid #fde68a;'
          }">
            ${p.paymentMethod === 'bank' ? '🏦 Banka / EFT' : '💵 Elden Nakit'}
          </span>
        </td>
        <td style="padding: 8px 10px; color: #475569;">${p.branchName || staffBranch?.name || '-'}</td>
        <td style="padding: 8px 10px; color: #64748b;">${p.description || '-'}</td>
        <td style="padding: 8px 10px; text-align: right; font-weight: bold; color: #047857; font-size: 12px;">
          ${p.amount.toLocaleString('tr-TR')} ₺
        </td>
      </tr>
    `).join('');

    return `
      <div style="font-family: Arial, Helvetica, sans-serif; color: #0f172a; padding: 24px; max-width: 800px; margin: 0 auto; background: #ffffff;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #059669; padding-bottom: 16px; margin-bottom: 20px;">
          <div>
            <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #065f46; letter-spacing: -0.5px;">
              ${activeCompanyName}
            </h1>
            <p style="margin: 3px 0 0 0; font-size: 12px; color: #475569; font-weight: bold;">
              PERSONEL MAAŞ & ÖDEME PUSULASI
            </p>
          </div>
          <div style="text-align: right; font-size: 11px; color: #64748b;">
            <div><strong>Dönem:</strong> ${monthName} ${year}</div>
            <div><strong>Düzenleme Tarihi:</strong> ${dateFormatted}</div>
            <div><strong>Belge No:</strong> MS-${year}${month < 10 ? '0' + month : month}-${staff.id.substring(0, 6).toUpperCase()}</div>
          </div>
        </div>

        <!-- Personel Bilgileri Tablosu -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tr>
              <td style="width: 25%; padding: 4px 0; color: #64748b;">Personel Adı:</td>
              <td style="width: 35%; padding: 4px 0; font-weight: bold; color: #0f172a;">${staff.name || staff.username}</td>
              <td style="width: 20%; padding: 4px 0; color: #64748b;">Şube / Birim:</td>
              <td style="width: 20%; padding: 4px 0; font-weight: bold; color: #0f172a;">${staffBranch?.name || 'Merkez'}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Kullanıcı Adı:</td>
              <td style="padding: 4px 0; color: #334155;">@${staff.username}</td>
              <td style="padding: 4px 0; color: #64748b;">Telefon:</td>
              <td style="padding: 4px 0; color: #334155;">${staff.phone || '-'}</td>
            </tr>
          </table>
        </div>

        <!-- Özet Finansal Kutular -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
          <div style="border: 1px solid #a7f3d0; background: #ecfdf5; border-radius: 10px; padding: 12px;">
            <div style="font-size: 11px; font-weight: bold; color: #065f46;">TOPLAM VERİLEN MAAŞ</div>
            <div style="font-size: 18px; font-weight: 900; color: #047857; margin-top: 4px;">
              ${calc.totalPaid.toLocaleString('tr-TR')} ₺
            </div>
          </div>
          <div style="border: 1px solid #bfdbfe; background: #eff6ff; border-radius: 10px; padding: 12px;">
            <div style="font-size: 11px; font-weight: bold; color: #1e40af;">🏦 BANKA / EFT İLE</div>
            <div style="font-size: 16px; font-weight: 900; color: #1d4ed8; margin-top: 4px;">
              ${calc.totalBank.toLocaleString('tr-TR')} ₺
            </div>
          </div>
          <div style="border: 1px solid #fde68a; background: #fffbeb; border-radius: 10px; padding: 12px;">
            <div style="font-size: 11px; font-weight: bold; color: #92400e;">💵 ELDEN NAKİT İLE</div>
            <div style="font-size: 16px; font-weight: 900; color: #b45309; margin-top: 4px;">
              ${calc.totalCash.toLocaleString('tr-TR')} ₺
            </div>
          </div>
        </div>

        ${
          calc.agreed !== undefined && calc.remaining !== null
            ? `
          <div style="background: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 10px 14px; margin-bottom: 20px; font-size: 11px; display: flex; justify-content: space-between;">
            <span><strong>Anlaşılan Dönem Hak Edişi:</strong> ${calc.agreed.toLocaleString('tr-TR')} ₺</span>
            <span style="color: ${calc.remaining > 0 ? '#b91c1c' : '#047857'}; font-weight: bold;">
              <strong>Kalan Bakiye:</strong> ${calc.remaining.toLocaleString('tr-TR')} ₺
            </span>
          </div>
        `
            : ''
        }

        <!-- Ödeme Hareketleri Detay Tablosu -->
        <div style="margin-bottom: 25px;">
          <h3 style="font-size: 12px; font-weight: 800; color: #334155; text-transform: uppercase; margin: 0 0 10px 0;">
            Ödeme Hareketleri Dökümü (${calc.payments.length} İşlem)
          </h3>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: #f1f5f9; text-align: left; font-size: 10px; font-weight: bold; color: #475569; text-transform: uppercase;">
                <th style="padding: 8px 10px; text-align: center; width: 30px;">#</th>
                <th style="padding: 8px 10px;">Tarih</th>
                <th style="padding: 8px 10px;">İşlem Türü</th>
                <th style="padding: 8px 10px;">Kanal</th>
                <th style="padding: 8px 10px;">Şube / Kasa</th>
                <th style="padding: 8px 10px;">Açıklama</th>
                <th style="padding: 8px 10px; text-align: right;">Tutar</th>
              </tr>
            </thead>
            <tbody>
              ${
                paymentRows ||
                `<tr><td colspan="7" style="padding: 16px; text-align: center; color: #94a3b8; font-size: 11px;">Bu döneme ait ödeme kaydı bulunmamaktadır.</td></tr>`
              }
            </tbody>
          </table>
        </div>

        <!-- İmza ve Onay Bölümü -->
        <div style="display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <div style="text-align: center; width: 40%;">
            <div style="font-size: 11px; font-weight: bold; color: #334155; margin-bottom: 50px;">
              İşveren / Yetkili İmza & Kaşe
            </div>
            <div style="border-top: 1px dashed #94a3b8; padding-top: 5px; font-size: 10px; color: #64748b;">
              ${activeCompanyName}
            </div>
          </div>
          <div style="text-align: center; width: 40%;">
            <div style="font-size: 11px; font-weight: bold; color: #334155; margin-bottom: 50px;">
              Personel / Teslim Alan İmza
            </div>
            <div style="border-top: 1px dashed #94a3b8; padding-top: 5px; font-size: 10px; color: #64748b;">
              ${staff.name || staff.username}
            </div>
          </div>
        </div>

        <!-- Dipnot -->
        <div style="margin-top: 25px; text-align: center; font-size: 9px; color: #94a3b8; line-height: 1.4;">
          İşbu pusula ${monthName} ${year} dönemi içerisinde personele banka veya nakit elden teslim edilen tüm ödemeleri belgeler.<br/>
          Sistem tarafından otomatik üretilmiştir.
        </div>
      </div>
    `;
  };

  // =========================================================
  // 📱 PDF İNDİR VE WHATSAPP / SİSTEM PAYLAŞIMI
  // =========================================================
  const handleExportAndSharePdf = async (openWhatsApp: boolean = false) => {
    if (!activeModalData) return;
    const staff = activeModalData.staff;
    const year = activeModalData.year;
    const month = activeModalData.month;
    const monthName = MONTH_NAMES[month - 1];

    setIsGeneratingPdf(true);

    try {
      const htmlContent = generateSalarySlipHtml(staff, year, month, currentMonthCalc);
      const cleanFileName = `${(staff.name || staff.username).replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ_-]/g, '_')}_${monthName}_${year}_Maas_Pusulasi.pdf`;

      // html2pdf import
      const html2pdf =
        (window as any).html2pdf || (await import('html2pdf.js')).default;

      const container = document.createElement('div');
      container.innerHTML = htmlContent;
      document.body.appendChild(container);

      const opt = {
        margin: [8, 8, 8, 8],
        filename: cleanFileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };

      // PDF Blob oluştur
      const worker = html2pdf().set(opt).from(container);

      // Mobil cihazlarda Web Share API ile dosya paylaşımı dene
      if (openWhatsApp && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
        try {
          const pdfBlob = await worker.outputPdf('blob');
          const pdfFile = new File([pdfBlob], cleanFileName, { type: 'application/pdf' });

          if (navigator.canShare({ files: [pdfFile] })) {
            document.body.removeChild(container);
            await navigator.share({
              files: [pdfFile],
              title: `${staff.name || staff.username} - ${monthName} ${year} Maaş Pusulası`,
              text: `Sayın ${staff.name || staff.username}, ${monthName} ${year} dönemi maaş pusulanız ektedir. (${activeCompanyName})`,
            });
            setIsGeneratingPdf(false);
            return;
          }
        } catch (shareErr) {
          console.warn('Native share failed or dismissed, falling back to download:', shareErr);
        }
      }

      // Standart İndirme (.save())
      await worker.save();
      document.body.removeChild(container);

      // Eğer WhatsApp tıklandıysa ve native share desteklenmediyse WhatsApp web/uygulamasına yönlendir
      if (openWhatsApp) {
        const phone = (staff.phone || '').replace(/\D/g, '');
        const messageLines = [
          `Sayın *${staff.name || staff.username}*,`,
          `*${monthName} ${year}* dönemi maaş pusulanız PDF olarak hazırlanmıştır.`,
          `━━━━━━━━━━━━━━━━━`,
          `• *Toplam Verilen:* ${currentMonthCalc.totalPaid.toLocaleString('tr-TR')} ₺`,
        ];

        if (currentMonthCalc.totalBank > 0) {
          messageLines.push(`  - 🏦 Banka: ${currentMonthCalc.totalBank.toLocaleString('tr-TR')} ₺`);
        }
        if (currentMonthCalc.totalCash > 0) {
          messageLines.push(`  - 💵 Elden Nakit: ${currentMonthCalc.totalCash.toLocaleString('tr-TR')} ₺`);
        }

        if (currentMonthCalc.agreed !== undefined && currentMonthCalc.remaining !== null) {
          messageLines.push(`• *Anlaşılan Hak Ediş:* ${currentMonthCalc.agreed.toLocaleString('tr-TR')} ₺`);
          messageLines.push(`• *Kalan Bakiye:* ${currentMonthCalc.remaining.toLocaleString('tr-TR')} ₺`);
        }

        messageLines.push(`━━━━━━━━━━━━━━━━━`);
        messageLines.push(`📄 *${cleanFileName}* belgesi cihazınıza indirilmiştir.`);
        messageLines.push(`Bilginize sunar, hayırlı kazançlar dileriz.`);
        messageLines.push(`*${activeCompanyName}*`);

        const encoded = encodeURIComponent(messageLines.join('\n'));
        const url = phone
          ? `https://wa.me/${phone.startsWith('90') ? phone : '90' + phone}?text=${encoded}`
          : `https://wa.me/?text=${encoded}`;

        window.open(url, '_blank');
      }

      setToastMessage(
        openWhatsApp
          ? '📄 Maaş Pusulası PDF olarak indirildi ve WhatsApp açıldı!'
          : '📄 Maaş Pusulası PDF olarak cihazınıza indirildi.'
      );
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('PDF üretilirken hata oluştu:', err);
      alert('PDF oluşturulurken bir hata meydana geldi.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-in fade-in duration-200">
      {/* 1. Header Banner & Geri Butonu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 p-6 rounded-3xl border border-emerald-500/30 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer hover:scale-105 active:scale-95"
            title="Personel Takibi Ana Menüsüne Dön"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Banknote className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Maaş & Ödeme Takibi
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
              Personel maaş ve avans ödemeleri, nakit/banka dökümü, şube kasaları ve PDF pusula arşivi.
            </p>
          </div>
        </div>

        {/* Yıl Seçici */}
        <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-emerald-500/30 self-start sm:self-auto shadow-inner">
          <button
            type="button"
            onClick={() => setSelectedYear((y) => y - 1)}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-all cursor-pointer"
          >
            ‹ {selectedYear - 1}
          </button>
          <span className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 text-sm font-black shadow-md shadow-emerald-500/30">
            {selectedYear}
          </span>
          <button
            type="button"
            onClick={() => setSelectedYear((y) => y + 1)}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-all cursor-pointer"
          >
            {selectedYear + 1} ›
          </button>
        </div>
      </div>

      {/* 2. Yıllık Özet KPI Kartları (Seçili Şubeye Göre Dinamik) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {selectedYear} Toplam Verilen
            </span>
            <Wallet className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {annualStats.totalPaid.toLocaleString('tr-TR')} ₺
          </p>
          <span className="text-[10px] text-slate-400">
            {annualStats.totalPaymentsCount} ödeme hareketi
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              💵 Elden Nakit
            </span>
            <Banknote className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
            {annualStats.totalCash.toLocaleString('tr-TR')} ₺
          </p>
          <span className="text-[10px] text-slate-400">
            Toplamın %
            {annualStats.totalPaid > 0
              ? Math.round((annualStats.totalCash / annualStats.totalPaid) * 100)
              : 0}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              🏦 Banka / Havale
            </span>
            <CreditCard className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 mt-2">
            {annualStats.totalBank.toLocaleString('tr-TR')} ₺
          </p>
          <span className="text-[10px] text-slate-400">
            Toplamın %
            {annualStats.totalPaid > 0
              ? Math.round((annualStats.totalBank / annualStats.totalPaid) * 100)
              : 0}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Personel Sayısı
            </span>
            <User className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 mt-2">
            {filteredStaff.length}
          </p>
          <span className="text-[10px] text-slate-400">
            {selectedBranchId === 'all'
              ? 'Tüm Şubeler Genel Toplam'
              : `${branches?.find((b) => b.id === selectedBranchId)?.name || 'Seçili Şube'}`}
          </span>
        </div>
      </div>

      {/* 3. Arama ve Şube Seçimi Çubuğu (Şubeli Firmalar İçin) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Arama Kutusu */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Personel adı, kullanıcı adı veya telefon ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ŞUBELİ FİRMALAR İÇİN ŞUBE SEÇİMİ BİLEŞENİ */}
        {branches && branches.length > 0 && (
          <div className="w-full sm:w-72 shrink-0">
            <BranchSelect
              options={branchOptions}
              selectedBranchId={selectedBranchId}
              onChange={(bId) => setSelectedBranchId(bId)}
              totalCompanyStaffCount={companyStaff.length}
            />
          </div>
        )}
      </div>

      {/* 4. Personel Kartları ve Açılır Çekmece (Accordion Drawer) */}
      {filteredStaff.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-100 dark:border-emerald-900/50">
            <User className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            Aranan Kriterde Personel Bulunamadı
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {selectedBranchId !== 'all'
              ? 'Seçili şubede henüz kayıtlı personel bulunmuyor veya arama kriteriyle eşleşmedi.'
              : 'Arama kutusunu temizleyerek tekrar deneyebilirsiniz.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredStaff.map((staff) => {
            const isExpanded = expandedStaffId === staff.id;
            const yearSummary = getStaffYearlySummary(staff.id, selectedYear);

            // Bu ayki özet
            const currentMonthRec = getMonthRecord(staff.id, selectedYear, currentMonth);
            let thisMonthPaid = 0;
            currentMonthRec?.payments?.forEach((p) => (thisMonthPaid += p.amount || 0));

            const staffBranch = branches?.find((b) => b.id === staff.branchId);

            return (
              <div
                key={staff.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all overflow-hidden"
              >
                {/* Personel Ana Kart Başlığı (Tıklanınca Çekmeceyi Açar/Kapatır) */}
                <div
                  onClick={() =>
                    setExpandedStaffId(isExpanded ? null : staff.id)
                  }
                  className="p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors select-none"
                >
                  <div className="flex items-center gap-3.5">
                    {/* Profil Resmi / Avatar */}
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-black flex items-center justify-center text-base shadow-md shadow-emerald-500/20 shrink-0">
                      {staff.name ? staff.name.substring(0, 2).toUpperCase() : 'PE'}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                          {staff.name || staff.username}
                        </h3>
                        {staff.role === 'admin' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                            Yönetici
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {staffBranch && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <strong className="text-slate-700 dark:text-slate-300">{staffBranch.name}</strong>
                          </span>
                        )}
                        {staff.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {staff.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Özet ve Çekmece Butonu */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <div className="text-left sm:text-right">
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {selectedYear} Toplam Verilen
                      </div>
                      <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                        {yearSummary.totalPaid.toLocaleString('tr-TR')} ₺
                      </div>
                      <div className="text-[10px] font-medium text-slate-400">
                        Bu Ay: {thisMonthPaid.toLocaleString('tr-TR')} ₺
                      </div>
                    </div>

                    {/* Çekmece Aç/Kapa Butonu */}
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                        isExpanded
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100'
                      }`}
                    >
                      <span>Maaş Çekmecesi</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* ========================================================= */}
                {/* 📂 ÇEKMECE İÇERİĞİ: 12 AY GRİD'İ (Accordion Expansion) */}
                {/* ========================================================= */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                      <span>{selectedYear} Yılı Aylar Çizelgesi:</span>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                        Detay, PDF ve ödeme girişi için aya dokunun
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                      {MONTH_NAMES.map((mName, idx) => {
                        const monthNum = idx + 1;
                        const rec = getMonthRecord(staff.id, selectedYear, monthNum);

                        let mPaid = 0;
                        let mCash = 0;
                        let mBank = 0;
                        (rec?.payments || []).forEach((p) => {
                          mPaid += p.amount || 0;
                          if (p.paymentMethod === 'cash') mCash += p.amount || 0;
                          if (p.paymentMethod === 'bank') mBank += p.amount || 0;
                        });

                        const hasPayments = mPaid > 0;
                        const isCurrent =
                          selectedYear === currentYear && monthNum === currentMonth;

                        return (
                          <button
                            key={monthNum}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenMonthModal(staff, selectedYear, monthNum);
                            }}
                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                              hasPayments
                                ? 'bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-800/80 shadow-sm hover:border-emerald-500'
                                : 'bg-white/60 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800/60 hover:bg-white hover:border-slate-300'
                            } ${isCurrent ? 'ring-2 ring-emerald-500/60' : ''}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span
                                className={`text-xs font-bold ${
                                  hasPayments
                                    ? 'text-slate-900 dark:text-white'
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {mName}
                              </span>
                              {isCurrent && (
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              )}
                            </div>

                            {hasPayments ? (
                              <div className="space-y-1">
                                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                  {mPaid.toLocaleString('tr-TR')} ₺
                                </p>
                                <div className="flex flex-wrap gap-1 text-[9px] font-bold">
                                  {mBank > 0 && (
                                    <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                                      🏦 {mBank.toLocaleString('tr-TR')} ₺
                                    </span>
                                  )}
                                  {mCash > 0 && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                                      💵 {mCash.toLocaleString('tr-TR')} ₺
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="py-1">
                                <p className="text-[11px] font-medium text-slate-400">
                                  Ödeme Yok
                                </p>
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                  + Giriş Yap
                                </span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. İLGİLİ AYA TIKLANINCA AÇILAN DETAY KARTI (BLUR MODAL)  */}
      {/* ========================================================= */}
      {activeModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Üst Başlık & Sağ Üst X Kapatma Butonu */}
            <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 bg-gradient-to-r from-emerald-950/30 via-slate-900/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black text-lg shrink-0">
                  <Banknote className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      {activeModalData.staff.name || activeModalData.staff.username}
                    </h2>
                    {branches?.find((b) => b.id === activeModalData.staff.branchId) && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                        {branches.find((b) => b.id === activeModalData.staff.branchId)?.name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {MONTH_NAMES[activeModalData.month - 1]} {activeModalData.year} Maaş & Ödeme Detayı
                  </p>
                </div>
              </div>

              {/* Sağ Üst Kapatma (X) Butonu */}
              <button
                type="button"
                onClick={() => {
                  setActiveModalData(null);
                  setIsAddingPayment(false);
                  setIsEditingAgreed(false);
                }}
                className="p-2 rounded-2xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Kapat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Gövdesi (Scroll Edilebilir) */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {/* O Ayın Finansal Özeti Kartı */}
              <div className="grid grid-cols-3 gap-2.5 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Toplam Verilen
                  </span>
                  <p className="text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {currentMonthCalc.totalPaid.toLocaleString('tr-TR')} ₺
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    💵 Elden Nakit
                  </span>
                  <p className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                    {currentMonthCalc.totalCash.toLocaleString('tr-TR')} ₺
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    🏦 Banka / EFT
                  </span>
                  <p className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                    {currentMonthCalc.totalBank.toLocaleString('tr-TR')} ₺
                  </p>
                </div>
              </div>

              {/* İsteğe Bağlı: Bu Ayki Anlaşılan Tutar & Kalan Bakiye */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3">
                {!isEditingAgreed ? (
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        {currentMonthCalc.agreed !== undefined
                          ? `Anlaşılan Hak Ediş: ${currentMonthCalc.agreed.toLocaleString('tr-TR')} ₺`
                          : 'Bu ay için anlaşılan tutar girilmedi (İsteğe bağlı)'}
                      </span>
                      {currentMonthCalc.remaining !== null && (
                        <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                          Kalan Maaş: {currentMonthCalc.remaining.toLocaleString('tr-TR')} ₺
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAgreedAmount(
                          currentMonthCalc.agreed !== undefined ? String(currentMonthCalc.agreed) : ''
                        );
                        setIsEditingAgreed(true);
                      }}
                      className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
                    >
                      {currentMonthCalc.agreed !== undefined ? 'Düzenle' : 'Tutar Belirle'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="number"
                      placeholder="Anlaşılan Tutar (₺)"
                      value={editingAgreedAmount}
                      onChange={(e) => setEditingAgreedAmount(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleSaveAgreedAmount}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-colors cursor-pointer"
                    >
                      Kaydet
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingAgreed(false)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-300 transition-colors cursor-pointer"
                    >
                      İptal
                    </button>
                  </div>
                )}
              </div>

              {/* Ödeme Hareketleri Listesi */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Ödeme Hareketleri ({currentMonthCalc.payments.length})
                  </h4>
                  {!isAddingPayment && (
                    <button
                      type="button"
                      onClick={() => setIsAddingPayment(true)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold transition-colors cursor-pointer border border-emerald-500/20"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Yeni Ödeme Ekle</span>
                    </button>
                  )}
                </div>

                {currentMonthCalc.payments.length === 0 && !isAddingPayment ? (
                  <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <Banknote className="w-8 h-8 text-slate-400 mx-auto mb-1.5 opacity-50" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Bu aya ait henüz bir ödeme kaydı bulunmuyor.
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Yukarıdaki veya alttaki "Yeni Ödeme Ekle" butonuna dokunarak nakit veya banka ödemesi işleyebilirsiniz.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {currentMonthCalc.payments.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 shadow-sm flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-xl text-xs font-bold shrink-0 ${
                              p.paymentMethod === 'cash'
                                ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                                : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60'
                            }`}
                          >
                            {p.paymentMethod === 'cash' ? '💵 Nakit' : '🏦 Banka'}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-slate-900 dark:text-white">
                                {p.amount.toLocaleString('tr-TR')} ₺
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                {p.paymentType === 'advance'
                                  ? 'Avans'
                                  : p.paymentType === 'salary'
                                  ? 'Maaş'
                                  : p.paymentType === 'bonus'
                                  ? 'Prim'
                                  : 'Diğer'}
                              </span>
                              {p.branchName && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                                  🏢 {p.branchName}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              <span>{p.date}</span>
                              {p.description && <span>• {p.description}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {p.receiptUrl && (
                            <button
                              type="button"
                              onClick={() => setPreviewReceiptUrl(p.receiptUrl!)}
                              className="p-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60 hover:bg-teal-100 cursor-pointer"
                              title="Dekont / Fiş Görselini Görüntüle"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm('Bu ödeme kaydını silmek istediğinize emin misiniz?')) {
                                await deleteSalaryPayment(currentModalRecord!.id, p.id);
                              }
                            }}
                            className="p-1.5 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Ödeme Kaydını Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Yeni Ödeme Ekleme Formu (Açılır Kısım) */}
              {isAddingPayment && (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-emerald-500/40 space-y-3 shadow-inner animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-emerald-500" />
                      Yeni Ödeme Girişi
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingPayment(false)}
                      className="text-xs font-bold text-slate-400 hover:text-slate-600"
                    >
                      Kapat
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Tutar */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Ödenen Tutar (₺) *
                      </label>
                      <input
                        type="number"
                        placeholder="Örn: 15000"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Tarih */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Ödeme Tarihi
                      </label>
                      <input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Ödeme Yöntemi Toggle: Nakit mi Banka mı? */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Ödeme Kanalı
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('bank')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          paymentMethod === 'bank'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-400'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>🏦 Banka (Havale / EFT)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cash')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          paymentMethod === 'cash'
                            ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-2 ring-amber-400'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        <span>💵 Elden Nakit</span>
                      </button>
                    </div>
                  </div>

                  {/* Şubeli Firmalar İçin: Ödemenin Yapıldığı Şube / Kasa */}
                  {branches && branches.length > 0 && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        🏢 Ödemenin Yapıldığı Şube / Kasa
                      </label>
                      <select
                        value={paymentBranchId}
                        onChange={(e) => setPaymentBranchId(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                      >
                        <option value="">Merkez Kasa / Genel</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Ödeme Türü: Maaş / Avans / Prim */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      İşlem Türü
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(
                        [
                          { id: 'salary', label: 'Maaş' },
                          { id: 'advance', label: 'Avans' },
                          { id: 'bonus', label: 'Prim' },
                          { id: 'other', label: 'Diğer' },
                        ] as const
                      ).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setPaymentType(item.id)}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            paymentType === item.id
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Açıklama */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Açıklama (İsteğe Bağlı)
                    </label>
                    <input
                      type="text"
                      placeholder="Örn: Ekim ayı avansı elden teslim edildi"
                      value={paymentDesc}
                      onChange={(e) => setPaymentDesc(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Dekont Görseli Yükleme */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Dekont / Fiş Görseli (İsteğe Bağlı)
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-white dark:bg-slate-900 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer transition-colors">
                        <ImageIcon className="w-4 h-4 text-emerald-500" />
                        <span>{paymentReceipt ? 'Dekont Seçildi (Değiştir)' : 'Görsel / Fotoğraf Yükle'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleReceiptFileChange}
                          className="hidden"
                        />
                      </label>
                      {paymentReceipt && (
                        <button
                          type="button"
                          onClick={() => setPaymentReceipt(undefined)}
                          className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Görseli Kaldır"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Kaydet Butonu */}
                  <div className="pt-1 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingPayment(false)}
                      className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-300 transition-colors cursor-pointer"
                    >
                      İptal
                    </button>
                    <button
                      type="button"
                      onClick={handleSavePayment}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                    >
                      Ödemeyi Kaydet
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ========================================================= */}
            {/* D. HIZLI AKSİYON BUTONLARI (KARTIN ALTI - PDF & WHATSAPP) */}
            {/* ========================================================= */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Yeni Ödeme Ekle Butonu */}
                {!isAddingPayment && (
                  <button
                    type="button"
                    onClick={() => setIsAddingPayment(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>Ödeme Ekle</span>
                  </button>
                )}

                {/* 2. Kalan Maaşı Kapat Butonu (Kalan varsa) */}
                {currentMonthCalc.remaining !== null && currentMonthCalc.remaining > 0 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleSettleRemaining('bank')}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 font-bold text-xs hover:bg-blue-100 transition-all cursor-pointer"
                      title="Kalan tutarı Bankadan ödenmiş olarak kaydet"
                    >
                      <span>🏦 Bankadan Kapat</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSettleRemaining('cash')}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-bold text-xs hover:bg-amber-100 transition-all cursor-pointer"
                      title="Kalan tutarı Nakit olarak kaydet"
                    >
                      <span>💵 Nakit Kapat</span>
                    </button>
                  </div>
                )}
              </div>

              {/* PDF İndir & WhatsApp İle Gönder Butonları */}
              <div className="flex items-center gap-2">
                {/* 📄 PDF Pusula İndir */}
                <button
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={() => handleExportAndSharePdf(false)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-all cursor-pointer disabled:opacity-50"
                  title="Resmi Maaş Pusulasını PDF Olarak İndir"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                  ) : (
                    <FileDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span>PDF Pusula</span>
                </button>

                {/* 📱 WhatsApp İle PDF & Bilgi Gönder */}
                <button
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={() => handleExportAndSharePdf(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-xs shadow-md shadow-emerald-700/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shrink-0 disabled:opacity-50"
                  title="Personele WhatsApp üzerinden PDF maaş pusulası ve döküm mesajı gönder"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>WhatsApp (PDF)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dekont Tam Ekran Önizleme Modalı */}
      {previewReceiptUrl && (
        <div
          onClick={() => setPreviewReceiptUrl(null)}
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md cursor-pointer animate-in fade-in"
        >
          <div className="relative max-w-xl max-h-[85vh] bg-slate-900 rounded-3xl overflow-hidden border border-slate-700 shadow-2xl">
            <button
              onClick={() => setPreviewReceiptUrl(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-slate-950/80 text-white hover:bg-rose-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewReceiptUrl}
              alt="Dekont / Fiş"
              className="w-full h-full object-contain max-h-[80vh]"
            />
          </div>
        </div>
      )}

      {/* Başarı Toast Bildirimi */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-60 px-4 py-3 rounded-2xl bg-emerald-600 text-white text-xs font-bold shadow-xl flex items-center gap-2 animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
