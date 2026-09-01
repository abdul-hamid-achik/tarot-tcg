/**
 * Validate generated card content against the game Card schema.
 */

import { NextResponse } from 'next/server'
import { validateAllContent } from '@/lib/card_loader'

export async function GET() {
  try {
    const summary = validateAllContent()

    return NextResponse.json(
      {
        success: summary.complete,
        summary,
        message: summary.complete
          ? 'All content is valid!'
          : `Found ${summary.invalid} invalid cards, ${summary.missingReversed.length} missing reversed faces`,
      },
      {
        status: summary.complete ? 200 : 400,
      },
    )
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
      },
    )
  }
}
