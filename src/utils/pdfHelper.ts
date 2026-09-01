import { readAsStringAsync } from 'expo-file-system/legacy';
import { Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { LocationItem } from '@/hooks/useStorage';

/**
 * Reads local photo files from disk and converts them to base64 data URLs for embedding in the HTML template.
 * @param photos List of local persistent file URIs
 */
const getBase64Photos = async (photos: string[]): Promise<string[]> => {
  const base64List: string[] = [];
  for (const uri of photos) {
    try {
      const base64Data = await readAsStringAsync(uri, { encoding: 'base64' });
      // Strip newlines/carriage returns which often break base64 image parsing on Android WebViews
      const cleanBase64 = base64Data.replace(/[\r\n]/g, '');
      base64List.push(`data:image/jpeg;base64,${cleanBase64}`);
    } catch (error: any) {
      console.warn('Fotoğraf PDF için base64 formatına çevrilemedi:', uri, error);
      Alert.alert(
        'Fotoğraf Okunamadı',
        `PDF raporuna eklenecek fotoğraf yüklenemedi.\n\nDosya: ${uri.split('/').pop()}\nHata: ${error?.message || error}`
      );
    }
  }
  return base64List;
};

/**
 * Generates an HTML report, compiles it into a PDF file, and triggers the native sharing UI.
 * @param location The LocationItem to generate the report for
 */
export const generateAndShareInstallationReport = async (location: LocationItem): Promise<void> => {
  try {
    const photos = location.photos || [];
    const base64Photos = await getBase64Photos(photos);

    // Format tasks rows
    const taskRows = location.tasks
      .map((task) => {
        let badgeClass = 'badge-pending';
        let statusText = 'BEKLEMEDE';
        if (task.status === 'completed') {
          badgeClass = 'badge-completed';
          statusText = 'TAMAMLANDI';
        } else if (task.status === 'not_present') {
          badgeClass = 'badge-not-present';
          statusText = 'MEVCUT DEĞİL';
        }

        return `
          <tr>
            <td class="task-name">${task.name}</td>
            <td style="width: 140px; text-align: center;">
              <span class="badge ${badgeClass}">${statusText}</span>
            </td>
          </tr>
        `;
      })
      .join('');

    // Format photos grid
    const photoItems = base64Photos
      .map((base64Data) => {
        return `
          <div class="photo-item">
            <img src="${base64Data}" />
          </div>
        `;
      })
      .join('');

    const formattedDate = new Date(location.createdAt).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const coordinatesText = location.latitude && location.longitude
      ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
      : 'İşaretlenmemiş';

    // HTML Template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Kurulum Teslim Raporu</title>
          <style>
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              color: #1e293b;
              padding: 30px;
              line-height: 1.5;
              background-color: #ffffff;
            }
            .header {
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 15px;
              margin-bottom: 25px;
            }
            .title {
              font-size: 26px;
              font-weight: bold;
              color: #0f172a;
              margin: 0;
            }
            .subtitle {
              font-size: 11px;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 1.5px;
              margin-top: 5px;
              font-weight: 600;
            }
            .meta-card {
              margin-top: 20px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              padding: 15px;
              border-radius: 8px;
              font-size: 13px;
            }
            .meta-row {
              display: flex;
              margin-bottom: 8px;
            }
            .meta-row:last-child {
              margin-bottom: 0;
            }
            .meta-label {
              font-weight: bold;
              width: 140px;
              color: #475569;
            }
            .meta-val {
              flex: 1;
              color: #0f172a;
            }
            .table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 25px;
            }
            .table th {
              background: #0f172a;
              color: #ffffff;
              text-align: left;
              padding: 12px 10px;
              font-size: 13px;
              font-weight: bold;
            }
            .table td {
              padding: 12px 10px;
              border-bottom: 1px solid #e2e8f0;
              font-size: 12px;
            }
            .task-name {
              color: #1e293b;
              font-weight: 500;
            }
            .badge {
              display: inline-block;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 10px;
              font-weight: bold;
              text-align: center;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .badge-completed {
              background: #e6f4ea;
              color: #10b981;
            }
            .badge-not-present {
              background: #fef3c7;
              color: #d97706;
            }
            .badge-pending {
              background: #f1f5f9;
              color: #64748b;
            }
            .notes-section {
              margin-top: 25px;
              background: #f8fafc;
              border-left: 4px solid #94a3b8;
              padding: 15px;
              border-radius: 4px;
              page-break-inside: avoid;
            }
            .notes-title {
              font-size: 14px;
              font-weight: bold;
              color: #334155;
              margin-bottom: 6px;
            }
            .notes-body {
              font-size: 12px;
              color: #475569;
              white-space: pre-wrap;
            }
            .photos-section {
              margin-top: 30px;
              page-break-inside: avoid;
            }
            .photos-title {
              font-size: 16px;
              font-weight: bold;
              color: #0f172a;
              margin-bottom: 15px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 5px;
            }
            .photos-grid {
              display: flex;
              flex-wrap: wrap;
              gap: 15px;
            }
            .photo-item {
              width: 31%;
              aspect-ratio: 1;
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              overflow: hidden;
              background: #f1f5f9;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .photo-item img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            .footer {
              margin-top: 50px;
              text-align: center;
              font-size: 11px;
              color: #94a3b8;
              border-top: 1px dashed #e2e8f0;
              padding-top: 15px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">Saha Takip Raporu</h1>
            <div class="subtitle">Sistem Teslim ve Görev Tamamlama Tutanağı</div>
          </div>

          <div class="meta-card">
            <div class="meta-row">
              <div class="meta-label">Müşteri / Lokasyon:</div>
              <div class="meta-val" style="font-weight: bold;">${location.name}</div>
            </div>
            <div class="meta-row">
              <div class="meta-label">Tarih:</div>
              <div class="meta-val">${formattedDate}</div>
            </div>
            <div class="meta-row">
              <div class="meta-label">Coğrafi Konum:</div>
              <div class="meta-val">${coordinatesText}</div>
            </div>
            <div class="meta-row">
              <div class="meta-label">Açık Adres:</div>
              <div class="meta-val">${location.address || 'Belirtilmemiş'}</div>
            </div>
          </div>

          <table class="table">
            <thead>
              <tr>
                <th>Tanımlı Kurulum Görevi</th>
                <th style="text-align: center;">Durum</th>
              </tr>
            </thead>
            <tbody>
              ${taskRows}
            </tbody>
          </table>

          ${location.notes ? `
            <div class="notes-section">
              <div class="notes-title">Kurulum Notları ve Açıklamalar</div>
              <div class="notes-body">${location.notes}</div>
            </div>
          ` : ''}

          ${photos.length > 0 ? `
            <div class="photos-section">
              <div class="photos-title">Kurulum Görselleri ve Fotoğrafları</div>
              <div class="photos-grid">
                ${photoItems}
              </div>
            </div>
          ` : ''}

          <div class="footer">
            Bu belge Saha Takip Raporu uygulaması ile otomatik olarak üretilmiştir.
          </div>
        </body>
      </html>
    `;

    // Compile into PDF
    const { uri } = await Print.printToFileAsync({ html: htmlContent });

    // Share PDF file
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${location.name} Kurulum Raporu`,
      UTI: 'com.adobe.pdf',
    });
  } catch (error) {
    console.error('PDF Raporu oluşturulurken hata oluştu:', error);
    throw error;
  }
};
