"use client"

import type { CellPosition } from '@/store/gameStore'
import type { Card as GameCard } from '@/schemas/gameSchemas'
import { gridMathService } from './GridMathService'

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

export interface GridCellAnimation {
    cellElement: HTMLElement
    position: CellPosition
    type: 'highlight' | 'shake' | 'pulse' | 'glow'
    options: AnimationOptions
}

export interface CombatAnimation {
    attackerElement: HTMLElement
    targetElement?: HTMLElement
    position: CellPosition
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
    easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeInCubic: (t: number) => t * t * t,
    easeOutCubic: (t: number) => (--t) * t * t + 1,
    easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
    easeOutBounce: (t: number) => {
        if (t < (1 / 2.75)) {
            return 7.5625 * t * t
        } else if (t < (2 / 2.75)) {
            return 7.5625 * (t -= (1.5 / 2.75)) * t + 0.75
        } else if (t < (2.5 / 2.75)) {
            return 7.5625 * (t -= (2.25 / 2.75)) * t + 0.9375
        } else {
            return 7.5625 * (t -= (2.625 / 2.75)) * t + 0.984375
        }
    }
}

class AnimationService {
    private activeAnimations = new Map<string, Animation>()
    private rafId: number | null = null
    private isRunning = false
    private performanceMode: 'high' | 'medium' | 'low' = 'high'

    constructor() {
        this.startAnimationLoop()
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
            case 'high': return baseDuration
            case 'medium': return baseDuration * 0.75
            case 'low': return baseDuration * 0.5
        }
    }

    /**
     * Animate a card moving between positions
     */
    animateCardMove(
        cardElement: HTMLElement,
        from: { x: number; y: number } | CellPosition,
        to: { x: number; y: number } | CellPosition,
        options: AnimationOptions = {}
    ): Promise<void> {
        const animationId = this.generateAnimationId('card-move')

        // Convert grid positions to screen coordinates if needed
        const fromCoords = this.isGridPosition(from)
            ? gridMathService.gridToScreenCoordinates(from)
            : from

        const toCoords = this.isGridPosition(to)
            ? gridMathService.gridToScreenCoordinates(to)
            : to

        const animation = new CardMoveAnimationImpl(
            animationId,
            cardElement,
            fromCoords,
            toCoords,
            {
                duration: this.getPerformanceDuration(options.duration || 500),
                easing: easingFunctions.easeOutCubic,
                onStart: () => { },
                onProgress: () => { },
                onComplete: () => { },
                ...options
            }
        )

        return this.runAnimation(animation)
    }

    /**
     * Animate card being played from hand
     */
    animateCardPlay(
        cardElement: HTMLElement,
        handPosition: { x: number; y: number },
        gridPosition: CellPosition,
        options: AnimationOptions = {}
    ): Promise<void> {
        const targetCoords = gridMathService.gridToScreenCoordinates(gridPosition)

        return this.animateCardMove(cardElement, handPosition, targetCoords, {
            duration: this.getPerformanceDuration(options.duration || 600),
            easing: easingFunctions.easeOutCubic,
            onStart: () => {
                cardElement.style.zIndex = '1000' // Bring to front during animation
                cardElement.style.transform += ' scale(1.05)' // More subtle scale for performance
                options.onStart?.()
            },
            onComplete: () => {
                cardElement.style.zIndex = ''
                cardElement.style.transform = cardElement.style.transform.replace(' scale(1.05)', '')
                options.onComplete?.()
            },
            ...options
        })
    }

    /**
     * Animate combat attack
     */
    animateCombatAttack(
        attackerElement: HTMLElement,
        attackerPosition: CellPosition,
        targetPosition?: CellPosition,
        options: AnimationOptions = {}
    ): Promise<void> {
        const animationId = this.generateAnimationId('combat-attack')

        const animation = new CombatAttackAnimation(
            animationId,
            attackerElement,
            attackerPosition,
            {
                duration: 800,
                easing: easingFunctions.easeInOutQuad,
                onStart: () => { },
                onProgress: () => { },
                onComplete: () => { },
                ...options
            },
            targetPosition
        )

        return this.runAnimation(animation)
    }

    /**
     * Animate damage numbers
     */
    animateDamage(
        position: CellPosition,
        damage: number,
        type: 'damage' | 'heal' = 'damage',
        options: AnimationOptions = {}
    ): Promise<void> {
        const animationId = this.generateAnimationId('damage-number')

        // Create damage number element
        const damageElement = this.createDamageElement(damage, type)
        const coords = gridMathService.gridToScreenCoordinates(position)

        // Position element
        damageElement.style.position = 'absolute'
        damageElement.style.left = `${coords.x}px`
        damageElement.style.top = `${coords.y}px`
        damageElement.style.pointerEvents = 'none'
        damageElement.style.zIndex = '2000'

        document.body.appendChild(damageElement)

        const animation = new DamageNumberAnimation(
            animationId,
            damageElement,
            coords,
            {
                duration: 1500,
                easing: easingFunctions.easeOutQuad,
                onStart: () => { },
                onProgress: () => { },
                onComplete: () => {
                    damageElement.remove()
                },
                ...options
            }
        )

        return this.runAnimation(animation)
    }

    /**
     * Animate cell highlighting
     */
    animateCellHighlight(
        cellElement: HTMLElement,
        type: 'valid' | 'invalid' | 'selected' | 'hover' = 'valid',
        options: AnimationOptions = {}
    ): Promise<void> {
        const animationId = this.generateAnimationId('cell-highlight')

        const animation = new CellHighlightAnimation(
            animationId,
            cellElement,
            type,
            {
                duration: 300,
                easing: easingFunctions.easeOutQuad,
                onStart: () => { },
                onProgress: () => { },
                onComplete: () => { },
                ...options
            }
        )

        return this.runAnimation(animation)
    }

    /**
     * Animate multiple cells simultaneously (for combat resolution)
     */
    animateMultipleCells(
        positions: CellPosition[],
        type: 'shake' | 'glow' | 'pulse',
        options: AnimationOptions = {}
    ): Promise<void[]> {
        const promises = positions.map(position => {
            const cellElement = this.getCellElementAtPosition(position)
            if (!cellElement) return Promise.resolve()

            return this.animateCellEffect(cellElement, type, options)
        })

        return Promise.all(promises)
    }

    /**
     * Animate card draw from deck
     */
    animateCardDraw(
        cardElement: HTMLElement,
        deckPosition: { x: number; y: number },
        handPosition: { x: number; y: number },
        options: AnimationOptions = {}
    ): Promise<void> {
        return this.animateCardMove(cardElement, deckPosition, handPosition, {
            duration: 400,
            easing: easingFunctions.easeOutQuad,
            onStart: () => {
                cardElement.style.transform += ' scale(0.8)'
            },
            onProgress: (progress) => {
                const scale = 0.8 + (0.2 * progress)
                cardElement.style.transform = cardElement.style.transform.replace(/scale\([^)]*\)/, `scale(${scale})`)
            },
            ...options
        })
    }

    /**
     * Stop all animations
     */
    stopAllAnimations(): void {
        this.activeAnimations.forEach(animation => {
            animation.stop()
        })
        this.activeAnimations.clear()
    }

    /**
     * Stop specific animation
     */
    stopAnimation(animationId: string): void {
        const animation = this.activeAnimations.get(animationId)
        if (animation) {
            animation.stop()
            this.activeAnimations.delete(animationId)
        }
    }

    /**
     * Check if any animations are running
     */
    hasActiveAnimations(): boolean {
        return this.activeAnimations.size > 0
    }

    /**
     * Get active animation count
     */
    getActiveAnimationCount(): number {
        return this.activeAnimations.size
    }

    /**
     * Start the main animation loop
     */
    private startAnimationLoop(): void {
        if (this.isRunning) return

        this.isRunning = true
        const loop = () => {
            if (this.activeAnimations.size === 0) {
                this.rafId = requestAnimationFrame(loop)
                return
            }

            const currentTime = performance.now()

            // Update all active animations
            this.activeAnimations.forEach((animation, id) => {
                const completed = animation.update(currentTime)
                if (completed) {
                    this.activeAnimations.delete(id)
                }
            })

            this.rafId = requestAnimationFrame(loop)
        }

        this.rafId = requestAnimationFrame(loop)
    }

    /**
     * Run an animation
     */
    private runAnimation(animation: Animation): Promise<void> {
        this.activeAnimations.set(animation.id, animation)
        return animation.promise
    }

    /**
     * Generate unique animation ID
     */
    private generateAnimationId(prefix: string): string {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    /**
     * Check if position is a grid position
     */
    private isGridPosition(pos: unknown): pos is CellPosition {
        return typeof pos === 'object' &&
            pos !== null &&
            'row' in pos &&
            'col' in pos &&
            typeof (pos as { row: unknown }).row === 'number' &&
            typeof (pos as { col: unknown }).col === 'number'
    }

    /**
     * Create damage number element
     */
    private createDamageElement(damage: number, type: 'damage' | 'heal'): HTMLElement {
        const element = document.createElement('div')
        element.textContent = type === 'damage' ? `-${damage}` : `+${damage}`
        element.style.fontSize = '24px'
        element.style.fontWeight = 'bold'
        element.style.color = type === 'damage' ? '#ef4444' : '#22c55e'
        element.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)'
        element.style.userSelect = 'none'
        element.className = 'animate-pulse'
        return element
    }

    /**
     * Get cell element at grid position
     */
    private getCellElementAtPosition(position: CellPosition): HTMLElement | null {
        const selector = `[data-grid-cell="${position.row}-${position.col}"]`
        const element = document.querySelector(selector)
        return element instanceof HTMLElement ? element : null
    }

    /**
     * Animate cell effects
     */
    private animateCellEffect(
        element: HTMLElement,
        type: 'shake' | 'glow' | 'pulse',
        options: AnimationOptions
    ): Promise<void> {
        const animationId = this.generateAnimationId(`cell-${type}`)

        const animation = new CellEffectAnimation(
            animationId,
            element,
            type,
            {
                duration: 500,
                easing: easingFunctions.easeOutQuad,
                onStart: () => { },
                onProgress: () => { },
                onComplete: () => { },
                ...options
            }
        )

        return this.runAnimation(animation)
    }
}

// Abstract Animation base class
abstract class Animation {
    public readonly id: string
    public readonly promise: Promise<void>
    protected startTime: number = 0
    protected isComplete: boolean = false
    protected resolvePromise!: () => void
    protected rejectPromise!: (reason?: unknown) => void

    constructor(
        id: string,
        protected options: Required<AnimationOptions>
    ) {
        this.id = id
        this.promise = new Promise((resolve, reject) => {
            this.resolvePromise = resolve
            this.rejectPromise = reject
        })
    }

    abstract update(currentTime: number): boolean

    stop(): void {
        this.isComplete = true
        this.rejectPromise(new Error('Animation stopped'))
    }

    protected complete(): void {
        if (this.isComplete) return
        this.isComplete = true
        this.options.onComplete?.()
        this.resolvePromise()
    }

    protected getProgress(currentTime: number): number {
        if (this.startTime === 0) {
            this.startTime = currentTime
            this.options.onStart?.()
            return 0
        }

        const elapsed = currentTime - this.startTime
        const progress = Math.min(elapsed / this.options.duration, 1)
        return this.options.easing(progress)
    }
}

// Specific animation implementations
class CardMoveAnimationImpl extends Animation {
    constructor(
        id: string,
        private element: HTMLElement,
        private from: { x: number; y: number },
        private to: { x: number; y: number },
        options: Required<AnimationOptions>
    ) {
        super(id, options)
    }

    update(currentTime: number): boolean {
        if (this.isComplete) return true

        const progress = this.getProgress(currentTime)

        const x = this.from.x + (this.to.x - this.from.x) * progress
        const y = this.from.y + (this.to.y - this.from.y) * progress

        this.element.style.transform = `translate(${x}px, ${y}px)`
        this.options.onProgress?.(progress)

        if (progress >= 1) {
            this.complete()
            return true
        }

        return false
    }
}

class CombatAttackAnimation extends Animation {
    constructor(
        id: string,
        private attackerElement: HTMLElement,
        private attackerPosition: CellPosition,
        options: Required<AnimationOptions>,
        private targetPosition?: CellPosition
    ) {
        super(id, options)
    }

    update(currentTime: number): boolean {
        if (this.isComplete) return true

        const progress = this.getProgress(currentTime)

        if (progress < 0.5) {
            // Move towards target
            const moveProgress = progress * 2
            if (this.targetPosition) {
                const attackerCoords = gridMathService.gridToScreenCoordinates(this.attackerPosition)
                const targetCoords = gridMathService.gridToScreenCoordinates(this.targetPosition)

                const x = attackerCoords.x + (targetCoords.x - attackerCoords.x) * moveProgress * 0.3
                const y = attackerCoords.y + (targetCoords.y - attackerCoords.y) * moveProgress * 0.3

                this.attackerElement.style.transform = `translate(${x - attackerCoords.x}px, ${y - attackerCoords.y}px) scale(${1 + moveProgress * 0.2})`
            } else {
                // Attack nexus - just scale up
                this.attackerElement.style.transform = `scale(${1 + moveProgress * 0.3})`
            }
        } else {
            // Return to original position
            const returnProgress = (progress - 0.5) * 2
            const scale = 1.2 - (returnProgress * 0.2)

            if (this.targetPosition) {
                const attackerCoords = gridMathService.gridToScreenCoordinates(this.attackerPosition)
                const targetCoords = gridMathService.gridToScreenCoordinates(this.targetPosition)

                const x = (attackerCoords.x + (targetCoords.x - attackerCoords.x) * 0.3) * (1 - returnProgress)
                const y = (attackerCoords.y + (targetCoords.y - attackerCoords.y) * 0.3) * (1 - returnProgress)

                this.attackerElement.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
            } else {
                this.attackerElement.style.transform = `scale(${scale})`
            }
        }

        this.options.onProgress?.(progress)

        if (progress >= 1) {
            this.attackerElement.style.transform = '' // Reset
            this.complete()
            return true
        }

        return false
    }
}

class DamageNumberAnimation extends Animation {
    constructor(
        id: string,
        private element: HTMLElement,
        private startPosition: { x: number; y: number },
        options: Required<AnimationOptions>
    ) {
        super(id, options)
    }

    update(currentTime: number): boolean {
        if (this.isComplete) return true

        const progress = this.getProgress(currentTime)

        // Float upward and fade out
        const y = this.startPosition.y - (progress * 60)
        const opacity = 1 - progress
        const scale = 1 + (progress * 0.5)

        this.element.style.transform = `translate(0, ${y - this.startPosition.y}px) scale(${scale})`
        this.element.style.opacity = opacity.toString()

        this.options.onProgress?.(progress)

        if (progress >= 1) {
            this.complete()
            return true
        }

        return false
    }
}

class CellHighlightAnimation extends Animation {
    constructor(
        id: string,
        private element: HTMLElement,
        private highlightType: string,
        options: Required<AnimationOptions>
    ) {
        super(id, options)
    }

    update(currentTime: number): boolean {
        if (this.isComplete) return true

        const progress = this.getProgress(currentTime)

        // Add highlight classes based on type
        const intensity = Math.sin(progress * Math.PI) // Fade in and out

        switch (this.highlightType) {
            case 'valid':
                this.element.style.boxShadow = `0 0 ${20 * intensity}px rgba(34, 197, 94, 0.8)`
                this.element.style.borderColor = `rgba(34, 197, 94, ${intensity})`
                break
            case 'invalid':
                this.element.style.boxShadow = `0 0 ${20 * intensity}px rgba(239, 68, 68, 0.8)`
                this.element.style.borderColor = `rgba(239, 68, 68, ${intensity})`
                break
            case 'selected':
                this.element.style.boxShadow = `0 0 ${20 * intensity}px rgba(59, 130, 246, 0.8)`
                this.element.style.borderColor = `rgba(59, 130, 246, ${intensity})`
                break
            case 'hover':
                this.element.style.boxShadow = `0 0 ${15 * intensity}px rgba(168, 85, 247, 0.6)`
                this.element.style.borderColor = `rgba(168, 85, 247, ${intensity * 0.8})`
                break
        }

        this.options.onProgress?.(progress)

        if (progress >= 1) {
            // Clean up styles
            this.element.style.boxShadow = ''
            this.element.style.borderColor = ''
            this.complete()
            return true
        }

        return false
    }
}

class CellEffectAnimation extends Animation {
    constructor(
        id: string,
        private element: HTMLElement,
        private effectType: 'shake' | 'glow' | 'pulse',
        options: Required<AnimationOptions>
    ) {
        super(id, options)
    }

    update(currentTime: number): boolean {
        if (this.isComplete) return true

        const progress = this.getProgress(currentTime)

        switch (this.effectType) {
            case 'shake':
                const shakeX = Math.sin(progress * Math.PI * 8) * 3 * (1 - progress)
                const shakeY = Math.cos(progress * Math.PI * 6) * 2 * (1 - progress)
                this.element.style.transform = `translate(${shakeX}px, ${shakeY}px)`
                break

            case 'glow':
                const glowIntensity = Math.sin(progress * Math.PI * 2) * 0.5 + 0.5
                this.element.style.boxShadow = `0 0 ${30 * glowIntensity}px rgba(255, 215, 0, 0.8)`
                break

            case 'pulse':
                const pulseScale = 1 + Math.sin(progress * Math.PI * 4) * 0.1
                this.element.style.transform = `scale(${pulseScale})`
                break
        }

        this.options.onProgress?.(progress)

        if (progress >= 1) {
            // Reset styles
            this.element.style.transform = ''
            this.element.style.boxShadow = ''
            this.complete()
            return true
        }

        return false
    }
}

// Lazy singleton instance - only created on client side
let animationServiceInstance: AnimationService | null = null

export const animationService = {
    getInstance(): AnimationService {
        if (typeof window === 'undefined') {
            // Return a no-op service for SSR
            return {
                setPerformanceMode: () => { },
                animateCardMove: () => Promise.resolve(),
                animateCardPlay: () => Promise.resolve(),
                animateCombatAttack: () => Promise.resolve(),
                animateDamage: () => Promise.resolve(),
                animateCellHighlight: () => Promise.resolve(),
                animateMultipleCells: () => Promise.resolve([]),
                animateCardDraw: () => Promise.resolve(),
                stopAllAnimations: () => { },
                stopAnimation: () => { },
                hasActiveAnimations: () => false,
                getActiveAnimationCount: () => 0,
            } as unknown as AnimationService
        }

        if (!animationServiceInstance) {
            animationServiceInstance = new AnimationService()
        }
        return animationServiceInstance
    },

    // Proxy methods for convenience
    setPerformanceMode(mode: 'high' | 'medium' | 'low') {
        return this.getInstance().setPerformanceMode(mode)
    },

    animateCardMove(cardElement: HTMLElement, from: CellPosition | { x: number; y: number }, to: CellPosition | { x: number; y: number }, options?: AnimationOptions) {
        return this.getInstance().animateCardMove(cardElement, from, to, options)
    },

    animateCardPlay(cardElement: HTMLElement, handPosition: { x: number; y: number }, gridPosition: CellPosition, options?: AnimationOptions) {
        return this.getInstance().animateCardPlay(cardElement, handPosition, gridPosition, options)
    },

    animateCombatAttack(attackerElement: HTMLElement, attackerPosition: CellPosition, targetPosition?: CellPosition, options?: AnimationOptions) {
        return this.getInstance().animateCombatAttack(attackerElement, attackerPosition, targetPosition, options)
    },

    animateDamage(position: CellPosition, damage: number, type: 'damage' | 'heal' = 'damage', options?: AnimationOptions) {
        return this.getInstance().animateDamage(position, damage, type, options)
    },

    animateCellHighlight(cellElement: HTMLElement, type?: 'valid' | 'invalid' | 'hover' | 'selected', options?: AnimationOptions) {
        return this.getInstance().animateCellHighlight(cellElement, type, options)
    },

    animateMultipleCells(positions: CellPosition[], type: 'shake' | 'glow' | 'pulse', options?: AnimationOptions) {
        return this.getInstance().animateMultipleCells(positions, type, options)
    },

    animateCardDraw(cardElement: HTMLElement, deckPosition: { x: number; y: number }, handPosition: { x: number; y: number }, options?: AnimationOptions) {
        return this.getInstance().animateCardDraw(cardElement, deckPosition, handPosition, options)
    },

    stopAllAnimations() {
        return this.getInstance().stopAllAnimations()
    },

    stopAnimation(animationId: string) {
        return this.getInstance().stopAnimation(animationId)
    },

    hasActiveAnimations() {
        return this.getInstance().hasActiveAnimations()
    },

    getActiveAnimationCount() {
        return this.getInstance().getActiveAnimationCount()
    }
}
