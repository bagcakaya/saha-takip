import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  Building2,
  Package,
  Camera,
  Image as ImageIcon,
  Download,
  Eye,
  Printer,
  Trash2,
  Edit2,
  Check,
  X,
  ChevronDown,
  Copy,
  Save,
  CheckSquare,
  Square,
  Calendar,
  FileCheck2,
  ListChecks,
  Loader2,
  SwitchCamera,
  Share2,
  Settings,
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';
import {
  QuotationRecord,
  QuotationLineItem,
  QuotationProduct,
  QuotationFooterTemplate,
  QuotationFooterTermItem,
  QuotationCurrency,
  QuotationStatus,
} from '../../types/storage';
import {
  DEFAULT_QUOTATION_FOOTER_TEMPLATES,
  POLATLAR_CORPORATE_LOGO_SVG_DATA_URI,
  POLATLAR_NAVY_LOGO_DATA_URI,
} from '../../constants/defaultAccounting';

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

const CURRENCY_SYMBOLS: Record<QuotationCurrency, string> = {
  TRY: '₺',
  USD: '$',
  EUR: '€',
};

const UNIT_OPTIONS = ['Adet', 'Set', 'Paket', 'Metre', 'Lisans', 'Hizmet', 'Kutu', 'Kg', 'Saat'];
const VAT_OPTIONS = [20, 10, 1, 0];

const STATUS_LABELS: Record<
  QuotationStatus,
  { label: string; badgeClass: string; dotColor: string }
> = {
  draft: {
    label: 'Taslak',
    badgeClass:
      'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    dotColor: 'bg-slate-400',
  },
  sent: {
    label: 'Müşteriye İletildi',
    badgeClass:
      'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    dotColor: 'bg-sky-500',
  },
  approved: {
    label: 'Onaylandı',
    badgeClass:
      'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    dotColor: 'bg-emerald-500',
  },
  rejected: {
    label: 'Reddedildi',
    badgeClass:
      'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    dotColor: 'bg-rose-500',
  },
  expired: {
    label: 'Süresi Doldu',
    badgeClass:
      'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    dotColor: 'bg-amber-500',
  },
};

const formatMoney = (amount: number, currency: QuotationCurrency = 'TRY') => {
  const sym = CURRENCY_SYMBOLS[currency] || '₺';
  const formatted = (Number(amount) || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === 'TRY' ? `${formatted} ${sym}` : `${sym}${formatted}`;
};

const escapeHtml = (str?: string) => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const compressProductImage = (file: File, maxDim = 420): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        // Atılan görsel formatı ne olursa olsun (JPG, PNG, BMP, HEIC vb.) otomatik WEBP formatına çevrilir
        const webpDataUrl = canvas.toDataURL('image/webp', 0.8);
        resolve(webpDataUrl);
      };
      img.onerror = () => reject(new Error('Görsel yüklenemedi.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.readAsDataURL(file);
  });
};

// Pure inline-styled A4 HTML generator for crisp PDF output and live preview
export const generateQuotationPdfHtml = (
  quote: QuotationRecord,
  logoUrl: string,
  companyFullTitle: string,
  companyAddress?: string,
  companyPhone?: string,
  forceHidePrices?: boolean
): string => {
  const isPriceless = Boolean(forceHidePrices ?? quote.hidePrices);
  const fmt = (val: number) => formatMoney(val, quote.currency || 'TRY');

  const formattedDate = quote.date
    ? new Date(quote.date).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('tr-TR');

  const formattedValidUntil = quote.validUntil
    ? new Date(quote.validUntil).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';

  const hasAnyDiscount = !isPriceless && (quote.items || []).some((it) => (it.discountPercent || 0) > 0);
  const hasAnyImage = (quote.items || []).some((it) => Boolean(it.imageUrl));

  const itemRowsHtml = (quote.items || [])
    .map((item, idx) => {
      const imgCell = item.imageUrl
        ? `<img src="${item.imageUrl}" alt="${escapeHtml(item.name)}" style="width: 52px; height: 52px; object-fit: contain; border-radius: 8px; border: 1px solid #e2e8f0; background: #ffffff; padding: 2px; display: block; margin: 0 auto;" />`
        : `<div style="width: 52px; height: 52px; border-radius: 8px; border: 1px dashed #cbd5e1; background: #f8fafc; color: #94a3b8; font-size: 8.5px; font-weight: 400; letter-spacing: 0.3px; display: flex; align-items: center; justify-content: center; text-align: center; margin: 0 auto;">GÖRSEL<br/>YOK</div>`;

      if (isPriceless) {
        return `
          <tr style="border-bottom: 1px solid #e2e8f0; page-break-inside: avoid; background-color: ${
            idx % 2 === 1 ? '#f8fafc' : '#ffffff'
          };">
            <td style="padding: 10px 8px; text-align: center; font-weight: 300; color: #64748b; font-size: 11px; width: 36px;">
              ${idx + 1}
            </td>
            ${
              hasAnyImage
                ? `<td style="padding: 8px 6px; text-align: center; width: 68px;">${imgCell}</td>`
                : ''
            }
            <td style="padding: 10px 12px;">
              <div style="font-size: 12px; font-weight: 500; color: #0f172a; line-height: 1.4; letter-spacing: 0.15px;">
                ${escapeHtml(item.name)}
              </div>
              ${
                item.code
                  ? `<div style="font-size: 9.5px; font-weight: 400; color: #0284c7; margin-top: 2px; letter-spacing: 0.25px;">Stok/Ürün Kodu: ${escapeHtml(item.code)}</div>`
                  : ''
              }
              ${
                item.description
                  ? `<div style="font-size: 10px; font-weight: 300; color: #64748b; margin-top: 3px; white-space: pre-wrap; line-height: 1.4; letter-spacing: 0.1px;">${escapeHtml(item.description)}</div>`
                  : ''
              }
            </td>
            <td style="padding: 10px 10px; text-align: center; font-size: 11.5px; font-weight: 400; color: #1e293b; white-space: nowrap; width: 100px; letter-spacing: 0.2px;">
              ${item.quantity} ${escapeHtml(item.unit || 'Adet')}
            </td>
          </tr>
        `;
      }

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; page-break-inside: avoid; background-color: ${
          idx % 2 === 1 ? '#f8fafc' : '#ffffff'
        };">
          <td style="padding: 9px 6px; text-align: center; font-weight: 300; color: #64748b; font-size: 11px;">
            ${idx + 1}
          </td>
          <td style="padding: 8px 6px; text-align: center; width: 64px;">
            ${imgCell}
          </td>
          <td style="padding: 9px 10px;">
            <div style="font-size: 11.5px; font-weight: 500; color: #0f172a; line-height: 1.35; letter-spacing: 0.15px;">
              ${escapeHtml(item.name)}
            </div>
            ${
              item.code
                ? `<div style="font-size: 9.5px; font-weight: 400; color: #0284c7; margin-top: 2px; letter-spacing: 0.25px;">Stok/Ürün Kodu: ${escapeHtml(item.code)}</div>`
                : ''
            }
            ${
              item.description
                ? `<div style="font-size: 10px; font-weight: 300; color: #64748b; margin-top: 3px; white-space: pre-wrap; line-height: 1.4; letter-spacing: 0.1px;">${escapeHtml(item.description)}</div>`
                : ''
            }
          </td>
          <td style="padding: 9px 8px; text-align: center; font-size: 11px; font-weight: 400; color: #1e293b; white-space: nowrap;">
            ${item.quantity} ${escapeHtml(item.unit || 'Adet')}
          </td>
          <td style="padding: 9px 8px; text-align: right; font-size: 11px; font-weight: 400; color: #334155; white-space: nowrap;">
            ${fmt(item.unitPrice)}
          </td>
          ${
            hasAnyDiscount
              ? `<td style="padding: 9px 6px; text-align: center; font-size: 10.5px; font-weight: 400; color: #e11d48; white-space: nowrap;">
                  ${item.discountPercent ? `%${item.discountPercent}` : '-'}
                </td>`
              : ''
          }
          ${
            quote.includeVat
              ? `<td style="padding: 9px 6px; text-align: center; font-size: 10px; font-weight: 300; color: #64748b; white-space: nowrap;">
                  %${item.vatRate ?? 20}
                </td>`
              : ''
          }
          <td style="padding: 9px 10px; text-align: right; font-size: 11.5px; font-weight: 500; color: #0f172a; white-space: nowrap;">
            ${fmt(item.lineTotal)}
          </td>
        </tr>
      `;
    })
    .join('');

  const footerTermsHtml =
    quote.footerTerms && quote.footerTerms.length > 0
      ? `
      <div style="margin-top: 20px; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; page-break-inside: avoid;">
        <div style="background: linear-gradient(90deg, #0f172a 0%, #1e3a8a 100%); color: #ffffff; padding: 7px 14px; font-size: 10px; font-weight: 400; letter-spacing: 1.1px; text-transform: uppercase;">
          TEKLİF KOŞULLARI VE BELGE ALTI BİLGİLENDİRME NOTLARI
        </div>
        <div style="padding: 10px 14px; background-color: #f8fafc;">
          <table style="width: 100%; border-collapse: collapse;">
            ${quote.footerTerms
              .map(
                (term) => `
              <tr>
                <td style="padding: 5px 8px 5px 0; vertical-align: top; width: 170px; font-size: 10.5px; font-weight: 500; color: #1e293b; white-space: nowrap; letter-spacing: 0.15px;">
                  ▪ ${escapeHtml(term.title)}:
                </td>
                <td style="padding: 5px 0; vertical-align: top; font-size: 10.5px; font-weight: 300; color: #475569; line-height: 1.45; letter-spacing: 0.1px;">
                  ${escapeHtml(term.content)}
                </td>
              </tr>
            `
              )
              .join('')}
          </table>
          ${
            quote.customFooterNote
              ? `
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #cbd5e1; font-size: 10.5px; font-weight: 300; color: #334155; white-space: pre-wrap; line-height: 1.45;">
              <span style="font-weight: 500; color: #0f172a;">Ek Not:</span> ${escapeHtml(quote.customFooterNote)}
            </div>
          `
              : ''
          }
        </div>
      </div>
    `
      : quote.customFooterNote
      ? `
      <div style="margin-top: 20px; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 14px; background-color: #f8fafc; page-break-inside: avoid; font-size: 10.5px; font-weight: 300; color: #334155; white-space: pre-wrap; line-height: 1.45;">
        <span style="display: block; margin-bottom: 4px; font-weight: 500; color: #0f172a; text-transform: uppercase; letter-spacing: 0.8px;">TEKLİF KOŞULLARI &amp; NOTLAR:</span>
        ${escapeHtml(quote.customFooterNote)}
      </div>
    `
      : '';

  const pdfLogoSrc =
    logoUrl && logoUrl !== POLATLAR_CORPORATE_LOGO_SVG_DATA_URI
      ? logoUrl
      : POLATLAR_NAVY_LOGO_DATA_URI;

  return `
    <div style="font-family: 'Montserrat', 'Inter', 'Plus Jakarta Sans', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-weight: 300; letter-spacing: 0.15px; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; color: #1e293b; background: #ffffff; width: 750px; margin: 0 auto; padding: 28px 32px; box-sizing: border-box;">
      <!-- 1. EN ÜSTTE POLATLAR YAZILIM KURUMSAL LOGO VE FİRMA BİLGİLERİ -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 22px;">
        <div style="padding-top: 4px;">
          <div style="border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; padding: 8px 4px; display: inline-block;">
            <img
              src="${pdfLogoSrc}"
              alt="POLATLAR YAZILIM Logo"
              style="height: 64px; width: auto; max-width: 240px; object-fit: contain; display: block;"
            />
          </div>
          <div style="font-size: 12px; font-weight: 500; color: #003870; letter-spacing: 1.6px; margin-top: 6px; text-transform: uppercase;">
            ${escapeHtml(companyFullTitle || 'POLATLAR YAZILIM')}
          </div>
        </div>

        <div style="text-align: left; font-size: 10.5px; font-weight: 300; color: #475569; line-height: 1.5; min-width: 225px; letter-spacing: 0.2px;">
          <div style="font-weight: 400; color: #334155; letter-spacing: 0.3px;">POLATLAR YAZILIM &amp; BİLGİSAYAR</div>
          <div style="font-weight: 400; color: #334155; letter-spacing: 0.3px;">MÜHENDİSLİĞİ LTD.ŞTİ.</div>
          <div>Gsm : ${escapeHtml(companyPhone || '0 533 608 23 53')}</div>
          <div>Web : www.polatlaryazilim.com</div>
          <div>e-Mail : bilgi@polatlaryazilim.com</div>
          <div>Vergi Dairesi : K.K.V.D.</div>
          <div>VKN : 732 166 3218</div>
          ${
            companyAddress
              ? `<div style="margin-top: 2px;">Adres : ${escapeHtml(companyAddress)}</div>`
              : ''
          }
        </div>
      </div>

      <!-- 2. TEKLİF ÇİZGİSİ VE KIRMIZI ALANDAKİ GİBİ CARİ İSMİ & TARİH/BELGE NO BLOĞU -->
      <div style="text-align: right; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 12px;">
        <span style="font-size: 17px; font-weight: 300; color: #64748b; letter-spacing: 1.8px;">Teklif</span>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <!-- Sol Taraf: Kırmızı Alan İçerisine Alınan Cari İsmi Formatı -->
          <td style="width: 58%; vertical-align: top; padding-right: 16px;">
            <div style="font-size: 12.5px; font-weight: 500; color: #0f172a; line-height: 1.4; text-transform: uppercase; letter-spacing: 0.4px;">
              ${escapeHtml(quote.cariName)}
            </div>
            ${
              quote.cariContactPerson
                ? `<div style="font-size: 10.5px; font-weight: 300; color: #475569; margin-top: 6px; letter-spacing: 0.15px;"><span style="font-weight: 500; color: #334155;">Yetkili :</span> ${escapeHtml(quote.cariContactPerson)}</div>`
                : ''
            }
            ${
              quote.cariPhone
                ? `<div style="font-size: 10.5px; font-weight: 300; color: #475569; margin-top: 2px; letter-spacing: 0.15px;"><span style="font-weight: 500; color: #334155;">Tel :</span> ${escapeHtml(quote.cariPhone)}</div>`
                : ''
            }
            ${
              quote.cariAddress
                ? `<div style="font-size: 10.5px; font-weight: 300; color: #475569; margin-top: 2px; letter-spacing: 0.15px;">${escapeHtml(quote.cariAddress)}</div>`
                : ''
            }
            ${
              quote.cariTaxInfo
                ? `<div style="font-size: 10.5px; font-weight: 300; color: #334155; margin-top: 12px; letter-spacing: 0.15px;"><span style="font-weight: 500; color: #0f172a;">V.Dairesi / V.No :</span> ${escapeHtml(quote.cariTaxInfo)}</div>`
                : ''
            }
          </td>

          <!-- Sağ Taraf: Tarih / Belge No / Termin Tarihi -->
          <td style="width: 42%; vertical-align: top;">
            <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; color: #1e293b;">
              <tr>
                <td style="padding: 3px 8px 3px 0; font-weight: 500; color: #475569; text-align: right; width: 125px; white-space: nowrap; letter-spacing: 0.4px;">TARİH :</td>
                <td style="padding: 3px 0; font-weight: 400; color: #0f172a;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 3px 8px 3px 0; font-weight: 500; color: #475569; text-align: right; white-space: nowrap; letter-spacing: 0.4px;">BELGE NO :</td>
                <td style="padding: 3px 0; font-weight: 400; color: #0f172a;">${escapeHtml(quote.quoteNumber)}</td>
              </tr>
              ${
                formattedValidUntil
                  ? `
              <tr>
                <td style="padding: 3px 8px 3px 0; font-weight: 500; color: #475569; text-align: right; white-space: nowrap; letter-spacing: 0.4px;">TERMİN / GEÇERLİLİK :</td>
                <td style="padding: 3px 0; font-weight: 400; color: #0f172a;">${formattedValidUntil}</td>
              </tr>
              `
                  : ''
              }
              ${
                quote.title
                  ? `
              <tr>
                <td style="padding: 3px 8px 3px 0; font-weight: 500; color: #475569; text-align: right; white-space: nowrap; letter-spacing: 0.4px;">KONU :</td>
                <td style="padding: 3px 0; font-weight: 400; color: #0f172a;">${escapeHtml(quote.title)}</td>
              </tr>
              `
                  : ''
              }
              ${
                quote.preparedBy
                  ? `
              <tr>
                <td style="padding: 3px 8px 3px 0; font-weight: 500; color: #475569; text-align: right; white-space: nowrap; letter-spacing: 0.4px;">HAZIRLAYAN :</td>
                <td style="padding: 3px 0; font-weight: 300; color: #334155;">${escapeHtml(quote.preparedBy)}</td>
              </tr>
              `
                  : ''
              }
            </table>
          </td>
        </tr>
      </table>

      <!-- 3. TEKLİF AÇIKLAMASI / ÖN YAZI -->
      ${
        quote.description
          ? `
        <div style="margin-bottom: 16px; background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 11px 14px; font-size: 11px; font-weight: 300; color: #0c4a6e; line-height: 1.5; white-space: pre-wrap; letter-spacing: 0.15px;">
          <span style="display: block; font-size: 9.5px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.9px; color: #0284c7; margin-bottom: 3px;">TEKLİF AÇIKLAMASI:</span>${escapeHtml(quote.description)}
        </div>
      `
          : ''
      }

      <!-- 4. ÜRÜN VE HİZMET KALEMLERİ TABLOSU -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden;">
        <thead>
          ${
            isPriceless
              ? `
          <tr style="background: linear-gradient(90deg, #0f172a 0%, #1e293b 100%); color: #ffffff; font-size: 10px; font-weight: 400; text-transform: uppercase; letter-spacing: 1px;">
            <th style="padding: 9px 8px; text-align: center; width: 36px; font-weight: 400;">#</th>
            ${
              hasAnyImage
                ? `<th style="padding: 9px 6px; text-align: center; width: 68px; font-weight: 400;">Görsel</th>`
                : ''
            }
            <th style="padding: 9px 12px; text-align: left; font-weight: 400;">Ürün / Hizmet Listesi</th>
            <th style="padding: 9px 10px; text-align: center; width: 100px; font-weight: 400;">Miktar</th>
          </tr>
          `
              : `
          <tr style="background: linear-gradient(90deg, #0f172a 0%, #1e293b 100%); color: #ffffff; font-size: 10px; font-weight: 400; text-transform: uppercase; letter-spacing: 1px;">
            <th style="padding: 9px 6px; text-align: center; width: 28px; font-weight: 400;">#</th>
            <th style="padding: 9px 6px; text-align: center; width: 64px; font-weight: 400;">Görsel</th>
            <th style="padding: 9px 10px; text-align: left; font-weight: 400;">Ürün / Hizmet Açıklaması</th>
            <th style="padding: 9px 8px; text-align: center; width: 75px; font-weight: 400;">Miktar</th>
            <th style="padding: 9px 8px; text-align: right; width: 95px; font-weight: 400;">Birim Fiyat</th>
            ${
              hasAnyDiscount
                ? `<th style="padding: 9px 6px; text-align: center; width: 55px; font-weight: 400;">İsk.</th>`
                : ''
            }
            ${
              quote.includeVat
                ? `<th style="padding: 9px 6px; text-align: center; width: 50px; font-weight: 400;">KDV</th>`
                : ''
            }
            <th style="padding: 9px 10px; text-align: right; width: 105px; font-weight: 400;">Toplam</th>
          </tr>
          `
          }
        </thead>
        <tbody>
          ${itemRowsHtml}
        </tbody>
      </table>

      <!-- 5. FİNANSAL ÖZET TABLOSU (SADECE FİYATLI TASARIMDA GÖSTERİLİR) -->
      ${
        isPriceless
          ? ''
          : `
      <div style="display: flex; justify-content: flex-end; margin-top: 14px; page-break-inside: avoid;">
        <table style="width: 290px; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; background-color: #f8fafc;">
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 7px 12px; font-size: 10.5px; font-weight: 300; color: #475569; letter-spacing: 0.2px;">Ara Toplam:</td>
            <td style="padding: 7px 12px; font-size: 11px; font-weight: 400; color: #0f172a; text-align: right;">
              ${fmt(quote.subtotal)}
            </td>
          </tr>
          ${
            quote.discountTotal > 0
              ? `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 7px 12px; font-size: 10.5px; font-weight: 300; color: #e11d48; letter-spacing: 0.2px;">Toplam İskonto:</td>
              <td style="padding: 7px 12px; font-size: 11px; font-weight: 400; color: #e11d48; text-align: right;">
                -${fmt(quote.discountTotal)}
              </td>
            </tr>
          `
              : ''
          }
          ${
            quote.includeVat
              ? `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 7px 12px; font-size: 10.5px; font-weight: 300; color: #475569; letter-spacing: 0.2px;">Hesaplanan KDV:</td>
              <td style="padding: 7px 12px; font-size: 11px; font-weight: 400; color: #334155; text-align: right;">
                ${fmt(quote.vatTotal)}
              </td>
            </tr>
          `
              : ''
          }
          <tr style="background: linear-gradient(90deg, #0f172a 0%, #0284c7 100%); color: #ffffff;">
            <td style="padding: 10px 12px; font-size: 11px; font-weight: 400; text-transform: uppercase; letter-spacing: 0.8px;">
              GENEL TOPLAM ${quote.includeVat ? '(KDV DAHİL)' : ''}:
            </td>
            <td style="padding: 10px 12px; font-size: 13px; font-weight: 500; text-align: right; white-space: nowrap; letter-spacing: 0.4px;">
              ${fmt(quote.grandTotal)}
            </td>
          </tr>
        </table>
      </div>
      `
      }

      <!-- 6. BELGE ALTI YAZILAR (ÖDEME, TESLİMAT, TERMİN VB.) -->
      ${footerTermsHtml}
    </div>
  `;
};

const createEmptyLineItem = (): QuotationLineItem => ({
  id: Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
  name: '',
  code: '',
  description: '',
  quantity: 1,
  unit: 'Adet',
  unitPrice: 0,
  discountPercent: 0,
  vatRate: 20,
  lineTotal: 0,
  imageUrl: undefined,
});

export const QuotationsSection: React.FC = () => {
  const { user, updateCompanyLogo } = useAuth();
  const {
    accountingData,
    cariItems,
    cariler,
    addCariItem,
    addQuotation,
    updateQuotation,
    deleteQuotation,
    addQuotationProduct,
    updateQuotationProduct,
    deleteQuotationProduct,
    addQuotationFooterTemplate,
    updateQuotationFooterTemplate,
    deleteQuotationFooterTemplate,
    updateQuotationSettings,
  } = useStorage();

  const quotations = useMemo(() => accountingData.quotations || [], [accountingData.quotations]);
  const products = useMemo(
    () => accountingData.quotationProducts || [],
    [accountingData.quotationProducts]
  );
  const footerTemplates = useMemo(
    () =>
      accountingData.quotationFooterTemplates && accountingData.quotationFooterTemplates.length > 0
        ? accountingData.quotationFooterTemplates
        : DEFAULT_QUOTATION_FOOTER_TEMPLATES,
    [accountingData.quotationFooterTemplates]
  );
  const quotationSettings = accountingData.quotationSettings || {};

  // Active POLATLAR YAZILIM Logo (Görsel-2 Official Logo by default, or Custom Quotation Logo)
  const activePolatlarLogo =
    quotationSettings.customLogoUrl || POLATLAR_CORPORATE_LOGO_SVG_DATA_URI;
  const rawCompanyTitle = quotationSettings.companyFullTitle || 'POLATLAR YAZILIM';
  const activeCompanyFullTitle =
    rawCompanyTitle.trim().toLocaleUpperCase('tr-TR') === 'POLATLAR'
      ? 'POLATLAR YAZILIM'
      : rawCompanyTitle;

  // Sub-navigation: 'quotations' | 'products' | 'footers'
  const [subTab, setSubTab] = useState<'quotations' | 'products' | 'footers'>('quotations');

  // Quotations list filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | QuotationStatus>('all');
  const [expandedQuoteIds, setExpandedQuoteIds] = useState<Record<string, boolean>>({});
  const [isDownloadingPdfId, setIsDownloadingPdfId] = useState<string | null>(null);

  // Preview Modal state & responsive A4 auto-fit scale
  const [previewQuote, setPreviewQuote] = useState<QuotationRecord | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const previewSheetRef = useRef<HTMLDivElement | null>(null);
  const [previewScale, setPreviewScale] = useState<number>(1);
  const [previewScaledHeight, setPreviewScaledHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!previewQuote) return;
    const A4_WIDTH = 750;

    const recalcScale = () => {
      const container = previewContainerRef.current;
      const sheet = previewSheetRef.current;
      if (!container) return;
      const availableWidth = Math.max(240, container.clientWidth - 16);
      const nextScale = availableWidth < A4_WIDTH ? availableWidth / A4_WIDTH : 1;
      setPreviewScale(nextScale);
      if (sheet) {
        setPreviewScaledHeight(Math.ceil(sheet.scrollHeight * nextScale));
      }
    };

    const timer1 = setTimeout(recalcScale, 30);
    const timer2 = setTimeout(recalcScale, 200);
    window.addEventListener('resize', recalcScale);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('resize', recalcScale);
    };
  }, [previewQuote]);

  // =========================================================
  // QUOTATION EDITOR MODAL STATE
  // =========================================================
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<QuotationRecord | null>(null);
  const [quoteNumber, setQuoteNumber] = useState('');
  const [quoteTitle, setQuoteTitle] = useState('');
  const [cariName, setCariName] = useState('');
  const [cariContactPerson, setCariContactPerson] = useState('');
  const [cariPhone, setCariPhone] = useState('');
  const [cariAddress, setCariAddress] = useState('');
  const [cariTaxInfo, setCariTaxInfo] = useState('');
  const [isCariPickerOpen, setIsCariPickerOpen] = useState(false);
  const [cariPickerSearch, setCariPickerSearch] = useState('');
  const [cariSavedToast, setCariSavedToast] = useState(false);

  const [quoteDate, setQuoteDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [currency, setCurrency] = useState<QuotationCurrency>('TRY');
  const [includeVat, setIncludeVat] = useState<boolean>(true);
  const [hidePrices, setHidePrices] = useState<boolean>(false);
  const [description, setDescription] = useState('');
  const [lineItems, setLineItems] = useState<QuotationLineItem[]>([createEmptyLineItem()]);
  const [selectedFooterTerms, setSelectedFooterTerms] = useState<QuotationFooterTermItem[]>([]);
  const [customFooterNote, setCustomFooterNote] = useState('');
  const [quoteStatus, setQuoteStatus] = useState<QuotationStatus>('draft');
  const [preparedBy, setPreparedBy] = useState('');
  const [preparedByPhone, setPreparedByPhone] = useState('');

  // Quick Add Footer Template inside Quotation Editor
  const [isQuickFooterOpen, setIsQuickFooterOpen] = useState(false);
  const [quickFooterTitle, setQuickFooterTitle] = useState('');
  const [quickFooterContent, setQuickFooterContent] = useState('');

  // Product Catalog Picker Modal inside Quotation Editor
  const [isCatalogPickerOpen, setIsCatalogPickerOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogQuantities, setCatalogQuantities] = useState<Record<string, number>>({});
  const [addedCatalogToastId, setAddedCatalogToastId] = useState<string | null>(null);

  const getCatalogQty = (prodId: string) => Math.max(1, Number(catalogQuantities[prodId]) || 1);
  const setCatalogQty = (prodId: string, val: number) => {
    setCatalogQuantities((prev) => ({
      ...prev,
      [prodId]: Math.max(1, val),
    }));
  };

  // =========================================================
  // PRODUCT CATALOG MODAL STATE (KAYITLI ÜRÜNLER)
  // =========================================================
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<QuotationProduct | null>(null);
  const [prodCode, setProdCode] = useState('');
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodCurrency, setProdCurrency] = useState<QuotationCurrency>('TRY');
  const [prodUnit, setProdUnit] = useState('Adet');
  const [prodVat, setProdVat] = useState<number>(20);
  const [prodImage, setProdImage] = useState<string | undefined>(undefined);
  const [productSearchQuery, setProductSearchQuery] = useState('');

  // =========================================================
  // FOOTER TEMPLATE MODAL STATE (BELGE ALTI ŞABLONLARI)
  // =========================================================
  const [isFooterModalOpen, setIsFooterModalOpen] = useState(false);
  const [editingFooter, setEditingFooter] = useState<QuotationFooterTemplate | null>(null);
  const [footerTitle, setFooterTitle] = useState('');
  const [footerContent, setFooterContent] = useState('');
  const [footerDefaultSelected, setFooterDefaultSelected] = useState(true);

  // Company Header Settings in Footers/Settings tab
  const [settingsCompanyTitle, setSettingsCompanyTitle] = useState(
    quotationSettings.companyFullTitle &&
      quotationSettings.companyFullTitle.trim().toLocaleUpperCase('tr-TR') !== 'POLATLAR'
      ? quotationSettings.companyFullTitle
      : 'POLATLAR YAZILIM'
  );
  const [settingsCompanyAddress, setSettingsCompanyAddress] = useState(
    quotationSettings.companyAddress || ''
  );
  const [settingsCompanyPhone, setSettingsCompanyPhone] = useState(
    quotationSettings.companyPhone || ''
  );
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);

  // =========================================================
  // CAMERA & GALLERY PERMISSION / CAPTURE STATE
  // =========================================================
  const [cameraTarget, setCameraTarget] = useState<
    | { mode: 'lineItem'; lineId: string }
    | { mode: 'productModal' }
    | { mode: 'companyLogo' }
    | null
  >(null);
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const fallbackCameraInputRef = useRef<HTMLInputElement | null>(null);
  const [savedLineToastId, setSavedLineToastId] = useState<string | null>(null);

  // Unified Cari list from Cariler module
  const availableCariler = useMemo(() => {
    if (cariItems && cariItems.length > 0) {
      return cariItems;
    }
    return (cariler || []).map((name, idx) => ({
      id: `cari_${idx}`,
      name,
      address: '',
      phone: '',
      tcNo: '',
      taxNo: '',
      createdAt: 0,
    }));
  }, [cariItems, cariler]);

  const filteredCarilerForPicker = useMemo(() => {
    const q = cariPickerSearch.trim().toLocaleLowerCase('tr-TR');
    if (!q) return availableCariler;
    return availableCariler.filter(
      (c) =>
        c.name.toLocaleLowerCase('tr-TR').includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.taxNo && c.taxNo.includes(q))
    );
  }, [availableCariler, cariPickerSearch]);

  // Stop camera stream helper
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  // Start live camera with Camera Permission request
  const startLiveCamera = async (
    target: { mode: 'lineItem'; lineId: string } | { mode: 'productModal' } | { mode: 'companyLogo' },
    facing: 'environment' | 'user' = 'environment'
  ) => {
    setCameraTarget(target);
    setCameraError(null);

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      // Fallback to native HTML5 camera capture input
      fallbackCameraInputRef.current?.click();
      return;
    }

    try {
      stopCameraStream();
      setIsLiveCameraOpen(true);
      setCameraFacingMode(facing);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('Kamera izni veya erişim hatası, dosya kamerasına yönlendiriliyor:', err);
      stopCameraStream();
      setIsLiveCameraOpen(false);
      // Fallback to native camera input
      fallbackCameraInputRef.current?.click();
    }
  };

  const handleCaptureFromLiveVideo = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const maxDim = 480;
    let width = vw;
    let height = vh;
    if (width > height) {
      if (width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      }
    } else {
      if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(video, 0, 0, width, height);
      // Kameradan çekilen fotoğraf da doğrudan WEBP formatına çevrilir
      const webpDataUrl = canvas.toDataURL('image/webp', 0.8);
      applySelectedImage(webpDataUrl);
    }
    stopCameraStream();
    setIsLiveCameraOpen(false);
  };

  const openGalleryForTarget = (
    target: { mode: 'lineItem'; lineId: string } | { mode: 'productModal' } | { mode: 'companyLogo' }
  ) => {
    setCameraTarget(target);
    if (galleryInputRef.current) {
      galleryInputRef.current.value = '';
      galleryInputRef.current.click();
    }
  };

  const applySelectedImage = async (dataUrl: string) => {
    if (!cameraTarget) return;
    if (cameraTarget.mode === 'lineItem') {
      setLineItems((prev) =>
        prev.map((item) => (item.id === cameraTarget.lineId ? { ...item, imageUrl: dataUrl } : item))
      );
    } else if (cameraTarget.mode === 'productModal') {
      setProdImage(dataUrl);
    } else if (cameraTarget.mode === 'companyLogo') {
      await updateQuotationSettings({
        ...quotationSettings,
        customLogoUrl: dataUrl,
      });
      await updateCompanyLogo(dataUrl).catch(() => {});
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Lütfen geçerli bir görsel dosyası seçiniz.');
      return;
    }
    try {
      const compressed = await compressProductImage(
        file,
        cameraTarget?.mode === 'companyLogo' ? 520 : 420
      );
      await applySelectedImage(compressed);
    } catch (err) {
      console.error('Görsel işleme hatası:', err);
      alert('Görsel işlenirken bir hata oluştu.');
    }
  };

  // Next quote number generator
  const generateNextQuoteNumber = () => {
    const year = new Date().getFullYear();
    const prefix = `TKL-${year}-`;
    let maxNum = 0;
    quotations.forEach((q) => {
      if (q.quoteNumber && q.quoteNumber.startsWith(prefix)) {
        const numPart = parseInt(q.quoteNumber.slice(prefix.length), 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      }
    });
    return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
  };

  // Live totals calculation for the quotation editor
  const calculatedTotals = useMemo(() => {
    let subtotal = 0;
    let discountTotal = 0;
    let vatTotal = 0;

    lineItems.forEach((item) => {
      const qty = Math.max(0, Number(item.quantity) || 0);
      const price = Math.max(0, Number(item.unitPrice) || 0);
      const discPct = Math.min(100, Math.max(0, Number(item.discountPercent) || 0));
      const gross = qty * price;
      const discAmt = gross * (discPct / 100);
      const net = gross - discAmt;
      const vatRate = Math.max(0, Number(item.vatRate) || 0);
      const vatAmt = includeVat ? net * (vatRate / 100) : 0;

      subtotal += gross;
      discountTotal += discAmt;
      vatTotal += vatAmt;
    });

    const netSubtotal = subtotal - discountTotal;
    const grandTotal = netSubtotal + vatTotal;
    return { subtotal, discountTotal, netSubtotal, vatTotal, grandTotal };
  }, [lineItems, includeVat]);

  // Open New Quotation Editor
  const handleOpenNewQuotation = () => {
    setEditingQuote(null);
    setQuoteNumber(generateNextQuoteNumber());
    setQuoteTitle('');
    setCariName('');
    setCariContactPerson('');
    setCariPhone('');
    setCariAddress('');
    setCariTaxInfo('');
    setIsCariPickerOpen(false);
    setCariPickerSearch('');
    const today = new Date();
    setQuoteDate(today.toISOString().split('T')[0]);
    const valid = new Date();
    valid.setDate(valid.getDate() + 7);
    setValidUntil(valid.toISOString().split('T')[0]);
    setCurrency('TRY');
    setIncludeVat(true);
    setHidePrices(false);
    setDescription(
      quotationSettings.defaultDescription ||
        'Firmamızdan talep etmiş olduğunuz ürün ve hizmetlere ilişkin hazırlanan fiyat teklifimiz aşağıda bilgilerinize sunulmuştur.'
    );
    setLineItems([createEmptyLineItem()]);
    const defaultTerms: QuotationFooterTermItem[] = footerTemplates
      .filter((t) => t.isDefaultSelected)
      .map((t) => ({
        id: t.id,
        title: t.title,
        content: t.content,
      }));
    setSelectedFooterTerms(defaultTerms);
    setCustomFooterNote('');
    setQuoteStatus('draft');
    setPreparedBy(user?.name || 'POLATLAR Yetkilisi');
    setPreparedByPhone(user?.phone || quotationSettings.companyPhone || '');
    setIsEditorOpen(true);
  };

  // Open Edit Quotation Editor
  const handleOpenEditQuotation = (q: QuotationRecord) => {
    setEditingQuote(q);
    setQuoteNumber(q.quoteNumber);
    setQuoteTitle(q.title || '');
    setCariName(q.cariName);
    setCariContactPerson(q.cariContactPerson || '');
    setCariPhone(q.cariPhone || '');
    setCariAddress(q.cariAddress || '');
    setCariTaxInfo(q.cariTaxInfo || '');
    setIsCariPickerOpen(false);
    setCariPickerSearch('');
    setQuoteDate(q.date || new Date().toISOString().split('T')[0]);
    setValidUntil(q.validUntil || '');
    setCurrency(q.currency || 'TRY');
    setIncludeVat(q.includeVat !== false);
    setHidePrices(Boolean(q.hidePrices));
    setDescription(q.description || '');
    setLineItems(
      q.items && q.items.length > 0
        ? q.items.map((it) => ({ ...it }))
        : [createEmptyLineItem()]
    );
    setSelectedFooterTerms(
      q.footerTerms && q.footerTerms.length > 0
        ? q.footerTerms.map((f) => ({ ...f }))
        : []
    );
    setCustomFooterNote(q.customFooterNote || '');
    setQuoteStatus(q.status || 'draft');
    setPreparedBy(q.preparedBy || user?.name || 'POLATLAR Yetkilisi');
    setPreparedByPhone(q.preparedByPhone || '');
    setIsEditorOpen(true);
  };

  // Duplicate existing quotation
  const handleDuplicateQuotation = async (q: QuotationRecord) => {
    const nextNo = generateNextQuoteNumber();
    await addQuotation({
      ...q,
      quoteNumber: nextNo,
      date: new Date().toISOString().split('T')[0],
      status: 'draft',
    });
  };

  // Select Cari from picker
  const handleSelectCari = (c: {
    id: string;
    name: string;
    phone?: string;
    address?: string;
    taxNo?: string;
    tcNo?: string;
  }) => {
    setCariName(c.name);
    if (c.phone) setCariPhone(c.phone);
    if (c.address) setCariAddress(c.address);
    if (c.taxNo || c.tcNo) setCariTaxInfo(c.taxNo || c.tcNo || '');
    setIsCariPickerOpen(false);
    setCariPickerSearch('');
  };

  // Save manually typed Cari to Cariler directory
  const handleSaveManualCariToDirectory = async () => {
    const trimmed = cariName.trim();
    if (!trimmed) {
      alert('Lütfen önce Cari / Müşteri adını yazınız.');
      return;
    }
    const exists = availableCariler.some(
      (c) => c.name.toLocaleLowerCase('tr-TR') === trimmed.toLocaleLowerCase('tr-TR')
    );
    if (exists) {
      alert(`"${trimmed}" zaten Cariler rehberinde kayıtlı.`);
      return;
    }
    try {
      await addCariItem({
        name: trimmed,
        phone: cariPhone.replace(/\D/g, '') || undefined,
        address: cariAddress.trim() || undefined,
        taxNo: cariTaxInfo.replace(/\D/g, '') || undefined,
      });
      setCariSavedToast(true);
      setTimeout(() => setCariSavedToast(false), 3000);
    } catch (e: any) {
      alert(e?.message || 'Cari kaydedilirken hata oluştu.');
    }
  };

  // Line Item updates
  const updateLineItem = (id: string, changes: Partial<QuotationLineItem>) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...changes };
        const qty = Math.max(0, Number(updated.quantity) || 0);
        const price = Math.max(0, Number(updated.unitPrice) || 0);
        const disc = Math.min(100, Math.max(0, Number(updated.discountPercent) || 0));
        updated.lineTotal = qty * price * (1 - disc / 100);
        return updated;
      })
    );
  };

  const handleAddLineItem = () => {
    setLineItems((prev) => [...prev, createEmptyLineItem()]);
  };

  const handleRemoveLineItem = (id: string) => {
    setLineItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  };

  // Add Product from Saved Catalog to Quotation Line Items (with selected quantity & calculated total)
  const handleSelectProductFromCatalog = (prod: QuotationProduct, selectedQuantity = 1) => {
    const qty = Math.max(1, Number(selectedQuantity) || 1);
    const unitPrice = Number(prod.unitPrice) || 0;
    const newLine: QuotationLineItem = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
      productId: prod.id,
      code: prod.code || '',
      name: prod.name,
      description: prod.description || '',
      quantity: qty,
      unit: prod.unit || 'Adet',
      unitPrice,
      discountPercent: 0,
      vatRate: prod.vatRate ?? 20,
      lineTotal: qty * unitPrice,
      imageUrl: prod.imageUrl,
    };

    setLineItems((prev) => {
      // If product already exists in lineItems, add to its quantity and update its lineTotal
      const existingIdx = prev.findIndex((it) => it.productId === prod.id && it.name === prod.name);
      if (existingIdx !== -1) {
        return prev.map((it, idx) => {
          if (idx !== existingIdx) return it;
          const nextQty = (Number(it.quantity) || 0) + qty;
          const price = Number(it.unitPrice) || 0;
          const disc = Math.min(100, Math.max(0, Number(it.discountPercent) || 0));
          return {
            ...it,
            quantity: nextQty,
            lineTotal: nextQty * price * (1 - disc / 100),
          };
        });
      }
      // If the only row is empty, replace it; otherwise append
      if (prev.length === 1 && !prev[0].name.trim() && !prev[0].unitPrice) {
        return [newLine];
      }
      return [...prev, newLine];
    });

    setAddedCatalogToastId(prod.id);
    setTimeout(() => setAddedCatalogToastId((prev) => (prev === prod.id ? null : prev)), 1800);
  };

  // Save a Quotation Line Item directly into the Product Catalog
  const handleSaveLineItemToCatalog = async (item: QuotationLineItem) => {
    if (!item.name.trim()) {
      alert('Kataloğa kaydetmek için lütfen ürün adını giriniz.');
      return;
    }
    const created = await addQuotationProduct({
      code: item.code?.trim() || undefined,
      name: item.name.trim(),
      description: item.description?.trim() || undefined,
      unitPrice: Number(item.unitPrice) || 0,
      currency,
      unit: item.unit || 'Adet',
      vatRate: item.vatRate ?? 20,
      imageUrl: item.imageUrl,
    });
    updateLineItem(item.id, { productId: created.id });
    setSavedLineToastId(item.id);
    setTimeout(() => setSavedLineToastId(null), 2500);
  };

  // Toggle Footer Template in Quotation Editor
  const handleToggleFooterTemplate = (tpl: QuotationFooterTemplate) => {
    setSelectedFooterTerms((prev) => {
      const exists = prev.some((f) => f.id === tpl.id);
      if (exists) {
        return prev.filter((f) => f.id !== tpl.id);
      }
      return [...prev, { id: tpl.id, title: tpl.title, content: tpl.content }];
    });
  };

  const handleUpdateSelectedFooterTerm = (
    id: string,
    field: 'title' | 'content',
    value: string
  ) => {
    setSelectedFooterTerms((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
  };

  const handleQuickSaveNewFooterTemplate = async () => {
    if (!quickFooterTitle.trim() || !quickFooterContent.trim()) {
      alert('Lütfen belge altı başlığını ve açıklamasını giriniz.');
      return;
    }
    const created = await addQuotationFooterTemplate({
      title: quickFooterTitle.trim(),
      content: quickFooterContent.trim(),
      isDefaultSelected: true,
    });
    setSelectedFooterTerms((prev) => [
      ...prev,
      { id: created.id, title: created.title, content: created.content },
    ]);
    setQuickFooterTitle('');
    setQuickFooterContent('');
    setIsQuickFooterOpen(false);
  };

  // Build QuotationRecord object from current form state
  const buildDraftQuotationObject = (): QuotationRecord | null => {
    const cleanCari = cariName.trim();
    if (!cleanCari) {
      alert('Lütfen Cari / Müşteri adını seçiniz veya manuel olarak yazınız.');
      return null;
    }
    const validItems = lineItems
      .filter((i) => i.name.trim() !== '')
      .map((i) => {
        const qty = Math.max(0, Number(i.quantity) || 0);
        const price = Math.max(0, Number(i.unitPrice) || 0);
        const disc = Math.min(100, Math.max(0, Number(i.discountPercent) || 0));
        return {
          ...i,
          name: i.name.trim(),
          quantity: qty,
          unitPrice: price,
          discountPercent: disc,
          lineTotal: qty * price * (1 - disc / 100),
        };
      });

    if (validItems.length === 0) {
      alert('Lütfen teklife en az 1 ürün veya hizmet kalemi ekleyiniz.');
      return null;
    }

    return {
      id: editingQuote?.id || 'preview-temp',
      quoteNumber: quoteNumber.trim() || generateNextQuoteNumber(),
      title: quoteTitle.trim() || undefined,
      cariName: cleanCari,
      cariContactPerson: cariContactPerson.trim() || undefined,
      cariPhone: cariPhone.trim() || undefined,
      cariAddress: cariAddress.trim() || undefined,
      cariTaxInfo: cariTaxInfo.trim() || undefined,
      date: quoteDate,
      validUntil: validUntil || undefined,
      currency,
      description: description.trim() || undefined,
      items: validItems,
      subtotal: calculatedTotals.subtotal,
      discountTotal: calculatedTotals.discountTotal,
      vatTotal: calculatedTotals.vatTotal,
      grandTotal: calculatedTotals.grandTotal,
      includeVat,
      hidePrices,
      selectedFooterIds: selectedFooterTerms.map((f) => f.id),
      footerTerms: selectedFooterTerms,
      customFooterNote: customFooterNote.trim() || undefined,
      status: quoteStatus,
      preparedBy: preparedBy.trim() || user?.name || 'POLATLAR Yetkilisi',
      preparedByPhone: preparedByPhone.trim() || undefined,
      companyLogoUrl: activePolatlarLogo,
      createdAt: editingQuote?.createdAt || Date.now(),
      createdBy: editingQuote?.createdBy || user?.id,
      createdByName: editingQuote?.createdByName || user?.name,
    };
  };

  // Save Quotation
  const handleSaveQuotation = async (e: React.FormEvent, andDownloadPdf = false) => {
    e.preventDefault();
    const built = buildDraftQuotationObject();
    if (!built) return;

    let savedRecord: QuotationRecord;
    if (editingQuote) {
      savedRecord = { ...built, id: editingQuote.id };
      await updateQuotation(savedRecord);
    } else {
      const { id: _unused, createdAt: _ca, ...payload } = built;
      savedRecord = await addQuotation(payload);
    }

    setIsEditorOpen(false);
    if (andDownloadPdf) {
      await handleDownloadPdf(savedRecord);
    }
  };

  // Download Quotation as PDF using html2pdf.js
  const handleDownloadPdf = async (quote: QuotationRecord, forceHidePrices?: boolean) => {
    let wrapper: HTMLDivElement | null = null;
    try {
      setIsDownloadingPdfId(quote.id);
      const isPricelessMode = Boolean(forceHidePrices ?? quote.hidePrices);
      const htmlString = generateQuotationPdfHtml(
        quote,
        activePolatlarLogo,
        activeCompanyFullTitle,
        quotationSettings.companyAddress,
        quotationSettings.companyPhone,
        isPricelessMode
      );

      wrapper = document.createElement('div');
      wrapper.style.position = 'fixed';
      wrapper.style.top = '0';
      wrapper.style.left = '0';
      wrapper.style.width = '780px';
      wrapper.style.background = '#ffffff';
      wrapper.style.zIndex = '-9999';
      wrapper.style.opacity = '0';
      wrapper.style.pointerEvents = 'none';
      wrapper.innerHTML = htmlString;
      document.body.appendChild(wrapper);

      // Wait briefly for web fonts and any embedded images to decode
      if (document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch {
          // ignore
        }
      }
      const imgs = Array.from(wrapper.querySelectorAll('img'));
      await Promise.all(
        imgs.map(
          (img) =>
            new Promise<void>((res) => {
              if (img.complete) {
                res();
              } else {
                img.onload = () => res();
                img.onerror = () => res();
              }
            })
        )
      );
      await new Promise((r) => setTimeout(r, 120));

      const targetElement = (wrapper.firstElementChild as HTMLElement) || wrapper;
      const safeCari = (quote.cariName || 'Musteri')
        .replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s-_]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      const modeSuffix = isPricelessMode ? '_Urun_Listesi' : '';
      const filename = `POLATLAR_Teklif_${quote.quoteNumber}_${safeCari}${modeSuffix}.pdf`;

      const h2p = getHtml2Pdf();
      if (typeof h2p === 'function') {
        const opt = {
          margin: [8, 8, 8, 8] as [number, number, number, number],
          filename,
          image: { type: 'jpeg' as const, quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            scrollY: 0,
            scrollX: 0,
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
        };
        await h2p().set(opt).from(targetElement).save();
      } else {
        handlePrintQuotation(quote);
      }
    } catch (err) {
      console.error('Teklif PDF oluşturma hatası:', err);
      handlePrintQuotation(quote);
    } finally {
      if (wrapper && wrapper.parentNode) {
        wrapper.parentNode.removeChild(wrapper);
      }
      setIsDownloadingPdfId(null);
    }
  };

  // Print Quotation via hidden iframe / print dialog
  const handlePrintQuotation = (quote: QuotationRecord, forceHidePrices?: boolean) => {
    const htmlContent = generateQuotationPdfHtml(
      quote,
      activePolatlarLogo,
      activeCompanyFullTitle,
      quotationSettings.companyAddress,
      quotationSettings.companyPhone,
      forceHidePrices
    );
    const fullDoc = `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <title>POLATLAR Teklif - ${escapeHtml(quote.quoteNumber)} - ${escapeHtml(quote.cariName)}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Montserrat:wght@300;400;500;600&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          body { margin: 0; padding: 0; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: 'Montserrat', 'Inter', 'Plus Jakarta Sans', sans-serif; font-weight: 300; }
        </style>
      </head>
      <body>${htmlContent}</body>
      </html>
    `;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(fullDoc);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 2000);
      }, 350);
    }
  };

  // Share Quotation Summary via WhatsApp
  const handleShareWhatsApp = (quote: QuotationRecord) => {
    const itemsList = (quote.items || [])
      .map(
        (it, idx) =>
          `${idx + 1}. *${it.name}* (${it.quantity} ${it.unit}) - ${formatMoney(
            it.lineTotal,
            quote.currency
          )}`
      )
      .join('\n');

    const termsList = (quote.footerTerms || [])
      .map((t) => `• *${t.title}:* ${t.content}`)
      .join('\n');

    const text = [
      `🏢 *${activeCompanyFullTitle} - FİYAT TEKLİFİ*`,
      `📄 *Teklif No:* ${quote.quoteNumber}`,
      `👤 *Cari / Müşteri:* ${quote.cariName}`,
      `📅 *Tarih:* ${quote.date}`,
      quote.description ? `\n📝 *Açıklama:* ${quote.description}` : '',
      `\n📦 *ÜRÜN & HİZMET KALEMLERİ:*`,
      itemsList,
      `\n💰 *GENEL TOPLAM:* *${formatMoney(quote.grandTotal, quote.currency)}* ${
        quote.includeVat ? '(KDV Dahil)' : '(KDV Hariç)'
      }`,
      termsList ? `\n📌 *TEKLİF KOŞULLARI:*\n${termsList}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const cleanPhone = (quote.cariPhone || '').replace(/\D/g, '');
    const waPhone = cleanPhone.startsWith('0')
      ? `90${cleanPhone.slice(1)}`
      : cleanPhone.length === 10
      ? `90${cleanPhone}`
      : cleanPhone;

    const url = waPhone
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Product Catalog Handlers
  const openNewProductModal = () => {
    setEditingProduct(null);
    setProdCode(`URN-${String(products.length + 1).padStart(3, '0')}`);
    setProdName('');
    setProdDesc('');
    setProdPrice('');
    setProdCurrency('TRY');
    setProdUnit('Adet');
    setProdVat(20);
    setProdImage(undefined);
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (p: QuotationProduct) => {
    setEditingProduct(p);
    setProdCode(p.code || '');
    setProdName(p.name);
    setProdDesc(p.description || '');
    setProdPrice(String(p.unitPrice));
    setProdCurrency(p.currency || 'TRY');
    setProdUnit(p.unit || 'Adet');
    setProdVat(p.vatRate ?? 20);
    setProdImage(p.imageUrl);
    setIsProductModalOpen(true);
  };

  const handleSaveProductModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) {
      alert('Lütfen ürün veya hizmet adını giriniz.');
      return;
    }
    const priceNum = parseFloat(String(prodPrice).replace(',', '.')) || 0;
    if (editingProduct) {
      await updateQuotationProduct({
        ...editingProduct,
        code: prodCode.trim() || undefined,
        name: prodName.trim(),
        description: prodDesc.trim() || undefined,
        unitPrice: priceNum,
        currency: prodCurrency,
        unit: prodUnit,
        vatRate: prodVat,
        imageUrl: prodImage,
      });
    } else {
      await addQuotationProduct({
        code: prodCode.trim() || undefined,
        name: prodName.trim(),
        description: prodDesc.trim() || undefined,
        unitPrice: priceNum,
        currency: prodCurrency,
        unit: prodUnit,
        vatRate: prodVat,
        imageUrl: prodImage,
      });
    }
    setIsProductModalOpen(false);
  };

  // Footer Template Modal Handlers
  const openNewFooterModal = () => {
    setEditingFooter(null);
    setFooterTitle('');
    setFooterContent('');
    setFooterDefaultSelected(true);
    setIsFooterModalOpen(true);
  };

  const openEditFooterModal = (tpl: QuotationFooterTemplate) => {
    setEditingFooter(tpl);
    setFooterTitle(tpl.title);
    setFooterContent(tpl.content);
    setFooterDefaultSelected(Boolean(tpl.isDefaultSelected));
    setIsFooterModalOpen(true);
  };

  const handleSaveFooterModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!footerTitle.trim() || !footerContent.trim()) {
      alert('Lütfen şablon başlığını ve metnini giriniz.');
      return;
    }
    if (editingFooter) {
      await updateQuotationFooterTemplate({
        ...editingFooter,
        title: footerTitle.trim(),
        content: footerContent.trim(),
        isDefaultSelected: footerDefaultSelected,
      });
    } else {
      await addQuotationFooterTemplate({
        title: footerTitle.trim(),
        content: footerContent.trim(),
        isDefaultSelected: footerDefaultSelected,
      });
    }
    setIsFooterModalOpen(false);
  };

  const handleSaveCompanyHeaderSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateQuotationSettings({
      ...quotationSettings,
      companyFullTitle: settingsCompanyTitle.trim() || 'POLATLAR YAZILIM',
      companyAddress: settingsCompanyAddress.trim() || undefined,
      companyPhone: settingsCompanyPhone.trim() || undefined,
    });
    setSettingsSavedToast(true);
    setTimeout(() => setSettingsSavedToast(false), 3000);
  };

  // Filtered Quotations
  const filteredQuotations = useMemo(() => {
    return quotations
      .filter((q) => {
        if (statusFilter !== 'all' && q.status !== statusFilter) return false;
        if (searchQuery.trim()) {
          const s = searchQuery.trim().toLocaleLowerCase('tr-TR');
          const inCari = (q.cariName || '').toLocaleLowerCase('tr-TR').includes(s);
          const inNo = (q.quoteNumber || '').toLocaleLowerCase('tr-TR').includes(s);
          const inTitle = (q.title || '').toLocaleLowerCase('tr-TR').includes(s);
          const inItems = (q.items || []).some((it) =>
            (it.name || '').toLocaleLowerCase('tr-TR').includes(s)
          );
          if (!inCari && !inNo && !inTitle && !inItems) return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [quotations, statusFilter, searchQuery]);

  // Filtered Products for Catalog
  const filteredProducts = useMemo(() => {
    const q = (isCatalogPickerOpen ? catalogSearch : productSearchQuery)
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLocaleLowerCase('tr-TR').includes(q) ||
        (p.code && p.code.toLocaleLowerCase('tr-TR').includes(q)) ||
        (p.description && p.description.toLocaleLowerCase('tr-TR').includes(q))
    );
  }, [products, productSearchQuery, catalogSearch, isCatalogPickerOpen]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Gizli Galeri & Kamera Inputları */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={fallbackCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* ========================================================= */}
      {/* 1. ÜST KURUMSAL BAŞLIK (POLATLAR LOGO EN BAŞTA) & AKSİYON */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* POLATLAR YAZILIM Kurumsal Logo Kutusu */}
          <div className="relative group/qlogo flex items-center justify-center bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 shadow-md shrink-0">
            <img
              src={activePolatlarLogo}
              alt="POLATLAR YAZILIM Logo"
              className="h-11 sm:h-12 w-auto max-w-[180px] object-contain"
            />
            <div className="absolute inset-0 bg-slate-950/90 opacity-0 group-hover/qlogo:opacity-100 transition-opacity rounded-2xl flex items-center justify-center gap-1.5 px-2">
              <button
                type="button"
                onClick={() => openGalleryForTarget({ mode: 'companyLogo' })}
                className="px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                title="Galeriden Logo Seç"
              >
                <ImageIcon className="w-3 h-3" />
                <span>Logo Seç</span>
              </button>
              <button
                type="button"
                onClick={() => startLiveCamera({ mode: 'companyLogo' })}
                className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer"
                title="Kameradan Logo Çek"
              >
                <Camera className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                POLATLAR YAZILIM — Teklif Modülü
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                POLATLAR YAZILIM
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cari seçimi veya manuel giriş, kamera/galeri görselli ürün kataloğu, belge altı koşulları ve PDF teklif indirme
            </p>
          </div>
        </div>

        {/* Sağ Aksiyon Butonları */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleOpenNewQuotation}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs sm:text-sm font-black shadow-md shadow-sky-600/25 transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Yeni Teklif Hazırla</span>
          </button>

          <button
            type="button"
            onClick={openNewProductModal}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
          >
            <Package className="w-4 h-4" />
            <span>+ Ürün Kaydet</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. ALT SEKMELER (TEKLİFLER | ÜRÜN KATALOĞU | BELGE ALTI)  */}
      {/* ========================================================= */}
      <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <button
          type="button"
          onClick={() => setSubTab('quotations')}
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            subTab === 'quotations'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Hazırlanan Teklifler</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              subTab === 'quotations'
                ? 'bg-white/20 text-white'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            {quotations.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('products')}
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            subTab === 'products'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Kayıtlı Ürün Kataloğu</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              subTab === 'products'
                ? 'bg-white/20 text-white'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            {products.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('footers')}
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            subTab === 'footers'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ListChecks className="w-4 h-4" />
          <span>Belge Altı Yazı Şablonları &amp; Başlık</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              subTab === 'footers'
                ? 'bg-white/20 text-white'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            {footerTemplates.length}
          </span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* SEKME 1: HAZIRLANAN TEKLİFLER LİSTESİ                     */}
      {/* ========================================================= */}
      {subTab === 'quotations' && (
        <div className="space-y-4">
          {/* Arama ve Durum Filtre Çubuğu */}
          <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari adı, teklif no, konu veya ürün adında ara..."
                className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(
                [
                  { id: 'all', label: 'Tümü' },
                  { id: 'draft', label: 'Taslak' },
                  { id: 'sent', label: 'İletildi' },
                  { id: 'approved', label: 'Onaylandı' },
                  { id: 'rejected', label: 'Reddedildi' },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    statusFilter === st.id
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Teklif Kartları Listesi */}
          {filteredQuotations.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-10 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Henüz Kayıtlı Teklif Bulunmuyor
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Müşterilerinize POLATLAR logolu, ürün görselli ve belge altı koşulları içeren profesyonel PDF fiyat teklifi hazırlamak için hemen başlayın.
              </p>
              <button
                type="button"
                onClick={handleOpenNewQuotation}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-black shadow-md shadow-sky-600/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>İlk Teklifi Hazırla</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {filteredQuotations.map((quote) => {
                const isOpen = Boolean(expandedQuoteIds[quote.id]);
                const stInfo = STATUS_LABELS[quote.status || 'draft'] || STATUS_LABELS.draft;
                const isDownloading = isDownloadingPdfId === quote.id;

                return (
                  <div
                    key={quote.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md transition-all p-4"
                  >
                    {/* Çekmece Başlığı: Cari İsmi & Hızlı PDF Butonu */}
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedQuoteIds((prev) => ({
                            ...prev,
                            [quote.id]: !prev[quote.id],
                          }))
                        }
                        className="flex-1 flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white shadow-sm transition-all cursor-pointer text-left min-w-0"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Building2 className="w-4 h-4 text-sky-100 shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/20 text-white shrink-0">
                            CARİ
                          </span>
                          <span className="text-xs sm:text-sm font-black truncate">
                            {quote.cariName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-black bg-white/15 px-2 py-0.5 rounded-lg">
                            {quote.hidePrices
                              ? '📋 Fiyatsız Liste'
                              : formatMoney(quote.grandTotal, quote.currency)}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 transition-transform duration-200 ${
                              isOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </button>

                      {/* Hızlı PDF İndir Butonu */}
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(quote)}
                        disabled={isDownloading}
                        className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-black shadow-sm transition-all cursor-pointer shrink-0"
                        title="PDF Olarak İndir"
                      >
                        {isDownloading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">PDF</span>
                      </button>
                    </div>

                    {/* Çekmece Açılınca Tüm Teklif Detayları */}
                    {isOpen && (
                      <div className="pt-3.5 mt-3.5 border-t border-slate-100 dark:border-slate-800 space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* Üst Bilgi & Durum Rozeti */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-black">
                              {quote.quoteNumber}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${stInfo.badgeClass}`}
                            >
                              <span className={`w-2 h-2 rounded-full ${stInfo.dotColor}`} />
                              {stInfo.label}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {quote.date}
                            </span>
                          </div>

                          {/* Durum Hızlı Değiştirici */}
                          <select
                            value={quote.status || 'draft'}
                            onChange={(e) =>
                              updateQuotation({
                                ...quote,
                                status: e.target.value as QuotationStatus,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                          >
                            <option value="draft">Durum: Taslak</option>
                            <option value="sent">Durum: Müşteriye İletildi</option>
                            <option value="approved">Durum: Onaylandı</option>
                            <option value="rejected">Durum: Reddedildi</option>
                            <option value="expired">Durum: Süresi Doldu</option>
                          </select>
                        </div>

                        {quote.title && (
                          <div className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100">
                            Konu: {quote.title}
                          </div>
                        )}

                        {quote.description && (
                          <div className="p-2.5 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/70 dark:border-sky-900/50 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {quote.description}
                          </div>
                        )}

                        {/* Ürün Kalemleri Özeti */}
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                            Teklif Kalemleri ({quote.items?.length || 0} Ürün/Hizmet)
                          </div>
                          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                            {(quote.items || []).map((it, idx) => (
                              <div
                                key={it.id || idx}
                                className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  {it.imageUrl ? (
                                    <img
                                      src={it.imageUrl}
                                      alt={it.name}
                                      className="w-10 h-10 rounded-lg object-contain bg-white border border-slate-200 shrink-0"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-lg bg-slate-200/70 dark:bg-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                                      <Package className="w-4 h-4" />
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                      {it.name}
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                      {it.quantity} {it.unit} × {formatMoney(it.unitPrice, quote.currency)}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-xs font-black text-slate-900 dark:text-white shrink-0">
                                  {formatMoney(it.lineTotal, quote.currency)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Belge Altı Seçili Koşullar Özeti */}
                        {quote.footerTerms && quote.footerTerms.length > 0 && (
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                              Seçili Belge Altı Koşulları ({quote.footerTerms.length})
                            </div>
                            {quote.footerTerms.map((term) => (
                              <div
                                key={term.id}
                                className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug"
                              >
                                <strong className="text-slate-800 dark:text-slate-100">
                                  • {term.title}:
                                </strong>{' '}
                                {term.content}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Alt Aksiyon Butonları */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPreviewQuote(quote)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-xs font-bold cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Önizle</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDownloadPdf(quote, false)}
                              disabled={isDownloading}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Fiyatlı PDF</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDownloadPdf(quote, true)}
                              disabled={isDownloading}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                              title="Fiyatsız sadece ürün isimlerinden oluşan liste PDF'i indir"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Fiyatsız Liste PDF</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handlePrintQuotation(quote)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Yazdır</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleShareWhatsApp(quote)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-50 dark:bg-green-950/50 hover:bg-green-100 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 text-xs font-bold cursor-pointer"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDuplicateQuotation(quote)}
                              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 cursor-pointer"
                              title="Teklifi Kopyala / Çoğalt"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditQuotation(quote)}
                              className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-600 dark:text-amber-400 cursor-pointer"
                              title="Teklifi Düzenle"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  confirm(
                                    `"${quote.quoteNumber} - ${quote.cariName}" teklifini silmek istediğinize emin misiniz?`
                                  )
                                ) {
                                  deleteQuotation(quote.id);
                                }
                              }}
                              className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-600 dark:text-rose-400 cursor-pointer"
                              title="Teklifi Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SEKME 2: KAYITLI ÜRÜN KATALOĞU (ÜRÜN KAYDETME & GÖRSEL)   */}
      {/* ========================================================= */}
      {subTab === 'products' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                placeholder="Kayıtlı ürün adı, stok kodu veya açıklamada ara..."
                className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              type="button"
              onClick={openNewProductModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Ürün / Hizmet Kaydet</span>
            </button>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-10 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <Package className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Kayıtlı Ürün Kataloğu Boş
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Sık teklif verdiğiniz ürünleri kamera veya galeriden görselleriyle birlikte buraya kaydedebilir, teklif hazırlarken tek tıkla seçebilirsiniz.
              </p>
              <button
                type="button"
                onClick={openNewProductModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>İlk Ürünü Kaydet</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((prod) => (
                <div
                  key={prod.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 flex flex-col justify-between gap-3 shadow-xs hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-3">
                    {prod.imageUrl ? (
                      <img
                        src={prod.imageUrl}
                        alt={prod.name}
                        className="w-20 h-20 rounded-xl object-contain bg-white border border-slate-200 p-1 shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 shrink-0">
                        <Package className="w-6 h-6 mb-1" />
                        <span className="text-[9px] font-bold">Görsel Yok</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      {prod.code && (
                        <span className="inline-block px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-[10px] font-black mb-1">
                          {prod.code}
                        </span>
                      )}
                      <h4 className="text-sm font-black text-slate-900 dark:text-white leading-snug">
                        {prod.name}
                      </h4>
                      {prod.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                          {prod.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">
                        Birim Fiyat ({prod.unit || 'Adet'})
                      </span>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        {formatMoney(prod.unitPrice, prod.currency || 'TRY')}{' '}
                        <span className="text-[10px] font-bold text-slate-400">
                          + %{prod.vatRate ?? 20} KDV
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditProductModal(prod)}
                        className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 hover:bg-amber-100 cursor-pointer"
                        title="Ürünü Düzenle"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            confirm(`"${prod.name}" ürününü katalogdan silmek istediğinize emin misiniz?`)
                          ) {
                            deleteQuotationProduct(prod.id);
                          }
                        }}
                        className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 cursor-pointer"
                        title="Ürünü Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SEKME 3: BELGE ALTI YAZI ŞABLONLARI & KURUMSAL BAŞLIK     */}
      {/* ========================================================= */}
      {subTab === 'footers' && (
        <div className="space-y-6">
          {/* Kurumsal Başlık & POLATLAR Logo Ayarları */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <Settings className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  POLATLAR Teklif Üst Başlık &amp; Logo Ayarları
                </h3>
              </div>
              {quotationSettings.customLogoUrl && (
                <button
                  type="button"
                  onClick={() =>
                    updateQuotationSettings({
                      ...quotationSettings,
                      customLogoUrl: undefined,
                    })
                  }
                  className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Varsayılan POLATLAR Logosuna Dön
                </button>
              )}
            </div>

            <form onSubmit={handleSaveCompanyHeaderSettings} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Teklif Üst Başlık Firma Ünvanı
                </label>
                <input
                  type="text"
                  value={settingsCompanyTitle}
                  onChange={(e) => setSettingsCompanyTitle(e.target.value)}
                  placeholder="Örn: POLATLAR"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Firma Telefonu (PDF Üst Başlıkta Görünür)
                </label>
                <input
                  type="text"
                  value={settingsCompanyPhone}
                  onChange={(e) => setSettingsCompanyPhone(e.target.value)}
                  placeholder="Örn: 0532 000 00 00"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Firma Adresi (PDF Üst Başlıkta Görünür)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settingsCompanyAddress}
                    onChange={(e) => setSettingsCompanyAddress(e.target.value)}
                    placeholder="Örn: Merkez / İstanbul"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black cursor-pointer shrink-0"
                  >
                    Kaydet
                  </button>
                </div>
              </div>
            </form>
            {settingsSavedToast && (
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                ✓ Kurumsal teklif başlık bilgileri kaydedildi.
              </div>
            )}
          </div>

          {/* Belge Altı Yazı Şablonları Listesi */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  Her Teklifte Seçilebilecek Belge Altı Yazı Şablonları
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ödeme koşulları, teslimat koşulları, termin tarihi ve garanti şartları gibi hazır maddeleri buradan yönetebilirsiniz.
                </p>
              </div>
              <button
                type="button"
                onClick={openNewFooterModal}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-black shadow-md cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>+ Yeni Belge Altı Yazısı Ekle</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {footerTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                        ▪ {tpl.title}
                      </span>
                      {tpl.isDefaultSelected && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[10px] font-black">
                          Varsayılan Seçili
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {tpl.content}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    <button
                      type="button"
                      onClick={() => openEditFooterModal(tpl)}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Düzenle</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          confirm(`"${tpl.title}" şablonunu silmek istediğinize emin misiniz?`)
                        ) {
                          deleteQuotationFooterTemplate(tpl.id);
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-100 cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Sil</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: YENİ TEKLİF HAZIRLA / DÜZENLE TAM EKRAN EDİTÖRÜ  */}
      {/* ========================================================= */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Üst Başlık: POLATLAR Logosu En Başta */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-950/50 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="bg-slate-950 rounded-xl px-3 py-1.5 border border-slate-800 shrink-0 flex items-center justify-center">
                  <img
                    src={activePolatlarLogo}
                    alt="POLATLAR YAZILIM Logo"
                    className="h-9 sm:h-10 w-auto max-w-[150px] object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-lg font-black text-slate-900 dark:text-white truncate">
                    {editingQuote ? `Teklifi Düzenle (${quoteNumber})` : 'Yeni Fiyat Teklifi Hazırla'}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    POLATLAR YAZILIM kurumsal antetli PDF teklif formu
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="p-2 rounded-xl bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Gövdesi */}
            <form
              onSubmit={(e) => handleSaveQuotation(e, false)}
              className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1"
            >
              {/* BÖLÜM 1: CARİ SEÇİMİ VEYA MANUEL CARİ GİRİŞİ */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      1. Müşteri / Cari Seçimi (Listeden Seçin veya Manuel Yazın)
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCariPickerOpen((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black shadow-xs cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>
                        {isCariPickerOpen
                          ? 'Cari Listesini Kapat'
                          : `Kayıtlı Carilerden Seç (${availableCariler.length})`}
                      </span>
                    </button>

                    {cariName.trim() && (
                      <button
                        type="button"
                        onClick={handleSaveManualCariToDirectory}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold hover:bg-emerald-100 cursor-pointer"
                        title="Manuel yazdığınız cariyi Cariler rehberine kaydeder"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Rehbere Kaydet</span>
                      </button>
                    )}
                  </div>
                </div>

                {cariSavedToast && (
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    ✓ "{cariName}" Cariler rehberine başarıyla kaydedildi!
                  </div>
                )}

                {/* Açılır Kayıtlı Cari Seçici */}
                {isCariPickerOpen && (
                  <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border-2 border-sky-500/50 shadow-lg space-y-2.5 animate-in fade-in duration-150">
                    <div className="relative">
                      <Search className="w-4 h-4 text-sky-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={cariPickerSearch}
                        onChange={(e) => setCariPickerSearch(e.target.value)}
                        placeholder="Kayıtlı cariler içinde ara..."
                        autoFocus
                        className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                      {filteredCarilerForPicker.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-400 space-y-2">
                          <div>Eşleşen kayıtlı cari bulunamadı.</div>
                          {cariPickerSearch.trim() && (
                            <button
                              type="button"
                              onClick={() => {
                                setCariName(cariPickerSearch.trim());
                                setIsCariPickerOpen(false);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-300 font-bold text-xs border border-sky-200 cursor-pointer"
                            >
                              ➕ "{cariPickerSearch.trim()}" adını manuel olarak kullan
                            </button>
                          )}
                        </div>
                      ) : (
                        filteredCarilerForPicker.map((c, i) => (
                          <button
                            key={c.id || i}
                            type="button"
                            onClick={() => handleSelectCari(c)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                              c.name === cariName
                                ? 'bg-sky-600 text-white font-bold'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium'
                            }`}
                          >
                            <span className="truncate">
                              {i + 1}. {c.name}
                            </span>
                            {c.phone && (
                              <span
                                className={`text-[10px] ml-2 shrink-0 ${
                                  c.name === cariName ? 'text-sky-100' : 'text-slate-400'
                                }`}
                              >
                                {c.phone}
                              </span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Cari Adı (Manuel Yazılabilir veya Seçilebilir) & Detay Alanları */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Cari / Müşteri Ünvanı * (Seçin veya Elle Yazın)
                    </label>
                    <input
                      type="text"
                      required
                      value={cariName}
                      onChange={(e) => setCariName(e.target.value)}
                      placeholder="Cari seçin veya müşteri/firma adını doğrudan buraya yazın..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      İlgili Yetkili Kişi
                    </label>
                    <input
                      type="text"
                      value={cariContactPerson}
                      onChange={(e) => setCariContactPerson(e.target.value)}
                      placeholder="Örn: Ahmet Bey"
                      className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Müşteri Telefonu
                    </label>
                    <input
                      type="text"
                      value={cariPhone}
                      onChange={(e) => setCariPhone(e.target.value)}
                      placeholder="05XX XXX XX XX"
                      className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Müşteri Adresi (İsteğe Bağlı)
                    </label>
                    <input
                      type="text"
                      value={cariAddress}
                      onChange={(e) => setCariAddress(e.target.value)}
                      placeholder="Müşteri açık adresi..."
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Vergi Dairesi / Vergi veya T.C. No (İsteğe Bağlı)
                    </label>
                    <input
                      type="text"
                      value={cariTaxInfo}
                      onChange={(e) => setCariTaxInfo(e.target.value)}
                      placeholder="Örn: Marmara Kurumlar V.D. - 1234567890"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* BÖLÜM 2: TEKLİF BİLGİLERİ & TEKLİF AÇIKLAMASI */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      2. Teklif Bilgileri, Tasarım Formatı ve Açıklama
                    </h3>
                  </div>

                  {/* Teklif Tasarım Formatı Seçici: Fiyatlı vs Fiyatsız Ürün Listesi */}
                  <div className="inline-flex items-center p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 gap-1">
                    <button
                      type="button"
                      onClick={() => setHidePrices(false)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        !hidePrices
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      💰 Fiyatlı Teklif Tasarımı
                    </button>
                    <button
                      type="button"
                      onClick={() => setHidePrices(true)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        hidePrices
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      📋 Fiyatsız Liste Tasarımı (Sadece Ürün İsimleri)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Teklif No
                    </label>
                    <input
                      type="text"
                      value={quoteNumber}
                      onChange={(e) => setQuoteNumber(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-black text-sky-700 dark:text-sky-300"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Teklif Konusu / Başlığı
                    </label>
                    <input
                      type="text"
                      value={quoteTitle}
                      onChange={(e) => setQuoteTitle(e.target.value)}
                      placeholder="Örn: Kamera & Otomasyon Sistem Kurulum Teklifi"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Teklif Tarihi
                    </label>
                    <input
                      type="date"
                      value={quoteDate}
                      onChange={(e) => setQuoteDate(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Geçerlilik Tarihi
                    </label>
                    <input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Para Birimi
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as QuotationCurrency)}
                      className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-900 dark:text-white"
                    >
                      <option value="TRY">₺ TRY (Türk Lirası)</option>
                      <option value="USD">$ USD (Amerikan Doları)</option>
                      <option value="EUR">€ EUR (Euro)</option>
                    </select>
                  </div>
                </div>

                {/* Teklif Açıklaması / Ön Yazı */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Teklif Açıklaması / Ön Yazı (PDF'te Ürün Tablosunun Üstünde Çıkar)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setDescription(
                            'Firmamızdan talep etmiş olduğunuz ürün ve hizmetlere ilişkin hazırlanan fiyat teklifimiz aşağıda bilgilerinize sunulmuştur. Teklifimizin uygun görülmesini temenni eder, iyi çalışmalar dileriz.'
                          )
                        }
                        className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                      >
                        Standart Ön Yazı Doldur
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Teklif hakkında genel açıklama, ön yazı veya kapsam bilgisi giriniz..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* BÖLÜM 3: ÜRÜN & HİZMET KALEMLERİ (KATALOGDAN SEÇ VEYA KAYDET + KAMERA/GALERİ GÖRSELİ) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      3. Ürün / Hizmet Kalemleri ve Görselleri ({lineItems.length} Kalem)
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCatalogSearch('');
                        setIsCatalogPickerOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-sm cursor-pointer"
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>Kayıtlı Ürünlerden Seç ({products.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black shadow-sm cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Yeni Satır Ekle</span>
                    </button>
                  </div>
                </div>

                {/* Ürün Satırları */}
                <div className="space-y-3">
                  {lineItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-2xs space-y-3"
                    >
                      <div className="flex flex-col lg:flex-row items-stretch lg:items-start gap-3.5">
                        {/* Sol: Ürün Görseli (Kamera & Galeri İzinli) */}
                        <div className="flex sm:flex-col items-center gap-2 shrink-0">
                          <div className="relative w-20 h-20 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                            {item.imageUrl ? (
                              <>
                                <img
                                  src={item.imageUrl}
                                  alt={item.name || 'Ürün'}
                                  className="w-full h-full object-contain p-1 bg-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateLineItem(item.id, { imageUrl: undefined })}
                                  className="absolute top-1 right-1 p-1 rounded-full bg-rose-600 text-white shadow cursor-pointer"
                                  title="Görseli Kaldır"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </>
                            ) : (
                              <div className="text-center p-1 text-slate-400">
                                <ImageIcon className="w-5 h-5 mx-auto mb-0.5" />
                                <span className="text-[9px] font-bold block leading-tight">
                                  Ürün Görseli
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Kamera & Galeri Butonları */}
                          <div className="flex sm:w-full gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                startLiveCamera({ mode: 'lineItem', lineId: item.id })
                              }
                              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-[10px] font-extrabold cursor-pointer"
                              title="Kamera İzni ile Fotoğraf Çek"
                            >
                              <Camera className="w-3 h-3" />
                              <span>Kamera</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                openGalleryForTarget({ mode: 'lineItem', lineId: item.id })
                              }
                              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[10px] font-extrabold cursor-pointer"
                              title="Galeriden Görsel Seç"
                            >
                              <ImageIcon className="w-3 h-3" />
                              <span>Galeri</span>
                            </button>
                          </div>
                        </div>

                        {/* Orta: Ürün Adı, Kodu ve Teknik Açıklaması */}
                        <div className="flex-1 space-y-2 min-w-0">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <div className="w-full sm:w-28 shrink-0">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                                #{idx + 1} Stok Kodu
                              </label>
                              <input
                                type="text"
                                value={item.code || ''}
                                onChange={(e) => updateLineItem(item.id, { code: e.target.value })}
                                placeholder="URN-001"
                                className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                                Ürün / Hizmet Adı *
                              </label>
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => updateLineItem(item.id, { name: e.target.value })}
                                placeholder="Ürün veya hizmet adını yazınız..."
                                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-black text-slate-900 dark:text-white"
                              />
                            </div>
                          </div>

                          <div>
                            <input
                              type="text"
                              value={item.description || ''}
                              onChange={(e) =>
                                updateLineItem(item.id, { description: e.target.value })
                              }
                              placeholder="Ürün teknik özellikleri, marka/model veya satır açıklaması (İsteğe bağlı)..."
                              className="w-full px-3 py-1.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 text-xs text-slate-700 dark:text-slate-300"
                            />
                          </div>
                        </div>

                        {/* Sağ: Miktar, Birim, Birim Fiyat, İskonto, KDV, Tutar */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 lg:w-[430px] gap-2 shrink-0 items-end">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                              Miktar
                            </label>
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              value={item.quantity}
                              onChange={(e) =>
                                updateLineItem(item.id, {
                                  quantity: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black text-center text-slate-900 dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                              Birim
                            </label>
                            <select
                              value={item.unit}
                              onChange={(e) => updateLineItem(item.id, { unit: e.target.value })}
                              className="w-full px-2 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                            >
                              {UNIT_OPTIONS.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                              Birim Fiyat ({CURRENCY_SYMBOLS[currency]})
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.unitPrice || ''}
                              onChange={(e) =>
                                updateLineItem(item.id, {
                                  unitPrice: parseFloat(e.target.value) || 0,
                                })
                              }
                              placeholder="0.00"
                              className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black text-right text-slate-900 dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                              İskonto %
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="any"
                              value={item.discountPercent || ''}
                              onChange={(e) =>
                                updateLineItem(item.id, {
                                  discountPercent: parseFloat(e.target.value) || 0,
                                })
                              }
                              placeholder="0"
                              className="w-full px-2 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-center text-rose-600 dark:text-rose-400"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                              KDV %
                            </label>
                            <select
                              value={item.vatRate}
                              onChange={(e) =>
                                updateLineItem(item.id, { vatRate: Number(e.target.value) })
                              }
                              className="w-full px-2 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                            >
                              {VAT_OPTIONS.map((v) => (
                                <option key={v} value={v}>
                                  %{v}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Satır Alt Çubuğu: Kataloğa Kaydet & Satır Toplamı & Sil */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveLineItemToCatalog(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold cursor-pointer"
                            title="Bu ürünü görseli ve fiyatıyla birlikte Kayıtlı Ürün Kataloğuna ekler"
                          >
                            <Save className="w-3 h-3" />
                            <span>
                              {savedLineToastId === item.id
                                ? '✓ Kataloğa Kaydedildi!'
                                : 'Ürünü Kataloğa Kaydet'}
                            </span>
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-xs font-bold text-slate-500">
                            Satır Tutarı:{' '}
                            <span className="text-sm font-black text-slate-900 dark:text-white">
                              {formatMoney(item.lineTotal, currency)}
                            </span>
                          </div>
                          {lineItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveLineItem(item.id)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                              title="Satırı Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Finansal Toplam Özeti */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeVat}
                      onChange={(e) => setIncludeVat(e.target.checked)}
                      className="w-4 h-4 rounded accent-sky-600"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Teklifte KDV Hesaplansın ve Gösterilsin
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="text-xs">
                      <span className="text-slate-400 font-bold block">Ara Toplam</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">
                        {formatMoney(calculatedTotals.subtotal, currency)}
                      </span>
                    </div>
                    {calculatedTotals.discountTotal > 0 && (
                      <div className="text-xs">
                        <span className="text-rose-400 font-bold block">İskonto</span>
                        <span className="font-extrabold text-rose-600">
                          -{formatMoney(calculatedTotals.discountTotal, currency)}
                        </span>
                      </div>
                    )}
                    {includeVat && (
                      <div className="text-xs">
                        <span className="text-slate-400 font-bold block">KDV Toplamı</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">
                          {formatMoney(calculatedTotals.vatTotal, currency)}
                        </span>
                      </div>
                    )}
                    <div className="pl-3 border-l border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] font-black uppercase text-sky-600 dark:text-sky-400 block">
                        GENEL TOPLAM
                      </span>
                      <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                        {formatMoney(calculatedTotals.grandTotal, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* BÖLÜM 4: BELGE ALTI YAZI SEÇİMİ (ÖDEME KOŞULLARI, TESLİMAT, TERMİN TARİHİ VS.) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <ListChecks className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        4. Belge Altı Yazı Seçimi (Ödeme Koşulları, Teslimat, Termin Tarihi vb.)
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Teklifin altında çıkmasını istediğiniz maddeleri işaretleyin; seçilen maddelerin metnini bu teklife özel değiştirebilirsiniz.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsQuickFooterOpen((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Yeni Belge Altı Şablonu Ekle</span>
                  </button>
                </div>

                {/* Hızlı Yeni Belge Altı Şablonu Ekleme Kutusu */}
                {isQuickFooterOpen && (
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-indigo-500/40 space-y-3">
                    <div className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                      Yeni Belge Altı Maddesi Kaydet (Tüm Tekliflerde Seçilebilir Olur)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <input
                        type="text"
                        value={quickFooterTitle}
                        onChange={(e) => setQuickFooterTitle(e.target.value)}
                        placeholder="Başlık (Örn: Ödeme Koşulları, Termin Tarihi)"
                        className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                      />
                      <input
                        type="text"
                        value={quickFooterContent}
                        onChange={(e) => setQuickFooterContent(e.target.value)}
                        placeholder="Açıklama (Örn: Sipariş onayından itibaren 3 iş günü içinde teslim edilir.)"
                        className="sm:col-span-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsQuickFooterOpen(false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500"
                      >
                        İptal
                      </button>
                      <button
                        type="button"
                        onClick={handleQuickSaveNewFooterTemplate}
                        className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-black cursor-pointer"
                      >
                        Kaydet ve Seç
                      </button>
                    </div>
                  </div>
                )}

                {/* Şablon Seçim Butonları (Chips / Checkboxes) */}
                <div className="flex flex-wrap gap-2">
                  {footerTemplates.map((tpl) => {
                    const isSelected = selectedFooterTerms.some((f) => f.id === tpl.id);
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => handleToggleFooterTemplate(tpl)}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-left ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 shrink-0 opacity-60" />
                        )}
                        <span>{tpl.title}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Seçilen Belge Altı Maddelerinin Düzenlenebilir Listesi */}
                {selectedFooterTerms.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="text-[11px] font-black uppercase text-slate-400">
                      Teklifte Çıkacak Seçili Belge Altı Maddeleri ({selectedFooterTerms.length})
                    </div>
                    {selectedFooterTerms.map((term) => (
                      <div
                        key={term.id}
                        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700"
                      >
                        <input
                          type="text"
                          value={term.title}
                          onChange={(e) =>
                            handleUpdateSelectedFooterTerm(term.id, 'title', e.target.value)
                          }
                          className="sm:w-48 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-900 dark:text-white shrink-0"
                        />
                        <input
                          type="text"
                          value={term.content}
                          onChange={(e) =>
                            handleUpdateSelectedFooterTerm(term.id, 'content', e.target.value)
                          }
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedFooterTerms((prev) =>
                              prev.filter((f) => f.id !== term.id)
                            )
                          }
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer self-end sm:self-center"
                          title="Bu Tekliften Çıkar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Ekstra Özel Belge Altı Notu & Hazırlayan Bilgisi */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Ekstra Belge Altı Özel Not (İsteğe Bağlı)
                    </label>
                    <input
                      type="text"
                      value={customFooterNote}
                      onChange={(e) => setCustomFooterNote(e.target.value)}
                      placeholder="Bu teklife özel eklemek istediğiniz ekstra not..."
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Teklifi Hazırlayan Yetkili
                    </label>
                    <input
                      type="text"
                      value={preparedBy}
                      onChange={(e) => setPreparedBy(e.target.value)}
                      placeholder="Ad Soyad"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Alt Kaydet / Önizle / PDF İndir Buton Çubuğu */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const draft = buildDraftQuotationObject();
                    if (draft) setPreviewQuote(draft);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-black cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>Canlı A4 Önizleme</span>
                </button>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={(e) => handleSaveQuotation(e, true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black shadow-lg shadow-emerald-600/25 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Kaydet ve PDF İndir</span>
                  </button>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-black shadow-lg shadow-sky-600/25 cursor-pointer"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>{editingQuote ? 'Teklifi Güncelle' : 'Teklifi Kaydet'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: KAYITLI ÜRÜNLERDEN SEÇME MODALI                  */}
      {/* ========================================================= */}
      {isCatalogPickerOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full max-h-[82vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  Kayıtlı Ürün Kataloğundan Teklife Ekle
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCatalogPickerOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Ürün adı veya stok kodu ara..."
                  autoFocus
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {filteredProducts.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                  <div>Katalogda eşleşen kayıtlı ürün bulunamadı.</div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCatalogPickerOpen(false);
                      openNewProductModal();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs cursor-pointer"
                  >
                    + Yeni Ürün Kataloğa Ekle
                  </button>
                </div>
              ) : (
                filteredProducts.map((prod) => {
                  const selectedQty = getCatalogQty(prod.id);
                  const unitPrice = Number(prod.unitPrice) || 0;
                  const calculatedLineTotal = selectedQty * unitPrice;
                  const isJustAdded = addedCatalogToastId === prod.id;

                  return (
                    <div
                      key={prod.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700 hover:border-emerald-400 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {prod.imageUrl ? (
                          <img
                            src={prod.imageUrl}
                            alt={prod.name}
                            className="w-12 h-12 rounded-xl object-contain bg-white border border-slate-200 p-0.5 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {prod.code && (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                                {prod.code}
                              </span>
                            )}
                            <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                              {prod.name}
                            </span>
                          </div>
                          {prod.description && (
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">
                              {prod.description}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                              {formatMoney(unitPrice, prod.currency || 'TRY')} / {prod.unit || 'Adet'}
                            </span>
                            {selectedQty > 1 && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] font-black">
                                {selectedQty} {prod.unit || 'Adet'} Toplam:{' '}
                                {formatMoney(calculatedLineTotal, prod.currency || 'TRY')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Sağ Taraf: Miktar Seçici (- / Miktar / +) ve Teklife Ekle Butonu */}
                      <div className="flex items-center justify-end gap-2 shrink-0">
                        <div className="inline-flex items-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-0.5 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => setCatalogQty(prod.id, selectedQty - 1)}
                            className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-black text-sm flex items-center justify-center cursor-pointer select-none"
                            title="Miktarı Azalt"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={selectedQty}
                            onChange={(e) =>
                              setCatalogQty(prod.id, parseFloat(e.target.value) || 1)
                            }
                            className="w-12 text-center bg-transparent text-xs font-black text-slate-900 dark:text-white focus:outline-none"
                            title="Eklenecek Miktar"
                          />
                          <button
                            type="button"
                            onClick={() => setCatalogQty(prod.id, selectedQty + 1)}
                            className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-black text-sm flex items-center justify-center cursor-pointer select-none"
                            title="Miktarı Artır"
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectProductFromCatalog(prod, selectedQty)}
                          className={`px-3.5 py-2 rounded-xl text-white text-xs font-black shadow-xs cursor-pointer shrink-0 flex items-center gap-1 transition-all ${
                            isJustAdded
                              ? 'bg-sky-600'
                              : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95'
                          }`}
                        >
                          {isJustAdded ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>{selectedQty} Eklendi!</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>
                                {selectedQty > 1
                                  ? `${selectedQty} ${prod.unit || 'Adet'} Ekle`
                                  : 'Teklife Ekle'}
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCatalogPickerOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-black cursor-pointer"
              >
                Tamam / Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: ÜRÜN KATALOĞU EKLE / DÜZENLE (KAMERA & GALERİ)    */}
      {/* ========================================================= */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                {editingProduct ? 'Kayıtlı Ürünü Düzenle' : 'Kataloğa Yeni Ürün / Hizmet Kaydet'}
              </h3>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProductModal} className="p-4 sm:p-5 space-y-4">
              {/* Ürün Görseli (Kamera ve Galeri İzinli) */}
              <div className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                <div className="relative w-20 h-20 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                  {prodImage ? (
                    <>
                      <img
                        src={prodImage}
                        alt="Ürün Görseli"
                        className="w-full h-full object-contain p-1"
                      />
                      <button
                        type="button"
                        onClick={() => setProdImage(undefined)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-rose-600 text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <ImageIcon className="w-7 h-7 text-slate-300" />
                  )}
                </div>

                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      Ürün Görseli (Kamera veya Galeri)
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-black">
                      Otomatik WEBP Sıkıştırma
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startLiveCamera({ mode: 'productModal' })}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black cursor-pointer shadow-xs"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Kameradan Çek</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openGalleryForTarget({ mode: 'productModal' })}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black cursor-pointer shadow-xs"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Galeriden Seç</span>
                    </button>
                  </div>
                  {prodImage && (
                    <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      ✓ Görsel WEBP formatına dönüştürüldü (~
                      {Math.max(1, Math.round((prodImage.length * 0.75) / 1024))} KB)
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Stok / Ürün Kodu
                  </label>
                  <input
                    type="text"
                    value={prodCode}
                    onChange={(e) => setProdCode(e.target.value)}
                    placeholder="URN-001"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Ürün / Hizmet Adı *
                  </label>
                  <input
                    type="text"
                    required
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    placeholder="Örn: 4MP IP Dome Kamera"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-black text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Ürün Özellikleri / Açıklama (İsteğe Bağlı)
                </label>
                <textarea
                  rows={2}
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  placeholder="Teklif tablosunda ürün adının altında çıkacak teknik detay..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Birim Fiyat *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Para Birimi
                  </label>
                  <select
                    value={prodCurrency}
                    onChange={(e) => setProdCurrency(e.target.value as QuotationCurrency)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="TRY">₺ TRY</option>
                    <option value="USD">$ USD</option>
                    <option value="EUR">€ EUR</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Birim
                  </label>
                  <select
                    value={prodUnit}
                    onChange={(e) => setProdUnit(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    KDV %
                  </label>
                  <select
                    value={prodVat}
                    onChange={(e) => setProdVat(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    {VAT_OPTIONS.map((v) => (
                      <option key={v} value={v}>
                        %{v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingProduct ? 'Ürünü Güncelle' : 'Kataloğa Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: BELGE ALTI YAZI ŞABLONU EKLE / DÜZENLE           */}
      {/* ========================================================= */}
      {isFooterModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                {editingFooter ? 'Belge Altı Şablonunu Düzenle' : 'Yeni Belge Altı Yazı Şablonu'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFooterModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFooterModal} className="p-4 sm:p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Koşul / Madde Başlığı *
                </label>
                <input
                  type="text"
                  required
                  value={footerTitle}
                  onChange={(e) => setFooterTitle(e.target.value)}
                  placeholder="Örn: Ödeme Koşulları, Teslimat Koşulları, Termin Tarihi..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-black text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Belge Altı Metni *
                </label>
                <textarea
                  rows={3}
                  required
                  value={footerContent}
                  onChange={(e) => setFooterContent(e.target.value)}
                  placeholder="Örn: Sipariş onayında %50 peşin, kalan %50 teslimatta tahsil edilir..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={footerDefaultSelected}
                  onChange={(e) => setFooterDefaultSelected(e.target.checked)}
                  className="w-4 h-4 rounded accent-indigo-600"
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Yeni teklif oluştururken otomatik seçili gelsin
                </span>
              </label>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFooterModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black cursor-pointer"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: CANLI KAMERA ÇEKİM MODALI (KAMERA İZNİ İLE)      */}
      {/* ========================================================= */}
      {isLiveCameraOpen && (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-sky-400" />
                <span className="text-sm font-black">Ürün Görseli Çek (Kamera)</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopCameraStream();
                  setIsLiveCameraOpen(false);
                }}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="relative aspect-4/3 w-full rounded-2xl overflow-hidden bg-black border border-slate-800">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>

              {cameraError && (
                <div className="text-xs text-rose-400 text-center">{cameraError}</div>
              )}

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (cameraTarget) {
                      const nextFacing =
                        cameraFacingMode === 'environment' ? 'user' : 'environment';
                      startLiveCamera(cameraTarget, nextFacing);
                    }
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <SwitchCamera className="w-4 h-4" />
                  <span>Kamera Değiştir</span>
                </button>

                <button
                  type="button"
                  onClick={handleCaptureFromLiveVideo}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Fotoğrafı Çek ve Kullan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 6: A4 KURUMSAL TEKLİF CANLI ÖNİZLEME & PDF İNDİRME  */}
      {/* ========================================================= */}
      {previewQuote && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-3.5 sm:p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-950 text-white shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-400" />
                <span className="text-xs sm:text-sm font-black">
                  Teklif Önizleme: {previewQuote.quoteNumber} — {previewQuote.cariName}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Önizleme İçinde Fiyatlı / Fiyatsız Tasarım Geçiş Anahtarı */}
                <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-800 border border-slate-700">
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewQuote((prev) => (prev ? { ...prev, hidePrices: false } : null))
                    }
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                      !previewQuote.hidePrices
                        ? 'bg-sky-600 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    💰 Fiyatlı
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewQuote((prev) => (prev ? { ...prev, hidePrices: true } : null))
                    }
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                      previewQuote.hidePrices
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    📋 Fiyatsız Liste
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleDownloadPdf(previewQuote)}
                  disabled={isDownloadingPdfId === previewQuote.id}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black cursor-pointer"
                >
                  {isDownloadingPdfId === previewQuote.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>PDF İndir</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePrintQuotation(previewQuote)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Yazdır</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewQuote(null)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div
              ref={previewContainerRef}
              className="p-2 sm:p-6 overflow-y-auto overflow-x-hidden bg-slate-800/90 flex-1 flex justify-center"
            >
              <div
                style={{
                  width: `${Math.round(750 * previewScale)}px`,
                  height: previewScaledHeight ? `${previewScaledHeight}px` : 'auto',
                  position: 'relative',
                }}
              >
                <div
                  ref={previewSheetRef}
                  className="bg-white rounded-xl shadow-2xl overflow-hidden"
                  style={{
                    width: '750px',
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top left',
                  }}
                  dangerouslySetInnerHTML={{
                    __html: generateQuotationPdfHtml(
                      previewQuote,
                      activePolatlarLogo,
                      activeCompanyFullTitle,
                      quotationSettings.companyAddress,
                      quotationSettings.companyPhone
                    ),
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
