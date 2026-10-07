import React, { useEffect, useState } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
  fullScreen?: boolean;
  fullScreenOnMobile?: boolean;
  allowMaximize?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
  fullScreen = false,
  fullScreenOnMobile = false,
  allowMaximize = true,
}) => {
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [viewportOffsetTop, setViewportOffsetTop] = useState<number>(0);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      setIsMaximized(false);
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

  const isFull = fullScreen || isMaximized;
  const isFullMobile = fullScreenOnMobile || isFull;

  return (
    <div
      className={`fixed inset-x-0 z-50 flex ${
        isFull
          ? 'items-stretch p-0'
          : isFullMobile
          ? 'items-stretch sm:items-center p-0 sm:p-4'
          : 'items-end sm:items-center p-0 sm:p-4'
      } justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-hidden`}
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
        className={`relative w-full ${
          isFull
            ? 'max-w-none h-full rounded-none border-0'
            : isFullMobile
            ? `${maxWidth} h-full sm:h-auto rounded-none sm:rounded-2xl border-0 sm:border`
            : `${maxWidth} rounded-t-2xl sm:rounded-2xl border-t sm:border`
        } bg-white dark:bg-slate-800 shadow-2xl flex flex-col border-slate-200 dark:border-slate-700 z-10 animate-in ${
          isFullMobile ? 'fade-in sm:zoom-in-95' : 'slide-in-from-bottom-4 sm:zoom-in-95'
        } duration-200 overflow-hidden`}
        style={{
          maxHeight: isFull
            ? '100dvh'
            : isFullMobile
            ? (viewportHeight ? `${viewportHeight}px` : '100dvh')
            : (viewportHeight ? `${Math.min(viewportHeight, window.innerHeight * 0.9)}px` : '90dvh'),
        }}
      >
        {title && (
          <div className={`flex items-center justify-between px-5 ${
            isFullMobile ? 'py-3 sm:py-4 pt-safe sm:pt-4' : 'py-3.5 sm:py-4'
          } border-b border-slate-100 dark:border-slate-700/60 shrink-0 bg-slate-50/50 dark:bg-slate-800/80`}>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate pr-2">
              {title}
            </h3>
            <div className="flex items-center gap-1 shrink-0">
              {allowMaximize && !fullScreen && (
                <button
                  type="button"
                  onClick={() => setIsMaximized((prev) => !prev)}
                  className="hidden sm:inline-flex p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                  title={isMaximized ? 'Küçült' : 'Tam Ekran'}
                  aria-label={isMaximized ? 'Küçült' : 'Tam Ekran'}
                >
                  {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                aria-label="Kapat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
        <div className={`flex-1 overflow-y-auto p-4 sm:p-5 overscroll-contain ${
          isFullMobile ? 'pb-safe' : ''
        }`}>
          {children}
        </div>
      </div>
    </div>
  );
};
