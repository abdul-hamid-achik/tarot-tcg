// Game Logger Utility for debugging matches
type LogLevel = 'action' | 'combat' | 'ai' | 'state' | 'error' | 'warn' | 'info' | 'debug' | 'system'

const LOG_COLORS = {
  action: '#4ade80', // green
  combat: '#f87171', // red
  ai: '#60a5fa', // blue
  state: '#fbbf24', // yellow
  error: '#ef4444', // dark red
  warn: '#fb923c', // orange
  info: '#38bdf8', // sky blue
  debug: '#a78bfa', // purple
  system: '#94a3b8', // slate
}

const LOG_ICONS = {
  action: '🎮',
  combat: '⚔️',
  ai: '🤖',
  state: '📊',
  error: '❌',
  warn: '⚠️',
  info: 'ℹ️',
  debug: '🔍',
  system: '⚙️',
}

export class GameLogger {
  static log(level: LogLevel, message: string, data?: unknown) {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    const icon = LOG_ICONS[level]
    const color = LOG_COLORS[level]

    console.log(
      `%c${icon} [${timestamp}] ${message}`,
      `color: ${color}; font-weight: bold;`,
      data ? data : '',
    )
  }

  static action(message: string, data?: unknown) {
    GameLogger.log('action', message, data)
  }

  static combat(message: string, data?: unknown) {
    GameLogger.log('combat', message, data)
  }

  static ai(message: string, data?: unknown) {
    GameLogger.log('ai', message, data)
  }

  static state(message: string, data?: unknown) {
    GameLogger.log('state', message, data)
  }

  static error(message: string, data?: unknown) {
    GameLogger.log('error', message, data)
  }

  static warn(message: string, data?: unknown) {
    GameLogger.log('warn', message, data)
  }

  static info(message: string, data?: unknown) {
    GameLogger.log('info', message, data)
  }

  static debug(message: string, data?: unknown) {
    GameLogger.log('debug', message, data)
  }

  static system(message: string, data?: unknown) {
    GameLogger.log('system', message, data)
  }

  static gameStart(player1Name: string, player2Name: string) {
    console.log(
      '%c🎯 === NEW GAME STARTED ===',
      'color: #a855f7; font-size: 14px; font-weight: bold;',
    )
    console.log(`Players: ${player1Name} vs ${player2Name}`)
  }

  static turnStart(player: string, turn: number, round: number, hasAttackToken: boolean) {
    console.log('%c--- Turn Start ---', 'color: #6366f1; font-weight: bold;')
    console.log(
      `Turn ${turn} | Round ${round} | Active: ${player} | Attack Token: ${hasAttackToken ? '⚔️' : '🛡️'}`,
    )
  }

  static combatSummary(
    attackers: { name: string; attack: number; health: number }[],
    defenders: { name: string; attack: number; health: number }[],
    damage: number,
  ) {
    console.group('%c💥 Combat Resolution', 'color: #ef4444; font-weight: bold;')
    console.log(
      'Attackers:',
      attackers.map(a => `${a.name} (${a.attack}/${a.health})`),
    )
    console.log(
      'Defenders:',
      defenders.map(d => `${d.name} (${d.attack}/${d.health})`),
    )
    console.log(`Nexus damage: ${damage}`)
    console.groupEnd()
  }
}
