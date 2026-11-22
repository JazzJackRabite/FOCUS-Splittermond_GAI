import { Knopf } from '../fundament';
import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-erhoeht flex items-center justify-center p-8">
          <div className="bg-flaeche border border-rahmen rounded-karte p-8 max-w-lg w-full text-center shadow-2xl">
            <h1 className="text-3xl font-bold text-gold mb-4 tracking-widest">FOCUS</h1>
            <p className="text-schrift text-lg mb-2 font-bold">Ein unerwarteter Fehler ist aufgetreten.</p>
            {this.state.error && (
              <p className="text-leise text-sm mb-6 tabular-nums bg-erhoeht p-3 rounded-knopf border border-gold break-words">
                {this.state.error.message}
              </p>
            )}
            <Knopf art="primaer" onClick={() => window.location.reload()} className="font-bold">
              Neu laden
            </Knopf>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
