import React, { useState } from 'react';
import {
  ArrowLeft,
  Share2,
  Trash2,
  ListTodo,
  FileText,
  Loader2,
  MessageCircle,
} from 'lucide-react';
import { LocationItem, TaskStatus } from '../../types/storage';
import { ProgressBar } from '../common/ProgressBar';
import { ChecklistTab } from './ChecklistTab';
import { NotesMediaTab } from './NotesMediaTab';
import { Lightbox } from '../common/Lightbox';
import { PdfService } from '../../services/pdfService';
import { WhatsappService } from '../../services/whatsappService';

interface LocationDetailModalProps {
  location: LocationItem | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
  onUpdateStatus: (taskId: string, status: TaskStatus) => void;
  onAddCustomTask: (taskName: string) => void;
  onDeleteCustomTask: (taskId: string, taskName: string) => void;
  onUpdateDetails: (
    address: string,
    notes: string,
    lat?: number,
    lon?: number,
    name?: string
  ) => void;
  onAddPhoto: (photoDataUrl: string) => void;
  onDeletePhoto: (photoDataUrl: string) => void;
}

export const LocationDetailModal: React.FC<LocationDetailModalProps> = ({
  location,
  isOpen,
  onClose,
  onDelete,
  onUpdateStatus,
  onAddCustomTask,
  onDeleteCustomTask,
  onUpdateDetails,
  onAddPhoto,
  onDeletePhoto,
}) => {
  const [activeTab, setActiveTab] = useState<'checklist' | 'metadata'>('checklist');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  if (!isOpen || !location) return null;

  const total = location.tasks.length;
  const completed = location.tasks.filter((t) => t.status === 'completed').length;
  const notPresent = location.tasks.filter((t) => t.status === 'not_present').length;

  const completedPct = total > 0 ? (completed / total) * 100 : 0;
  const notPresentPct = total > 0 ? (notPresent / total) * 100 : 0;

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      await PdfService.exportPdf(location);
    } catch (err) {
      alert('PDF raporu oluşturulurken bir hata oluştu.');
      console.error(err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div
          className="fixed inset-0"
          onClick={onClose}
          aria-hidden="true"
        />

        <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col h-[92vh] sm:h-[88vh] border-t sm:border border-slate-200 dark:border-slate-700 z-10 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-slate-700/80 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={onClose}
                className="p-1.5 -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0"
                aria-label="Geri Dön"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                  {location.name}
                </h2>
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 block truncate">
                  Lokasyon Detayları
                </span>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  WhatsappService.shareLocation({
                    locationName: location.name,
                    staffName: location.createdByName || 'Saha Yetkilisi',
                  });
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition-colors border border-emerald-200/80 dark:border-emerald-800/80"
                title="WhatsApp ile Paylaş / Yöneticiye Bildir"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>

              <button
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700/70 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors disabled:opacity-50"
                title="PDF Teslim Tutanağı İndir / Paylaş"
              >
                {isExportingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                ) : (
                  <Share2 className="w-4 h-4 text-blue-500" />
                )}
                <span className="hidden sm:inline">PDF Raporu</span>
              </button>

              <button
                onClick={() => {
                  if (
                    window.confirm(
                      `"${location.name}" kurulum kaydını silmek istediğinize emin misiniz?`
                    )
                  ) {
                    onDelete();
                  }
                }}
                className="p-2 rounded-xl text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                title="Kurulumu Sil"
                aria-label="Kurulumu Sil"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress Header Block */}
          <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-700/60 shrink-0 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-900 dark:text-slate-100">
                Kurulum İlerlemesi: %{Math.round(completedPct)}
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
                {completed} Tamamlandı • {notPresent} Mevcut Değil
              </span>
            </div>
            <ProgressBar completedPct={completedPct} notPresentPct={notPresentPct} height="h-2" />
          </div>

          {/* Sub Tab Switcher */}
          <div className="flex border-b border-slate-200 dark:border-slate-700/80 shrink-0 bg-white dark:bg-slate-800">
            <button
              onClick={() => setActiveTab('checklist')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
                activeTab === 'checklist'
                  ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-950/20'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <ListTodo className="w-4 h-4" />
              <span>Kontrol Listesi</span>
            </button>

            <button
              onClick={() => setActiveTab('metadata')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
                activeTab === 'metadata'
                  ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-950/20'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Notlar & Medya</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {activeTab === 'checklist' ? (
              <ChecklistTab
                location={location}
                onUpdateStatus={onUpdateStatus}
                onAddCustomTask={onAddCustomTask}
                onDeleteCustomTask={onDeleteCustomTask}
              />
            ) : (
              <NotesMediaTab
                location={location}
                onUpdateDetails={onUpdateDetails}
                onAddPhoto={onAddPhoto}
                onDeletePhoto={onDeletePhoto}
                onPreviewPhoto={(url) => setPreviewPhoto(url)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Lightbox for Fullscreen Image View */}
      <Lightbox
        photoUrl={previewPhoto}
        onClose={() => setPreviewPhoto(null)}
        onDelete={onDeletePhoto}
      />
    </>
  );
};
