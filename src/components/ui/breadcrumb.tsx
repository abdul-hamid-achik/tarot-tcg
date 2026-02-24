'use client'

import { ChevronRight, Home } from 'lucide-react'
import Link from 'next/link'
import { Fragment } from 'react'

interface BreadcrumbItem {
  label: string
  href?: string
  isCurrentPage?: boolean
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center space-x-1 text-sm text-gray-600 ${className}`}
    >
      {/* Home link */}
      <Link
        href="/"
        className="flex items-center hover:text-gray-900 transition-colors"
        aria-label="Home"
      >
        <Home className="w-4 h-4" />
      </Link>

      {items.length > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}

      {items.map((item, index) => (
        <Fragment key={`${item.label}-${index}`}>
          {item.href && !item.isCurrentPage ? (
            <Link href={item.href} className="hover:text-gray-900 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span
              className={item.isCurrentPage ? 'text-gray-900 font-medium' : 'text-gray-600'}
              aria-current={item.isCurrentPage ? 'page' : undefined}
            >
              {item.label}
            </span>
          )}
          {index < items.length - 1 && <ChevronRight className="w-4 h-4 text-gray-400" />}
        </Fragment>
      ))}
    </nav>
  )
}
