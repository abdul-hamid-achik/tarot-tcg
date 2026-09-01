import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import '../styles/drag-drop.css'
import { GameErrorBoundary } from '@/components/error_boundary'
import { SiteShell } from '@/components/site_shell'
import { ThemeProvider } from '@/contexts/theme_context'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://tarot-tcg.com'),
  title: {
    default: 'Tarot TCG - Strategic Card Game',
    template: '%s | Tarot TCG',
  },
  description:
    'A strategic card battler where ancient tarot wisdom meets modern gameplay. 78 unique cards, zodiac mechanics, and deep strategy.',
  openGraph: {
    title: 'Tarot TCG - Strategic Card Game',
    description:
      'A strategic card battler where ancient tarot wisdom meets modern gameplay. 78 unique cards, zodiac mechanics, and deep strategy.',
    type: 'website',
    siteName: 'Tarot TCG',
    url: 'https://tarot-tcg.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tarot TCG - Strategic Card Game',
    description: 'A strategic card battler where ancient tarot wisdom meets modern gameplay.',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        <GameErrorBoundary showDetails={process.env.NODE_ENV === 'development'}>
          <ThemeProvider>
            <SiteShell>{children}</SiteShell>
          </ThemeProvider>
        </GameErrorBoundary>
      </body>
    </html>
  )
}
