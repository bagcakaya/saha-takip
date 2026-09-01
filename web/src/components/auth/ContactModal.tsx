import React from 'react';
import { User, Phone, Mail, Globe, X, ExternalLink, MessageCircle } from 'lucide-react';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Modal Card */}
      <div
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
              İletişim & Destek
            </h3>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Polatlar Yazılım İletişim Bilgileri
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contact Cards List (Matches User's UI) */}
        <div className="space-y-3">
          {/* 1. Ad Soyad */}
          <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 shadow-xs">
            <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block uppercase tracking-wide">
                Ad Soyad
              </span>
              <span className="text-sm font-black text-slate-900 dark:text-slate-100 block truncate">
                MURAT POLAT
              </span>
            </div>
          </div>

          {/* 2. Telefon (WhatsApp) */}
          <a
            href="https://wa.me/905336082353?text=Merhaba,%20Saha%20Takip%20Raporu%20hakkında%20bilgi%20almak%20istiyorum."
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/40 hover:bg-blue-100/80 dark:hover:bg-blue-900/50 border border-blue-100 dark:border-blue-900/60 shadow-xs transition-all group"
            title="WhatsApp Mesaj Gönder"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Phone className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Telefon
                  </span>
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    <MessageCircle className="w-2.5 h-2.5" /> WhatsApp
                  </span>
                </div>
                <span className="text-sm font-black text-blue-600 dark:text-blue-400 block tracking-wider">
                  0533 608 23 53
                </span>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-blue-500 opacity-60 group-hover:opacity-100 transition-opacity" />
          </a>

          {/* 3. E-posta (Gmail) */}
          <a
            href="https://mail.google.com/mail/?view=cm&fs=1&to=polatdg@hotmail.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 hover:bg-blue-50/60 dark:hover:bg-slate-700/80 border border-slate-100 dark:border-slate-700/60 shadow-xs transition-all group"
            title="Gmail Gönder"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Mail className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  E-posta
                </span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400 block truncate">
                  polatdg@hotmail.com
                </span>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-blue-500 opacity-60 group-hover:opacity-100 transition-opacity" />
          </a>

          {/* 4. Web Sitesi */}
          <a
            href="https://www.polatlaryazilim.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 hover:bg-blue-50/60 dark:hover:bg-slate-700/80 border border-slate-100 dark:border-slate-700/60 shadow-xs transition-all group"
            title="Web Sitesini Ziyaret Et"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Globe className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Web Sitesi
                </span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400 block truncate">
                  https://www.polatlaryazilim.com
                </span>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-blue-500 opacity-60 group-hover:opacity-100 transition-opacity" />
          </a>
        </div>

        {/* Close Button */}
        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-3 px-4 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold transition-colors shadow-xs"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
