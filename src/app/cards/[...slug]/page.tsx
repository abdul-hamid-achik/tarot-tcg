import { MDXContent } from '@content-collections/mdx/react'
import { allCards } from 'content-collections'
import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { DualFaceAbilities } from '@/components/dual_face_abilities'
import { Badge } from '@/components/ui/badge'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardNavigation } from '@/components/ui/card_navigation'
import { getCardImagePath } from '@/lib/card_images'
import { mergeOrientedSources, summarizeAbilities } from '@/lib/card_orientation'

interface PageProps {
  params: Promise<{
    slug: string[]
  }>
}

export async function generateStaticParams() {
  return allCards.map(card => ({
    slug: card.slug.split('/'),
  }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: slugArray } = await params
  const slug = slugArray.join('/')
  const card = allCards.find(item => item.slug === slug)
  if (!card) return { title: 'Card' }

  const oriented = mergeOrientedSources(card.abilities, card.effects)
  const reversed = summarizeAbilities(oriented.reversed)

  return {
    title: card.name,
    description: reversed
      ? `${card.name}: upright and reversed game text for Tarot TCG.`
      : `${card.name} in Tarot TCG.`,
  }
}

export default async function CardPage({ params }: PageProps) {
  const { slug: slugArray } = await params
  const slug = slugArray.join('/')
  const card = allCards.find(item => item.slug === slug)

  if (!card) notFound()

  // Find previous and next cards
  const currentIndex = allCards.findIndex(item => item.slug === slug)
  const previousCard = currentIndex > 0 ? allCards[currentIndex - 1] : undefined
  const nextCard = currentIndex < allCards.length - 1 ? allCards[currentIndex + 1] : undefined

  // Create breadcrumb items
  const breadcrumbItems = [
    { label: 'Cards', href: '/cards' },
    ...(slugArray.length > 1
      ? [
          {
            label: slugArray[0]
              .split('-')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' '),
            href: `/cards#${slugArray[0]}`,
          },
        ]
      : []),
    { label: card.name, isCurrentPage: true },
  ]

  const oriented = mergeOrientedSources(card.abilities, card.effects)
  const imagePath = getCardImagePath({
    id: card.id,
    name: card.name,
  })

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto py-8 max-w-4xl px-4">
        {/* Breadcrumb */}
        <Breadcrumb items={breadcrumbItems} className="mb-6" />

        {/* Card Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-6 mb-8">
            <Image
              src={imagePath}
              alt=""
              width={160}
              height={240}
              className="w-40 h-60 object-cover rounded-md border border-border shadow-sm"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold">{card.name}</h1>
                <span className="text-3xl" aria-hidden>
                  {card.tarotSymbol}
                </span>
              </div>
              <p className="text-muted-foreground mb-4">
                {card.cardType}
                {card.spellType ? ` · ${card.spellType}` : ''}
                {` · ${card.cost} mana`}
                {card.isUnit ? ` · ${card.attack}/${card.health}` : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{card.zodiacClass}</Badge>
                <Badge variant="outline">{card.element}</Badge>
                <Badge variant="outline">{card.rarity}</Badge>
              </div>
              {card.keywords && card.keywords.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {card.keywords.map(keyword => (
                    <Badge key={keyword} variant="outline">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Upright and reversed</CardTitle>
            </CardHeader>
            <CardContent>
              <DualFaceAbilities upright={oriented.upright} reversed={oriented.reversed} />
            </CardContent>
          </Card>
        </div>

        {/* MDX Content */}
        <Card>
          <CardHeader>
            <CardTitle>Lore</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose dark:prose-invert max-w-none">
              <MDXContent code={card.mdx} />
            </div>
          </CardContent>
        </Card>

        {/* Card Navigation */}
        <CardNavigation
          previousCard={
            previousCard
              ? {
                  name: previousCard.name,
                  slug: previousCard.slug,
                }
              : undefined
          }
          nextCard={
            nextCard
              ? {
                  name: nextCard.name,
                  slug: nextCard.slug,
                }
              : undefined
          }
        />
      </div>
    </div>
  )
}
