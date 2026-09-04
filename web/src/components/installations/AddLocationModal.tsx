import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { MessageCircle } from 'lucide-react';
import { WhatsappService } from '../../services/whatsappService';
import { useAuth } from '../../context/AuthContext';

interface AddLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string) => Promise<void>;
}

export const AddLocationModal: React.FC<AddLocationModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const locName = name.trim();
    if (!locName) return;

    try {
      setIsSubmitting(true);
      await onAdd(locName);
      if (notifyWhatsapp) {
        WhatsappService.shareLocation({
          locationName: locName,
          staffName: user?.name || user?.username || 'Saha Yetkilisi',
        });
      }
      setName('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Yeni Kurulum Yeri">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Firma / Lokasyon Adı
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn: Merkez Ofis, X Restoran, Y Plaza"
            autoFocus
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
          />
        </div>

        {/* WhatsApp Notification Option */}
        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80 cursor-pointer transition-colors hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40">
          <input
            type="checkbox"
            checked={notifyWhatsapp}
            onChange={(e) => setNotifyWhatsapp(e.target.checked)}
            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
          />
          <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
            Eklendiğinde WhatsApp ile Bildir
          </span>
        </label>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm font-semibold transition-colors"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={!name.trim() || isSubmitting}
            className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
          >
            {isSubmitting ? (
              'Ekleniyor...'
            ) : (
              <>
                <MessageCircle className="w-4 h-4" />
                <span>Kaydet {notifyWhatsapp ? '& Gönder' : ''}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
