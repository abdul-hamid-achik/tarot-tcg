import { Card } from '@/schemas/gameSchemas';

/**
 * Static mapping of card names and IDs to their image paths
 * This ensures fast, synchronous access to card images
 */
const CARD_IMAGE_MAPPING: { [key: string]: string } = {
  // Major Arcana - by name
  'the fool': 'cards/major_00/2x.png',
  'fool': 'cards/major_00/2x.png',
  'the magician': 'cards/major_01/2x.png',
  'magician': 'cards/major_01/2x.png',
  'the high priestess': 'cards/major_02/2x.png',
  'high priestess': 'cards/major_02/2x.png',
  'the empress': 'cards/major_03/2x.png',
  'empress': 'cards/major_03/2x.png',
  'the emperor': 'cards/major_04/2x.png',
  'emperor': 'cards/major_04/2x.png',
  'the hierophant': 'cards/major_05/2x.png',
  'hierophant': 'cards/major_05/2x.png',
  'the lovers': 'cards/major_06/2x.png',
  'lovers': 'cards/major_06/2x.png',
  'the chariot': 'cards/major_07/2x.png',
  'chariot': 'cards/major_07/2x.png',
  'strength': 'cards/major_08/2x.png',
  'the hermit': 'cards/major_09/2x.png',
  'hermit': 'cards/major_09/2x.png',
  'wheel of fortune': 'cards/major_10/2x.png',
  'the wheel': 'cards/major_10/2x.png',
  'justice': 'cards/major_11/2x.png',
  'the hanged man': 'cards/major_12/2x.png',
  'hanged man': 'cards/major_12/2x.png',
  'death': 'cards/major_13/2x.png',
  'temperance': 'cards/major_14/2x.png',
  'the devil': 'cards/major_15/2x.png',
  'devil': 'cards/major_15/2x.png',
  'the tower': 'cards/major_16/2x.png',
  'tower': 'cards/major_16/2x.png',
  'the star': 'cards/major_17/2x.png',
  'star': 'cards/major_17/2x.png',
  'the moon': 'cards/major_18/2x.png',
  'moon': 'cards/major_18/2x.png',
  'the sun': 'cards/major_19/2x.png',
  'sun': 'cards/major_19/2x.png',
  'judgement': 'cards/major_20/2x.png',
  'judgment': 'cards/major_20/2x.png',
  'the world': 'cards/major_21/2x.png',
  'world': 'cards/major_21/2x.png',

  // Major Arcana - by ID
  'major_00': 'cards/major_00/2x.png',
  'major_01': 'cards/major_01/2x.png',
  'major_02': 'cards/major_02/2x.png',
  'major_03': 'cards/major_03/2x.png',
  'major_04': 'cards/major_04/2x.png',
  'major_05': 'cards/major_05/2x.png',
  'major_06': 'cards/major_06/2x.png',
  'major_07': 'cards/major_07/2x.png',
  'major_08': 'cards/major_08/2x.png',
  'major_09': 'cards/major_09/2x.png',
  'major_10': 'cards/major_10/2x.png',
  'major_11': 'cards/major_11/2x.png',
  'major_12': 'cards/major_12/2x.png',
  'major_13': 'cards/major_13/2x.png',
  'major_14': 'cards/major_14/2x.png',
  'major_15': 'cards/major_15/2x.png',
  'major_16': 'cards/major_16/2x.png',
  'major_17': 'cards/major_17/2x.png',
  'major_18': 'cards/major_18/2x.png',
  'major_19': 'cards/major_19/2x.png',
  'major_20': 'cards/major_20/2x.png',
  'major_21': 'cards/major_21/2x.png',

  // Cups - by name
  'ace of cups': 'cards/cups_01/2x.png',
  'two of cups': 'cards/cups_02/2x.png',
  'three of cups': 'cards/cups_03/2x.png',
  'four of cups': 'cards/cups_04/2x.png',
  'five of cups': 'cards/cups_05/2x.png',
  'six of cups': 'cards/cups_06/2x.png',
  'seven of cups': 'cards/cups_07/2x.png',
  'eight of cups': 'cards/cups_08/2x.png',
  'nine of cups': 'cards/cups_09/2x.png',
  'ten of cups': 'cards/cups_10/2x.png',
  'page of cups': 'cards/cups_page/2x.png',
  'knight of cups': 'cards/cups_knight/2x.png',
  'queen of cups': 'cards/cups_queen/2x.png',
  'king of cups': 'cards/cups_king/2x.png',

  // Cups - by ID
  'cups_01': 'cards/cups_01/2x.png',
  'cups_02': 'cards/cups_02/2x.png',
  'cups_03': 'cards/cups_03/2x.png',
  'cups_04': 'cards/cups_04/2x.png',
  'cups_05': 'cards/cups_05/2x.png',
  'cups_06': 'cards/cups_06/2x.png',
  'cups_07': 'cards/cups_07/2x.png',
  'cups_08': 'cards/cups_08/2x.png',
  'cups_09': 'cards/cups_09/2x.png',
  'cups_10': 'cards/cups_10/2x.png',
  'cups_page': 'cards/cups_page/2x.png',
  'cups_knight': 'cards/cups_knight/2x.png',
  'cups_queen': 'cards/cups_queen/2x.png',
  'cups_king': 'cards/cups_king/2x.png',

  // Pentacles - by name
  'ace of pentacles': 'cards/pentacles_01/2x.png',
  'two of pentacles': 'cards/pentacles_02/2x.png',
  'three of pentacles': 'cards/pentacles_03/2x.png',
  'four of pentacles': 'cards/pentacles_04/2x.png',
  'five of pentacles': 'cards/pentacles_05/2x.png',
  'six of pentacles': 'cards/pentacles_06/2x.png',
  'seven of pentacles': 'cards/pentacles_07/2x.png',
  'eight of pentacles': 'cards/pentacles_08/2x.png',
  'nine of pentacles': 'cards/pentacles_09/2x.png',
  'ten of pentacles': 'cards/pentacles_10/2x.png',
  'page of pentacles': 'cards/pentacles_page/2x.png',
  'knight of pentacles': 'cards/pentacles_knight/2x.png',
  'queen of pentacles': 'cards/pentacles_queen/2x.png',
  'king of pentacles': 'cards/pentacles_king/2x.png',

  // Pentacles - by ID
  'pentacles_01': 'cards/pentacles_01/2x.png',
  'pentacles_02': 'cards/pentacles_02/2x.png',
  'pentacles_03': 'cards/pentacles_03/2x.png',
  'pentacles_04': 'cards/pentacles_04/2x.png',
  'pentacles_05': 'cards/pentacles_05/2x.png',
  'pentacles_06': 'cards/pentacles_06/2x.png',
  'pentacles_07': 'cards/pentacles_07/2x.png',
  'pentacles_08': 'cards/pentacles_08/2x.png',
  'pentacles_09': 'cards/pentacles_09/2x.png',
  'pentacles_10': 'cards/pentacles_10/2x.png',
  'pentacles_page': 'cards/pentacles_page/2x.png',
  'pentacles_knight': 'cards/pentacles_knight/2x.png',
  'pentacles_queen': 'cards/pentacles_queen/2x.png',
  'pentacles_king': 'cards/pentacles_king/2x.png',

  // Swords - by name
  'ace of swords': 'cards/swords_01/2x.png',
  'two of swords': 'cards/swords_02/2x.png',
  'three of swords': 'cards/swords_03/2x.png',
  'four of swords': 'cards/swords_04/2x.png',
  'five of swords': 'cards/swords_05/2x.png',
  'six of swords': 'cards/swords_06/2x.png',
  'seven of swords': 'cards/swords_07/2x.png',
  'eight of swords': 'cards/swords_08/2x.png',
  'nine of swords': 'cards/swords_09/2x.png',
  'ten of swords': 'cards/swords_10/2x.png',
  'page of swords': 'cards/swords_page/2x.png',
  'knight of swords': 'cards/swords_knight/2x.png',
  'queen of swords': 'cards/swords_queen/2x.png',
  'king of swords': 'cards/swords_king/2x.png',

  // Swords - by ID
  'swords_01': 'cards/swords_01/2x.png',
  'swords_02': 'cards/swords_02/2x.png',
  'swords_03': 'cards/swords_03/2x.png',
  'swords_04': 'cards/swords_04/2x.png',
  'swords_05': 'cards/swords_05/2x.png',
  'swords_06': 'cards/swords_06/2x.png',
  'swords_07': 'cards/swords_07/2x.png',
  'swords_08': 'cards/swords_08/2x.png',
  'swords_09': 'cards/swords_09/2x.png',
  'swords_10': 'cards/swords_10/2x.png',
  'swords_page': 'cards/swords_page/2x.png',
  'swords_knight': 'cards/swords_knight/2x.png',
  'swords_queen': 'cards/swords_queen/2x.png',
  'swords_king': 'cards/swords_king/2x.png',

  // Wands - by name
  'ace of wands': 'cards/wands_01/2x.png',
  'two of wands': 'cards/wands_02/2x.png',
  'three of wands': 'cards/wands_03/2x.png',
  'four of wands': 'cards/wands_04/2x.png',
  'five of wands': 'cards/wands_05/2x.png',
  'six of wands': 'cards/wands_06/2x.png',
  'seven of wands': 'cards/wands_07/2x.png',
  'eight of wands': 'cards/wands_08/2x.png',
  'nine of wands': 'cards/wands_09/2x.png',
  'ten of wands': 'cards/wands_10/2x.png',
  'page of wands': 'cards/wands_page/2x.png',
  'knight of wands': 'cards/wands_knight/2x.png',
  'queen of wands': 'cards/wands_queen/2x.png',
  'king of wands': 'cards/wands_king/2x.png',

  // Wands - by ID
  'wands_01': 'cards/wands_01/2x.png',
  'wands_02': 'cards/wands_02/2x.png',
  'wands_03': 'cards/wands_03/2x.png',
  'wands_04': 'cards/wands_04/2x.png',
  'wands_05': 'cards/wands_05/2x.png',
  'wands_06': 'cards/wands_06/2x.png',
  'wands_07': 'cards/wands_07/2x.png',
  'wands_08': 'cards/wands_08/2x.png',
  'wands_09': 'cards/wands_09/2x.png',
  'wands_10': 'cards/wands_10/2x.png',
  'wands_page': 'cards/wands_page/2x.png',
  'wands_knight': 'cards/wands_knight/2x.png',
  'wands_queen': 'cards/wands_queen/2x.png',
  'wands_king': 'cards/wands_king/2x.png'
};

/**
 * Maps a card to its image path based on the tarot card structure
 * in public/default/cards/
 */
export function getCardImagePath(card: Card): string {
  if (!card || !card.name) {
    return getCardBackImagePath();
  }

  // Try exact match by name (case insensitive)
  const nameKey = card.name.toLowerCase();
  if (CARD_IMAGE_MAPPING[nameKey]) {
    return `/default/${CARD_IMAGE_MAPPING[nameKey]}`;
  }

  // Try exact match by ID
  if (card.id && CARD_IMAGE_MAPPING[card.id]) {
    return `/default/${CARD_IMAGE_MAPPING[card.id]}`;
  }

  // Pattern matching fallback for complex names
  const imagePath = mapCardNameToImagePath(card.name, card.id);
  if (imagePath) {
    return `/default/cards/${imagePath}/2x.png`;
  }

  console.warn(`Could not find image for card "${card.name}" (ID: ${card.id}). Using fallback.`);
  return getCardBackImagePath();
}

/**
 * Fallback pattern matching for cards not in static mapping
 */
function mapCardNameToImagePath(cardName: string, cardId?: string): string | null {
  const name = cardName.toLowerCase();
  
  // Handle "X of Y" pattern
  const minorPattern = /^(ace|one|two|three|four|five|six|seven|eight|nine|ten|page|knight|queen|king)\s+of\s+(cups|pentacles|swords|wands|coins)$/i;
  const match = name.match(minorPattern);
  
  if (match) {
    const [, rank, suit] = match;
    let suitName = suit.toLowerCase();
    
    // Handle alternative suit names
    if (suitName === 'coins') suitName = 'pentacles';
    
    const rankName = rank.toLowerCase();
    
    // Convert number words to digits
    const numberMappings: { [key: string]: string } = {
      'ace': '01',
      'one': '01',
      'two': '02',
      'three': '03',
      'four': '04',
      'five': '05',
      'six': '06',
      'seven': '07',
      'eight': '08',
      'nine': '09',
      'ten': '10'
    };
    
    if (numberMappings[rankName]) {
      return `${suitName}_${numberMappings[rankName]}`;
    } else {
      // Court cards (page, knight, queen, king)
      return `${suitName}_${rankName}`;
    }
  }

  // If we have a card ID that matches our directory structure, use it
  if (cardId) {
    const idPattern = /^(major_\d{2}|(?:cups|pentacles|swords|wands)_(?:\d{2}|king|queen|knight|page))$/;
    if (idPattern.test(cardId)) {
      return cardId;
    }
  }

  return null;
}

/**
 * Get the card back image path
 */
export function getCardBackImagePath(): string {
  return '/default/back/2x.png';
}
