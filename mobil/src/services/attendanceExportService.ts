import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { Platform, Alert } from 'react-native';
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
  if (record.status === 'on_leave') return 0;
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
export const exportAttendanceToExcel = async ({
  records,
  summaries,
  startDate,
  endDate,
  companyName = 'POLATLAR',
}: {
  records: AttendanceRecord[];
  summaries: StaffAttendanceSummary[];
  startDate: string;
  endDate: string;
  companyName?: string;
}): Promise<void> => {
  try {
    const wb = XLSX.utils.book_new();

    const rangeLabel =
      startDate && endDate
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
      [],
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
    wsSummary['!cols'] = [
      { wch: 22 },
      { wch: 16 },
      { wch: 18 },
      { wch: 14 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
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

    const sortedRecords = [...records].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.checkInTime || 0) - (a.checkInTime || 0);
    });

    sortedRecords.forEach((r) => {
      const checkInDate = r.checkInTime ? new Date(r.checkInTime) : null;
      const checkOutDate = r.checkOutTime ? new Date(r.checkOutTime) : null;
      const durationMin = calculateRecordDurationMinutes(r);

      let statusText = 'Tamamlandı';
      if (r.status === 'on_leave') statusText = 'İzinli';
      else if (r.status === 'checked_in') statusText = 'Mesaide';
      else if (r.status === 'pending_checkin_approval') statusText = 'Giriş Onayı Bekliyor';
      else if (r.status === 'pending_checkout_approval') statusText = 'Çıkış Onayı Bekliyor';

      const checkInTimeStr =
        r.status === 'on_leave' || !checkInDate
          ? '-'
          : checkInDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const checkOutTimeStr =
        r.status === 'on_leave' || !checkOutDate
          ? '-'
          : checkOutDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const checkInDistanceStr =
        r.status === 'on_leave' || r.checkInDistance === undefined ? '-' : `${Math.round(r.checkInDistance)} m`;
      const checkOutDistanceStr =
        r.status === 'on_leave' || r.checkOutDistance === undefined ? '-' : `${Math.round(r.checkOutDistance)} m`;

      const checkInApprovalStr =
        r.status === 'on_leave'
          ? '-'
          : r.checkInOutside
          ? r.checkInApprovalStatus === 'pending'
            ? 'Dış Giriş (Onay Bekliyor)'
            : 'Dış Giriş (Onaylandı)'
          : 'Normal';

      const checkOutApprovalStr =
        r.status === 'on_leave'
          ? '-'
          : r.checkOutOutside
          ? r.checkOutApprovalStatus === 'pending'
            ? 'Dış Çıkış (Onay Bekliyor)'
            : 'Dış Çıkış (Onaylandı)'
          : r.checkOutTime
          ? 'Normal'
          : '-';

      const notesStr =
        r.status === 'on_leave'
          ? r.approvalNote
            ? `İzinli (${r.approvalNote})`
            : 'İzinli'
          : r.notes || r.approvalNote || '-';

      detailsAoa.push([
        r.date,
        r.userName,
        r.userRole === 'admin' ? 'Yönetici' : 'Saha Yetkilisi',
        r.branchName || 'Merkez',
        statusText,
        checkInTimeStr,
        checkInDistanceStr,
        checkInApprovalStr,
        checkOutTimeStr,
        checkOutDistanceStr,
        checkOutApprovalStr,
        r.status === 'on_leave' ? '-' : formatMinutesToDuration(durationMin),
        r.status === 'on_leave' ? '-' : durationMin,
        notesStr,
      ]);
    });

    const wsDetails = XLSX.utils.aoa_to_sheet(detailsAoa);
    wsDetails['!cols'] = [
      { wch: 12 },
      { wch: 20 },
      { wch: 14 },
      { wch: 16 },
      { wch: 18 },
      { wch: 12 },
      { wch: 14 },
      { wch: 22 },
      { wch: 12 },
      { wch: 14 },
      { wch: 22 },
      { wch: 16 },
      { wch: 14 },
      { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, wsDetails, 'Detaylı Kayıtlar');

    const safeCompany = companyName.replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ_-]/g, '_');
    const safeStart = (startDate || 'Baslangic').replace(/\./g, '-');
    const safeEnd = (endDate || 'Bitis').replace(/\./g, '-');
    const fileName = `Mesai_Raporu_${safeCompany}_${safeStart}_${safeEnd}.xlsx`;

    if (Platform.OS === 'web') {
      XLSX.writeFile(wb, fileName);
    } else {
      const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Mesai Raporunu İndir / Paylaş',
          UTI: 'com.microsoft.excel.xlsx',
        });
      } else {
        Alert.alert('Başarılı', `${fileName} oluşturuldu.`);
      }
    }
  } catch (error: any) {
    console.error('exportAttendanceToExcel error:', error);
    Alert.alert('Hata', 'Excel raporu oluşturulurken bir hata meydana geldi: ' + error?.message);
  }
};

/**
 * Export attendance records and staff summaries to PDF
 */
export const exportAttendanceToPdf = async ({
  records,
  summaries,
  startDate,
  endDate,
  companyName = 'POLATLAR',
}: {
  records: AttendanceRecord[];
  summaries: StaffAttendanceSummary[];
  startDate: string;
  endDate: string;
  companyName?: string;
}): Promise<void> => {
  try {
    const rangeLabel =
      startDate && endDate
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

    const totalMinutes = summaries.reduce((acc, s) => acc + s.totalMinutes, 0);
    const totalDays = summaries.reduce((acc, s) => acc + s.totalDays, 0);
    const totalCompleted = summaries.reduce((acc, s) => acc + s.completedSessions, 0);

    const summaryTableRows = summaries
      .map(
        (s) => `
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
      `
      )
      .join('');

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

        let statusBadge = `<span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: #f1f5f9; color: #475569;">Tamamlandı</span>`;
        if (r.status === 'on_leave') {
          statusBadge = `<span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0;">İzinli</span>`;
        } else if (r.status === 'checked_in') {
          statusBadge = `<span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: #dcfce7; color: #15803d;">Mesaide</span>`;
        } else if (r.status === 'pending_checkin_approval') {
          statusBadge = `<span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: #fef3c7; color: #b45309;">Giriş Onayı</span>`;
        } else if (r.status === 'pending_checkout_approval') {
          statusBadge = `<span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: #fef3c7; color: #b45309;">Çıkış Onayı</span>`;
        }

        const checkInStr =
          r.status === 'on_leave' || !checkInDate
            ? '-'
            : checkInDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const checkOutStr =
          r.status === 'on_leave' || !checkOutDate
            ? '-'
            : checkOutDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const durationStr = r.status === 'on_leave' ? '-' : formatMinutesToDuration(durationMin);

        return `
          <tr>
            <td style="padding: 6px 8px; font-size: 11px; border-bottom: 1px solid #e2e8f0; color: #334155;">
              ${r.date}
            </td>
            <td style="padding: 6px 8px; font-size: 11px; font-weight: bold; border-bottom: 1px solid #e2e8f0; color: #0f172a;">
              ${r.userName}
            </td>
            <td style="padding: 6px 8px; font-size: 11px; border-bottom: 1px solid #e2e8f0; color: #475569;">
              ${r.branchName || 'Merkez'}
            </td>
            <td style="padding: 6px 8px; font-size: 11px; text-align: center; border-bottom: 1px solid #e2e8f0; font-family: monospace;">
              ${checkInStr}
            </td>
            <td style="padding: 6px 8px; font-size: 11px; text-align: center; border-bottom: 1px solid #e2e8f0; font-family: monospace;">
              ${checkOutStr}
            </td>
            <td style="padding: 6px 8px; font-size: 11px; text-align: right; font-weight: bold; border-bottom: 1px solid #e2e8f0; color: #0284c7;">
              ${durationStr}
            </td>
            <td style="padding: 6px 8px; font-size: 11px; text-align: center; border-bottom: 1px solid #e2e8f0;">
              ${statusBadge}
            </td>
            <td style="padding: 6px 8px; font-size: 10px; color: #64748b; border-bottom: 1px solid #e2e8f0; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
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
          <meta charset="utf-8" />
          <title>${companyName} - Personel Mesai Raporu</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              background: #ffffff;
              padding: 20px;
              font-size: 12px;
            }
            .header-table { width: 100%; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px; }
            .company-name { font-size: 20px; font-weight: 900; color: #0284c7; letter-spacing: -0.5px; }
            .report-title { font-size: 14px; font-weight: bold; color: #334155; margin-top: 4px; }
            .report-meta { text-align: right; font-size: 11px; color: #64748b; }
            .kpi-row { display: flex; gap: 12px; margin-bottom: 16px; }
            .kpi-box { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; background: #f8fafc; }
            .kpi-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
            .kpi-value { font-size: 16px; font-weight: 900; color: #0284c7; margin-top: 2px; }
            .section-title { font-size: 12px; font-weight: 800; color: #1e293b; margin: 14px 0 6px 0; border-left: 3px solid #0284c7; padding-left: 8px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
            th { background: #f1f5f9; color: #334155; font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 8px 10px; border-bottom: 1px solid #cbd5e1; text-align: left; }
            .signatures { display: flex; justify-content: space-between; margin-top: 28px; padding-top: 14px; }
            .signature-box { width: 45%; border-top: 1px dashed #94a3b8; padding-top: 8px; font-size: 11px; color: #475569; }
            .signature-title { font-weight: bold; color: #1e293b; margin-bottom: 4px; }
            .footer-note { margin-top: 20px; text-align: center; font-size: 10px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td>
                <div class="company-name">${companyName.toUpperCase()}</div>
                <div class="report-title">Personel Mesai ve Devam Çizelgesi</div>
              </td>
              <td class="report-meta">
                <div><strong>Dönem:</strong> ${rangeLabel}</div>
                <div><strong>Tarih:</strong> ${reportDate}</div>
              </td>
            </tr>
          </table>

          <div class="kpi-row">
            <div class="kpi-box">
              <div class="kpi-label">Toplam Mesai Süresi</div>
              <div class="kpi-value">${formatMinutesToDuration(totalMinutes)}</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">Toplam Çalışılan Gün</div>
              <div class="kpi-value">${totalDays} Gün</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">Tamamlanan Oturum</div>
              <div class="kpi-value">${totalCompleted} Adet</div>
            </div>
          </div>

          <div class="section-title">📊 Personel Mesai Özeti</div>
          <table>
            <thead>
              <tr>
                <th>Personel Adı</th>
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

          <div class="section-title" style="margin-top: 18px;">📋 Günlük Mesai Dökümü (Son ${Math.min(200, sortedRecords.length)} Kayıt)</div>
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
            Bu mesai takip dökümü İş Takip Sistemi tarafından elektronik ortamda üretilmiştir.
          </div>
        </body>
      </html>
    `;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
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
    } else {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
          dialogTitle: 'Mesai Raporunu Yazdır / İndir',
        });
      } else {
        await Print.printAsync({ uri });
      }
    }
  } catch (error: any) {
    console.error('exportAttendanceToPdf error:', error);
    Alert.alert('Hata', 'PDF raporu oluşturulurken bir hata meydana geldi: ' + error?.message);
  }
};
