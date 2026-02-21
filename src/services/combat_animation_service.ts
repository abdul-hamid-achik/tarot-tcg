/**
 * Lightweight service that triggers CSS animations on battlefield DOM elements.
 * Uses data-player/data-slot attributes on BattlefieldSlot to find elements.
 */

function getSlotElement(player: string, slot: number): HTMLElement | null {
  return document.querySelector(`[data-player="${player}"][data-slot="${slot}"]`)
}

function applyAnimation(element: HTMLElement, className: string, durationMs: number) {
  element.classList.add(className)
  setTimeout(() => element.classList.remove(className), durationMs)
}

function showFloatingText(element: HTMLElement, text: string, color: string) {
  const float = document.createElement('div')
  float.textContent = text
  float.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 1.5rem;
    font-weight: bold;
    color: ${color};
    pointer-events: none;
    z-index: 100;
    animation: damage-float 0.8s ease-out forwards;
  `
  element.style.position = 'relative'
  element.appendChild(float)
  setTimeout(() => float.remove(), 800)
}

class CombatAnimationService {
  /** Animate an attack: attacker lunges, target shakes */
  triggerAttack(attackerSlot: number, targetPlayer: string, targetSlot: number) {
    const attackerPlayer = targetPlayer === 'player2' ? 'player1' : 'player2'
    const attacker = getSlotElement(attackerPlayer, attackerSlot)
    const target = getSlotElement(targetPlayer, targetSlot)

    if (attacker) {
      applyAnimation(attacker, 'attack-declare-animation', 500)
    }
    if (target) {
      setTimeout(() => applyAnimation(target, 'shake', 500), 250)
    }
  }

  /** Show damage number floating up from a slot */
  triggerDamage(player: string, slot: number, amount: number) {
    const element = getSlotElement(player, slot)
    if (element) {
      applyAnimation(element, 'shake', 500)
      showFloatingText(element, `-${amount}`, '#ef4444')
    }
  }

  /** Show nexus damage on player info area */
  triggerNexusDamage(player: string, amount: number) {
    // Flash the player info panel
    const selector =
      player === 'player1' ? '[data-player-panel="player1"]' : '[data-player-panel="player2"]'
    const panel = document.querySelector(selector) as HTMLElement
    if (panel) {
      applyAnimation(panel, 'shake', 500)
      showFloatingText(panel, `-${amount}`, '#ef4444')
    }
  }

  /** Animate unit death (fade out) */
  triggerDeath(player: string, slot: number) {
    const element = getSlotElement(player, slot)
    if (element) {
      element.style.transition = 'opacity 0.4s, transform 0.4s'
      element.style.opacity = '0.3'
      element.style.transform = 'scale(0.8)'
      setTimeout(() => {
        element.style.opacity = ''
        element.style.transform = ''
        element.style.transition = ''
      }, 500)
    }
  }

  /** Animate card being played (scale in) */
  triggerCardPlayed(player: string, slot: number) {
    const element = getSlotElement(player, slot)
    if (element) {
      element.style.transition = 'transform 0.3s'
      element.style.transform = 'scale(1.15)'
      setTimeout(() => {
        element.style.transform = ''
        setTimeout(() => {
          element.style.transition = ''
        }, 300)
      }, 200)
    }
  }
}

export const combatAnimationService = new CombatAnimationService()
