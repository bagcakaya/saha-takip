import React, { useState } from 'react';
import { Search, Plus, Clock, Check, Ban, X } from 'lucide-react';
import { LocationItem, TaskStatus } from '../../types/storage';

interface ChecklistTabProps {
  location: LocationItem;
  onUpdateStatus: (taskId: string, status: TaskStatus) => void;
  onAddCustomTask: (taskName: string) => void;
  onDeleteCustomTask: (taskId: string, taskName: string) => void;
}

export const ChecklistTab: React.FC<ChecklistTabProps> = ({
  location,
  onUpdateStatus,
  onAddCustomTask,
  onDeleteCustomTask,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [newTaskName, setNewTaskName] = useState('');

  const filteredTasks = location.tasks.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;
    onAddCustomTask(newTaskName.trim());
    setNewTaskName('');
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Task Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Görevlerde ara..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm font-medium"
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

      {/* Task List */}
      <div className="space-y-2.5 max-h-[50vh] sm:max-h-[55vh] overflow-y-auto pr-1">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs sm:text-sm">
            {searchQuery ? 'Aramaya uygun görev bulunamadı.' : 'Henüz tanımlı görev yok.'}
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              className="bg-slate-50 dark:bg-slate-900/90 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5 transition-all"
            >
              {/* Task Header */}
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                  {task.name}
                </span>
                <button
                  onClick={() => onDeleteCustomTask(task.id, task.name)}
                  className="p-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0"
                  title="Görevi Sil"
                  aria-label="Görevi Sil"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Segment Control */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-800/80 rounded-lg">
                {/* Pending */}
                <button
                  onClick={() => onUpdateStatus(task.id, 'pending')}
                  className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[11px] font-bold transition-all ${
                    task.status === 'pending'
                      ? 'bg-slate-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Clock className="w-3 h-3 shrink-0" />
                  <span className="truncate">Beklemede</span>
                </button>

                {/* Completed */}
                <button
                  onClick={() => onUpdateStatus(task.id, 'completed')}
                  className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[11px] font-bold transition-all ${
                    task.status === 'completed'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Tamamlandı</span>
                </button>

                {/* Not Present */}
                <button
                  onClick={() => onUpdateStatus(task.id, 'not_present')}
                  className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[11px] font-bold transition-all ${
                    task.status === 'not_present'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400'
                  }`}
                >
                  <Ban className="w-3 h-3 shrink-0" />
                  <span className="truncate">Mevcut Değil</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Custom Task Input */}
      <form onSubmit={handleAddCustom} className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/80">
        <input
          type="text"
          value={newTaskName}
          onChange={(e) => setNewTaskName(e.target.value)}
          placeholder="Bu kurulum için özel bir görev ekle..."
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm font-medium"
        />
        <button
          type="submit"
          disabled={!newTaskName.trim()}
          className="p-2.5 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white shadow-xs disabled:opacity-40 transition-all shrink-0"
          title="Özel Görev Ekle"
          aria-label="Özel Görev Ekle"
        >
          <Plus className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};
