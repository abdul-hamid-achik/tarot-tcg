import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function ContentNavigation() {
  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-300 dark:border-gray-600 p-4">
      <div className="container mx-auto flex gap-4">
        <Button variant="link" asChild>
          <Link href="/content">All Content</Link>
        </Button>
        <Button variant="link" asChild>
          <Link href="/content#cards">Cards</Link>
        </Button>
        <Button variant="link" asChild>
          <Link href="/content#classes">Classes</Link>
        </Button>
        <Button variant="link" asChild>
          <Link href="/">Game</Link>
        </Button>
      </div>
    </nav>
  )
}
