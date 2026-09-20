import React from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('MOX Error Boundary Caught Component Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 font-sans">
          <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
            <div className="inline-flex p-4 bg-red-500/10 border border-red-500/30 rounded-2xl mb-4 text-red-400">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold mb-2">MOX Application Recovery</h2>
            <p className="text-xs text-slate-400 mb-4 font-mono">
              A runtime component rendering error occurred. MOX safety guard prevented page crash.
            </p>
            {this.state.error && (
              <div className="bg-slate-950 border border-slate-800 text-red-400 text-xs font-mono p-4 rounded-xl mb-6 text-left overflow-x-auto max-h-40">
                {this.state.error.toString()}
              </div>
            )}
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={this.handleRetry}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Component
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
