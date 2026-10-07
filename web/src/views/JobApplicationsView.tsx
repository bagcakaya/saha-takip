import React, { useState, useMemo, useRef } from 'react';
import {
  UserPlus,
  Plus,
  Search,
  X,
  FileText,
  Download,
  Eye,
  Edit2,
  Trash2,
  Phone,
  PhoneCall,
  MapPin,
  GraduationCap,
  Briefcase,
  Shield,
  CheckCircle2,
  Clock,
  AlertCircle,
  UserCheck,
  Image as ImageIcon,
  ChevronDown,
  Sparkles,
  Users,
} from 'lucide-react';
import { useStorage } from '../context/StorageContext';
import { JobApplication, JobApplicationStatus } from '../types/storage';
import { UserRole } from '../types/auth';
import { UserService } from '../services/userService';

const STATUS_CONFIG: Record<
  JobApplicationStatus,
  { label: string; bg: string; text: string; border: string; badge: string; icon: any }
> = {
  new: {
    label: 'Yeni Başvuru',
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-700',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700',
    icon: Clock,
  },
  call_scheduled: {
    label: 'Aranması Planlandı',
    bg: 'bg-cyan-500/10 dark:bg-cyan-500/20',
    text: 'text-cyan-700 dark:text-cyan-300',
    border: 'border-cyan-300 dark:border-cyan-700',
    badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-200 border border-cyan-300 dark:border-cyan-700',
    icon: PhoneCall,
  },
  interview_scheduled: {
    label: 'Mülakat Planlandı',
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-300 dark:border-blue-700',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border border-blue-300 dark:border-blue-700',
    icon: CalendarIcon,
  },
  offer_made: {
    label: 'Teklif Yapıldı',
    bg: 'bg-purple-500/10 dark:bg-purple-500/20',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-300 dark:border-purple-700',
    badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 border border-purple-300 dark:border-purple-700',
    icon: Sparkles,
  },
  hired: {
    label: 'İşe Alındı',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-300 dark:border-emerald-700',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Reddedildi',
    bg: 'bg-rose-500/10 dark:bg-rose-500/20',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-300 dark:border-rose-700',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200 border border-rose-300 dark:border-rose-700',
    icon: AlertCircle,
  },
};

function CalendarIcon(props: any) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

export const JobApplicationsView: React.FC = () => {
  const {
    jobApplications,
    addJobApplication,
    updateJobApplication,
    deleteJobApplication,
    updateJobApplicationStatus,
    convertApplicationToStaff,
    branches,
  } = useStorage();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | JobApplicationStatus>('all');
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingApplication, setEditingApplication] = useState<JobApplication | null>(null);

  // Conversion Modal State
  const [convertingApp, setConvertingApp] = useState<JobApplication | null>(null);

  // CV / Document Preview Modal State
  const [previewCvApp, setPreviewCvApp] = useState<JobApplication | null>(null);

  // Photo Preview Modal State
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<{ url: string; name: string } | null>(null);

  // Safe list
  const safeList = useMemo(() => {
    return Array.isArray(jobApplications) ? jobApplications : [];
  }, [jobApplications]);

  // Statistics
  const stats = useMemo(() => {
    const total = safeList.length;
    const newCount = safeList.filter((a) => a.status === 'new').length;
    const callCount = safeList.filter((a) => a.status === 'call_scheduled').length;
    const interviewCount = safeList.filter((a) => a.status === 'interview_scheduled').length;
    const offerCount = safeList.filter((a) => a.status === 'offer_made').length;
    const hiredCount = safeList.filter((a) => a.status === 'hired').length;
    const rejectedCount = safeList.filter((a) => a.status === 'rejected').length;
    return { total, newCount, callCount, interviewCount, offerCount, hiredCount, rejectedCount };
  }, [safeList]);

  // Filtered & sorted list (newest first)
  const filteredList = useMemo(() => {
    return safeList
      .filter((app) => {
        if (statusFilter !== 'all' && app.status !== statusFilter) {
          return false;
        }
        if (!searchQuery.trim()) return true;

        const q = searchQuery.toLowerCase().trim();
        return (
          app.fullName?.toLowerCase().includes(q) ||
          app.phone?.toLowerCase().includes(q) ||
          app.address?.toLowerCase().includes(q) ||
          app.appliedPosition?.toLowerCase().includes(q) ||
          app.education?.toLowerCase().includes(q) ||
          app.militaryStatus?.toLowerCase().includes(q) ||
          app.experience?.toLowerCase().includes(q) ||
          app.statusNotes?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [safeList, statusFilter, searchQuery]);

  const handleOpenAdd = () => {
    setEditingApplication(null);
    setIsAddEditModalOpen(true);
  };

  const handleOpenEdit = (app: JobApplication) => {
    setEditingApplication(app);
    setIsAddEditModalOpen(true);
  };

  const handleDelete = async (app: JobApplication) => {
    if (
      window.confirm(
        `"${app.fullName}" isimli adayın başvuru kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
      )
    ) {
      await deleteJobApplication(app.id);
    }
  };

  const handleStatusChange = async (app: JobApplication, newStatus: JobApplicationStatus) => {
    await updateJobApplicationStatus(app.id, newStatus);
    if (newStatus === 'hired' && !app.convertedToUserId) {
      if (
        window.confirm(
          `"${app.fullName}" adayı "İşe Alındı" durumuna taşındı!\n\nŞimdi bu aday için sisteme personel kullanıcı hesabı oluşturmak ister misiniz?`
        )
      ) {
        setConvertingApp(app);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-in fade-in duration-200">
      {/* 1. Header Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-teal-900/90 via-slate-900 to-indigo-950 p-6 rounded-3xl border border-teal-500/30 text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="p-2 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <UserPlus className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              İş Başvuruları & Aday Takibi
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-300">
            Aday özgeçmişleri, mülakat aşamaları ve tek tıkla personele dönüştürme paneli.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Yeni Başvuru Ekle</span>
        </button>
      </div>

      {/* 2. Pipeline KPI Cards (Görsel-3) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
        <button
          onClick={() => setStatusFilter('all')}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-700 shadow-md ring-2 ring-slate-400'
              : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold opacity-75">Toplam Aday</span>
            <Users className="w-4 h-4 opacity-50" />
          </div>
          <p className="text-xl sm:text-2xl font-black mt-2">{stats.total}</p>
        </button>

        <button
          onClick={() => setStatusFilter('new')}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'new'
              ? 'bg-amber-600 text-white border-amber-500 shadow-md ring-2 ring-amber-400'
              : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold opacity-75">Yeni Başvuru</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black mt-2 text-amber-600 dark:text-amber-400">
            {stats.newCount}
          </p>
        </button>

        <button
          onClick={() => setStatusFilter('call_scheduled')}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'call_scheduled'
              ? 'bg-cyan-600 text-white border-cyan-500 shadow-md ring-2 ring-cyan-400'
              : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-cyan-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold opacity-75">Aranması Planlı</span>
            <PhoneCall className="w-4 h-4 text-cyan-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black mt-2 text-cyan-600 dark:text-cyan-400">
            {stats.callCount}
          </p>
        </button>

        <button
          onClick={() => setStatusFilter('interview_scheduled')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'interview_scheduled'
              ? 'bg-blue-600 text-white border-blue-500 shadow-md ring-2 ring-blue-400'
              : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold opacity-75">Mülakat Planlı</span>
            <CalendarIcon className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black mt-2 text-blue-600 dark:text-blue-400">
            {stats.interviewCount}
          </p>
        </button>

        <button
          onClick={() => setStatusFilter('offer_made')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'offer_made'
              ? 'bg-purple-600 text-white border-purple-500 shadow-md ring-2 ring-purple-400'
              : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-purple-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold opacity-75">Teklif Yapıldı</span>
            <Sparkles className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-black mt-2 text-purple-600 dark:text-purple-400">
            {stats.offerCount}
          </p>
        </button>

        <button
          onClick={() => setStatusFilter('hired')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'hired'
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-md ring-2 ring-emerald-400'
              : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold opacity-75">İşe Alındı</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black mt-2 text-emerald-600 dark:text-emerald-400">
            {stats.hiredCount}
          </p>
        </button>

        <button
          onClick={() => setStatusFilter('rejected')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'rejected'
              ? 'bg-rose-600 text-white border-rose-500 shadow-md ring-2 ring-rose-400'
              : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold opacity-75">Reddedildi</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black mt-2 text-rose-600 dark:text-rose-400">
            {stats.rejectedCount}
          </p>
        </button>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Aday adı, telefon, pozisyon, mezuniyet veya iş deneyimi ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
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

        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-2 shrink-0">
          Gösterilen: <span className="font-bold text-slate-800 dark:text-slate-200">{filteredList.length}</span> aday
        </div>
      </div>

      {/* 4. Table / Cards View */}
      {filteredList.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto mb-4 border border-teal-100 dark:border-teal-900/50">
            <UserPlus className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            {searchQuery || statusFilter !== 'all' ? 'Arama Kriterine Uygun Aday Bulunamadı' : 'Henüz İş Başvurusu Bulunmuyor'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5">
            {searchQuery || statusFilter !== 'all'
              ? 'Filtreleri temizleyerek veya farklı bir arama yaparak tekrar deneyebilirsiniz.'
              : 'Yeni bir iş başvurusu eklemek için "Yeni Başvuru Ekle" butonunu kullanabilirsiniz.'}
          </p>
          {(searchQuery || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
            >
              Filtreleri Temizle
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View (lg+) */}
          <div className="hidden lg:block bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4 w-12 text-center">Fotoğraf</th>
                    <th className="py-3.5 px-4">Adı - Soyadı</th>
                    <th className="py-3.5 px-4">Telefon & Adres</th>
                    <th className="py-3.5 px-4">Pozisyon</th>
                    <th className="py-3.5 px-4">Mezuniyet</th>
                    <th className="py-3.5 px-4">Askerlik Durumu</th>
                    <th className="py-3.5 px-4 max-w-xs">İş Deneyimi</th>
                    <th className="py-3.5 px-4 text-center">CV / Belge</th>
                    <th className="py-3.5 px-4">Durum Süreci</th>
                    <th className="py-3.5 px-4 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredList.map((app) => {
                    const statusConf = STATUS_CONFIG[app.status] || STATUS_CONFIG.new;

                    return (
                      <tr
                        key={app.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* 1. Fotoğraf */}
                        <td className="py-3.5 px-4 text-center">
                          {app.photoData ? (
                            <button
                              onClick={() => setPreviewPhotoUrl({ url: app.photoData!, name: app.fullName })}
                              className="relative group inline-block"
                              title="Fotoğrafı büyüt"
                            >
                              <img
                                src={app.photoData}
                                alt={app.fullName}
                                className="w-10 h-10 rounded-full object-cover border-2 border-teal-500/40 shadow-sm group-hover:scale-110 transition-transform"
                              />
                              <span className="absolute inset-0 bg-black/30 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                <Eye className="w-3.5 h-3.5" />
                              </span>
                            </button>
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 font-bold flex items-center justify-center mx-auto text-xs uppercase">
                              {app.fullName ? app.fullName.substring(0, 2) : 'AD'}
                            </div>
                          )}
                        </td>

                        {/* 2. Ad-Soyad */}
                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                            {app.fullName}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <span>
                              {new Date(app.createdAt).toLocaleDateString('tr-TR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            {app.convertedToUsername && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40">
                                <UserCheck className="w-3 h-3" />
                                Personel: @{app.convertedToUsername}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 3. Telefon & Adres */}
                        <td className="py-3.5 px-4">
                          <a
                            href={`tel:${app.phone}`}
                            className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 font-bold hover:underline"
                          >
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            <span>{app.phone || '-'}</span>
                          </a>
                          {app.address && (
                            <div
                              className="text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1 mt-1 max-w-[200px] truncate"
                              title={app.address}
                            >
                              <MapPin className="w-3 h-3 shrink-0 text-slate-400 mt-0.5" />
                              <span className="truncate">{app.address}</span>
                            </div>
                          )}
                        </td>

                        {/* 4. Başvurulan Pozisyon */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                            <Briefcase className="w-3.5 h-3.5 text-teal-500" />
                            {app.appliedPosition || 'Genel Başvuru'}
                          </span>
                        </td>

                        {/* 5. Mezuniyet */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                            <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                            {app.education || '-'}
                          </span>
                        </td>

                        {/* 6. Askerlik Durumu */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            <Shield className="w-3 h-3 text-slate-400" />
                            {app.militaryStatus || 'Belirtilmedi'}
                          </span>
                        </td>

                        {/* 7. İş Deneyimi */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <p
                            className="text-slate-600 dark:text-slate-300 line-clamp-2 text-xs"
                            title={app.experience}
                          >
                            {app.experience || '-'}
                          </p>
                        </td>

                        {/* 8. CV ve Belge */}
                        <td className="py-3.5 px-4 text-center">
                          {app.cvFileData ? (
                            <button
                              onClick={() => setPreviewCvApp(app)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors cursor-pointer"
                              title="CV Görüntüle / İndir"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>CV İncele</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs italic">Yok</span>
                          )}
                        </td>

                        {/* 9. Durum (Pipeline Seçici) */}
                        <td className="py-3.5 px-4">
                          <div className="relative inline-block">
                            <select
                              value={app.status}
                              onChange={(e) =>
                                handleStatusChange(app, e.target.value as JobApplicationStatus)
                              }
                              className={`appearance-none text-xs font-extrabold px-3 py-1.5 pr-7 rounded-xl border cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 ${statusConf.badge}`}
                            >
                              <option value="new">Yeni Başvuru</option>
                              <option value="call_scheduled">Aranması Planlandı</option>
                              <option value="interview_scheduled">Mülakat Planlandı</option>
                              <option value="offer_made">Teklif Yapıldı</option>
                              <option value="hired">İşe Alındı</option>
                              <option value="rejected">Reddedildi</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                          </div>
                        </td>

                        {/* 10. İşlemler */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Personel Yap Butonu */}
                            {!app.convertedToUserId ? (
                              <button
                                onClick={() => setConvertingApp(app)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-sm shadow-emerald-600/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                title="Adayı Personele / Sistem Kullanıcısına Dönüştür"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>Personel Yap</span>
                              </button>
                            ) : (
                              <span
                                className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                title={`Personel oluşturuldu (@${app.convertedToUsername})`}
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </span>
                            )}

                            <button
                              onClick={() => handleOpenEdit(app)}
                              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Başvuruyu Düzenle"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleDelete(app)}
                              className="p-1.5 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              title="Başvuruyu Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View (< lg) */}
          <div className="lg:hidden space-y-3">
            {filteredList.map((app) => {
              const statusConf = STATUS_CONFIG[app.status] || STATUS_CONFIG.new;

              return (
                <div
                  key={app.id}
                  className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {app.photoData ? (
                        <button
                          onClick={() => setPreviewPhotoUrl({ url: app.photoData!, name: app.fullName })}
                          className="relative"
                        >
                          <img
                            src={app.photoData}
                            alt={app.fullName}
                            className="w-12 h-12 rounded-full object-cover border-2 border-teal-500/50 shadow-sm"
                          />
                        </button>
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 font-bold flex items-center justify-center text-sm uppercase">
                          {app.fullName ? app.fullName.substring(0, 2) : 'AD'}
                        </div>
                      )}

                      <div>
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-base">
                          {app.fullName}
                        </h4>
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-600 dark:text-teal-400">
                          <Briefcase className="w-3 h-3" />
                          {app.appliedPosition || 'Genel Başvuru'}
                        </span>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-extrabold ${statusConf.badge}`}>
                      {statusConf.label}
                    </span>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Telefon</span>
                      <a
                        href={`tel:${app.phone}`}
                        className="font-bold text-teal-600 dark:text-teal-400 hover:underline"
                      >
                        {app.phone || '-'}
                      </a>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Mezuniyet</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {app.education || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Askerlik</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {app.militaryStatus || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Başvuru Tarihi</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {new Date(app.createdAt).toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                  </div>

                  {/* Experience */}
                  {app.experience && (
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-bold text-slate-800 dark:text-slate-200">İş Deneyimi: </span>
                      <span className="line-clamp-2">{app.experience}</span>
                    </div>
                  )}

                  {/* Address */}
                  {app.address && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{app.address}</span>
                    </div>
                  )}

                  {/* Converted badge if any */}
                  {app.convertedToUsername && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Sistem Kullanıcısı Oluşturuldu: @{app.convertedToUsername}</span>
                    </div>
                  )}

                  {/* Görsel-2: Durum Belirleme Butonları (Görsel-3'teki Kartlara Gönderir) */}
                  <div className="space-y-1.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>Aşama Butonları:</span>
                      <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">
                        Görseldeki karta taşır
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {/* 1. Aranması Planlandı */}
                      <button
                        type="button"
                        onClick={() => handleStatusChange(app, 'call_scheduled')}
                        className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          app.status === 'call_scheduled'
                            ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30 ring-2 ring-cyan-400'
                            : 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 hover:bg-cyan-100'
                        }`}
                        title="Adayı 'Aranması Planlandı' kartına gönder"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>Aranması Planlandı</span>
                      </button>

                      {/* 2. Mülakat Planlandı */}
                      <button
                        type="button"
                        onClick={() => handleStatusChange(app, 'interview_scheduled')}
                        className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          app.status === 'interview_scheduled'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-400'
                            : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100'
                        }`}
                        title="Adayı 'Mülakat Planlı' kartına gönder"
                      >
                        <CalendarIcon className="w-3.5 h-3.5" />
                        <span>Mülakat Planlandı</span>
                      </button>

                      {/* 3. İşe Alındı */}
                      <button
                        type="button"
                        onClick={() => handleStatusChange(app, 'hired')}
                        className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          app.status === 'hired'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100'
                        }`}
                        title="Adayı 'İşe Alındı' kartına gönder"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>İşe Alındı</span>
                      </button>

                      {/* 4. Reddedildi */}
                      <button
                        type="button"
                        onClick={() => handleStatusChange(app, 'rejected')}
                        className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          app.status === 'rejected'
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-400'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100'
                        }`}
                        title="Adayı 'Reddedildi' kartına gönder"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Reddedildi</span>
                      </button>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      {app.cvFileData && (
                        <button
                          onClick={() => setPreviewCvApp(app)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>CV</span>
                        </button>
                      )}

                      {!app.convertedToUserId && (
                        <button
                          onClick={() => setConvertingApp(app)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Personel Yap</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(app)}
                        className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(app)}
                        className="p-2 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 5. Modals */}

      {/* Add / Edit Application Modal */}
      {isAddEditModalOpen && (
        <AddEditApplicationModal
          isOpen={isAddEditModalOpen}
          initialData={editingApplication}
          onClose={() => {
            setIsAddEditModalOpen(false);
            setEditingApplication(null);
          }}
          onSave={async (formData) => {
            if (editingApplication) {
              await updateJobApplication(editingApplication.id, formData);
            } else {
              await addJobApplication(formData);
            }
            setIsAddEditModalOpen(false);
            setEditingApplication(null);
          }}
        />
      )}

      {/* Convert Candidate To Staff Modal */}
      {convertingApp && (
        <ConvertToStaffModal
          application={convertingApp}
          branches={branches || []}
          onClose={() => setConvertingApp(null)}
          onConvert={async (params) => {
            const res = await convertApplicationToStaff(convertingApp.id, params);
            if (res.success) {
              alert(
                `🎉 Tebrikler! "${params.name}" personeli başarıyla sisteme eklendi.\n\nKullanıcı Adı: ${params.username}\nŞifre: ${params.password || '1234'}\n\nAday durumu "İşe Alındı" olarak güncellendi.`
              );
              setConvertingApp(null);
            } else {
              alert(`İşlem Başarısız: ${res.error || 'Personel eklenemedi.'}`);
            }
          }}
        />
      )}

      {/* CV / Document Preview Modal */}
      {previewCvApp && (
        <CvPreviewModal
          application={previewCvApp}
          onClose={() => setPreviewCvApp(null)}
        />
      )}

      {/* Photo Preview Modal */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div
            className="relative max-w-lg w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl p-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white">{previewPhotoUrl.name}</h4>
              <button
                onClick={() => setPreviewPhotoUrl(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={previewPhotoUrl.url}
              alt={previewPhotoUrl.name}
              className="max-h-[75vh] w-auto mx-auto rounded-2xl object-contain shadow-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ========================================================
// 1. ADD / EDIT APPLICATION MODAL
// ========================================================
interface AddEditModalProps {
  isOpen: boolean;
  initialData: JobApplication | null;
  onClose: () => void;
  onSave: (data: Omit<JobApplication, 'id' | 'createdAt' | 'companyCode'>) => Promise<void>;
}

const AddEditApplicationModal: React.FC<AddEditModalProps> = ({
  isOpen,
  initialData,
  onClose,
  onSave,
}) => {
  const [fullName, setFullName] = useState(initialData?.fullName || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [address, setAddress] = useState(initialData?.address || '');
  const [education, setEducation] = useState(initialData?.education || 'Lisans');
  const [appliedPosition, setAppliedPosition] = useState(
    initialData?.appliedPosition || 'Teknik Servis'
  );
  const [militaryStatus, setMilitaryStatus] = useState(
    initialData?.militaryStatus || 'Yapıldı'
  );
  const [experience, setExperience] = useState(initialData?.experience || '');
  const [status, setStatus] = useState<JobApplicationStatus>(initialData?.status || 'new');
  const [statusNotes, setStatusNotes] = useState(initialData?.statusNotes || '');
  const [interviewDate, setInterviewDate] = useState(initialData?.interviewDate || '');
  const [salaryExpectation, setSalaryExpectation] = useState(
    initialData?.salaryExpectation || ''
  );

  // File states
  const [photoData, setPhotoData] = useState<string | undefined>(initialData?.photoData);
  const [cvFileName, setCvFileName] = useState<string | undefined>(initialData?.cvFileName);
  const [cvFileData, setCvFileData] = useState<string | undefined>(initialData?.cvFileData);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Fotoğraf boyutu 5 MB\'dan küçük olmalıdır.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert('CV / Belge boyutu 15 MB\'dan küçük olmalıdır.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCvFileName(file.name);
      setCvFileData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      alert('Lütfen ad ve soyad girin.');
      return;
    }
    if (!phone.trim()) {
      alert('Lütfen telefon numarası girin.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        fullName: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        education,
        appliedPosition: appliedPosition.trim(),
        militaryStatus,
        experience: experience.trim(),
        status,
        statusNotes: statusNotes.trim(),
        interviewDate: interviewDate || undefined,
        salaryExpectation: salaryExpectation.trim() || undefined,
        photoData,
        cvFileName,
        cvFileData,
      });
    } catch (err) {
      console.error(err);
      alert('Kayıt kaydedilirken bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <UserPlus className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                {initialData ? 'Başvuru Kaydını Düzenle' : 'Yeni İş Başvurusu Ekle'}
              </h3>
              <p className="text-xs text-slate-400">
                Adayın temel ve mesleki bilgilerini eksiksiz doldurun.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Photo & Basic Info Row */}
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* Photo Upload Box */}
            <div className="flex flex-col items-center gap-2 shrink-0 w-full sm:w-auto">
              <div
                onClick={() => photoInputRef.current?.click()}
                className="w-24 h-24 rounded-2xl border-2 border-dashed border-teal-400/50 hover:border-teal-500 bg-teal-50/50 dark:bg-teal-950/20 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-colors relative group"
                title="Fotoğraf Yükle"
              >
                {photoData ? (
                  <>
                    <img
                      src={photoData}
                      alt="Aday Önizleme"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold transition-opacity">
                      Değiştir
                    </div>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-6 h-6 text-teal-500 mb-1" />
                    <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 text-center px-1">
                      Fotoğraf Yükle
                    </span>
                  </>
                )}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              {photoData && (
                <button
                  type="button"
                  onClick={() => setPhotoData(undefined)}
                  className="text-[10px] font-semibold text-rose-500 hover:underline"
                >
                  Fotoğrafı Kaldır
                </button>
              )}
            </div>

            {/* Name & Phone */}
            <div className="flex-1 w-full space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Adı - Soyadı <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Ahmet Yılmaz"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Telefon Numarası <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Örn: 0532 123 45 67"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Applied Position & Education */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Başvurulan Pozisyon (Yazılabilir)
              </label>
              <input
                type="text"
                placeholder="Örn: Teknik Servis, Montaj, Yazılımcı..."
                value={appliedPosition}
                onChange={(e) => setAppliedPosition(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {[
                  'Teknik Servis',
                  'Saha Montaj / Kurulum',
                  'Satış & Pazarlama',
                  'Muhasebe / Finans',
                  'Yazılım & IT',
                  'Depo & Sevkiyat',
                  'Ofis Personeli',
                ].map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setAppliedPosition(pos)}
                    className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-teal-950/60 dark:hover:text-teal-300 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Mezuniyet Durumu
              </label>
              <select
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="İlköğretim">İlköğretim</option>
                <option value="Lise">Lise</option>
                <option value="Ön Lisans (MYO)">Ön Lisans (MYO)</option>
                <option value="Lisans (Üniversite)">Lisans (Üniversite)</option>
                <option value="Yüksek Lisans">Yüksek Lisans</option>
                <option value="Doktora">Doktora</option>
              </select>
            </div>
          </div>

          {/* Military Status & Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Askerlik Durumu (Erkek Adaylar)
              </label>
              <select
                value={militaryStatus}
                onChange={(e) => setMilitaryStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="Yapıldı">Yapıldı</option>
                <option value="Muaf">Muaf</option>
                <option value="Tecilli">Tecilli</option>
                <option value="Muaf / Yok (Kadın Aday)">Muaf / Yok (Kadın Aday)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Maaş Beklentisi (Opsiyonel)
              </label>
              <input
                type="text"
                placeholder="Örn: 35.000 TL"
                value={salaryExpectation}
                onChange={(e) => setSalaryExpectation(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              İkametgah / Adres Bilgisi
            </label>
            <input
              type="text"
              placeholder="Örn: Kadıköy / İstanbul"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Experience */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              İş Deneyimi & Geçmiş Tecrübeler
            </label>
            <textarea
              rows={3}
              placeholder="Önceki çalıştığı şirketler, görevler, deneyim yılı ve uzmanlıklar..."
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* CV / File Upload */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Özgeçmiş (CV) / Belge Yükleme
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => cvInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-teal-500" />
                <span>{cvFileName ? 'CV Belgesini Değiştir' : 'CV / Belge Seç (PDF, Word, Görsel)'}</span>
              </button>
              <input
                ref={cvInputRef}
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                onChange={handleCvUpload}
                className="hidden"
              />
              {cvFileName && (
                <div className="flex items-center gap-2 text-xs font-bold text-teal-600 dark:text-teal-400">
                  <span className="truncate max-w-xs">{cvFileName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCvFileName(undefined);
                      setCvFileData(undefined);
                    }}
                    className="text-rose-500 hover:text-rose-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Status Pipeline & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Başvuru Aşaması / Durumu
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as JobApplicationStatus)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="new">Yeni Başvuru</option>
                <option value="call_scheduled">Aranması Planlandı</option>
                <option value="interview_scheduled">Mülakat Planlandı</option>
                <option value="offer_made">Teklif Yapıldı</option>
                <option value="hired">İşe Alındı</option>
                <option value="rejected">Reddedildi</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Mülakat Tarihi (Opsiyonel)
              </label>
              <input
                type="datetime-local"
                value={interviewDate}
                onChange={(e) => setInterviewDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Yönetici Notları / Görüşme Detayı
            </label>
            <input
              type="text"
              placeholder="Aday hakkında iç değerlendirme notu..."
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs shadow-lg shadow-teal-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Kaydediliyor...' : initialData ? 'Değişiklikleri Kaydet' : 'Başvuruyu Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ========================================================
// 2. CONVERT TO STAFF / USER MODAL
// ========================================================
interface ConvertModalProps {
  application: JobApplication;
  branches: Array<{ id: string; name: string }>;
  onClose: () => void;
  onConvert: (params: {
    username: string;
    password?: string;
    name: string;
    role?: UserRole;
    branchId?: string;
  }) => Promise<void>;
}

const ConvertToStaffModal: React.FC<ConvertModalProps> = ({
  application,
  branches,
  onClose,
  onConvert,
}) => {
  const suggestedUsername = useMemo(() => {
    return UserService.generateSuggestedUsername(application.fullName);
  }, [application.fullName]);

  const [name, setName] = useState(application.fullName || '');
  const [username, setUsername] = useState(suggestedUsername);
  const [password, setPassword] = useState('1234');
  const [role, setRole] = useState<UserRole>('staff');
  const [branchId, setBranchId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      alert('Lütfen kullanıcı adı belirleyin.');
      return;
    }
    if (!password.trim() || password.length < 3) {
      alert('Şifre en az 3 karakter olmalıdır.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConvert({
        name: name.trim(),
        username: username.trim().toLowerCase(),
        password: password.trim(),
        role,
        branchId: branchId || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-emerald-600/10 via-teal-600/10 to-indigo-600/10">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
              <UserCheck className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-base">
                Personel & Sistem Hesabı Oluştur
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aday işe alındı olarak işaretlenecek ve sisteme giriş yetkisi tanımlanacaktır.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Aday:</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">
                {application.fullName}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-slate-400">Pozisyon:</span>
              <span className="font-semibold text-teal-600 dark:text-teal-400">
                {application.appliedPosition || 'Belirtilmedi'}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-slate-400">Telefon:</span>
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                {application.phone}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Personel Adı - Soyadı
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Sistem Kullanıcı Adı (Küçük Harf)
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Giriş ekranında kullanılacak benzersiz takma isim.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              İlk Giriş Şifresi
            </label>
            <input
              type="text"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Kullanıcı Rolü
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="staff">Saha Elemanı / Personel</option>
                <option value="admin">Yönetici (Admin)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Şube Ataması
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Merkez / Şubesiz</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Oluşturuluyor...' : 'Personeli Onayla & Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ========================================================
// 3. CV / DOCUMENT PREVIEW MODAL
// ========================================================
interface CvModalProps {
  application: JobApplication;
  onClose: () => void;
}

const CvPreviewModal: React.FC<CvModalProps> = ({ application, onClose }) => {
  const isImage =
    application.cvFileData?.startsWith('data:image/') ||
    application.cvFileName?.match(/\.(jpg|jpeg|png|webp|gif)$/i);
  const isPdf =
    application.cvFileData?.startsWith('data:application/pdf') ||
    application.cvFileName?.endsWith('.pdf');

  const handleDownload = () => {
    if (!application.cvFileData) return;
    const link = document.createElement('a');
    link.href = application.cvFileData;
    link.download = application.cvFileName || `${application.fullName}_CV.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">
                {application.fullName} - CV & Başvuru Dosyası
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-md">
                {application.cvFileName || 'Dosya'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>İndir</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 overflow-auto flex items-center justify-center">
          {isPdf ? (
            <iframe
              src={application.cvFileData}
              title="CV Önizleme"
              className="w-full h-full rounded-2xl border border-slate-300 dark:border-slate-800 shadow-inner"
            />
          ) : isImage ? (
            <img
              src={application.cvFileData}
              alt="CV Belgesi"
              className="max-h-full max-w-full rounded-2xl object-contain shadow-lg"
            />
          ) : (
            <div className="text-center p-8">
              <FileText className="w-16 h-16 text-slate-400 mx-auto mb-3" />
              <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-1">
                Önizleme Desteklenmiyor
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Bu belge türü doğrudan tarayıcı içinde önizlenemiyor. Dosyayı cihazınıza indirerek görüntüleyebilirsiniz.
              </p>
              <button
                onClick={handleDownload}
                className="px-5 py-2.5 rounded-xl bg-teal-600 text-white font-bold text-xs"
              >
                Dosyayı İndir ({application.cvFileName})
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
