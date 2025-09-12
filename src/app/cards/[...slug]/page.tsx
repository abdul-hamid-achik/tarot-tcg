import { allCards } from 'contentlayer/generated'
import { notFound } from 'next/navigation'
import { getMDXComponent } from 'next-contentlayer2/hooks'
import { Badge } from '@/components/ui/badge'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardNavigation } from '@/components/ui/card_navigation'

interface PageProps {
  params: Promise<{
    slug: string[]
  }>
}

export async function generateStaticParams() {
  return allCards.map(card => ({
    slug: card._raw.flattenedPath.replace('cards/', '').split('/'),
  }))
}

export default async function CardPage({ params }: PageProps) {
  const { slug: slugArray } = await params
  const slug = slugArray.join('/')
  const card = allCards.find(card => card._raw.flattenedPath === `cards/${slug}`)

  if (!card) notFound()

  // Find previous and next cards
  const currentIndex = allCards.findIndex(c => c._raw.flattenedPath === `cards/${slug}`)
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

  const MDXContent = getMDXComponent(card.body.code)

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
      <div className="container mx-auto py-8 max-w-4xl">
        {/* Breadcrumb */}
        <Breadcrumb items={breadcrumbItems} className="mb-6" />

        {/* Card Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-4xl font-bold text-black dark:text-white transition-colors">
              {card.name}
            </h1>
            <span className="text-3xl">{card.tarotSymbol}</span>
          </div>

          {/* Card Stats */}
          <Card className="mb-6 rounded-sm bg-white dark:bg-gray-900 transition-colors border-gray-300">
            <CardHeader>
              <CardTitle>Card Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="font-semibold">Type:</span> {card.cardType}
                </div>
                <div>
                  <span className="font-semibold">Cost:</span> {card.cost}
                </div>
                {card.isUnit && (
                  <>
                    <div>
                      <span className="font-semibold">Attack:</span> {card.attack}
                    </div>
                    <div>
                      <span className="font-semibold">Health:</span> {card.health}
                    </div>
                  </>
                )}
                {card.isSpell && card.spellType && (
                  <div>
                    <span className="font-semibold">Spell Type:</span> {card.spellType}
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="secondary">{card.zodiacClass}</Badge>
                <Badge variant="outline">{card.element}</Badge>
                <Badge variant="default">{card.rarity}</Badge>
              </div>

              {card.keywords && card.keywords.length > 0 && (
                <div className="mt-4">
                  <span className="font-semibold mb-2 block">Keywords:</span>
                  <div className="flex flex-wrap gap-2">
                    {card.keywords.map(keyword => (
                      <Badge key={keyword} variant="outline">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Abilities */}
          {card.abilities && (
            <Card className="mb-6 rounded-sm bg-white dark:bg-gray-900 transition-colors border-gray-300">
              <CardHeader>
                <CardTitle>Abilities</CardTitle>
              </CardHeader>
              <CardContent>
                {card.abilities.upright && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-green-700 mb-2">Upright</h4>
                    {card.abilities.upright.map(
                      (ability: { name: string; description: string }) => (
                        <div key={`${ability.name}-${ability.description}`} className="mb-2">
                          <strong>{ability.name}:</strong> {ability.description}
                        </div>
                      ),
                    )}
                  </div>
                )}
                {card.abilities.reversed && (
                  <div>
                    <h4 className="font-semibold text-red-700 mb-2">Reversed</h4>
                    {card.abilities.reversed.map(
                      (ability: { name: string; description: string }) => (
                        <div key={`${ability.name}-${ability.description}`} className="mb-2">
                          <strong>{ability.name}:</strong> {ability.description}
                        </div>
                      ),
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Effects (for spells) */}
          {card.effects && (
            <Card className="mb-6 rounded-sm bg-white dark:bg-gray-900 transition-colors border-gray-300">
              <CardHeader>
                <CardTitle>Effects</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap">{JSON.stringify(card.effects, null, 2)}</pre>
              </CardContent>
            </Card>
          )}
        </div>

        {/* MDX Content */}
        <Card className="rounded-sm bg-white dark:bg-gray-900 transition-colors border-gray-300">
          <CardHeader>
            <CardTitle>Lore & Strategy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none">
              <MDXContent />
            </div>
          </CardContent>
        </Card>

        {/* Card Navigation */}
        <CardNavigation
          previousCard={
            previousCard
              ? {
                  name: previousCard.name,
                  slug: previousCard._raw.flattenedPath.replace('cards/', ''),
                }
              : undefined
          }
          nextCard={
            nextCard
              ? {
                  name: nextCard.name,
                  slug: nextCard._raw.flattenedPath.replace('cards/', ''),
                }
              : undefined
          }
        />
      </div>
    </div>
  )
}
