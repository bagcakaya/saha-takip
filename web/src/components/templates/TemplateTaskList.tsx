import React, { useState } from 'react';
import { Search, Plus, Trash2, X, Info } from 'lucide-react';
import { useStorage } from '../../context/StorageContext';

export const TemplateTaskList: React.FC = () => {
  const {
    standardTasks,
    addStandardTask,
    deleteStandardTask,
    resetStandardTasks,
  } = useStorage();

  const [searchQuery, setSearchQuery] = useState('');
  const [newTaskName, setNewTaskName] = useState('');

  const filteredTasks = standardTasks.filter((t) =>
    t.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;

    if (standardTasks.some((t) => t.toLowerCase() === newTaskName.trim().toLowerCase())) {
      alert('Bu görev zaten şablonda mevcut.');
      return;
    }

    addStandardTask(newTaskName.trim());
    setNewTaskName('');
  };

  const handleDelete = (index: number, taskName: string) => {
    if (
      window.confirm(
        `"${taskName}" görevini şablondan silmek istediğinize emin misiniz?\n\n*Bu işlem mevcut lokasyonlardaki görevleri etkilemez, sadece yeni oluşturulacak yerleri etkiler.`
      )
    ) {
      deleteStandardTask(index);
    }
  };

  return (
    <div className="space-y-4">
      {/* Info Card */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50">
        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Burada tanımladığınız standart görev listesi, ekleyeceğiniz her yeni kurulum yeri için otomatik olarak kopyalanacaktır. Mevcut kurulum yerlerindeki görevler bu listeden etkilenmez.
        </p>
      </div>

      {/* Search Input */}
      {standardTasks.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Şablon görevlerde ara..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm font-medium shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Task List */}
      <div className="space-y-2">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-10 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-6">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1">
              {searchQuery ? 'Aramayla eşleşen şablon görev bulunamadı.' : 'Şablonda görev bulunmuyor.'}
            </span>
            <span className="text-xs text-slate-400 block mb-4">
              {searchQuery ? 'Lütfen arama teriminizi kontrol edin.' : 'Aşağıdaki alandan yeni standart görev ekleyebilir veya varsayılanları yükleyebilirsiniz.'}
            </span>
            {!searchQuery && (
              <button
                onClick={resetStandardTasks}
                className="px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                Varsayılan 12 Görevi Yükle
              </button>
            )}
          </div>
        ) : (
          filteredTasks.map((task) => {
            const originalIndex = standardTasks.indexOf(task);
            return (
              <div
                key={`${task}-${originalIndex}`}
                className="flex items-center justify-between gap-3 p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs"
              >
                <span className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">
                  {task}
                </span>

                <button
                  onClick={() => handleDelete(originalIndex, task)}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0"
                  title="Görevi Sil"
                  aria-label="Görevi Sil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Add Standard Task Input */}
      <form onSubmit={handleAdd} className="flex items-center gap-2 pt-2">
        <input
          type="text"
          value={newTaskName}
          onChange={(e) => setNewTaskName(e.target.value)}
          placeholder="Yeni standart şablon görevi ekle..."
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm font-medium shadow-xs"
        />
        <button
          type="submit"
          disabled={!newTaskName.trim()}
          className="p-3 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white shadow-md disabled:opacity-40 transition-all shrink-0"
          title="Şablona Ekle"
          aria-label="Şablona Ekle"
        >
          <Plus className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};
