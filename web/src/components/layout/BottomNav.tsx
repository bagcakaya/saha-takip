import React from 'react';
import { Home, Building2, ClipboardList, RotateCcw, ListTodo } from 'lucide-react';
import { TabType } from './Header';

interface BottomNavProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  notesCount?: number;
  returnsCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  notesCount = 0,
  returnsCount = 0,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 pb-safe shadow-lg">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1">
        {/* Tab 0: Ana Menü */}
        <button
          onClick={() => setActiveTab('home')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            activeTab === 'home'
              ? 'text-blue-600 dark:text-blue-400 font-black scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <Home className={`w-5 h-5 mb-1 ${activeTab === 'home' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] sm:text-[11px] tracking-tight">Ana Menü</span>
        </button>

        {/* Tab 1: Kurulumlar */}
        <button
          onClick={() => setActiveTab('installations')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            activeTab === 'installations'
              ? 'text-blue-600 dark:text-blue-400 font-black scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <Building2 className={`w-5 h-5 mb-1 ${activeTab === 'installations' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] sm:text-[11px] tracking-tight">Kurulumlar</span>
        </button>

        {/* Tab 2: İş Emirleri */}
        <button
          onClick={() => setActiveTab('notes')}
          className={`flex-1 flex flex-col items-center justify-center py-1 relative transition-all ${
            activeTab === 'notes'
              ? 'text-blue-600 dark:text-blue-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <div className="relative">
            <ClipboardList className={`w-5 h-5 mb-1 ${activeTab === 'notes' ? 'stroke-[2.5]' : ''}`} />
            {notesCount > 0 && (
              <span className="absolute -top-1 -right-2 w-4 h-4 bg-blue-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                {notesCount > 9 ? '9+' : notesCount}
              </span>
            )}
          </div>
          <span className="text-[10px] sm:text-[11px] tracking-tight">İş Emirleri</span>
        </button>

        {/* Tab 3: İade/Garanti */}
        <button
          onClick={() => setActiveTab('returns')}
          className={`flex-1 flex flex-col items-center justify-center py-1 relative transition-all ${
            activeTab === 'returns'
              ? 'text-blue-600 dark:text-blue-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <div className="relative">
            <RotateCcw className={`w-5 h-5 mb-1 ${activeTab === 'returns' ? 'stroke-[2.5]' : ''}`} />
            {returnsCount > 0 && (
              <span className="absolute -top-1 -right-2 w-4 h-4 bg-amber-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                {returnsCount > 9 ? '9+' : returnsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] sm:text-[11px] tracking-tight">İade/Garanti</span>
        </button>

        {/* Tab 4: Şablon */}
        <button
          onClick={() => setActiveTab('template')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-all ${
            activeTab === 'template'
              ? 'text-blue-600 dark:text-blue-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <ListTodo className={`w-5 h-5 mb-1 ${activeTab === 'template' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] sm:text-[11px] tracking-tight">Şablon</span>
        </button>
      </div>
    </nav>
  );
};
