'use client'

import type { Card as GameCard } from '@/schemas/schema'
import type { BattlefieldPosition } from '@/services/battlefield_service'

export interface AnimationOptions {
  duration?: number
  easing?: EasingFunction
  onStart?: () => void
  onProgress?: (progress: number) => void
  onComplete?: () => void
}

export interface CardMoveAnimation {
  card: GameCard
  element: HTMLElement
  from: { x: number; y: number }
  to: { x: number; y: number }
  options: AnimationOptions
}

export interface BattlefieldAnimation {
  slotElement: HTMLElement
  position: BattlefieldPosition
  type: 'highlight' | 'shake' | 'pulse' | 'glow'
  options: AnimationOptions
}

export interface CombatAnimation {
  attackerElement: HTMLElement
  targetElement?: HTMLElement
  damage?: number
  type: 'attack' | 'defend' | 'damage' | 'heal'
  options: AnimationOptions
}

export type EasingFunction = (t: number) => number

// Common easing functions
export const easingFunctions = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => --t * t * t + 1,
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeOutBounce: (t: number) => {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t
    } else if (t < 2 / 2.75) {
      const t1 = t - 1.5 / 2.75
      return 7.5625 * t1 * t1 + 0.75
    } else if (t < 2.5 / 2.75) {
      const t2 = t - 2.25 / 2.75
      return 7.5625 * t2 * t2 + 0.9375
    } else {
      const t3 = t - 2.625 / 2.75
      return 7.5625 * t3 * t3 + 0.984375
    }
  },
}

class AnimationService {
  private activeAnimations = new Map<string, Animation>()
  private isRunning = false
  private performanceMode: 'high' | 'medium' | 'low' = 'high'

  constructor() {
    // Only start animation loop in browser environment
    if (typeof window !== 'undefined') {
      this.startAnimationLoop()
    }
  }

  /**
   * Set performance mode to adjust animation quality and duration
   */
  setPerformanceMode(mode: 'high' | 'medium' | 'low'): void {
    this.performanceMode = mode
  }

  /**
   * Get performance-adjusted animation duration
   */
  private getPerformanceDuration(baseDuration: number): number {
    switch (this.performanceMode) {
      case 'high':
        return baseDuration
      case 'medium':
        return baseDuration * 0.75
      case 'low':
        return baseDuration * 0.5
    }
  }

  /**
   * Animate a card moving between positions
   */
  animateCardMove(
    card: GameCard,
    _from: BattlefieldPosition | 'hand',
    to: BattlefieldPosition | 'hand' | 'graveyard',
    options: AnimationOptions = {},
  ): Promise<void> {
    return new Promise(resolve => {
      const duration = this.getPerformanceDuration(options.duration || 500)

      // Get elements for animation
      const cardElement = document.querySelector(`[data-card-id="${card.id}"]`) as HTMLElement
      if (!cardElement) {
        resolve()
        return
      }

      // Calculate positions
      const fromRect = cardElement.getBoundingClientRect()
      let toRect: DOMRect

      if (to === 'hand') {
        const handElement = document.querySelector('[data-hand-area]')
        toRect = handElement?.getBoundingClientRect() || fromRect
      } else if (to === 'graveyard') {
        const graveyardElement = document.querySelector('[data-graveyard]')
        toRect = graveyardElement?.getBoundingClientRect() || fromRect
      } else {
        const slotElement = document.querySelector(`[data-slot="${to.player}-${to.slot}"]`)
        toRect = slotElement?.getBoundingClientRect() || fromRect
      }

      // Animate with CSS transitions
      cardElement.style.transition = `transform ${duration}ms ease-out`
      cardElement.style.transform = `translate(${toRect.left - fromRect.left}px, ${toRect.top - fromRect.top}px)`

      setTimeout(() => {
        cardElement.style.transition = ''
        cardElement.style.transform = ''
        options.onComplete?.()
        resolve()
      }, duration)
    })
  }

  /**
   * Animate an attack to the nexus
   */
  async animateAttackToNexus(attackerPosition: BattlefieldPosition): Promise<void> {
    const duration = this.getPerformanceDuration(400)
    const attackerElement = document.querySelector(
      `[data-slot="${attackerPosition.player}-${attackerPosition.slot}"] .game-card`,
    ) as HTMLElement

    if (!attackerElement) return

    // Attack animation - card moves toward opponent's nexus
    attackerElement.style.transition = `transform ${duration}ms ease-out`
    attackerElement.style.transform =
      attackerPosition.player === 'player1'
        ? 'translateY(-30px) scale(1.1)'
        : 'translateY(30px) scale(1.1)'

    await this.wait(duration)
    attackerElement.style.transform = ''
    await this.wait(100)
  }

  /**
   * Animate unit combat between two cards
   */
  async animateUnitCombat(
    attackerPosition: BattlefieldPosition,
    targetPosition: BattlefieldPosition,
  ): Promise<void> {
    const duration = this.getPerformanceDuration(500)

    const attackerElement = document.querySelector(
      `[data-slot="${attackerPosition.player}-${attackerPosition.slot}"] .game-card`,
    ) as HTMLElement

    const targetElement = document.querySelector(
      `[data-slot="${targetPosition.player}-${targetPosition.slot}"] .game-card`,
    ) as HTMLElement

    if (!attackerElement) return

    // Calculate direction of attack
    const attackDirection = attackerPosition.player === 'player1' ? -1 : 1

    // Attacker moves toward target
    attackerElement.style.transition = `transform ${duration}ms ease-out`
    attackerElement.style.transform = `translateY(${20 * attackDirection}px) scale(1.1)`

    // Target shakes if it exists
    if (targetElement) {
      targetElement.classList.add('shake')
    }

    await this.wait(duration)

    // Return to original position
    attackerElement.style.transform = ''
    if (targetElement) {
      targetElement.classList.remove('shake')
    }

    await this.wait(100)
  }

  /**
   * Animate nexus damage
   */
  async animateNexusDamage(damage: number): Promise<void> {
    const nexusElement = document.querySelector('[data-player-nexus]') as HTMLElement
    if (!nexusElement) return

    // Flash red and shake
    nexusElement.classList.add('nexus-damage')

    // Create damage number
    const damageElement = document.createElement('div')
    damageElement.className = 'nexus-damage-number'
    damageElement.textContent = `-${damage}`
    damageElement.style.cssText = `
      position: absolute;
      color: #ff0000;
      font-size: 32px;
      font-weight: bold;
      pointer-events: none;
      animation: damage-float 1.5s ease-out forwards;
      z-index: 1000;
    `

    nexusElement.appendChild(damageElement)

    await this.wait(1500)

    damageElement.remove()
    nexusElement.classList.remove('nexus-damage')
  }

  /**
   * Animate unit taking damage
   */
  async animateUnitDamage(position: BattlefieldPosition, damage: number): Promise<void> {
    const targetElement = document.querySelector(
      `[data-slot="${position.player}-${position.slot}"]`,
    ) as HTMLElement

    if (!targetElement) return

    // Create damage number
    const damageElement = document.createElement('div')
    damageElement.className = 'damage-number'
    damageElement.textContent = `-${damage}`
    damageElement.style.cssText = `
      position: absolute;
      color: #ff4444;
      font-size: 20px;
      font-weight: bold;
      pointer-events: none;
      animation: damage-float 1s ease-out forwards;
      z-index: 1000;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
    `

    targetElement.appendChild(damageElement)

    // Shake animation
    targetElement.classList.add('shake')

    await this.wait(1000)

    damageElement.remove()
    targetElement.classList.remove('shake')
  }

  /**
   * Highlight a battlefield slot
   */
  highlightSlot(
    position: BattlefieldPosition,
    type: 'valid' | 'invalid' | 'hover' = 'valid',
  ): void {
    const slotElement = document.querySelector(
      `[data-slot="${position.player}-${position.slot}"]`,
    ) as HTMLElement

    if (!slotElement) return

    // Remove existing highlights
    slotElement.classList.remove(
      'slot-highlight-valid',
      'slot-highlight-invalid',
      'slot-highlight-hover',
    )

    // Add new highlight
    slotElement.classList.add(`slot-highlight-${type}`)
  }

  /**
   * Clear all slot highlights
   */
  clearSlotHighlights(): void {
    document.querySelectorAll('[data-slot]').forEach(element => {
      element.classList.remove(
        'slot-highlight-valid',
        'slot-highlight-invalid',
        'slot-highlight-hover',
      )
    })
  }

  /**
   * Animate card draw
   */
  async animateCardDraw(_card: GameCard): Promise<void> {
    const duration = this.getPerformanceDuration(400)

    const deckElement = document.querySelector('[data-deck]') as HTMLElement
    const handElement = document.querySelector('[data-hand-area]') as HTMLElement

    if (!deckElement || !handElement) return

    // Create temporary card element
    const tempCard = document.createElement('div')
    tempCard.className = 'temp-card-draw'
    tempCard.style.cssText = `
      position: fixed;
      width: 80px;
      height: 120px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 8px;
      z-index: 1000;
      transition: transform ${duration}ms ease-out;
    `

    const deckRect = deckElement.getBoundingClientRect()
    const handRect = handElement.getBoundingClientRect()

    tempCard.style.left = `${deckRect.left}px`
    tempCard.style.top = `${deckRect.top}px`

    document.body.appendChild(tempCard)

    // Animate to hand
    requestAnimationFrame(() => {
      tempCard.style.transform = `translate(${handRect.left - deckRect.left}px, ${handRect.top - deckRect.top}px)`
    })

    await this.wait(duration)
    tempCard.remove()
  }

  /**
   * Animate card play from hand
   */
  async animateCardPlay(card: GameCard, to: BattlefieldPosition): Promise<void> {
    await this.animateCardMove(card, 'hand', to)
  }

  /**
   * Animate card death
   */
  async animateCardDeath(card: GameCard, position: BattlefieldPosition): Promise<void> {
    const cardElement = document.querySelector(`[data-card-id="${card.id}"]`) as HTMLElement
    if (!cardElement) return

    const duration = this.getPerformanceDuration(500)

    // Mystical death animation with tarot theming
    cardElement.style.transition = `opacity ${duration}ms, transform ${duration}ms, filter ${duration}ms`
    cardElement.style.opacity = '0'
    cardElement.style.transform = 'scale(0.5) rotate(180deg)' // Reversed card effect
    cardElement.style.filter = 'sepia(1) hue-rotate(270deg)' // Purple mystical effect

    await this.wait(duration)

    // Move to graveyard
    await this.animateCardMove(card, position, 'graveyard')
  }

  /**
   * Animate card being reversed (tarot mechanic)
   */
  async animateCardReverse(card: GameCard): Promise<void> {
    const cardElement = document.querySelector(`[data-card-id="${card.id}"]`) as HTMLElement
    if (!cardElement) return

    const duration = this.getPerformanceDuration(600)

    // Mystical flip animation
    cardElement.style.transition = `transform ${duration}ms ease-in-out`
    cardElement.style.transform = 'rotateY(180deg) scale(1.1)'

    // Add mystical glow effect
    cardElement.style.filter = 'drop-shadow(0 0 10px #8b5cf6)'

    await this.wait(duration)

    // Return to normal but keep the reversed state
    cardElement.style.transform = ''
    cardElement.style.filter = ''
  }

  /**
   * Animate cosmic resonance buildup (zodiac synergy)
   */
  async animateCosmicResonance(cards: GameCard[]): Promise<void> {
    const duration = this.getPerformanceDuration(800)

    for (const card of cards) {
      const cardElement = document.querySelector(`[data-card-id="${card.id}"]`) as HTMLElement
      if (cardElement) {
        // Pulsing zodiac energy
        cardElement.style.animation = `cosmic-pulse ${duration}ms ease-in-out`
        cardElement.style.filter = 'drop-shadow(0 0 15px gold)'
      }
    }

    await this.wait(duration)

    // Clear effects
    for (const card of cards) {
      const cardElement = document.querySelector(`[data-card-id="${card.id}"]`) as HTMLElement
      if (cardElement) {
        cardElement.style.animation = ''
        cardElement.style.filter = ''
      }
    }
  }

  /**
   * Wait for a specified duration
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Start the animation loop
   */
  private startAnimationLoop(): void {
    // Only run animations in browser environment
    if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') {
      return
    }

    if (this.isRunning) return
    this.isRunning = true

    const loop = () => {
      if (this.performanceMode === 'low') {
        // Skip complex animations in low performance mode
        this.activeAnimations.clear()
      }

      if (this.isRunning) {
        requestAnimationFrame(loop)
      }
    }

    requestAnimationFrame(loop)
  }

  /**
   * Stop the animation loop
   */
  stopAnimationLoop(): void {
    this.isRunning = false
  }
}

// Export singleton instance
export const animationService = new AnimationService()
