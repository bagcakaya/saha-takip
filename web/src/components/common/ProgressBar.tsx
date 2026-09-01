import React from 'react';

interface ProgressBarProps {
  completedPct: number;
  notPresentPct: number;
  height?: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  completedPct,
  notPresentPct,
  height = 'h-2.5',
  className = '',
}) => {
  return (
    <div
      className={`w-full ${height} rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex ${className}`}
    >
      <div
        style={{ width: `${Math.min(100, Math.max(0, completedPct))}%` }}
        className="bg-emerald-500 transition-all duration-300 ease-out h-full"
        title={`Tamamlanan: %${Math.round(completedPct)}`}
      />
      <div
        style={{ width: `${Math.min(100 - completedPct, Math.max(0, notPresentPct))}%` }}
        className="bg-amber-500 transition-all duration-300 ease-out h-full"
        title={`Mevcut Değil: %${Math.round(notPresentPct)}`}
      />
    </div>
  );
};
