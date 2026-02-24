'use client'

import {
  ArrowLeft,
  BarChart3,
  Gauge,
  Home,
  Info,
  Monitor,
  Moon,
  RotateCcw,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useTheme } from '@/contexts/theme_context'
import type { GameSettings } from '@/services/settings_service'
import { settingsService } from '@/services/settings_service'
import { soundService } from '@/services/sound_service'

export default function SettingsPage() {
  const [settings, setSettings] = useState<GameSettings | null>(null)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setSettings(settingsService.getAll())
  }, [])

  const updateSetting = useCallback(
    <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
      settingsService.set(key, value)
      setSettings(settingsService.getAll())

      // Sync sound settings with sound service
      if (key === 'soundEnabled') {
        const muted = soundService.isMuted()
        const enabled = value as boolean
        if (enabled && muted) soundService.toggleMute()
        if (!enabled && !muted) soundService.toggleMute()
      }
      if (key === 'soundVolume') {
        soundService.setVolume(value as number)
      }
    },
    [],
  )

  const handleReset = useCallback(() => {
    if (window.confirm('Reset all settings to defaults? This cannot be undone.')) {
      settingsService.reset()
      setSettings(settingsService.getAll())
      // Sync sound with defaults
      soundService.setVolume(0.5)
      if (soundService.isMuted()) soundService.toggleMute()
    }
  }, [])

  if (!settings) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-2xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Customize your game experience</p>
          </div>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>

        {/* Sound Settings */}
        <SettingsSection icon={<Volume2 className="w-5 h-5" />} title="Sound">
          <SettingRow label="Sound Effects" description="Enable or disable all game sounds">
            <ToggleSwitch
              checked={settings.soundEnabled}
              onChange={v => updateSetting('soundEnabled', v)}
              aria-label="Toggle sound effects"
            />
          </SettingRow>

          <SettingRow label="Volume" description={`${Math.round(settings.soundVolume * 100)}%`}>
            <div className="flex items-center gap-3 w-48">
              <VolumeX className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(settings.soundVolume * 100)}
                onChange={e => updateSetting('soundVolume', Number(e.target.value) / 100)}
                disabled={!settings.soundEnabled}
                className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Sound volume"
              />
              <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
          </SettingRow>
        </SettingsSection>

        <Separator />

        {/* Game Settings */}
        <SettingsSection icon={<Gauge className="w-5 h-5" />} title="Game">
          <SettingRow label="Animation Speed" description="Control how fast animations play">
            <Select
              value={settings.animationSpeed}
              onValueChange={v =>
                updateSetting('animationSpeed', v as GameSettings['animationSpeed'])
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fast">Fast</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="slow">Slow</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow
            label="Auto-End Turn Timer"
            description="Automatically end your turn after a time limit"
          >
            <ToggleSwitch
              checked={settings.autoEndTurnEnabled}
              onChange={v => updateSetting('autoEndTurnEnabled', v)}
              aria-label="Toggle auto-end turn timer"
            />
          </SettingRow>

          {settings.autoEndTurnEnabled && (
            <SettingRow
              label="Turn Duration"
              description={`${settings.autoEndTurnDuration} seconds per turn`}
            >
              <Select
                value={String(settings.autoEndTurnDuration)}
                onValueChange={v => updateSetting('autoEndTurnDuration', Number(v))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 seconds</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">60 seconds</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
          )}

          <SettingRow
            label="Card Ability Previews"
            description="Show ability descriptions when hovering over cards"
          >
            <ToggleSwitch
              checked={settings.showAbilityPreviews}
              onChange={v => updateSetting('showAbilityPreviews', v)}
              aria-label="Toggle card ability previews"
            />
          </SettingRow>
        </SettingsSection>

        <Separator />

        {/* Display Settings */}
        <SettingsSection icon={<Monitor className="w-5 h-5" />} title="Display">
          <SettingRow label="Theme" description="Switch between light and dark appearance">
            <div className="flex items-center gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('light')}
                className="gap-1.5"
              >
                <Sun className="w-4 h-4" />
                Light
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('dark')}
                className="gap-1.5"
              >
                <Moon className="w-4 h-4" />
                Dark
              </Button>
            </div>
          </SettingRow>

          <SettingRow
            label="Reduce Animations"
            description="Minimize animations for accessibility or performance"
          >
            <ToggleSwitch
              checked={settings.reduceAnimations}
              onChange={v => updateSetting('reduceAnimations', v)}
              aria-label="Toggle reduce animations"
            />
          </SettingRow>
        </SettingsSection>

        <Separator />

        {/* About */}
        <SettingsSection icon={<Info className="w-5 h-5" />} title="About">
          <SettingRow label="Version" description="Current game version">
            <span className="text-sm font-mono text-muted-foreground">v0.1.0-alpha</span>
          </SettingRow>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/stats">
              <Button variant="outline" size="sm" className="gap-1.5">
                <BarChart3 className="w-4 h-4" />
                View Stats
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Home className="w-4 h-4" />
                Home
              </Button>
            </Link>
          </div>
        </SettingsSection>

        <Separator />

        {/* Reset */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Reset Settings</p>
            <p className="text-xs text-muted-foreground">Restore all settings to their defaults</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-muted-foreground hover:text-destructive hover:border-destructive"
            onClick={handleReset}
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Reset to Defaults
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Local sub-components                                               */
/* ------------------------------------------------------------------ */

function SettingsSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-primary">{icon}</span>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function ToggleSwitch({
  checked,
  onChange,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  'aria-label'?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        checked ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
