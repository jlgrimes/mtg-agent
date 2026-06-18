"use client";

import { Component, type ReactNode } from "react";

interface Props {
  readonly children: ReactNode;
  readonly fallback: ReactNode;
}

// Catches render errors (e.g. a malformed stored message) so they degrade to a
// fallback instead of white-screening the whole app.
export class ErrorBoundary extends Component<Props, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("ChatView render error:", error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
