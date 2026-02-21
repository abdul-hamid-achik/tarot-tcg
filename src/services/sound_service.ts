import { GameLogger } from '@/lib/game_logger'

type SoundEffect =
  | 'card_play'
  | 'card_draw'
  | 'attack'
  | 'damage'
  | 'unit_death'
  | 'spell_cast'
  | 'turn_start'
  | 'turn_end'
  | 'game_win'
  | 'game_lose'
  | 'button_click'
  | 'error'
  | 'mana_spend'
  | 'heal'
  | 'mulligan'

// Synthesized sound parameters for each effect
const SOUND_DEFINITIONS: Record<SoundEffect, { frequency: number; duration: number; type: OscillatorType; volume: number; ramp?: 'up' | 'down' | 'pulse' }> = {
  card_play: { frequency: 440, duration: 0.15, type: 'sine', volume: 0.3, ramp: 'down' },
  card_draw: { frequency: 600, duration: 0.1, type: 'sine', volume: 0.2, ramp: 'up' },
  attack: { frequency: 200, duration: 0.2, type: 'sawtooth', volume: 0.3, ramp: 'down' },
  damage: { frequency: 150, duration: 0.15, type: 'square', volume: 0.25, ramp: 'down' },
  unit_death: { frequency: 100, duration: 0.4, type: 'sawtooth', volume: 0.2, ramp: 'down' },
  spell_cast: { frequency: 800, duration: 0.3, type: 'sine', volume: 0.25, ramp: 'pulse' },
  turn_start: { frequency: 500, duration: 0.2, type: 'sine', volume: 0.2, ramp: 'up' },
  turn_end: { frequency: 350, duration: 0.15, type: 'sine', volume: 0.15, ramp: 'down' },
  game_win: { frequency: 660, duration: 0.8, type: 'sine', volume: 0.35, ramp: 'up' },
  game_lose: { frequency: 200, duration: 0.6, type: 'sine', volume: 0.3, ramp: 'down' },
  button_click: { frequency: 1000, duration: 0.05, type: 'sine', volume: 0.15 },
  error: { frequency: 200, duration: 0.2, type: 'square', volume: 0.2, ramp: 'pulse' },
  mana_spend: { frequency: 700, duration: 0.1, type: 'sine', volume: 0.15, ramp: 'down' },
  heal: { frequency: 550, duration: 0.25, type: 'sine', volume: 0.2, ramp: 'up' },
  mulligan: { frequency: 400, duration: 0.15, type: 'triangle', volume: 0.2, ramp: 'down' },
}

class SoundService {
  private audioContext: AudioContext | null = null
  private masterVolume = 0.5
  private muted = false
  private initialized = false

  /**
   * Initialize the audio context (must be called from user gesture)
   */
  init(): void {
    if (this.initialized) return
    if (typeof window === 'undefined') return

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.initialized = true

      // Load preferences from localStorage
      const savedVolume = localStorage.getItem('tarot-tcg-volume')
      if (savedVolume) this.masterVolume = parseFloat(savedVolume)

      const savedMuted = localStorage.getItem('tarot-tcg-muted')
      if (savedMuted) this.muted = savedMuted === 'true'

      GameLogger.system('Sound system initialized')
    } catch (error) {
      GameLogger.warn('Failed to initialize audio context:', error)
    }
  }

  /**
   * Play a sound effect
   */
  play(effect: SoundEffect): void {
    if (this.muted || !this.audioContext) return

    // Lazy init on first play (handles autoplay policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }

    const def = SOUND_DEFINITIONS[effect]
    if (!def) return

    try {
      const ctx = this.audioContext
      const now = ctx.currentTime

      // Create oscillator
      const oscillator = ctx.createOscillator()
      oscillator.type = def.type
      oscillator.frequency.setValueAtTime(def.frequency, now)

      // Create gain node for volume envelope
      const gainNode = ctx.createGain()
      const volume = def.volume * this.masterVolume

      switch (def.ramp) {
        case 'up':
          gainNode.gain.setValueAtTime(0, now)
          gainNode.gain.linearRampToValueAtTime(volume, now + def.duration * 0.3)
          gainNode.gain.linearRampToValueAtTime(0, now + def.duration)
          break
        case 'down':
          gainNode.gain.setValueAtTime(volume, now)
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + def.duration)
          break
        case 'pulse':
          gainNode.gain.setValueAtTime(0, now)
          gainNode.gain.linearRampToValueAtTime(volume, now + def.duration * 0.1)
          gainNode.gain.linearRampToValueAtTime(volume * 0.3, now + def.duration * 0.5)
          gainNode.gain.linearRampToValueAtTime(volume * 0.8, now + def.duration * 0.7)
          gainNode.gain.linearRampToValueAtTime(0, now + def.duration)
          break
        default:
          gainNode.gain.setValueAtTime(volume, now)
          gainNode.gain.linearRampToValueAtTime(0, now + def.duration)
      }

      // Special frequency modulation for some effects
      if (effect === 'game_win') {
        // Rising arpeggio feel
        oscillator.frequency.setValueAtTime(440, now)
        oscillator.frequency.linearRampToValueAtTime(550, now + 0.2)
        oscillator.frequency.linearRampToValueAtTime(660, now + 0.4)
        oscillator.frequency.linearRampToValueAtTime(880, now + 0.6)
      } else if (effect === 'game_lose') {
        // Descending
        oscillator.frequency.setValueAtTime(400, now)
        oscillator.frequency.linearRampToValueAtTime(200, now + 0.3)
        oscillator.frequency.linearRampToValueAtTime(100, now + 0.6)
      } else if (effect === 'spell_cast') {
        // Shimmer effect
        oscillator.frequency.setValueAtTime(600, now)
        oscillator.frequency.linearRampToValueAtTime(1200, now + 0.15)
        oscillator.frequency.linearRampToValueAtTime(800, now + 0.3)
      }

      // Connect and play
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      oscillator.start(now)
      oscillator.stop(now + def.duration + 0.05)
    } catch (error) {
      // Silently fail - don't break the game for sound errors
    }
  }

  /**
   * Set master volume (0-1)
   */
  setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume))
    localStorage.setItem('tarot-tcg-volume', String(this.masterVolume))
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return this.masterVolume
  }

  /**
   * Toggle mute
   */
  toggleMute(): boolean {
    this.muted = !this.muted
    localStorage.setItem('tarot-tcg-muted', String(this.muted))
    return this.muted
  }

  /**
   * Get mute state
   */
  isMuted(): boolean {
    return this.muted
  }

  /**
   * Check if sound system is ready
   */
  isReady(): boolean {
    return this.initialized && this.audioContext !== null
  }

  /**
   * Clean up audio context (call on component unmount)
   */
  destroy(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close()
    }
    this.audioContext = null
    this.initialized = false
  }
}

export const soundService = new SoundService()
