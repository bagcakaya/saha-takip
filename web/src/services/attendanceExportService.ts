import * as XLSX from 'xlsx';
import { AttendanceRecord } from '../types/storage';

export interface StaffAttendanceSummary {
  userId: string;
  userName: string;
  userRole?: string;
  branchName?: string;
  totalDays: number;
  totalMinutes: number;
  totalDurationFormatted: string;
  averageMinutesPerDay: number;
  averageDurationFormatted: string;
  completedSessions: number;
  activeSessions: number;
  pendingSessions: number;
}

/**
 * Format total minutes to human-readable Turkish string: 'X sa Y dk' or 'Y dk'
 */
export const formatMinutesToDuration = (minutes: number): string => {
  if (!minutes || isNaN(minutes) || minutes <= 0) return '0 dk';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0 && m > 0) return `${h} sa ${m} dk`;
  if (h > 0) return `${h} sa`;
  return `${m} dk`;
};

/**
 * Calculates work duration in minutes for a record
 */
export const calculateRecordDurationMinutes = (record: AttendanceRecord): number => {
  if (record.workDurationMinutes && record.workDurationMinutes > 0) {
    return record.workDurationMinutes;
  }
  if (record.checkInTime) {
    const end = record.checkOutTime || Date.now();
    const diff = Math.floor((end - record.checkInTime) / 60000);
    return Math.max(0, diff);
  }
  return 0;
};

/**
 * Export attendance records and staff summaries to Excel (.xlsx)
 */
export const exportAttendanceToExcel = ({
  records,
  summaries,
  startDate,
  endDate,
  companyName = 'Firma',
}: {
  records: AttendanceRecord[];
  summaries: StaffAttendanceSummary[];
  startDate: string;
  endDate: string;
  companyName?: string;
}): void => {
  const wb = XLSX.utils.book_new();

  const rangeLabel = startDate && endDate
    ? `${startDate} - ${endDate}`
    : startDate
    ? `${startDate} sonrası`
    : endDate
    ? `${endDate} öncesi`
    : 'Tüm Zamanlar';

  // -------------------------------------------------------------
  // Sheet 1: Mesai Özeti
  // -------------------------------------------------------------
  const summaryAoa: any[][] = [
    [`${companyName.toUpperCase()} - PERSONEL MESAİ ÖZETİ`],
    [`Tarih Aralığı: ${rangeLabel}`, '', '', `Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`],
    [], // empty row
    [
      'Personel Adı',
      'Rol / Yetki',
      'Şube / Lokasyon',
      'Çalışılan Gün',
      'Toplam Mesai',
      'Toplam Süre (Dk)',
      'Günlük Ort. Mesai',
      'Tamamlanan Mesai',
      'Aktif / Bekleyen',
    ],
  ];

  let sumTotalDays = 0;
  let sumTotalMinutes = 0;
  let sumCompleted = 0;
  let sumPending = 0;

  summaries.forEach((s) => {
    sumTotalDays += s.totalDays;
    sumTotalMinutes += s.totalMinutes;
    sumCompleted += s.completedSessions;
    sumPending += s.activeSessions + s.pendingSessions;

    summaryAoa.push([
      s.userName,
      s.userRole === 'admin' ? 'Yönetici' : 'Saha Yetkilisi',
      s.branchName || 'Merkez',
      s.totalDays,
      s.totalDurationFormatted,
      s.totalMinutes,
      s.averageDurationFormatted,
      s.completedSessions,
      s.activeSessions + s.pendingSessions,
    ]);
  });

  const overallAvgMinutes = sumTotalDays > 0 ? Math.round(sumTotalMinutes / sumTotalDays) : 0;

  // Add overall total row
  summaryAoa.push([]);
  summaryAoa.push([
    'GENEL TOPLAM',
    '',
    '',
    sumTotalDays,
    formatMinutesToDuration(sumTotalMinutes),
    sumTotalMinutes,
    formatMinutesToDuration(overallAvgMinutes),
    sumCompleted,
    sumPending,
  ]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);

  // Set column widths
  wsSummary['!cols'] = [
    { wch: 22 }, // Personel
    { wch: 16 }, // Rol
    { wch: 18 }, // Şube
    { wch: 14 }, // Çalışılan Gün
    { wch: 18 }, // Toplam Mesai
    { wch: 16 }, // Toplam Süre (Dk)
    { wch: 18 }, // Günlük Ort. Mesai
    { wch: 16 }, // Tamamlanan
    { wch: 16 }, // Bekleyen
  ];

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Mesai Özeti');

  // -------------------------------------------------------------
  // Sheet 2: Detaylı Günlük Kayıtlar
  // -------------------------------------------------------------
  const detailsAoa: any[][] = [
    [`${companyName.toUpperCase()} - GÜNLÜK MESAİ DETAY KAYITLARI`],
    [`Tarih Aralığı: ${rangeLabel}`, '', '', `Toplam Kayıt: ${records.length} Adet`],
    [],
    [
      'Tarih',
      'Personel Adı',
      'Rol',
      'Şube',
      'Durum',
      'Giriş Saati',
      'Giriş Mesafesi',
      'Giriş Durumu',
      'Çıkış Saati',
      'Çıkış Mesafesi',
      'Çıkış Durumu',
      'Çalışma Süresi',
      'Süre (Dakika)',
      'Notlar / Açıklama',
    ],
  ];

  // Sort records by date descending, then checkInTime descending
  const sortedRecords = [...records].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.checkInTime || 0) - (a.checkInTime || 0);
  });

  sortedRecords.forEach((r) => {
    const checkInDate = r.checkInTime ? new Date(r.checkInTime) : null;
    const checkOutDate = r.checkOutTime ? new Date(r.checkOutTime) : null;
    const durationMin = calculateRecordDurationMinutes(r);

    let statusText = 'Tamamlandı';
    if (r.status === 'checked_in') statusText = 'Mesaide';
    else if (r.status === 'pending_checkin_approval') statusText = 'Giriş Onayı Bekliyor';
    else if (r.status === 'pending_checkout_approval') statusText = 'Çıkış Onayı Bekliyor';

    const checkInDistanceStr = r.checkInDistance !== undefined ? `${Math.round(r.checkInDistance)} m` : '-';
    const checkOutDistanceStr = r.checkOutDistance !== undefined ? `${Math.round(r.checkOutDistance)} m` : '-';

    const checkInApprovalStr = r.checkInOutside
      ? r.checkInApprovalStatus === 'pending'
        ? 'Dış Giriş (Onay Bekliyor)'
        : 'Dış Giriş (Onaylandı)'
      : 'Normal';

    const checkOutApprovalStr = r.checkOutOutside
      ? r.checkOutApprovalStatus === 'pending'
        ? 'Dış Çıkış (Onay Bekliyor)'
        : 'Dış Çıkış (Onaylandı)'
      : r.checkOutTime ? 'Normal' : '-';

    detailsAoa.push([
      r.date,
      r.userName,
      r.userRole === 'admin' ? 'Yönetici' : 'Saha Yetkilisi',
      r.branchName || 'Merkez',
      statusText,
      checkInDate ? checkInDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-',
      checkInDistanceStr,
      checkInApprovalStr,
      checkOutDate ? checkOutDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-',
      checkOutDistanceStr,
      checkOutApprovalStr,
      formatMinutesToDuration(durationMin),
      durationMin,
      r.notes || r.approvalNote || '',
    ]);
  });

  const wsDetails = XLSX.utils.aoa_to_sheet(detailsAoa);

  wsDetails['!cols'] = [
    { wch: 12 }, // Tarih
    { wch: 20 }, // Personel
    { wch: 14 }, // Rol
    { wch: 16 }, // Şube
    { wch: 18 }, // Durum
    { wch: 12 }, // Giriş Saati
    { wch: 14 }, // Giriş Mesafesi
    { wch: 22 }, // Giriş Durumu
    { wch: 12 }, // Çıkış Saati
    { wch: 14 }, // Çıkış Mesafesi
    { wch: 22 }, // Çıkış Durumu
    { wch: 16 }, // Süre
    { wch: 14 }, // Süre Dk
    { wch: 30 }, // Notlar
  ];

  XLSX.utils.book_append_sheet(wb, wsDetails, 'Mesai Detayları');

  const safeCompany = companyName.replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ_-]/g, '_');
  const safeStart = startDate || 'Baslangic';
  const safeEnd = endDate || 'Bitis';
  const fileName = `Mesai_Raporu_${safeCompany}_${safeStart}_${safeEnd}.xlsx`;

  XLSX.writeFile(wb, fileName);
};

/**
 * Export attendance records and staff summaries to PDF
 */
export const exportAttendanceToPdf = async ({
  records,
  summaries,
  startDate,
  endDate,
  companyName = 'Firma',
}: {
  records: AttendanceRecord[];
  summaries: StaffAttendanceSummary[];
  startDate: string;
  endDate: string;
  companyName?: string;
}): Promise<void> => {
  const rangeLabel = startDate && endDate
    ? `${startDate} - ${endDate}`
    : startDate
    ? `${startDate} sonrası`
    : endDate
    ? `${endDate} öncesi`
    : 'Tüm Zamanlar';

  const reportDate = new Date().toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Calculate totals
  const totalMinutes = summaries.reduce((acc, s) => acc + s.totalMinutes, 0);
  const totalDays = summaries.reduce((acc, s) => acc + s.totalDays, 0);
  const totalCompleted = summaries.reduce((acc, s) => acc + s.completedSessions, 0);

  // Summary Rows HTML
  const summaryTableRows = summaries
    .map((s) => {
      return `
        <tr>
          <td style="padding: 8px 10px; font-weight: bold; color: #0f172a; border-bottom: 1px solid #e2e8f0;">
            ${s.userName}
          </td>
          <td style="padding: 8px 10px; color: #475569; font-size: 11px; border-bottom: 1px solid #e2e8f0;">
            ${s.userRole === 'admin' ? 'Yönetici' : 'Saha Yetkilisi'}
          </td>
          <td style="padding: 8px 10px; color: #475569; font-size: 11px; border-bottom: 1px solid #e2e8f0;">
            ${s.branchName || 'Merkez'}
          </td>
          <td style="padding: 8px 10px; text-align: center; font-weight: bold; border-bottom: 1px solid #e2e8f0;">
            ${s.totalDays} gün
          </td>
          <td style="padding: 8px 10px; text-align: right; font-weight: 800; color: #0284c7; border-bottom: 1px solid #e2e8f0;">
            ${s.totalDurationFormatted}
          </td>
          <td style="padding: 8px 10px; text-align: right; color: #16a34a; font-weight: 600; border-bottom: 1px solid #e2e8f0;">
            ${s.averageDurationFormatted}
          </td>
          <td style="padding: 8px 10px; text-align: center; border-bottom: 1px solid #e2e8f0;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold; background: #ecfdf5; color: #047857;">
              ${s.completedSessions}
            </span>
          </td>
        </tr>
      `;
    })
    .join('');

  // Detail Rows HTML (top 200 records)
  const sortedRecords = [...records].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.checkInTime || 0) - (a.checkInTime || 0);
  });

  const detailTableRows = sortedRecords
    .slice(0, 200)
    .map((r) => {
      const checkInDate = r.checkInTime ? new Date(r.checkInTime) : null;
      const checkOutDate = r.checkOutTime ? new Date(r.checkOutTime) : null;
      const durationMin = calculateRecordDurationMinutes(r);

      let statusBadge = `<span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: #f1f5f9; color: #475569;">Çıkış Yaptı</span>`;
      if (r.status === 'checked_in') {
        statusBadge = `<span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: #dcfce7; color: #15803d;">Mesaide</span>`;
      } else if (r.status === 'pending_checkin_approval') {
        statusBadge = `<span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: #fef3c7; color: #b45309;">Giriş Onayı</span>`;
      } else if (r.status === 'pending_checkout_approval') {
        statusBadge = `<span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: #fef3c7; color: #b45309;">Çıkış Onayı</span>`;
      }

      return `
        <tr>
          <td style="padding: 6px 8px; font-weight: bold; border-bottom: 1px solid #f1f5f9; font-size: 11px;">
            ${r.date}
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-weight: 600; font-size: 11px; color: #1e293b;">
            ${r.userName}
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 10px; color: #64748b;">
            ${r.branchName || 'Merkez'}
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 11px; text-align: center;">
            ${checkInDate ? checkInDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'}
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 11px; text-align: center;">
            ${checkOutDate ? checkOutDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'}
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: bold; text-align: right; color: #0284c7;">
            ${formatMinutesToDuration(durationMin)}
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; text-align: center;">
            ${statusBadge}
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 10px; color: #64748b;">
            ${r.notes || r.approvalNote || '-'}
          </td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Personel Mesai Raporu - ${companyName}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            padding: 24px;
            margin: 0;
            background-color: #ffffff;
            font-size: 12px;
            line-height: 1.4;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 14px;
            margin-bottom: 16px;
          }
          .title {
            font-size: 20px;
            font-weight: 900;
            color: #0369a1;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .company-name {
            font-size: 13px;
            font-weight: 800;
            color: #0f172a;
            margin-top: 4px;
          }
          .meta-info {
            text-align: right;
            font-size: 11px;
            color: #475569;
          }
          .badge-range {
            display: inline-block;
            background: #e0f2fe;
            color: #0369a1;
            padding: 4px 8px;
            border-radius: 6px;
            font-weight: bold;
            margin-top: 4px;
          }
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 20px;
          }
          .kpi-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 12px;
          }
          .kpi-title {
            font-size: 10px;
            font-weight: bold;
            color: #64748b;
            text-transform: uppercase;
          }
          .kpi-value {
            font-size: 17px;
            font-weight: 900;
            color: #0f172a;
            margin-top: 2px;
          }
          .section-title {
            font-size: 13px;
            font-weight: 800;
            color: #1e293b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
            margin-top: 16px;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-bottom: 14px;
          }
          th {
            background: #f1f5f9;
            color: #334155;
            font-weight: 800;
            text-transform: uppercase;
            font-size: 10px;
            padding: 8px 10px;
            text-align: left;
            border-bottom: 1px solid #cbd5e1;
          }
          .signatures {
            margin-top: 30px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            page-break-inside: avoid;
          }
          .signature-box {
            border-top: 1px solid #94a3b8;
            padding-top: 8px;
            text-align: center;
            font-size: 11px;
            color: #475569;
          }
          .signature-title {
            font-weight: bold;
            color: #0f172a;
            margin-bottom: 35px;
          }
          .footer-note {
            margin-top: 25px;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
            border-top: 1px solid #f1f5f9;
            padding-top: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">Personel Mesai Takip Raporu</h1>
            <div class="company-name">${companyName}</div>
          </div>
          <div class="meta-info">
            <div><strong>Rapor Tarihi:</strong> ${reportDate}</div>
            <div class="badge-range">📅 ${rangeLabel}</div>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-title">Toplam Mesai</div>
            <div class="kpi-value" style="color: #0284c7;">${formatMinutesToDuration(totalMinutes)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Personel Sayısı</div>
            <div class="kpi-value">${summaries.length} Kişi</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Çalışılan Gün</div>
            <div class="kpi-value">${totalDays} Gün</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Tamamlanan Kayıt</div>
            <div class="kpi-value" style="color: #16a34a;">${totalCompleted} Giriş</div>
          </div>
        </div>

        <div class="section-title">📊 Personel Bazlı Mesai Özeti</div>
        <table>
          <thead>
            <tr>
              <th>Personel</th>
              <th>Rol</th>
              <th>Şube</th>
              <th style="text-align: center;">Çalışılan Gün</th>
              <th style="text-align: right;">Toplam Mesai</th>
              <th style="text-align: right;">Günlük Ort. Mesai</th>
              <th style="text-align: center;">Tamamlanan</th>
            </tr>
          </thead>
          <tbody>
            ${summaryTableRows}
          </tbody>
        </table>

        <div class="section-title" style="margin-top: 20px;">📋 Günlük Mesai Dökümü (Son ${Math.min(200, sortedRecords.length)} Kayıt)</div>
        <table>
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Personel</th>
              <th>Şube</th>
              <th style="text-align: center;">Giriş Saati</th>
              <th style="text-align: center;">Çıkış Saati</th>
              <th style="text-align: right;">Süre</th>
              <th style="text-align: center;">Durum</th>
              <th>Not / Açıklama</th>
            </tr>
          </thead>
          <tbody>
            ${detailTableRows}
          </tbody>
        </table>

        <div class="signatures">
          <div class="signature-box">
            <div class="signature-title">Raporu Hazırlayan / İK Yetkilisi</div>
            <div>İmza / Tarih: .........................</div>
          </div>
          <div class="signature-box">
            <div class="signature-title">Şirket Yöneticisi Onayı</div>
            <div>İmza / Kaşe: .........................</div>
          </div>
        </div>

        <div class="footer-note">
          Bu mesai takip dökümü Saha Takip Sistemi web uygulaması tarafından elektronik olarak üretilmiştir.
        </div>
      </body>
    </html>
  `;

  const safeCompany = companyName.replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ_-]/g, '_');
  const safeStart = startDate || 'Baslangic';
  const safeEnd = endDate || 'Bitis';
  const fileName = `Mesai_Raporu_${safeCompany}_${safeStart}_${safeEnd}.pdf`;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html2pdf = (window as any).html2pdf || (await import('html2pdf.js')).default;
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    const opt = {
      margin: [10, 10, 10, 10],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    await html2pdf().set(opt).from(container).save();
    document.body.removeChild(container);
  } catch (err) {
    console.warn('html2pdf export failed, using print fallback:', err);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  }
};
