import React from 'react';
import { Sparkles, Sun, Moon, Sunset, CloudRain, Snowflake } from 'lucide-react';
import { TimeOfDay, WeatherCondition } from '../../types/auth';

interface WeatherSwitcherProps {
  currentMode: string;
  onSelectMode: (
    mode: 'auto' | 'night' | 'day' | 'sunset' | 'rain' | 'snow',
    timeOfDay?: TimeOfDay,
    condition?: WeatherCondition
  ) => void;
}

export const WeatherSwitcher: React.FC<WeatherSwitcherProps> = ({
  currentMode,
  onSelectMode,
}) => {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 p-1.5 rounded-2xl bg-black/40 backdrop-blur-md border border-white/15 text-white shadow-2xl text-[11px] font-bold max-w-[95vw] overflow-x-auto">
      {/* Auto */}
      <button
        onClick={() => onSelectMode('auto')}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all shrink-0 ${
          currentMode === 'auto'
            ? 'bg-white/30 text-white shadow-xs'
            : 'text-white/70 hover:text-white hover:bg-white/10'
        }`}
        title="Canlı Konum ve Saate Göre Otomatik"
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
        <span>Otomatik Canlı</span>
      </button>

      {/* Night + Shooting Stars */}
      <button
        onClick={() => onSelectMode('night', 'night', 'clear')}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all shrink-0 ${
          currentMode === 'night'
            ? 'bg-blue-600/80 text-white shadow-xs'
            : 'text-white/70 hover:text-white hover:bg-white/10'
        }`}
        title="Yıldızlı & Kayan Yıldızlı Gece"
      >
        <Moon className="w-3.5 h-3.5 text-blue-300" />
        <span>Gece & Kayan Yıldız</span>
      </button>

      {/* Day */}
      <button
        onClick={() => onSelectMode('day', 'day', 'clear')}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all shrink-0 ${
          currentMode === 'day'
            ? 'bg-sky-500/80 text-white shadow-xs'
            : 'text-white/70 hover:text-white hover:bg-white/10'
        }`}
        title="Açık Güneşli Gündüz"
      >
        <Sun className="w-3.5 h-3.5 text-amber-300" />
        <span>Gündüz</span>
      </button>

      {/* Sunset */}
      <button
        onClick={() => onSelectMode('sunset', 'sunset', 'clear')}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all shrink-0 ${
          currentMode === 'sunset'
            ? 'bg-orange-600/80 text-white shadow-xs'
            : 'text-white/70 hover:text-white hover:bg-white/10'
        }`}
        title="Alacakaranlık Günbatımı"
      >
        <Sunset className="w-3.5 h-3.5 text-orange-300" />
        <span>Günbatımı</span>
      </button>

      {/* Rain */}
      <button
        onClick={() => onSelectMode('rain', 'day', 'rain')}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all shrink-0 ${
          currentMode === 'rain'
            ? 'bg-slate-700/80 text-white shadow-xs'
            : 'text-white/70 hover:text-white hover:bg-white/10'
        }`}
        title="Yağmur Yağışlı"
      >
        <CloudRain className="w-3.5 h-3.5 text-cyan-300" />
        <span>Yağmur</span>
      </button>

      {/* Snow */}
      <button
        onClick={() => onSelectMode('snow', 'night', 'snow')}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all shrink-0 ${
          currentMode === 'snow'
            ? 'bg-indigo-600/80 text-white shadow-xs'
            : 'text-white/70 hover:text-white hover:bg-white/10'
        }`}
        title="Kar Yağışlı"
      >
        <Snowflake className="w-3.5 h-3.5 text-indigo-200" />
        <span>Kar</span>
      </button>
    </div>
  );
};
