import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
    state: State = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('ErrorBoundary caught:', error, info.componentStack);
    }

    render() {
        if (!this.state.hasError) return this.props.children;
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 max-w-sm w-full text-center">
                    <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="w-6 h-6 text-red-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">Etwas ist schiefgelaufen</h3>
                    <p className="text-sm text-slate-500 mb-6">
                        {this.state.error?.message || 'Ein unerwarteter Fehler ist aufgetreten.'}
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Erneut versuchen
                    </button>
                </div>
            </div>
        );
    }
}
