import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[BarcodeFlow ErrorBoundary Caught]:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-slate-900 border border-red-500/40 rounded-2xl m-6 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 bg-red-600/20 text-red-400 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">
            {this.props.fallbackTitle || 'Component Rendering Recovered'}
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {this.state.error?.message || 'A minor interface error occurred. Session is preserved.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 mx-auto cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload Workspace
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
