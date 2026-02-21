'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="text-6xl">&#x2727;</div>
        <h1 className="text-4xl font-bold">Page Not Found</h1>
        <p className="text-muted-foreground text-lg">
          The cards have spoken - this path leads nowhere. Perhaps the fates have another destiny in
          mind.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/">
            <Button size="lg">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return Home
            </Button>
          </Link>
          <Link href="/play">
            <Button size="lg" variant="outline">
              Play a Game
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
