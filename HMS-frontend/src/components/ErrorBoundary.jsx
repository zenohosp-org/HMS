import { Component } from "react";
class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900"><div className="card p-8 max-w-md w-full text-center"><div className="text-5xl mb-4">⚠️</div><h1 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
                            Something went wrong
                        </h1><p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{this.state.error?.message || "An unexpected error occurred."}</p><button
        className="btn-primary"
        onClick={() => window.location.reload()}
      >
                            Reload Page
                        </button></div></div>;
    }
    return this.props.children;
  }
}
export {
  ErrorBoundary
};
