import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
}) => {
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [viewportOffsetTop, setViewportOffsetTop] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle virtual keyboard viewport resizing on mobile devices
  useEffect(() => {
    if (!isOpen) return;

    const handleViewportChange = () => {
      if (typeof window !== 'undefined' && window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
        setViewportOffsetTop(window.visualViewport.offsetTop);
      }
    };

    handleViewportChange();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', handleViewportChange);
      vv.addEventListener('scroll', handleViewportChange);
    }

    return () => {
      if (vv) {
        vv.removeEventListener('resize', handleViewportChange);
        vv.removeEventListener('scroll', handleViewportChange);
      }
    };
  }, [isOpen]);

  // Smoothly scroll focused input into center of modal view when keyboard appears
  useEffect(() => {
    if (!isOpen) return;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 250);
      }
    };

    window.addEventListener('focusin', handleFocusIn);
    return () => {
      window.removeEventListener('focusin', handleFocusIn);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-x-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-hidden"
      style={{
        top: `${viewportOffsetTop}px`,
        height: viewportHeight ? `${viewportHeight}px` : '100dvh',
        maxHeight: viewportHeight ? `${viewportHeight}px` : '100dvh',
      }}
    >
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative w-full ${maxWidth} bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col border-t sm:border border-slate-200 dark:border-slate-700 z-10 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 overflow-hidden`}
        style={{
          maxHeight: viewportHeight ? `${Math.min(viewportHeight, window.innerHeight * 0.9)}px` : '90dvh',
        }}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-700/60 shrink-0">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate pr-2">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors shrink-0"
              aria-label="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
};
