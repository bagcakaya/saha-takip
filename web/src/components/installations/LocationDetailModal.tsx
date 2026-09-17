import React, { useState } from 'react';
import {
  ArrowLeft,
  Share2,
  Trash2,
  ListTodo,
  FileText,
  Loader2,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  Clock,
  Check,
  X,
  RotateCcw,
  Building2,
} from 'lucide-react';
import { LocationItem, TaskStatus } from '../../types/storage';
import { ProgressBar } from '../common/ProgressBar';
import { ChecklistTab } from './ChecklistTab';
import { NotesMediaTab } from './NotesMediaTab';
import { Lightbox } from '../common/Lightbox';
import { PdfService } from '../../services/pdfService';
import { WhatsappService } from '../../services/whatsappService';
import { useAuth } from '../../context/AuthContext';
import { isUserAdmin } from '../../types/auth';
import { useStorage } from '../../context/StorageContext';
import { CompleteLocationModal } from './CompleteLocationModal';
import { RejectLocationModal } from './RejectLocationModal';

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
  const { user } = useAuth();
  const isAdmin = isUserAdmin(user);
  const { completeLocation, approveLocation, rejectLocation } = useStorage();

  const [activeTab, setActiveTab] = useState<'checklist' | 'metadata'>('checklist');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [lightboxData, setLightboxData] = useState<{
    images: string[];
    initialIndex: number;
    title: string;
  } | null>(null);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

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
                {location.cariName ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 truncate">
                    <Building2 className="w-3 h-3 shrink-0" />
                    <span>{location.cariName}</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 block truncate">
                    Lokasyon Detayları
                  </span>
                )}
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

          {/* Approval Workflow & Status Banner */}
          <div className="px-4 py-2.5 bg-slate-100/70 dark:bg-slate-900/70 border-b border-slate-200/80 dark:border-slate-700/80 shrink-0 space-y-2">
            {isAdmin ? (
              /* Admin Approval View */
              <>
                {location.status === 'pending_approval' && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-600 animate-spin" />
                        <span>Personel Onay Bekliyor ({location.completedByName || 'Saha Personeli'})</span>
                      </span>
                      {location.completedAt && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                          {new Date(location.completedAt).toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>

                    {location.completionNote && (
                      <p className="text-xs text-slate-800 dark:text-slate-200 bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                        <strong className="text-slate-900 dark:text-slate-100">Personel Notu:</strong> {location.completionNote}
                      </p>
                    )}

                    {location.completionPhotos && location.completionPhotos.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">
                          Tamamlama Fotoğrafları ({location.completionPhotos.length}):
                        </span>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {location.completionPhotos.map((p, idx) => (
                            <img
                              key={idx}
                              src={p}
                              alt="Tamamlama"
                              onClick={() =>
                                setLightboxData({
                                  images: location.completionPhotos!,
                                  initialIndex: idx,
                                  title: `${location.name} - Tamamlama Fotoğrafları`,
                                })
                              }
                              className="w-12 h-12 rounded-lg object-cover border border-amber-200 cursor-pointer hover:opacity-80 transition-all shrink-0"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => approveLocation(location.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs shadow-xs transition-all cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>Kurulumu Onayla</span>
                      </button>
                      <button
                        onClick={() => setIsRejectModalOpen(true)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/50 active:scale-95 font-extrabold text-xs transition-all cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                        <span>Reddet</span>
                      </button>
                    </div>
                  </div>
                )}

                {location.status === 'rejected' && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Kurulum Reddedildi</span>
                      </div>
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 truncate">
                        Gerekçe: {location.rejectionReason || 'Eksikler var'}
                      </p>
                    </div>
                    <button
                      onClick={() => approveLocation(location.id)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 cursor-pointer"
                    >
                      Yine de Onayla
                    </button>
                  </div>
                )}

                {location.status === 'approved' && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                    <span className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Bu kurulum {location.approvedByName || 'Yönetici'} tarafından onaylandı.</span>
                    </span>
                    {location.approvedAt && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                        {new Date(location.approvedAt).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* Field Staff Approval View */
              <>
                {(!location.status || location.status === 'pending') && (
                  <button
                    onClick={() => setIsCompleteModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>✓ Kurulumu Tamamla (Yönetici Onayına Gönder)</span>
                  </button>
                )}

                {location.status === 'pending_approval' && (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-xs font-bold text-amber-700 dark:text-amber-400 gap-2">
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Kurulum tamamlandı ve yönetici onayına gönderildi. Onay bekleniyor.</span>
                  </div>
                )}

                {location.status === 'rejected' && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                      <AlertCircle className="w-4 h-4" />
                      <span>Yönetici Kurulumu Reddetti</span>
                    </div>
                    {location.rejectionReason && (
                      <p className="text-xs text-rose-800 dark:text-rose-200 bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-rose-200">
                        <strong>Red Gerekçesi:</strong> {location.rejectionReason}
                      </p>
                    )}
                    <button
                      onClick={() => setIsCompleteModalOpen(true)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>↻ Eksikleri Giderdim / Tekrar Onaya Gönder</span>
                    </button>
                  </div>
                )}

                {location.status === 'approved' && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-400 gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Bu kurulum yönetici tarafından onaylandı.</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sub Tab Switcher */}
          <div className="flex border-b border-slate-200 dark:border-slate-700/80 shrink-0 bg-white dark:bg-slate-800">
            <button
              onClick={() => setActiveTab('checklist')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
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
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
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
                onPreviewPhoto={(url, idx) =>
                  setLightboxData({
                    images: location.photos || [url],
                    initialIndex: idx !== undefined ? idx : 0,
                    title: `${location.name} - Kurulum Fotoğrafları`,
                  })
                }
              />
            )}
          </div>
        </div>
      </div>

      {/* Lightbox for Fullscreen Image View */}
      <Lightbox
        images={lightboxData?.images || []}
        initialIndex={lightboxData?.initialIndex || 0}
        title={lightboxData?.title || 'Kurulum Fotoğrafı'}
        onClose={() => setLightboxData(null)}
        onDelete={(photoUrl) => {
          onDeletePhoto(photoUrl);
          setLightboxData((prev) => {
            if (!prev) return null;
            const remaining = prev.images.filter((img) => img !== photoUrl);
            if (remaining.length === 0) return null;
            return {
              ...prev,
              images: remaining,
              initialIndex: Math.min(prev.initialIndex, remaining.length - 1),
            };
          });
        }}
      />

      {/* Complete Location Modal */}
      <CompleteLocationModal
        isOpen={isCompleteModalOpen}
        location={location}
        onClose={() => setIsCompleteModalOpen(false)}
        onConfirm={async (note, photos) => {
          await completeLocation(location.id, note, photos);
        }}
      />

      {/* Reject Location Modal */}
      <RejectLocationModal
        isOpen={isRejectModalOpen}
        location={location}
        onClose={() => setIsRejectModalOpen(false)}
        onConfirm={async (reason) => {
          await rejectLocation(location.id, reason);
        }}
      />
    </>
  );
};
