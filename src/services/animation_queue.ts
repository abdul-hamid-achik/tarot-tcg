import { GameLogger } from '@/lib/game_logger'

/**
 * Animation queueing with state blocking
 * Ensures animations complete before state updates proceed
 */

export type AnimationType =
  | 'card_played'
  | 'unit_attack'
  | 'unit_damage'
  | 'unit_death'
  | 'nexus_damage'
  | 'card_draw'
  | 'spell_cast'
  | 'effect_trigger'
  | 'stat_change'

export interface QueuedAnimation {
  id: string
  type: AnimationType
  data: Record<string, unknown>
  duration: number
  priority: number
  blocking: boolean
  onComplete?: () => void
  onStart?: () => void
}

export interface AnimationBatch {
  id: string
  animations: QueuedAnimation[]
  mode: 'sequential' | 'parallel'
  onBatchComplete?: () => void
}

export class AnimationQueue {
  private queue: QueuedAnimation[] = []
  private batches: AnimationBatch[] = []
  private isProcessing = false
  private isPaused = false
  private isEnabled = true
  private animationCounter = 0
  private batchCounter = 0
  private currentAnimation: QueuedAnimation | null = null

  // Callbacks for state management
  private onBlockingStart?: () => void
  private onBlockingEnd?: () => void

  /**
   * Configure blocking callbacks
   */
  configure(options: {
    onBlockingStart?: () => void
    onBlockingEnd?: () => void
    enabled?: boolean
  }): void {
    if (options.onBlockingStart) this.onBlockingStart = options.onBlockingStart
    if (options.onBlockingEnd) this.onBlockingEnd = options.onBlockingEnd
    if (options.enabled !== undefined) this.isEnabled = options.enabled
  }

  /**
   * Enable or disable animations (for testing)
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
  }

  /**
   * Add a single animation to the queue
   */
  enqueue(animation: Omit<QueuedAnimation, 'id'>): string {
    if (!this.isEnabled) {
      // If disabled, immediately call onComplete
      animation.onComplete?.()
      return ''
    }

    const id = `anim_${++this.animationCounter}`
    const queuedAnimation: QueuedAnimation = { ...animation, id }

    this.queue.push(queuedAnimation)
    this.queue.sort((a, b) => b.priority - a.priority)

    GameLogger.debug(`AnimationQueue: Enqueued ${animation.type} (${id})`)

    // Start processing if not already
    if (!this.isProcessing && !this.isPaused) {
      this.processQueue()
    }

    return id
  }

  /**
   * Add a batch of animations
   */
  enqueueBatch(
    animations: Omit<QueuedAnimation, 'id'>[],
    mode: 'sequential' | 'parallel' = 'sequential',
    onBatchComplete?: () => void
  ): string {
    if (!this.isEnabled) {
      // If disabled, immediately call callbacks
      animations.forEach(a => { a.onComplete?.() })
      onBatchComplete?.()
      return ''
    }

    const batchId = `batch_${++this.batchCounter}`
    const queuedAnimations = animations.map((anim, index) => ({
      ...anim,
      id: `${batchId}_${index}`,
    }))

    this.batches.push({
      id: batchId,
      animations: queuedAnimations,
      mode,
      onBatchComplete,
    })

    GameLogger.debug(
      `AnimationQueue: Enqueued batch ${batchId} (${animations.length} animations, ${mode})`
    )

    // Start processing if not already
    if (!this.isProcessing && !this.isPaused) {
      this.processQueue()
    }

    return batchId
  }

  /**
   * Process the animation queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.isPaused) return

    this.isProcessing = true

    // Notify if we have blocking animations
    if (this.hasBlockingAnimations()) {
      this.onBlockingStart?.()
    }

    while (this.queue.length > 0 || this.batches.length > 0) {
      if (this.isPaused) break

      // Process batches first
      if (this.batches.length > 0) {
        const batch = this.batches.shift()!
        await this.processBatch(batch)
        continue
      }

      // Process single animations
      const animation = this.queue.shift()!
      await this.processAnimation(animation)
    }

    this.isProcessing = false
    this.currentAnimation = null

    // Notify that blocking is complete
    this.onBlockingEnd?.()
  }

  /**
   * Process a single animation
   */
  private async processAnimation(animation: QueuedAnimation): Promise<void> {
    this.currentAnimation = animation
    animation.onStart?.()

    GameLogger.debug(`AnimationQueue: Processing ${animation.type} (${animation.id})`)

    // Wait for animation duration
    await this.wait(animation.duration)

    animation.onComplete?.()
    this.currentAnimation = null
  }

  /**
   * Process a batch of animations
   */
  private async processBatch(batch: AnimationBatch): Promise<void> {
    GameLogger.debug(`AnimationQueue: Processing batch ${batch.id}`)

    if (batch.mode === 'parallel') {
      // Run all animations in parallel
      await Promise.all(batch.animations.map(a => this.processAnimation(a)))
    } else {
      // Run animations sequentially
      for (const animation of batch.animations) {
        await this.processAnimation(animation)
      }
    }

    batch.onBatchComplete?.()
  }

  /**
   * Wait for a specified duration
   */
  private wait(duration: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, duration))
  }

  /**
   * Check if there are blocking animations
   */
  private hasBlockingAnimations(): boolean {
    return this.queue.some(a => a.blocking) ||
      this.batches.some(b => b.animations.some(a => a.blocking))
  }

  /**
   * Pause animation processing
   */
  pause(): void {
    this.isPaused = true
    GameLogger.debug('AnimationQueue: Paused')
  }

  /**
   * Resume animation processing
   */
  resume(): void {
    this.isPaused = false
    GameLogger.debug('AnimationQueue: Resumed')
    if (!this.isProcessing) {
      this.processQueue()
    }
  }

  /**
   * Clear all queued animations
   */
  clear(): void {
    // Call onComplete for all cleared animations
    this.queue.forEach(a => { a.onComplete?.() })
    this.batches.forEach(b => {
      b.animations.forEach(a => { a.onComplete?.() })
      b.onBatchComplete?.()
    })

    this.queue = []
    this.batches = []
    this.currentAnimation = null

    GameLogger.debug('AnimationQueue: Cleared')
  }

  /**
   * Get queue status
   */
  getStatus(): {
    queueLength: number
    batchCount: number
    isProcessing: boolean
    isPaused: boolean
    currentAnimation: string | null
  } {
    return {
      queueLength: this.queue.length,
      batchCount: this.batches.length,
      isProcessing: this.isProcessing,
      isPaused: this.isPaused,
      currentAnimation: this.currentAnimation?.id || null,
    }
  }

  /**
   * Check if queue is empty and not processing
   */
  isIdle(): boolean {
    return !this.isProcessing && this.queue.length === 0 && this.batches.length === 0
  }

  /**
   * Wait until queue is idle
   */
  async waitForIdle(): Promise<void> {
    while (!this.isIdle()) {
      await this.wait(16) // Check every frame
    }
  }
}

// Singleton instance
export const animationQueue = new AnimationQueue()
