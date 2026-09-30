import { Component, type ReactNode } from "react";
import { TriangleAlert, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary]", error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-red-500/15 bg-red-500/[0.04] p-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10">
            <TriangleAlert size={18} className="text-red-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {this.props.fallbackTitle ?? "Something went wrong"}
            </p>
            <p className="mt-1 text-xs text-white/40">
              {this.props.fallbackMessage ??
                this.state.error?.message ??
                "This section failed to load. It won't affect the rest of your dashboard."}
            </p>
          </div>
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.08] hover:text-white"
          >
            <RefreshCw size={13} />
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
