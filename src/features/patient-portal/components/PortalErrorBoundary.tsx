/**
 * PortalErrorBoundary — Patient portal error boundary
 * Catches JS errors in portal sections + logs to Cloud Logs
 * RDC 978 Art. 167 — Error handling with audit trail
 *
 * Usage:
 *   <PortalErrorBoundary>
 *     <PatientPortalDashboard />
 *   </PortalErrorBoundary>
 */

import React, { Component, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  errorId: string;
}

export class PortalErrorBoundary extends Component<Props, State> {
  private resetTimeoutId?: NodeJS.Timeout;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: '',
    };
  }

  static getDerivedStateFromError(error: Error): Pick<State, 'hasError' | 'error'> {
    return {
      hasError: true,
      error,
    };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.setState({ errorInfo, errorId });

    // Log to Cloud Logs
    console.error('[PortalErrorBoundary]', {
      errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });

    // Notify parent if callback provided
    this.props.onError?.(error, errorInfo);

    // Optional: Auto-reset after 5 seconds
    if (this.resetTimeoutId) clearTimeout(this.resetTimeoutId);
    this.resetTimeoutId = setTimeout(() => {
      this.resetErrorBoundary();
    }, 5000);
  }

  override componentDidUpdate(prevProps: Props) {
    // Reset if resetKeys changed
    if (this.props.resetOnPropsChange && this.props.resetKeys) {
      const prevKeys = prevProps.resetKeys || [];
      const currKeys = this.props.resetKeys || [];

      if (
        prevKeys.length !== currKeys.length ||
        !prevKeys.every((key, i) => key === currKeys[i])
      ) {
        this.resetErrorBoundary();
      }
    }
  }

  override componentWillUnmount() {
    if (this.resetTimeoutId) clearTimeout(this.resetTimeoutId);
  }

  resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: '',
    });
  };

  override render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
              {/* Icon */}
              <div className="text-4xl mb-4 text-center">⚠️</div>

              {/* Error message */}
              <h1 className="text-xl font-bold text-red-300 mb-2 text-center">
                Algo deu errado
              </h1>

              <p className="text-sm text-red-200 mb-4 text-center leading-relaxed">
                Ocorreu um erro inesperado no portal. Tente recarregar a página ou
                entre em contato com o suporte.
              </p>

              {/* Error details (development only) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mb-4 text-xs">
                  <summary className="cursor-pointer text-slate-400 hover:text-slate-300 font-mono">
                    Detalhes do erro
                  </summary>
                  <div className="mt-2 bg-slate-900/50 p-3 rounded border border-slate-700 max-h-48 overflow-auto">
                    <p className="text-slate-300 font-mono break-words">
                      {this.state.error.message}
                    </p>
                    {this.state.errorInfo && (
                      <pre className="mt-2 text-slate-400 font-mono text-[10px] overflow-auto max-h-32">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                </details>
              )}

              {/* Error ID (for support) */}
              <div className="bg-slate-900/30 border border-slate-700 rounded p-3 mb-4">
                <p className="text-xs text-slate-400 mb-1">
                  <strong>ID do erro:</strong>
                </p>
                <code className="text-xs text-slate-300 font-mono break-all">
                  {this.state.errorId}
                </code>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    this.resetErrorBoundary();
                    window.location.reload();
                  }}
                  className={`
                    w-full px-4 py-2 rounded-lg text-sm font-medium
                    bg-red-500/20 hover:bg-red-500/30
                    text-red-300 border border-red-500/30
                    transition-colors duration-150
                  `}
                >
                  Recarregar página
                </button>

                <button
                  onClick={this.resetErrorBoundary}
                  className={`
                    w-full px-4 py-2 rounded-lg text-sm font-medium
                    bg-white/8 hover:bg-white/12
                    text-slate-300 border border-white/10
                    transition-colors duration-150
                  `}
                >
                  Voltar
                </button>
              </div>

              {/* Support link */}
              <p className="text-xs text-slate-500 text-center mt-4">
                Problema persistente?{' '}
                <a
                  href={`mailto:suporte@labclinico.com.br?subject=Erro no Portal&body=ID do erro: ${this.state.errorId}`}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Contate o suporte
                </a>
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
