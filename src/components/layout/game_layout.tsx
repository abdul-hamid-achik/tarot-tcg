'use client'

import type React from 'react'
import { cn } from '@/lib/utils'

interface GameLayoutProps {
  children: React.ReactNode
  className?: string
}

export default function GameLayout({ children, className = '' }: GameLayoutProps) {
  return (
    <div
      className={cn(
        'relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-background text-foreground',
        className,
      )}
    >
      {children}
    </div>
  )
}
