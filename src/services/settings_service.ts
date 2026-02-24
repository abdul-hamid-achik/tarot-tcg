export interface GameSettings {
  soundEnabled: boolean
  soundVolume: number // 0-1
  animationSpeed: 'fast' | 'normal' | 'slow'
  autoEndTurnEnabled: boolean
  autoEndTurnDuration: number // seconds
  showAbilityPreviews: boolean
  reduceAnimations: boolean
}

const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  soundVolume: 0.5,
  animationSpeed: 'normal',
  autoEndTurnEnabled: false,
  autoEndTurnDuration: 30,
  showAbilityPreviews: true,
  reduceAnimations: false,
}

const STORAGE_KEY = 'tarot_tcg_settings'

class SettingsService {
  private settings: GameSettings = { ...DEFAULT_SETTINGS }
  private loaded = false

  constructor() {
    this.load()
  }

  /**
   * Load settings from localStorage (SSR-safe)
   */
  private load(): void {
    if (typeof window === 'undefined') return
    if (this.loaded) return

    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        // Merge with defaults to handle missing keys from older versions
        this.settings = { ...DEFAULT_SETTINGS, ...parsed }
      }
    } catch {
      // If parsing fails, use defaults
      this.settings = { ...DEFAULT_SETTINGS }
    }
    this.loaded = true
  }

  /**
   * Persist current settings to localStorage (SSR-safe)
   */
  private save(): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings))
    } catch {
      // Storage full or unavailable - silently fail
    }
  }

  /**
   * Get all settings
   */
  getAll(): GameSettings {
    this.load()
    return { ...this.settings }
  }

  /**
   * Get a single setting value
   */
  get<K extends keyof GameSettings>(key: K): GameSettings[K] {
    this.load()
    return this.settings[key]
  }

  /**
   * Set a single setting value
   */
  set<K extends keyof GameSettings>(key: K, value: GameSettings[K]): void {
    this.load()
    this.settings[key] = value
    this.save()
  }

  /**
   * Update multiple settings at once
   */
  update(partial: Partial<GameSettings>): void {
    this.load()
    this.settings = { ...this.settings, ...partial }
    this.save()
  }

  /**
   * Reset all settings to defaults
   */
  reset(): void {
    this.settings = { ...DEFAULT_SETTINGS }
    this.save()
  }

  /**
   * Get default settings (useful for comparison)
   */
  getDefaults(): GameSettings {
    return { ...DEFAULT_SETTINGS }
  }
}

export const settingsService = new SettingsService()
