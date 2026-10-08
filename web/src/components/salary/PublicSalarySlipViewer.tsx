import React, { useEffect, useRef, useState } from 'react';
import {
  FileDown,
  Printer,
  Building2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import html2pdf from 'html2pdf.js';

export interface SalarySlipPayload {
  isYearly?: boolean;
  staffName: string;
  staffUsername: string;
  staffPhone?: string;
  staffTcNo?: string;
  staffAddress?: string;
  branchName?: string;
  companyName: string;
  month?: number;
  monthName?: string;
  year: number;
  totalPaid: number;
  totalBank: number;
  totalCash: number;
  totalAdvance?: number;
  totalBonus?: number;
  agreed?: number;
  remaining?: number | null;
  paymentsCount?: number;
  activeMonthsCount?: number;
  averageMonthly?: number;
  payments?: Array<{
    date: string;
    amount: number;
    method: string;
    type: string;
    desc?: string;
    branch?: string;
  }>;
  monthlyBreakdown?: Array<{
    month: number;
    monthName: string;
    total: number;
    bank: number;
    cash: number;
    advance: number;
    bonus: number;
    count: number;
  }>;
}

// Safely resolve html2pdf in ESM/CommonJS/UMD bundler environments
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getHtml2Pdf = (): any => {
  let h2p: any = html2pdf;
  if (!h2p || typeof h2p !== 'function') {
    if (typeof (h2p as any)?.default === 'function') {
      h2p = (h2p as any).default;
    } else if (typeof (window as any).html2pdf === 'function') {
      h2p = (window as any).html2pdf;
    }
  }
  return h2p;
};

// Generate pure HTML template with inline styles for 100% reliable PDF rendering
const generateSlipHtml = (data: SalarySlipPayload): string => {
  const isYearly = !!data.isYearly;
  const dateFormatted = new Date().toLocaleDateString('tr-TR');

  if (isYearly) {
    const monthRows = (data.monthlyBreakdown || [])
      .map((m) => {
        const hasData = m.total > 0;
        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px; ${hasData ? 'background-color: #fafbfc;' : ''}">
            <td style="padding: 7px 10px; font-weight: bold; color: #1e293b;">${m.monthName}</td>
            <td style="padding: 7px 10px; text-align: right; color: #0284c7; font-weight: 600;">
              ${m.bank > 0 ? m.bank.toLocaleString('tr-TR') + ' ₺' : '-'}
            </td>
            <td style="padding: 7px 10px; text-align: right; color: #d97706; font-weight: 600;">
              ${m.cash > 0 ? m.cash.toLocaleString('tr-TR') + ' ₺' : '-'}
            </td>
            <td style="padding: 7px 10px; text-align: right; color: #64748b;">
              ${m.advance > 0 ? m.advance.toLocaleString('tr-TR') + ' ₺' : '-'}
            </td>
            <td style="padding: 7px 10px; text-align: right; color: #64748b;">
              ${m.bonus > 0 ? m.bonus.toLocaleString('tr-TR') + ' ₺' : '-'}
            </td>
            <td style="padding: 7px 10px; text-align: right; font-weight: 800; color: ${hasData ? '#059669' : '#94a3b8'};">
              ${hasData ? m.total.toLocaleString('tr-TR') + ' ₺' : '0 ₺'}
            </td>
            <td style="padding: 7px 10px; text-align: center; font-size: 10px; color: #64748b;">
              ${hasData ? `${m.count} işlem` : '-'}
            </td>
          </tr>
        `;
      })
      .join('');

    const monthlyBreakdownTable =
      data.monthlyBreakdown && data.monthlyBreakdown.length > 0
        ? `
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 11px; font-weight: 800; color: #334155; text-transform: uppercase; margin: 0 0 8px 0; letter-spacing: 0.5px;">
          12 Aylık Maaş & Ödeme Dağılımı
        </h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background-color: #f1f5f9; text-align: left; font-size: 10px; font-weight: bold; color: #475569; text-transform: uppercase;">
              <th style="padding: 7px 10px;">Ay</th>
              <th style="padding: 7px 10px; text-align: right;">Banka / EFT</th>
              <th style="padding: 7px 10px; text-align: right;">Elden Nakit</th>
              <th style="padding: 7px 10px; text-align: right;">Avans</th>
              <th style="padding: 7px 10px; text-align: right;">Prim</th>
              <th style="padding: 7px 10px; text-align: right;">Toplam</th>
              <th style="padding: 7px 10px; text-align: center;">İşlem</th>
            </tr>
          </thead>
          <tbody>
            ${monthRows}
          </tbody>
        </table>
      </div>
    `
        : '';

    return `
      <div style="font-family: Arial, Helvetica, sans-serif; color: #0f172a; padding: 20px; width: 720px; margin: 0 auto; background: #ffffff; box-sizing: border-box;">
        <!-- Üst Başlık -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #059669; padding-bottom: 14px; margin-bottom: 16px;">
          <div>
            <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #065f46; letter-spacing: -0.5px;">${data.companyName}</h1>
            <p style="margin: 3px 0 0 0; font-size: 11px; font-weight: bold; color: #059669; text-transform: uppercase; letter-spacing: 0.8px;">
              YILLIK PERSONEL MAAŞ & ÖDEME İCMAL BORDROSU
            </p>
          </div>
          <div style="text-align: right; font-size: 10px; color: #64748b;">
            <div style="display: inline-block; background-color: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-size: 11px; font-weight: bold; padding: 3px 8px; border-radius: 6px;">
              DÖNEM: ${data.year} YILI KÜMÜLATİF
            </div>
            <div style="margin-top: 4px;">Düzenleme: ${dateFormatted}</div>
            <div>Belge No: YIL-${data.year}</div>
          </div>
        </div>

        <!-- Personel Bilgi Kartı -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
          <tr>
            <td style="padding: 8px 12px; width: 35%;">
              <span style="color: #64748b; font-size: 10px; font-weight: bold; text-transform: uppercase;">Personel Adı Soyadı</span><br/>
              <strong style="color: #0f172a; font-size: 13px;">${data.staffName}</strong>
            </td>
            <td style="padding: 8px 12px; width: 25%;">
              <span style="color: #64748b; font-size: 10px; font-weight: bold; text-transform: uppercase;">T.C. Kimlik No</span><br/>
              <strong style="color: #0f172a; font-family: monospace;">${data.staffTcNo || '-'}</strong>
            </td>
            <td style="padding: 8px 12px; width: 20%;">
              <span style="color: #64748b; font-size: 10px; font-weight: bold; text-transform: uppercase;">Telefon</span><br/>
              <strong style="color: #0f172a;">${data.staffPhone || '-'}</strong>
            </td>
            <td style="padding: 8px 12px; width: 20%;">
              <span style="color: #64748b; font-size: 10px; font-weight: bold; text-transform: uppercase;">Şube / Lokasyon</span><br/>
              <strong style="color: #0f172a;">${data.branchName || 'Genel Merkez'}</strong>
            </td>
          </tr>
          ${
            data.staffAddress
              ? `
          <tr>
            <td colspan="4" style="padding: 6px 12px 8px 12px; border-top: 1px dashed #e2e8f0;">
              <span style="color: #64748b; font-size: 10px; font-weight: bold; text-transform: uppercase;">İkametgah / Adres:</span>
              <span style="color: #334155; font-size: 11px; margin-left: 6px;">${data.staffAddress}</span>
            </td>
          </tr>
          `
              : ''
          }
        </table>

        <!-- Yıllık Özet Kartları -->
        <div style="display: flex; gap: 8px; margin-bottom: 18px;">
          <div style="flex: 1; border: 1px solid #a7f3d0; background-color: #ecfdf5; border-radius: 8px; padding: 10px;">
            <div style="font-size: 9px; font-weight: bold; color: #065f46; text-transform: uppercase;">Yıllık Toplam Ödenen</div>
            <div style="font-size: 15px; font-weight: 900; color: #047857; margin-top: 3px;">
              ${data.totalPaid.toLocaleString('tr-TR')} ₺
            </div>
          </div>
          <div style="flex: 1; border: 1px solid #bfdbfe; background-color: #eff6ff; border-radius: 8px; padding: 10px;">
            <div style="font-size: 9px; font-weight: bold; color: #1e40af; text-transform: uppercase;">Banka / EFT</div>
            <div style="font-size: 14px; font-weight: 800; color: #1d4ed8; margin-top: 3px;">
              ${data.totalBank.toLocaleString('tr-TR')} ₺
            </div>
          </div>
          <div style="flex: 1; border: 1px solid #fde68a; background-color: #fffbeb; border-radius: 8px; padding: 10px;">
            <div style="font-size: 9px; font-weight: bold; color: #92400e; text-transform: uppercase;">Elden Nakit</div>
            <div style="font-size: 14px; font-weight: 800; color: #b45309; margin-top: 3px;">
              ${data.totalCash.toLocaleString('tr-TR')} ₺
            </div>
          </div>
          <div style="flex: 1; border: 1px solid #e2e8f0; background-color: #f8fafc; border-radius: 8px; padding: 10px;">
            <div style="font-size: 9px; font-weight: bold; color: #475569; text-transform: uppercase;">Aylık Ortalama</div>
            <div style="font-size: 14px; font-weight: 800; color: #334155; margin-top: 3px;">
              ${(data.averageMonthly || Math.round(data.totalPaid / 12)).toLocaleString('tr-TR')} ₺
            </div>
          </div>
        </div>

        ${monthlyBreakdownTable}

        <!-- İmza Alanı -->
        <div style="display: flex; justify-content: space-between; margin-top: 35px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
          <div style="text-align: center; width: 38%;">
            <div style="font-size: 11px; font-weight: bold; color: #334155; margin-bottom: 45px;">İşveren / Yetkili İmza & Kaşe</div>
            <div style="border-top: 1px dashed #94a3b8; padding-top: 4px; font-size: 10px; color: #64748b;">${data.companyName}</div>
          </div>
          <div style="text-align: center; width: 38%;">
            <div style="font-size: 11px; font-weight: bold; color: #334155; margin-bottom: 45px;">Personel Teslim Alan İmza</div>
            <div style="border-top: 1px dashed #94a3b8; padding-top: 4px; font-size: 10px; color: #64748b;">${data.staffName}</div>
          </div>
        </div>

        <div style="margin-top: 20px; text-align: center; font-size: 9px; color: #94a3b8;">
          İşbu icmal ${data.year} yılı kümülatif personel bordro özetini gösterir ve resmi bordro ekidir. Sistem tarafından otomatik üretilmiştir.
        </div>
      </div>
    `;
  }

  // Monthly Slip HTML
  const paymentRows = (data.payments || [])
    .map(
      (p, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 8px 10px; text-align: center; color: #64748b;">${idx + 1}</td>
        <td style="padding: 8px 10px; font-weight: bold; color: #1e293b;">${p.date}</td>
        <td style="padding: 8px 10px; color: #334155;">
          ${
            p.type === 'bonus'
              ? 'Prim'
              : p.type === 'advance'
              ? 'Avans'
              : 'Maaş'
          }
        </td>
        <td style="padding: 8px 10px;">
          <span style="display: inline-block; padding: 2px 6px; border-radius: 6px; font-size: 10px; font-weight: bold; ${
            p.method === 'bank'
              ? 'background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;'
              : 'background: #fffbeb; color: #b45309; border: 1px solid #fde68a;'
          }">
            ${p.method === 'bank' ? '🏦 Banka / EFT' : '💵 Elden Nakit'}
          </span>
        </td>
        <td style="padding: 8px 10px; color: #475569;">${p.branch || data.branchName || '-'}</td>
        <td style="padding: 8px 10px; color: #64748b;">${p.desc || '-'}</td>
        <td style="padding: 8px 10px; text-align: right; font-weight: bold; color: #047857; font-size: 12px;">
          ${p.amount.toLocaleString('tr-TR')} ₺
        </td>
      </tr>
    `
    )
    .join('');

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #0f172a; padding: 20px; width: 720px; margin: 0 auto; background: #ffffff; box-sizing: border-box;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #059669; padding-bottom: 16px; margin-bottom: 20px;">
        <div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #065f46; letter-spacing: -0.5px;">
            ${data.companyName}
          </h1>
          <p style="margin: 3px 0 0 0; font-size: 12px; color: #475569; font-weight: bold;">
            PERSONEL MAAŞ & ÖDEME PUSULASI
          </p>
        </div>
        <div style="text-align: right; font-size: 11px; color: #64748b;">
          <div><strong>Dönem:</strong> ${data.monthName || (data.month ? `${data.month}. Ay` : '')} ${data.year}</div>
          <div><strong>Düzenleme:</strong> ${dateFormatted}</div>
          <div><strong>Belge No:</strong> MS-${data.year}${data.month && data.month < 10 ? '0' + data.month : data.month || ''}</div>
        </div>
      </div>

      <!-- Personel Bilgileri Tablosu -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <tr>
            <td style="width: 20%; padding: 4px 0; color: #64748b;">Personel Adı:</td>
            <td style="width: 30%; padding: 4px 0; font-weight: bold; color: #0f172a;">${data.staffName}</td>
            <td style="width: 20%; padding: 4px 0; color: #64748b;">T.C. Kimlik No:</td>
            <td style="width: 30%; padding: 4px 0; font-weight: bold; color: #0f172a; font-family: monospace;">${data.staffTcNo || '-'}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Kullanıcı Adı:</td>
            <td style="padding: 4px 0; color: #334155;">@${data.staffUsername}</td>
            <td style="padding: 4px 0; color: #64748b;">Telefon:</td>
            <td style="padding: 4px 0; color: #334155;">${data.staffPhone || '-'}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Şube / Birim:</td>
            <td style="padding: 4px 0; font-weight: bold; color: #0f172a;">${data.branchName || 'Merkez'}</td>
            <td style="padding: 4px 0; color: #64748b;">İkamet / Adres:</td>
            <td style="padding: 4px 0; color: #334155;">${data.staffAddress || '-'}</td>
          </tr>
        </table>
      </div>

      <!-- Özet Finansal Kutular -->
      <div style="display: flex; gap: 12px; margin-bottom: 20px;">
        <div style="flex: 1; border: 1px solid #a7f3d0; background: #ecfdf5; border-radius: 10px; padding: 12px;">
          <div style="font-size: 11px; font-weight: bold; color: #065f46;">TOPLAM</div>
          <div style="font-size: 18px; font-weight: 900; color: #047857; margin-top: 4px;">
            ${data.totalPaid.toLocaleString('tr-TR')} ₺
          </div>
        </div>
        <div style="flex: 1; border: 1px solid #bfdbfe; background: #eff6ff; border-radius: 10px; padding: 12px;">
          <div style="font-size: 11px; font-weight: bold; color: #1e40af;">🏦 BANKA / EFT İLE</div>
          <div style="font-size: 16px; font-weight: 900; color: #1d4ed8; margin-top: 4px;">
            ${data.totalBank.toLocaleString('tr-TR')} ₺
          </div>
        </div>
        <div style="flex: 1; border: 1px solid #fde68a; background: #fffbeb; border-radius: 10px; padding: 12px;">
          <div style="font-size: 11px; font-weight: bold; color: #92400e;">💵 ELDEN NAKİT İLE</div>
          <div style="font-size: 16px; font-weight: 900; color: #b45309; margin-top: 4px;">
            ${data.totalCash.toLocaleString('tr-TR')} ₺
          </div>
        </div>
      </div>

      ${
        data.agreed !== undefined && data.remaining !== undefined && data.remaining !== null
          ? `
        <div style="background: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 10px 14px; margin-bottom: 20px; font-size: 11px; display: flex; justify-content: space-between;">
          <span><strong>Anlaşılan Dönem Hak Edişi:</strong> ${data.agreed.toLocaleString('tr-TR')} ₺</span>
          <span style="color: ${(data.remaining ?? 0) > 0 ? '#b91c1c' : '#047857'}; font-weight: bold;">
            <strong>Kalan Bakiye:</strong> ${(data.remaining ?? 0).toLocaleString('tr-TR')} ₺
          </span>
        </div>
      `
          : ''
      }

      <!-- Ödeme Hareketleri Detay Tablosu -->
      <div style="margin-bottom: 25px;">
        <h3 style="font-size: 12px; font-weight: 800; color: #334155; text-transform: uppercase; margin: 0 0 10px 0;">
          Ödeme Hareketleri Dökümü (${data.payments?.length || 0} İşlem)
        </h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left; font-size: 10px; font-weight: bold; color: #475569; text-transform: uppercase;">
              <th style="padding: 8px 10px; text-align: center; width: 30px;">#</th>
              <th style="padding: 8px 10px;">Tarih</th>
              <th style="padding: 8px 10px;">Ödeme Türü</th>
              <th style="padding: 8px 10px;">Kanal</th>
              <th style="padding: 8px 10px;">Şube</th>
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
            ${data.companyName}
          </div>
        </div>
        <div style="text-align: center; width: 40%;">
          <div style="font-size: 11px; font-weight: bold; color: #334155; margin-bottom: 50px;">
            Personel / Teslim Alan İmza
          </div>
          <div style="border-top: 1px dashed #94a3b8; padding-top: 5px; font-size: 10px; color: #64748b;">
            ${data.staffName}
          </div>
        </div>
      </div>

      <!-- Dipnot -->
      <div style="margin-top: 25px; text-align: center; font-size: 9px; color: #94a3b8; line-height: 1.4;">
        İşbu pusula ${data.monthName || (data.month ? `${data.month}. Ay` : '')} ${data.year} dönemi içerisinde personele banka veya nakit elden teslim edilen tüm ödemeleri belgeler.<br/>
        Sistem tarafından otomatik üretilmiştir ve resmi bordro ekidir.
      </div>
    </div>
  `;
};

export const PublicSalarySlipViewer: React.FC = () => {
  const [data, setData] = useState<SalarySlipPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [readyPdfUrl, setReadyPdfUrl] = useState<string | null>(null);
  const [readyPdfName, setReadyPdfName] = useState<string>('');
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('pusula');
      if (!token) {
        setError('Pusula bağlantı parametresi bulunamadı.');
        return;
      }

      // Safe base64 decoding with UTF-8 support
      const decoded = decodeURIComponent(
        atob(token)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const parsed: SalarySlipPayload = JSON.parse(decoded);
      setData(parsed);
    } catch (err: any) {
      console.error('Pusula decode hatası:', err);
      setError('Pusula bağlantısı geçersiz veya bozuk.');
    }
  }, []);

  const handleDownloadPdf = async () => {
    if (!data) return;
    setIsDownloading(true);

    const cleanFileName = data.isYearly
      ? `${data.staffName.replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ_-]/g, '_')}_${data.year}_Yillik_Odeme_Icmali.pdf`
      : `${data.staffName.replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ_-]/g, '_')}_${data.monthName || (data.month ? `Ay_${data.month}` : 'Donem')}_${data.year}_Maas_Pusulasi.pdf`;

    // Safely append isolated printable container in DOM flow for accurate html2canvas capture
    const container = document.createElement('div');
    container.innerHTML = generateSlipHtml(data);
    document.body.appendChild(container);

    try {
      const h2p = getHtml2Pdf();
      if (!h2p || typeof h2p !== 'function') {
        throw new Error('PDF kütüphanesi hazır değil');
      }

      const opt = {
        margin: [8, 8, 8, 8],
        filename: cleanFileName,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
        },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
      };

      const pdfBlob: Blob = await h2p().set(opt).from(container).outputPdf('blob');

      const isMobile =
        typeof navigator !== 'undefined' &&
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

      let shared = false;

      // Mobil cihazlarda doğrudan sistem paylaşım sayfası (WhatsApp, Dosyalar vb.)
      if (isMobile && navigator.share && navigator.canShare) {
        try {
          const pdfFile = new File([pdfBlob], cleanFileName, { type: 'application/pdf' });
          if (navigator.canShare({ files: [pdfFile] })) {
            await navigator.share({
              files: [pdfFile],
              title: cleanFileName,
            });
            shared = true;
          }
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') {
            return;
          }
          console.warn('Share API error, fallback to blob download:', shareErr);
        }
      }

      if (!shared) {
        const blobUrl = URL.createObjectURL(pdfBlob);
        setReadyPdfUrl(blobUrl);
        setReadyPdfName(cleanFileName);

        // Tarayıcı indirme tetikleme
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = cleanFileName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Mobil veya WhatsApp WebView ortamında otomatik indirme kısıtlanabiliyor, yeni sekmede de aç
        if (isMobile) {
          setTimeout(() => {
            try {
              window.open(blobUrl, '_blank');
            } catch (_) {}
          }, 400);
        }
      }
    } catch (err) {
      console.error('PDF indirme hatası:', err);
      // Fallback: Tarayıcı yerel yazdırma/PDF kaydetme penceresini aç
      try {
        window.print();
      } catch (printErr) {
        console.error('Yazdırma hatası:', printErr);
        alert(
          'PDF indirilemedi. Lütfen tarayıcınızın menüsünden "Yazdır" veya "PDF Olarak Kaydet" seçeneğini kullanınız.'
        );
      }
    } finally {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 rounded-3xl bg-slate-800 border border-rose-500/30 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-black text-white">Geçersiz Pusula Bağlantısı</h2>
          <p className="text-xs text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 print:bg-white text-slate-100 print:text-slate-900 flex flex-col items-center py-6 px-3 sm:px-6 print:p-0">
      <style>{`
        @media print {
          body, html {
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print-card-wrapper {
            box-shadow: none !important;
            border: none !important;
            max-width: 100% !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* Üst İşlem Çubuğu (Yazdırma ve İndirme) */}
      <div className="w-full max-w-[800px] mb-4 flex flex-wrap items-center justify-between gap-3 bg-slate-800/90 backdrop-blur-md p-3.5 rounded-2xl border border-slate-700 shadow-xl print:hidden">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-black text-white block">{data.companyName}</span>
            <span className="text-[10px] text-slate-400">
              {data.isYearly ? `${data.year} Yıllık İcmal` : `${data.monthName || (data.month ? `${data.month}. Ay` : '')} ${data.year} Pusulası`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Yazdır</span>
          </button>
          <button
            type="button"
            disabled={isDownloading}
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Hazırlanıyor...</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                <span>Resmi PDF İndir</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* PDF İndirme Başarı / Doğrudan Açma Butonu (Özellikle Mobil ve WhatsApp Webview için) */}
      {readyPdfUrl && (
        <div className="w-full max-w-[800px] mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3 text-emerald-300 text-xs print:hidden animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">
              PDF belgeniz hazır! İndirme otomatik başlamadıysa sağdaki butondan hemen açabilirsiniz.
            </span>
          </div>
          <a
            href={readyPdfUrl}
            download={readyPdfName}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shrink-0 transition-colors shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>PDF'i Aç</span>
          </a>
        </div>
      )}

      {/* Yazdırılabilir & İndirilebilir Resmi Bordro Pusulası Kartı */}
      <div className="print-card-wrapper w-full max-w-[800px] bg-white text-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        <div ref={printRef} className="p-6 sm:p-8 space-y-5 bg-white text-slate-900 font-sans">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-emerald-600 pb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-emerald-800 tracking-tight">
                {data.companyName}
              </h1>
              <p className="text-xs font-bold text-slate-600 mt-1">
                {data.isYearly ? 'YILLIK PERSONEL ÖDEME VE BORDRO İCMALİ' : 'PERSONEL MAAŞ & ÖDEME PUSULASI'}
              </p>
            </div>
            <div className="text-right text-[11px] text-slate-500 space-y-0.5">
              <div>
                <strong>Dönem:</strong>{' '}
                {data.isYearly
                  ? `${data.year} Yılı`
                  : `${data.monthName || (data.month ? `${data.month}. Ay` : '')} ${data.year}`}
              </div>
              <div>
                <strong>Düzenleme:</strong> {new Date().toLocaleDateString('tr-TR')}
              </div>
              <div>
                <strong>Belge No:</strong>{' '}
                {data.isYearly
                  ? `YIL-${data.year}`
                  : `MS-${data.year}${data.month && data.month < 10 ? '0' + data.month : data.month || ''}`}
              </div>
            </div>
          </div>

          {/* Personel Bilgileri */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Personel Adı</span>
                <span className="font-extrabold text-slate-900">{data.staffName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">T.C. Kimlik No</span>
                <span className="font-mono font-bold text-slate-900">{data.staffTcNo || '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Kullanıcı Adı</span>
                <span className="font-semibold text-slate-700">@{data.staffUsername}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Telefon</span>
                <span className="font-semibold text-slate-700">{data.staffPhone || '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Şube / Birim</span>
                <span className="font-semibold text-slate-700">{data.branchName || 'Merkez'}</span>
              </div>
              <div className="sm:col-span-3">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">İkametgah / Açık Adres</span>
                <span className="font-medium text-slate-700 truncate block" title={data.staffAddress || '-'}>
                  {data.staffAddress || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Finansal Kutular */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                {data.isYearly ? 'YILLIK TOPLAM ÖDENEN' : 'TOPLAM'}
              </span>
              <span className="text-lg font-black text-emerald-700 mt-1 block">
                {data.totalPaid.toLocaleString('tr-TR')} ₺
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200">
              <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider block">
                🏦 BANKA / EFT İLE
              </span>
              <span className="text-base font-black text-blue-700 mt-1 block">
                {data.totalBank.toLocaleString('tr-TR')} ₺
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
              <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block">
                💵 ELDEN NAKİT İLE
              </span>
              <span className="text-base font-black text-amber-700 mt-1 block">
                {data.totalCash.toLocaleString('tr-TR')} ₺
              </span>
            </div>
          </div>

          {/* Anlaşılan Hak Ediş ve Kalan Bakiye (Varsa) */}
          {!data.isYearly && data.agreed !== undefined && data.remaining !== undefined && data.remaining !== null && (
            <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between text-xs">
              <span>
                <strong>Anlaşılan Dönem Hak Edişi:</strong> {data.agreed.toLocaleString('tr-TR')} ₺
              </span>
              <span className={(data.remaining ?? 0) > 0 ? 'text-rose-700 font-extrabold' : 'text-emerald-700 font-extrabold'}>
                <strong>Kalan Bakiye:</strong> {(data.remaining ?? 0).toLocaleString('tr-TR')} ₺
              </span>
            </div>
          )}

          {/* Yıllık 12 Aylık Dağılım Tablosu (Varsa) */}
          {data.isYearly && data.monthlyBreakdown && data.monthlyBreakdown.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                12 Aylık Maaş & Ödeme Dağılımı
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Ay</th>
                      <th className="p-2.5 text-right">Banka / EFT</th>
                      <th className="p-2.5 text-right">Elden Nakit</th>
                      <th className="p-2.5 text-right">Avans</th>
                      <th className="p-2.5 text-right">Prim</th>
                      <th className="p-2.5 text-right">Toplam</th>
                      <th className="p-2.5 text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.monthlyBreakdown.map((m, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="p-2.5 font-bold text-slate-800">{m.monthName}</td>
                        <td className="p-2.5 text-right text-blue-700 font-semibold">
                          {m.bank > 0 ? `${m.bank.toLocaleString('tr-TR')} ₺` : '-'}
                        </td>
                        <td className="p-2.5 text-right text-amber-700 font-semibold">
                          {m.cash > 0 ? `${m.cash.toLocaleString('tr-TR')} ₺` : '-'}
                        </td>
                        <td className="p-2.5 text-right text-slate-600">
                          {m.advance > 0 ? `${m.advance.toLocaleString('tr-TR')} ₺` : '-'}
                        </td>
                        <td className="p-2.5 text-right text-slate-600">
                          {m.bonus > 0 ? `${m.bonus.toLocaleString('tr-TR')} ₺` : '-'}
                        </td>
                        <td className="p-2.5 text-right font-black text-emerald-700">
                          {m.total > 0 ? `${m.total.toLocaleString('tr-TR')} ₺` : '0 ₺'}
                        </td>
                        <td className="p-2.5 text-center text-slate-500 text-[11px]">
                          {m.count > 0 ? `${m.count} işlem` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Ödeme Kalemleri Tablosu */}
          {data.payments && data.payments.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Ödeme Hareketleri Dökümü ({data.payments.length} İşlem)
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Tarih</th>
                      <th className="p-2.5">Ödeme Türü</th>
                      <th className="p-2.5">Kanal</th>
                      <th className="p-2.5">Şube</th>
                      <th className="p-2.5">Açıklama</th>
                      <th className="p-2.5 text-right">Tutar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.payments.map((p, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="p-2.5 text-slate-600">{p.date}</td>
                        <td className="p-2.5 font-bold text-slate-800">
                          {p.type === 'bonus' ? '🎁 Prim' : p.type === 'advance' ? '⚡ Avans' : '💼 Maaş'}
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              p.method === 'bank'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {p.method === 'bank' ? '🏦 Banka' : '💵 Nakit'}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-600">{p.branch || '-'}</td>
                        <td className="p-2.5 text-slate-500">{p.desc || '-'}</td>
                        <td className="p-2.5 text-right font-black text-emerald-700">
                          {p.amount.toLocaleString('tr-TR')} ₺
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* İmza Alanı */}
          <div className="pt-8 flex items-center justify-between text-xs border-t border-slate-200">
            <div className="text-center w-40">
              <div className="font-bold text-slate-700 mb-8">İşveren / Yetkili İmza</div>
              <div className="border-t border-dashed border-slate-300 pt-1 text-[11px] text-slate-500 font-semibold">
                {data.companyName}
              </div>
            </div>
            <div className="text-center w-40">
              <div className="font-bold text-slate-700 mb-8">Personel Teslim Alan İmza</div>
              <div className="border-t border-dashed border-slate-300 pt-1 text-[11px] text-slate-500 font-semibold">
                {data.staffName}
              </div>
            </div>
          </div>

          {/* Dipnot */}
          <div className="pt-2 text-center text-[10px] text-slate-400">
            İşbu pusula sistem tarafından otomatik üretilmiştir ve resmi bordro ekidir.
          </div>
        </div>
      </div>
    </div>
  );
};
