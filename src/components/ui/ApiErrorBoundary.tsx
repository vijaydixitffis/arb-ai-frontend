import React from 'react'
import { QueryErrorResetBoundary } from '@tanstack/react-query'

interface State { hasError: boolean; error: Error | null }

class InnerBoundary extends React.Component<
  { children: React.ReactNode; onReset: () => void; fallbackLabel?: string },
  State
> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ApiErrorBoundary]', error, info)
  }

  handleReset = () => {
    this.props.onReset()
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-4 p-8 text-center">
          <p className="text-sm text-red-600">
            {this.state.error?.message ?? 'Something went wrong loading this page.'}
          </p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
          >
            {this.props.fallbackLabel ?? 'Retry'}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export function ApiErrorBoundary({
  children,
  fallbackLabel,
}: {
  children: React.ReactNode
  fallbackLabel?: string
}) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <InnerBoundary onReset={reset} fallbackLabel={fallbackLabel}>
          {children}
        </InnerBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}
