import { HomePage } from '@/components/home_page'
import { getAllCards } from '@/lib/card_loader'

const FEATURED_NAMES = ['The Fool', 'The Magician', 'Death', 'The World']

export default function Page() {
  const allCards = getAllCards()
  const featured = FEATURED_NAMES.map(name => allCards.find(card => card.name === name)).filter(
    (card): card is NonNullable<typeof card> => Boolean(card),
  )

  return <HomePage featured={featured} />
}
