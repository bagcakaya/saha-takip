import React, { useState, useEffect } from 'react';
import { Company } from '../../types/auth';
import { CompanyService } from '../../services/companyService';

interface CompanySelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCompanyCode: string;
  onSelectCompany: (companyCode: string) => void;
}

export const CompanySelectModal: React.FC<CompanySelectModalProps> = ({
  isOpen,
  onClose,
  currentCompanyCode,
  onSelectCompany,
}) => {
  const [companies, setCompanies] = useState<Company[]>(() => CompanyService.getCompaniesLocal());
  const [selectedCode, setSelectedCode] = useState<string>(() => {
    return (currentCompanyCode || 'POLATLAR').trim().toUpperCase();
  });

  useEffect(() => {
    if (isOpen) {
      const local = CompanyService.getCompaniesLocal();
      if (local && local.length > 0) {
        setCompanies(local);
      }
      CompanyService.fetchCompanies().then((fresh) => {
        if (fresh && fresh.length > 0) {
          setCompanies(fresh);
        }
      }).catch(() => {});
      setSelectedCode((currentCompanyCode || 'POLATLAR').trim().toUpperCase());
    }
  }, [isOpen, currentCompanyCode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onSelectCompany(selectedCode);
    onClose();
  };

  // Ensure POLATLAR is always first, then sort by id or name
  const sortedCompanies = [...companies].sort((a, b) => {
    if (a.code.toUpperCase() === 'POLATLAR') return -1;
    if (b.code.toUpperCase() === 'POLATLAR') return 1;
    return a.id - b.id;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm sm:max-w-md bg-slate-900/95 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 text-white animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Company Radio List matching Görsel-2 */}
        <div className="space-y-3 pt-2">
          {sortedCompanies.map((c) => {
            const isSelected = selectedCode === c.code.toUpperCase();
            return (
              <div
                key={c.code}
                onClick={() => setSelectedCode(c.code.toUpperCase())}
                className="flex items-center gap-3.5 p-3 rounded-2xl cursor-pointer hover:bg-slate-800/60 transition-colors select-none group"
              >
                {/* Radio Circle */}
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-transparent'
                      : 'border-slate-600 bg-transparent group-hover:border-slate-400'
                  }`}
                >
                  {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                </div>

                {/* Company Label */}
                <span className="text-sm sm:text-base font-medium text-slate-100 group-hover:text-white transition-colors">
                  {c.name} ({c.code.toUpperCase()})
                </span>
              </div>
            );
          })}
        </div>

        {/* Action Button matching Görsel-2: Tamam */}
        <div className="pt-2 flex justify-center">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full sm:w-auto min-w-[140px] py-2.5 px-8 text-center text-white hover:text-blue-400 font-bold text-base transition-colors cursor-pointer select-none"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
