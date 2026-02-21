'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { RotateCcw, ArrowLeft } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="text-6xl">&#x2736;</div>
        <h1 className="text-3xl font-bold">Something went wrong</h1>
        <p className="text-muted-foreground">
          The cosmic energies have been disrupted. Don&apos;t worry - your progress is safe.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <pre className="text-left text-sm bg-muted p-4 rounded-lg overflow-auto max-h-40 text-muted-foreground">
            {error.message}
          </pre>
        )}
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} size="lg">
            <RotateCcw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          <Button size="lg" variant="outline" onClick={() => (window.location.href = '/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    </div>
  )
}
