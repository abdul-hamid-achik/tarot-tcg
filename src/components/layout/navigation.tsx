'use client'

import {
  BarChart3,
  BookOpen,
  CreditCard,
  Flame,
  Layers,
  Menu,
  Play,
  Settings,
  Swords,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme_toggle'

interface NavigationProps {
  className?: string
}

export function Navigation({ className = '' }: NavigationProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close mobile menu on route change
  const prevPathRef = useRef(pathname)
  if (pathname !== prevPathRef.current) {
    prevPathRef.current = pathname
    if (mobileOpen) setMobileOpen(false)
  }

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }

  const navItems = [
    { label: 'Game', href: '/', icon: Play, description: 'Play the tarot card game' },
    { label: 'Cards', href: '/cards', icon: CreditCard, description: 'Browse all tarot cards' },
    { label: 'Tutorial', href: '/tutorial', icon: BookOpen, description: 'Learn how to play' },
    { label: 'Play', href: '/play', icon: Swords, description: 'Play against AI' },
    { label: 'Decks', href: '/deck-builder', icon: Layers, description: 'Build custom decks' },
    {
      label: 'Challenges',
      href: '/challenges',
      icon: Flame,
      description: 'Special rule challenges',
    },
    {
      label: 'Stats',
      href: '/stats',
      icon: BarChart3,
      description: 'View statistics and achievements',
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: Settings,
      description: 'Customize your experience',
    },
  ]

  return (
    <header
      className={`bg-background border-b border-border shadow-sm transition-colors ${className}`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">⚡</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Tarot TCG</h1>
              <p className="text-xs text-muted-foreground">Strategic Card Game</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map(item => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={active ? 'default' : 'ghost'}
                    size="sm"
                    className={`flex items-center space-x-2 transition-colors ${
                      active
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    {item.href === '/cards' && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        78
                      </Badge>
                    )}
                  </Button>
                </Link>
              )
            })}
            <div className="ml-3">
              <ThemeToggle />
            </div>
          </nav>

          {/* Mobile: theme toggle + hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              className="p-2"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-border bg-background pb-3">
          <div className="container mx-auto px-4 pt-2 space-y-1">
            {navItems.map(item => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link key={item.href} href={item.href} className="block">
                  <div
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <div className="flex-1">
                      <span className="text-sm font-medium">{item.label}</span>
                      <span className="text-xs opacity-70 ml-2">{item.description}</span>
                    </div>
                    {item.href === '/cards' && (
                      <Badge variant="secondary" className="text-xs">
                        78
                      </Badge>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </nav>
      )}
    </header>
  )
}
