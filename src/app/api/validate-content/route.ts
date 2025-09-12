/**
 * API endpoint to validate all content using the Zod schemas
 * Useful for CI/CD pipelines or development checks
 */

import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // In production, this would use the actual generated content
    // const { allCards } = await import('contentlayer/generated')

    // For demonstration, we'll create a mock response
    const mockValidationSummary = {
      total: 78,
      valid: 76,
      invalid: 2,
      invalidDetails: [
        {
          cardName: 'The Fool',
          cardId: 'the-fool',
          errors: [
            {
              code: 'invalid_type',
              expected: 'number',
              received: 'string',
              path: ['cost'],
              message: 'Expected number, received string',
            },
          ],
        },
        {
          cardName: 'Three of Cups',
          cardId: 'three-of-cups',
          errors: [
            {
              code: 'invalid_enum_value',
              options: ['fire', 'earth', 'air', 'water'],
              received: 'spirit',
              path: ['element'],
              message:
                "Invalid enum value. Expected 'fire' | 'earth' | 'air' | 'water', received 'spirit'",
            },
          ],
        },
      ],
    }

    // In production:
    // const summary = getCardValidationSummary(allCards)

    const isValid = mockValidationSummary.invalid === 0

    return NextResponse.json(
      {
        success: isValid,
        summary: mockValidationSummary,
        message: isValid
          ? 'All content is valid!'
          : `Found ${mockValidationSummary.invalid} invalid cards`,
      },
      {
        status: isValid ? 200 : 400,
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
