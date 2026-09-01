import React, { useState } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  Key,
  Shield,
  User as UserIcon,
  Crown,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/auth';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user: currentUser, users, addUser, updateUser, deleteUser } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<'list' | 'add'>('list');

  // Form states for adding user
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('staff');
  const [formMsg, setFormMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // States for password edit modal/prompt
  const [editingPasswordUserId, setEditingPasswordUserId] = useState<string | null>(null);
  const [changedPassword, setChangedPassword] = useState('');

  if (!isOpen) return null;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);

    const res = addUser({
      username: newUsername,
      password: newPassword,
      name: newName,
      role: newRole,
    });

    if (res.success) {
      setFormMsg({ type: 'success', text: `"${newUsername}" kullanıcısı başarıyla eklendi.` });
      setNewUsername('');
      setNewPassword('');
      setNewName('');
      setNewRole('staff');
      setTimeout(() => {
        setActiveSubTab('list');
        setFormMsg(null);
      }, 1200);
    } else {
      setFormMsg({ type: 'error', text: res.error || 'Kullanıcı eklenemedi.' });
    }
  };

  const handleRoleToggle = (userId: string, currentRole: UserRole) => {
    const nextRole: UserRole = currentRole === 'admin' ? 'staff' : 'admin';
    const roleName = nextRole === 'admin' ? 'Sistem Yöneticisi (Admin)' : 'Saha Yetkilisi';

    if (
      window.confirm(
        `Bu kullanıcının yetkisini "${roleName}" olarak değiştirmek istediğinize emin misiniz?`
      )
    ) {
      const res = updateUser(userId, { role: nextRole });
      if (!res.success && res.error) {
        alert(res.error);
      }
    }
  };

  const handleSaveNewPassword = (userId: string) => {
    if (!changedPassword || changedPassword.length < 3) {
      alert('Şifre en az 3 karakter olmalıdır.');
      return;
    }
    const res = updateUser(userId, { password: changedPassword });
    if (res.success) {
      alert('Şifre başarıyla güncellendi.');
      setEditingPasswordUserId(null);
      setChangedPassword('');
    } else {
      alert(res.error || 'Şifre güncellenemedi.');
    }
  };

  const handleDelete = (userId: string, username: string) => {
    if (
      window.confirm(
        `"${username}" kullanıcısını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
      )
    ) {
      const res = deleteUser(userId);
      if (!res.success && res.error) {
        alert(res.error);
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Kullanıcı ve Yetki Yönetimi" maxWidth="max-w-2xl">
      <div className="space-y-4">
        {/* Sub Tabs */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/80">
          <button
            onClick={() => {
              setActiveSubTab('list');
              setFormMsg(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'list'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Kullanıcı Listesi ({users.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveSubTab('add');
              setFormMsg(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'add'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Yeni Kullanıcı Ekle</span>
          </button>
        </div>

        {/* Tab 1: Users List */}
        {activeSubTab === 'list' && (
          <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
            {users.map((account) => {
              const isAdmin = account.role === 'admin';
              const isCurrent = currentUser?.id === account.id;

              return (
                <div
                  key={account.id}
                  className="bg-slate-50 dark:bg-slate-900/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 space-y-3 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* User Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 ${
                          isAdmin
                            ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-xs'
                            : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                        }`}
                      >
                        {isAdmin ? <Crown className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {account.name}
                          </h4>
                          {isCurrent && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                              Siz
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 font-mono block truncate">
                          @{account.username}
                        </span>
                      </div>
                    </div>

                    {/* Role Pill */}
                    <button
                      onClick={() => handleRoleToggle(account.id, account.role)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border shrink-0 ${
                        isAdmin
                          ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/80 hover:bg-amber-100'
                          : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/80 hover:bg-blue-100'
                      }`}
                      title="Yetkiyi Değiştirmek İçin Tıklayın"
                    >
                      {isAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                      <span>{isAdmin ? 'Yönetici (Admin)' : 'Saha Yetkilisi'}</span>
                    </button>
                  </div>

                  {/* Password Changer inline box */}
                  {editingPasswordUserId === account.id ? (
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <input
                        type="password"
                        value={changedPassword}
                        onChange={(e) => setChangedPassword(e.target.value)}
                        placeholder="Yeni şifre belirleyin..."
                        autoFocus
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => handleSaveNewPassword(account.id)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-xs"
                      >
                        Kaydet
                      </button>
                      <button
                        onClick={() => {
                          setEditingPasswordUserId(null);
                          setChangedPassword('');
                        }}
                        className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-xs font-semibold"
                      >
                        İptal
                      </button>
                    </div>
                  ) : null}

                  {/* Actions Row */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                    <span className="text-[11px] text-slate-400">
                      Eklenme: {new Date(account.createdAt).toLocaleDateString('tr-TR')}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditingPasswordUserId(
                            editingPasswordUserId === account.id ? null : account.id
                          );
                          setChangedPassword('');
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80 font-semibold transition-colors"
                      >
                        <Key className="w-3.5 h-3.5 text-amber-500" />
                        <span>Şifre Belirle</span>
                      </button>

                      <button
                        onClick={() => handleDelete(account.id, account.username)}
                        className="p-1.5 rounded-lg text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                        title="Kullanıcıyı Sil"
                        aria-label="Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Add User Form */}
        {activeSubTab === 'add' && (
          <form onSubmit={handleAddSubmit} className="space-y-4">
            {formMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  formMsg.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                }`}
              >
                {formMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                ) : null}
                <span>{formMsg.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Username */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Kullanıcı Adı (Giriş için)
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Örn: ahmet, burak, mert"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Giriş Şifresi
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="En az 3 karakter"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Ad Soyad / Unvan
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Örn: Ahmet Yılmaz"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Yetki Seviyesi (Rol)
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="staff">Saha Yetkilisi (Kurulum & Raporlama)</option>
                  <option value="admin">Sistem Yöneticisi (Admin - Tam Yetkili)</option>
                </select>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <span className="font-bold text-blue-700 dark:text-blue-300 block mb-1">
                Yetki Bilgilendirmesi:
              </span>
              • <strong>Sistem Yöneticisi (Admin)</strong>: Diğer kullanıcıları yönetebilir, yeni kullanıcılar ekleyebilir ve yetkilerini değiştirebilir.
              <br />• <strong>Saha Yetkilisi</strong>: Kurulumları, notları ve şablonları yönetebilir fakat Kullanıcı Yönetim Paneline erişemez.
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white text-xs sm:text-sm font-extrabold shadow-md transition-all active:scale-[0.99]"
            >
              Kullanıcıyı Kaydet
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
};
