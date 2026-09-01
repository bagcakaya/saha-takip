import { LocationItem } from '../types/storage';

export const PdfService = {
  /**
   * Generates HTML content string for the installation report
   */
  generateHtmlReport(location: LocationItem): string {
    const photos = location.photos || [];

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

    const photoItems = photos
      .map((photoUri) => {
        return `
          <div class="photo-item">
            <img src="${photoUri}" alt="Kurulum Fotoğrafı" />
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

    const coordinatesText =
      location.latitude && location.longitude
        ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
        : 'İşaretlenmemiş';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${location.name} - Kurulum Teslim Raporu</title>
          <style>
            * {
              box-sizing: border-box;
            }
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              color: #1e293b;
              padding: 24px;
              line-height: 1.5;
              background-color: #ffffff;
              margin: 0;
            }
            .header {
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 12px;
              margin-bottom: 20px;
            }
            .title {
              font-size: 24px;
              font-weight: bold;
              color: #0f172a;
              margin: 0;
            }
            .subtitle {
              font-size: 11px;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 1.5px;
              margin-top: 4px;
              font-weight: 600;
            }
            .meta-card {
              margin-top: 16px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              padding: 14px;
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
              width: 150px;
              color: #475569;
            }
            .meta-val {
              flex: 1;
              color: #0f172a;
            }
            .table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            .table th {
              background: #0f172a;
              color: #ffffff;
              text-align: left;
              padding: 10px 12px;
              font-size: 12px;
              font-weight: bold;
            }
            .table td {
              padding: 10px 12px;
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
              margin-top: 20px;
              background: #f8fafc;
              border-left: 4px solid #94a3b8;
              padding: 14px;
              border-radius: 4px;
              page-break-inside: avoid;
            }
            .notes-title {
              font-size: 13px;
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
              margin-top: 25px;
              page-break-inside: avoid;
            }
            .photos-title {
              font-size: 15px;
              font-weight: bold;
              color: #0f172a;
              margin-bottom: 12px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 5px;
            }
            .photos-grid {
              display: flex;
              flex-wrap: wrap;
              gap: 12px;
            }
            .photo-item {
              width: 30%;
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
              margin-top: 40px;
              text-align: center;
              font-size: 11px;
              color: #94a3b8;
              border-top: 1px dashed #e2e8f0;
              padding-top: 12px;
            }
            @media print {
              body {
                padding: 0;
              }
              .photo-item {
                page-break-inside: avoid;
              }
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

          ${
            location.notes
              ? `
            <div class="notes-section">
              <div class="notes-title">Kurulum Notları ve Açıklamalar</div>
              <div class="notes-body">${location.notes}</div>
            </div>
          `
              : ''
          }

          ${
            photos.length > 0
              ? `
            <div class="photos-section">
              <div class="photos-title">Kurulum Görselleri (${photos.length} Adet)</div>
              <div class="photos-grid">
                ${photoItems}
              </div>
            </div>
          `
              : ''
          }

          <div class="footer">
            Bu belge Saha Takip Raporu web uygulaması ile otomatik olarak üretilmiştir.
          </div>
        </body>
      </html>
    `;
  },

  /**
   * Generates and downloads PDF report, or opens print dialog
   */
  async exportPdf(location: LocationItem): Promise<void> {
    const html = this.generateHtmlReport(location);
    const cleanFileName = `${location.name.replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ_-]/g, '_')}_Kurulum_Raporu.pdf`;

    try {
      // Try using html2pdf.js dynamically if loaded
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html2pdf = (window as any).html2pdf || (await import('html2pdf.js')).default;
      
      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);

      const opt = {
        margin: [10, 10, 10, 10],
        filename: cleanFileName,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };

      await html2pdf().set(opt).from(container).save();
      document.body.removeChild(container);
    } catch (err) {
      console.warn('html2pdf export failed, falling back to print window:', err);
      // Fallback: Open formatted print window
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
  },
};
