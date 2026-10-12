import React from 'react';
import { Sparkles } from 'lucide-react';

interface AiFloatingButtonProps {
  onClick: () => void;
}

export const AiFloatingButton: React.FC<AiFloatingButtonProps> = ({ onClick }) => {
  return (
    <div className="fixed bottom-6 right-5 z-40">
      <button
        type="button"
        onClick={onClick}
        className="group relative flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white shadow-xl shadow-indigo-500/35 hover:shadow-indigo-500/50 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border border-white/25"
        title="Yapay Zekâ Asistanını Başlat (Sesle veya Yazıyla)"
      >
        {/* Glow effect animation */}
        <span className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 opacity-40 blur-xs group-hover:opacity-75 transition-opacity duration-300 animate-pulse" />

        <div className="relative flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-yellow-300 animate-bounce" />
        </div>

        <span className="relative text-xs font-black tracking-tight drop-shadow-xs flex items-center gap-1.5">
          <span>AI Asistan</span>
          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-md bg-white/20 text-[9px] font-extrabold uppercase tracking-wider">
            Ücretsiz
          </span>
        </span>
      </button>
    </div>
  );
};
