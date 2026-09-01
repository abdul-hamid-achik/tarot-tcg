import { allCards, allMetaGuides, allZodiacClasses } from 'content-collections'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ContentPage() {
  const cardsByCategory = allCards.reduce(
    (acc, card) => {
      const category = card.category || 'other'
      if (!acc[category]) acc[category] = []
      acc[category].push(card)
      return acc
    },
    {} as Record<string, typeof allCards>,
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-4xl font-bold mb-8">Game Content</h1>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Guides</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {allMetaGuides.map(doc => (
              <Card key={doc.slug}>
                <CardHeader>
                  <CardTitle>
                    <Link href={doc.url} className="hover:underline">
                      {doc.title}
                    </Link>
                  </CardTitle>
                  <CardDescription>{doc.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Zodiac classes</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {allZodiacClasses.map(doc => (
              <Card key={doc.slug}>
                <CardHeader>
                  <CardTitle>
                    <Link href={doc.url} className="hover:underline">
                      {doc.title}
                    </Link>
                  </CardTitle>
                  <CardDescription>{doc.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-6">Cards</h2>

          {Object.entries(cardsByCategory).map(([category, cards]) => (
            <div key={category} className="mb-8">
              <h3 className="text-xl font-medium mb-4 capitalize">{category.replace('-', ' ')}</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {cards.map(card => (
                  <Card key={card.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">
                          <Link href={card.url} className="hover:underline">
                            {card.name}
                          </Link>
                        </CardTitle>
                        <div className="text-lg">{card.tarotSymbol}</div>
                      </div>
                      <CardDescription>
                        {card.zodiacClass} · {card.element} · {card.rarity}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between text-sm">
                        <span>Cost: {card.cost}</span>
                        {card.isUnit && (
                          <span>
                            {card.attack}/{card.health}
                          </span>
                        )}
                        {card.isSpell && <span className="capitalize">{card.spellType}</span>}
                      </div>
                      {card.keywords && card.keywords.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {card.keywords.map(keyword => (
                            <span key={keyword} className="px-2 py-1 text-xs bg-muted rounded">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
