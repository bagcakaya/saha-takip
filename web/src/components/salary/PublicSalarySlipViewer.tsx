import React, { useEffect, useRef, useState } from 'react';
import { FileDown, Printer, Building2, AlertCircle } from 'lucide-react';
import html2pdf from 'html2pdf.js';

export interface SalarySlipPayload {
  isYearly?: boolean;
  staffName: string;
  staffUsername: string;
  staffPhone?: string;
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

export const PublicSalarySlipViewer: React.FC = () => {
  const [data, setData] = useState<SalarySlipPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
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
    if (!printRef.current || !data) return;
    setIsDownloading(true);
    try {
      const cleanFileName = data.isYearly
        ? `${data.staffName.replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ_-]/g, '_')}_${data.year}_Yillik_Odeme_Icmali.pdf`
        : `${data.staffName.replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ_-]/g, '_')}_${data.monthName || data.month}_${data.year}_Maas_Pusulasi.pdf`;

      const opt = {
        margin: 8,
        filename: cleanFileName,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          scrollX: 0,
          scrollY: 0,
        },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
      };

      await html2pdf().set(opt).from(printRef.current).save();
    } catch (err) {
      console.error('PDF indirme hatası:', err);
      alert('PDF indirilirken bir hata oluştu.');
    } finally {
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
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center py-6 px-3 sm:px-6">
      {/* Üst İşlem Çubuğu (Yazdırma ve İndirme) */}
      <div className="w-full max-w-[800px] mb-4 flex flex-wrap items-center justify-between gap-3 bg-slate-800/90 backdrop-blur-md p-3.5 rounded-2xl border border-slate-700 shadow-xl print:hidden">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-black text-white block">{data.companyName}</span>
            <span className="text-[10px] text-slate-400">
              {data.isYearly ? `${data.year} Yıllık İcmal` : `${data.monthName} ${data.year} Pusulası`}
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
            <FileDown className="w-4 h-4" />
            <span>{isDownloading ? 'İndiriliyor...' : '📥 Resmi PDF Olarak İndir'}</span>
          </button>
        </div>
      </div>

      {/* Yazdırılabilir & İndirilebilir Resmi Bordro Pusulası Kartı */}
      <div className="w-full max-w-[800px] bg-white text-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
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
              <div><strong>Dönem:</strong> {data.isYearly ? `${data.year} Yılı` : `${data.monthName} ${data.year}`}</div>
              <div><strong>Düzenleme:</strong> {new Date().toLocaleDateString('tr-TR')}</div>
              <div><strong>Belge No:</strong> {data.isYearly ? `YIL-${data.year}` : `MS-${data.year}${data.month && data.month < 10 ? '0' + data.month : data.month}`}</div>
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
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Kullanıcı Adı</span>
                <span className="font-semibold text-slate-700">@{data.staffUsername}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Şube / Birim</span>
                <span className="font-semibold text-slate-700">{data.branchName || 'Merkez'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Telefon</span>
                <span className="font-semibold text-slate-700">{data.staffPhone || '-'}</span>
              </div>
            </div>
          </div>

          {/* Finansal Kutular */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                {data.isYearly ? 'YILLIK TOPLAM ÖDENEN' : 'TOPLAM VERİLEN MAAŞ'}
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
              <span><strong>Anlaşılan Dönem Hak Edişi:</strong> {data.agreed.toLocaleString('tr-TR')} ₺</span>
              <span className={(data.remaining ?? 0) > 0 ? 'text-rose-700 font-extrabold' : 'text-emerald-700 font-extrabold'}>
                <strong>Kalan Bakiye:</strong> {(data.remaining ?? 0).toLocaleString('tr-TR')} ₺
              </span>
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
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="p-2.5 text-slate-600">{p.date}</td>
                        <td className="p-2.5 font-bold text-slate-800">
                          {p.type === 'bonus' ? '🎁 Prim' : p.type === 'advance' ? '⚡ Avans' : '💼 Maaş'}
                        </td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.method === 'bank'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
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
