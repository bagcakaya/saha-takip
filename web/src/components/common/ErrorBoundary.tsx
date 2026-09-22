import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl sm:rounded-3xl bg-slate-900 text-white p-6 shadow-2xl border border-rose-500/40 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center border border-rose-500/30">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">
                {this.props.fallbackTitle || 'Sayfa Yüklenirken Bir Sorun Oluştu'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Veriler güncellenirken beklenmedik bir durum oluştu. Ekranı yenileyebilir veya doğrudan ana menüye dönebilirsiniz.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Ana Menüye Dön</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Yenile</span>
              </button>
            </div>

            {/* Expandable Technical Details for diagnostics */}
            {this.state.error && (
              <div className="pt-2 border-t border-slate-800 text-left">
                <button
                  type="button"
                  onClick={this.toggleDetails}
                  className="flex items-center justify-between w-full text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition"
                >
                  <span>Teknik Hata Detayı</span>
                  {this.state.showDetails ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {this.state.showDetails && (
                  <pre className="mt-2 p-3 rounded-xl bg-slate-950 text-[10px] text-rose-300 font-mono overflow-x-auto whitespace-pre-wrap max-h-40 border border-slate-800">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
