import { CardsCatalog } from '@/components/cards_catalog'
import { getAllCards } from '@/lib/card_loader'

export default function CardsPage() {
  return <CardsCatalog cards={getAllCards()} />
}
