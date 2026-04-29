import React, { Component, ReactNode } from 'react';
import { Sentry } from '../../lib/sentry';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  eventId?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const eventId = Sentry.captureException(error, {
      contexts: { react: { componentStack: errorInfo.componentStack } },
    });
    this.setState({ eventId });
    console.error('Uncaught error:', error, errorInfo);
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-red-500">
          <h1 className="text-2xl font-bold mb-4">Ops! Algo deu errado.</h1>
          <p>{this.state.error?.message}</p>
          {this.state.eventId && (
            <p className="mt-2 text-xs text-slate-500 font-mono">
              ID do erro: {this.state.eventId}
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
