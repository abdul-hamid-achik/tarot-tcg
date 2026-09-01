'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { Navigation } from '@/components/layout/navigation'

const FULLSCREEN_ROUTES = ['/play', '/tutorial', '/multiplayer']

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const hideNav = FULLSCREEN_ROUTES.some(
    route => pathname === route || pathname.startsWith(`${route}/`),
  )

  return (
    <>
      {!hideNav && <Navigation />}
      {children}
    </>
  )
}
