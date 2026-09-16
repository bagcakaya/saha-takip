import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  MapPin,
  Users,
  ExternalLink,
  Edit3,
  Trash2,
  Phone,
  Compass,
} from 'lucide-react';
import { useStorage } from '../context/StorageContext';
import { useAuth } from '../context/AuthContext';
import { isUserAdmin } from '../types/auth';
import { Branch } from '../types/storage';
import { LocationService } from '../services/locationService';
import { BranchModal } from '../components/branches/BranchModal';
import { BranchStaffModal } from '../components/branches/BranchStaffModal';

export const BranchesView: React.FC = () => {
  const { user, users } = useAuth();
  const {
    branches,
    addBranch,
    updateBranch,
    deleteBranch,
    assignStaffToBranch,
    attendanceRecords,
  } = useStorage();

  const isAdmin = isUserAdmin(user);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [assigningBranch, setAssigningBranch] = useState<Branch | null>(null);

  // User's current GPS position for live distance calculation to all branches
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    LocationService.getCurrentPosition()
      .then((pos) => {
        setUserCoords({ lat: pos.latitude, lon: pos.longitude });
      })
      .catch(() => {
        // Silently ignore if permission denied
      });
  }, []);

  // Today's attendance calculation
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const activeStaffToday = useMemo(() => {
    return attendanceRecords.filter(
      (r) => r.date === todayStr && r.status === 'checked_in'
    );
  }, [attendanceRecords, todayStr]);

  // Company users map
  const usersMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [users]);

  // Total assigned staff across all branches
  const totalAssignedStaffCount = useMemo(() => {
    const set = new Set<string>();
    branches.forEach((b) => {
      (b.assignedUserIds || []).forEach((uid) => set.add(uid));
    });
    return set.size;
  }, [branches]);

  // Filtered branches
  const filteredBranches = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return branches;
    return branches.filter((b) => {
      const matchName = b.name.toLowerCase().includes(q);
      const matchAddress = (b.address || '').toLowerCase().includes(q);
      const matchStaff = (b.assignedUserIds || []).some((uid) =>
        (usersMap.get(uid) || '').toLowerCase().includes(q)
      );
      return matchName || matchAddress || matchStaff;
    });
  }, [branches, searchQuery, usersMap]);

  const handleDelete = async (b: Branch) => {
    if (
      !window.confirm(
        `"${b.name}" şubesini silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz.`
      )
    ) {
      return;
    }
    try {
      await deleteBranch(b.id);
    } catch (e) {
      console.error('Şube silinirken hata oluştu:', e);
    }
  };

  if (!isAdmin) {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-3xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-sm">
          <Building2 className="w-8 h-8" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
            Yetkisiz Erişim
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            Şubeler ve şube mesai alanı yönetimi yalnızca şirket yöneticilerine açıktır.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* 1. Header Banner & Top Stats */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-blue-800/50">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-blue-500/25 text-blue-300 border border-blue-400/30 backdrop-blur-xs flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Şube Yönetim Sistemi
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/10 text-slate-300">
                20m Mesai Yarıçapı
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Firma Şubeleri & Personel Atamaları
            </h1>
            <p className="text-xs sm:text-sm text-blue-200/90 max-w-xl leading-relaxed">
              Her şubenin konumunu belirleyebilir, personelleri kendi şubesine atayabilir ve personelin sadece kendi şubesinin 20 metre çapında mesaiye başlamasını sağlayabilirsiniz.
            </p>
          </div>

          {/* Quick Stats Badges */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="px-4 py-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center min-w-[95px]">
              <span className="text-[10px] font-bold text-blue-200 block uppercase">Toplam Şube</span>
              <span className="text-2xl font-black text-white">{branches.length}</span>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center min-w-[95px]">
              <span className="text-[10px] font-bold text-indigo-200 block uppercase">Atanmış Personel</span>
              <span className="text-2xl font-black text-indigo-300">{totalAssignedStaffCount}</span>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center min-w-[95px]">
              <span className="text-[10px] font-bold text-emerald-200 block uppercase">Bugün Mesaide</span>
              <span className="text-2xl font-black text-emerald-300">{activeStaffToday.length}</span>
            </div>
          </div>
        </div>

        {/* Decorative ambient blobs */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -top-10 w-48 h-48 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none" />
      </div>

      {/* 2. Actions & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Şube adı, adres veya personel ara..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 shadow-xs focus:ring-2 focus:ring-blue-500 outline-hidden transition-all"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        </div>

        {/* Add Branch Button (Admins) */}
        {isAdmin && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-black shadow-lg shadow-blue-500/25 transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Şube Ekle</span>
          </button>
        )}
      </div>

      {/* 3. Branch Cards Grid */}
      {filteredBranches.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
              {searchQuery ? 'Aramanızla eşleşen şube bulunamadı' : 'Henüz Şube Eklenmedi'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {searchQuery
                ? 'Farklı bir arama terimi deneyin veya filtreyi temizleyin.'
                : 'Firmanızın şubelerini tanımlayarak personelleri şubelere atayabilir ve 20 metre yarıçapında mesai doğrulaması başlatabilirsiniz.'}
            </p>
          </div>
          {isAdmin && !searchQuery && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-500/25 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>İlk Şubeyi Ekle</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredBranches.map((branch) => {
            const assignedCount = (branch.assignedUserIds || []).length;
            const isUserAssignedHere =
              user?.id && (branch.assignedUserIds || []).includes(user.id);

            // Calculate distance to current user position
            let distanceToUser: number | null = null;
            if (userCoords && branch.latitude && branch.longitude) {
              distanceToUser = LocationService.calculateDistance(
                userCoords.lat,
                userCoords.lon,
                branch.latitude,
                branch.longitude
              );
            }

            const isUserInside20m =
              distanceToUser !== null && distanceToUser <= (branch.radiusMeters || 20);

            return (
              <div
                key={branch.id}
                className="group relative flex flex-col justify-between rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-sm hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-800 transition-all duration-200"
              >
                <div className="space-y-4">
                  {/* Card Header: Icon, Name & Radius Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5 leading-tight">
                          <span>{branch.name}</span>
                          {isUserAssignedHere && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              Şubeniz
                            </span>
                          )}
                        </h3>
                        <span className="text-[11px] font-bold text-slate-400">
                          {branch.companyCode}
                        </span>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                      {branch.radiusMeters || 20}m Alan
                    </span>
                  </div>

                  {/* Address */}
                  <div className="space-y-1">
                    <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{branch.address || 'Adres belirtilmemiş'}</span>
                    </div>

                    {branch.phone && (
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{branch.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Live Distance from current user */}
                  {distanceToUser !== null && (
                    <div
                      className={`p-2.5 rounded-2xl text-xs font-bold flex items-center justify-between border ${
                        isUserInside20m
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Compass className={`w-4 h-4 ${isUserInside20m ? 'text-emerald-600 animate-spin' : 'text-slate-400'}`} />
                        <span>Şubeye Mesafeniz:</span>
                      </div>
                      <span className="font-extrabold font-mono">
                        {LocationService.formatDistance(distanceToUser)}
                        {isUserInside20m && ' (Alanın İçindesiniz)'}
                      </span>
                    </div>
                  )}

                  {/* Assigned Personnel Chips */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                        Atanmış Personeller
                      </span>
                      <span className="text-[11px] text-slate-400 font-semibold">
                        {assignedCount} Kişi
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                      {assignedCount === 0 ? (
                        <span className="text-[11px] text-slate-400 italic">
                          Henüz bu şubeye personel atanmadı.
                        </span>
                      ) : (
                        branch.assignedUserIds.slice(0, 4).map((uid) => (
                          <span
                            key={uid}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            {usersMap.get(uid) || 'Personel'}
                          </span>
                        ))
                      )}
                      {assignedCount > 4 && (
                        <span className="px-2 py-1 rounded-xl text-[11px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                          +{assignedCount - 4} daha
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      LocationService.openInGoogleMaps(
                        branch.address,
                        branch.latitude,
                        branch.longitude
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Google Maps üzerinde göster"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Harita</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => setAssigningBranch(branch)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-xs font-bold transition-all cursor-pointer"
                          title="Personel Ata"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Personel</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingBranch(branch)}
                          className="p-1.5 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Şubeyi Düzenle"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(branch)}
                          className="p-1.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Şubeyi Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Modals */}
      {/* Create / Edit Branch Modal */}
      <BranchModal
        isOpen={isAddModalOpen || !!editingBranch}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingBranch(null);
        }}
        branchToEdit={editingBranch}
        onSave={async (data) => {
          if (editingBranch) {
            await updateBranch(editingBranch.id, data);
          } else {
            await addBranch(data);
          }
        }}
      />

      {/* Quick Staff Assign Modal */}
      <BranchStaffModal
        isOpen={!!assigningBranch}
        onClose={() => setAssigningBranch(null)}
        branch={assigningBranch}
        onSave={async (branchId, userIds) => {
          await assignStaffToBranch(branchId, userIds);
        }}
      />
    </div>
  );
};
