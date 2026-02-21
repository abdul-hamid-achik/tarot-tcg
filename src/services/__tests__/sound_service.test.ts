import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── Web Audio API mocks ──────────────────────────────────────────────────────
const mockOscillator = {
  type: 'sine' as OscillatorType,
  frequency: {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  },
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}

const mockGainNode = {
  gain: {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  },
  connect: vi.fn(),
}

let mockState: AudioContextState = 'running'

const mockAudioContext = {
  get state() {
    return mockState
  },
  createOscillator: vi.fn(() => mockOscillator),
  createGain: vi.fn(() => mockGainNode),
  destination: {},
  currentTime: 0,
  resume: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
}

// Stub globally before anything imports AudioContext
vi.stubGlobal('AudioContext', vi.fn(() => mockAudioContext))

// ── Fresh singleton per test ──────────────────────────────────────────────────
// resetModules() ensures each test gets a pristine SoundService instance
async function freshService() {
  vi.resetModules()
  const mod = await import('@/services/sound_service')
  return mod.soundService
}

describe('SoundService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState = 'running'
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('init()', () => {
    it('creates an AudioContext on init', async () => {
      const svc = await freshService()
      svc.init()

      expect(AudioContext).toHaveBeenCalledTimes(1)
      expect(svc.isReady()).toBe(true)
    })

    it('is idempotent — calling init() twice does not create two contexts', async () => {
      const svc = await freshService()
      svc.init()
      svc.init()

      expect(AudioContext).toHaveBeenCalledTimes(1)
    })

    it('loads saved mute preference from localStorage', async () => {
      localStorage.setItem('tarot-tcg-muted', 'true')
      const svc = await freshService()
      svc.init()

      expect(svc.isMuted()).toBe(true)
    })

    it('loads saved volume preference from localStorage', async () => {
      localStorage.setItem('tarot-tcg-volume', '0.8')
      const svc = await freshService()
      svc.init()

      expect(svc.getVolume()).toBeCloseTo(0.8)
    })

    it('reports not ready before init', async () => {
      const svc = await freshService()
      expect(svc.isReady()).toBe(false)
    })
  })

  describe('play()', () => {
    it('plays a sound effect by creating oscillator + gain nodes', async () => {
      const svc = await freshService()
      svc.init()
      svc.play('card_play')

      expect(mockAudioContext.createOscillator).toHaveBeenCalled()
      expect(mockAudioContext.createGain).toHaveBeenCalled()
      expect(mockOscillator.start).toHaveBeenCalled()
      expect(mockOscillator.stop).toHaveBeenCalled()
    })

    it('does nothing when muted', async () => {
      const svc = await freshService()
      svc.init()
      svc.toggleMute() // now muted
      svc.play('card_play')

      expect(mockAudioContext.createOscillator).not.toHaveBeenCalled()
    })

    it('does nothing when not initialized', async () => {
      const svc = await freshService()
      // intentionally skip init()
      svc.play('card_play')

      expect(mockAudioContext.createOscillator).not.toHaveBeenCalled()
    })

    it('resumes a suspended AudioContext before playing', async () => {
      mockState = 'suspended'
      const svc = await freshService()
      svc.init()
      svc.play('button_click')

      expect(mockAudioContext.resume).toHaveBeenCalled()
    })

    it('plays all 15 defined sound effects without throwing', async () => {
      const svc = await freshService()
      svc.init()

      const effects = [
        'card_play', 'card_draw', 'attack', 'damage', 'unit_death',
        'spell_cast', 'turn_start', 'turn_end', 'game_win', 'game_lose',
        'button_click', 'error', 'mana_spend', 'heal', 'mulligan',
      ] as const

      for (const effect of effects) {
        expect(() => svc.play(effect)).not.toThrow()
      }
    })
  })

  describe('toggleMute()', () => {
    it('returns true when muting', async () => {
      const svc = await freshService()
      expect(svc.toggleMute()).toBe(true)
    })

    it('returns false when unmuting', async () => {
      const svc = await freshService()
      svc.toggleMute() // → true (muted)
      expect(svc.toggleMute()).toBe(false) // → false (unmuted)
    })

    it('persists mute state to localStorage', async () => {
      const svc = await freshService()
      svc.toggleMute() // mute

      expect(localStorage.getItem('tarot-tcg-muted')).toBe('true')
    })

    it('isMuted() reflects the toggle', async () => {
      const svc = await freshService()
      expect(svc.isMuted()).toBe(false)
      svc.toggleMute()
      expect(svc.isMuted()).toBe(true)
      svc.toggleMute()
      expect(svc.isMuted()).toBe(false)
    })
  })

  describe('setVolume()', () => {
    it('clamps volume to maximum of 1', async () => {
      const svc = await freshService()
      svc.setVolume(1.5)
      expect(svc.getVolume()).toBe(1)
    })

    it('clamps volume to minimum of 0', async () => {
      const svc = await freshService()
      svc.setVolume(-0.5)
      expect(svc.getVolume()).toBe(0)
    })

    it('persists volume to localStorage', async () => {
      const svc = await freshService()
      svc.setVolume(0.7)

      expect(localStorage.getItem('tarot-tcg-volume')).toBe('0.7')
    })
  })

  describe('destroy()', () => {
    it('closes the AudioContext', async () => {
      const svc = await freshService()
      svc.init()
      svc.destroy()

      expect(mockAudioContext.close).toHaveBeenCalled()
      expect(svc.isReady()).toBe(false)
    })

    it('is safe to call when not initialized', async () => {
      const svc = await freshService()
      expect(() => svc.destroy()).not.toThrow()
    })

    it('does not close an already-closed context', async () => {
      mockState = 'closed'
      const svc = await freshService()
      svc.init()
      svc.destroy()

      expect(mockAudioContext.close).not.toHaveBeenCalled()
    })
  })
})
