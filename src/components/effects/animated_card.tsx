'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AnimatedCardProps {
  children: ReactNode
  isVisible?: boolean
  animation?: 'fadeIn' | 'slideUp' | 'scaleIn' | 'playCard' | 'attack'
  delay?: number
  className?: string
  onAnimationComplete?: () => void
}

const animations = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.3 },
  },
  slideUp: {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const },
  },
  playCard: {
    initial: { opacity: 0, scale: 0.5, y: 100, rotateZ: -15 },
    animate: { opacity: 1, scale: 1, y: 0, rotateZ: 0 },
    exit: { opacity: 0, scale: 0.5 },
    transition: {
      duration: 0.5,
      ease: [0.34, 1.56, 0.64, 1] as const, // Bouncy
    },
  },
  attack: {
    initial: { x: 0 },
    animate: { x: 0 }, // Animation handled separately
    exit: { opacity: 0 },
    transition: { duration: 0.4 },
  },
} as const

export function AnimatedCard({
  children,
  isVisible = true,
  animation = 'fadeIn',
  delay = 0,
  className,
  onAnimationComplete,
}: AnimatedCardProps) {
  const animationConfig = animations[animation]

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          className={cn(className)}
          initial={animationConfig.initial}
          animate={animationConfig.animate}
          exit={animationConfig.exit}
          transition={{
            ...(animationConfig.transition as object),
            delay,
          }}
          onAnimationComplete={onAnimationComplete}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Hover effect wrapper
interface HoverCardProps {
  children: ReactNode
  className?: string
  disabled?: boolean
}

export function HoverCard({ children, className, disabled = false }: HoverCardProps) {
  return (
    <motion.div
      className={cn(className)}
      whileHover={disabled ? {} : { scale: 1.05, y: -5 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

// Attack animation component
interface AttackAnimationProps {
  isAttacking: boolean
  direction?: 'up' | 'down' | 'left' | 'right'
  children: ReactNode
  className?: string
}

export function AttackAnimation({
  isAttacking,
  direction = 'up',
  children,
  className,
}: AttackAnimationProps) {
  const directionOffset = {
    up: { y: -30 },
    down: { y: 30 },
    left: { x: -30 },
    right: { x: 30 },
  }

  return (
    <motion.div
      className={cn(className)}
      animate={
        isAttacking
          ? {
              ...directionOffset[direction],
              transition: {
                type: 'spring',
                stiffness: 400,
                damping: 10,
              },
            }
          : { x: 0, y: 0 }
      }
    >
      {children}
    </motion.div>
  )
}

// Damage shake effect
interface DamageShakeProps {
  isDamaged: boolean
  children: ReactNode
  className?: string
}

export function DamageShake({ isDamaged, children, className }: DamageShakeProps) {
  return (
    <motion.div
      className={cn(className)}
      animate={
        isDamaged
          ? {
              x: [0, -5, 5, -5, 5, 0],
              transition: {
                duration: 0.4,
                ease: 'easeInOut',
              },
            }
          : {}
      }
    >
      {children}
    </motion.div>
  )
}

// Stagger container for multiple items
interface StaggerContainerProps {
  children: ReactNode
  className?: string
  staggerDelay?: number
}

export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.05,
}: StaggerContainerProps) {
  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      animate="show"
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      className={cn(className)}
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 },
      }}
    >
      {children}
    </motion.div>
  )
}

// Pulse glow effect for valid targets
interface PulseGlowProps {
  isActive: boolean
  color?: 'green' | 'red' | 'amber' | 'blue'
  children: ReactNode
  className?: string
}

export function PulseGlow({
  isActive,
  color = 'green',
  children,
  className,
}: PulseGlowProps) {
  const glowColors = {
    green: 'shadow-emerald-400/60',
    red: 'shadow-red-400/60',
    amber: 'shadow-amber-400/60',
    blue: 'shadow-blue-400/60',
  }

  return (
    <motion.div
      className={cn(className)}
      animate={
        isActive
          ? {
              boxShadow: [
                `0 0 0 0 var(--tw-shadow-color)`,
                `0 0 20px 5px var(--tw-shadow-color)`,
                `0 0 0 0 var(--tw-shadow-color)`,
              ],
            }
          : {}
      }
      transition={
        isActive
          ? {
              duration: 1.5,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'easeInOut',
            }
          : {}
      }
      style={{
        '--tw-shadow-color': isActive
          ? color === 'green'
            ? 'rgba(52, 211, 153, 0.6)'
            : color === 'red'
              ? 'rgba(248, 113, 113, 0.6)'
              : color === 'amber'
                ? 'rgba(251, 191, 36, 0.6)'
                : 'rgba(96, 165, 250, 0.6)'
          : 'transparent',
      } as React.CSSProperties}
    >
      {children}
    </motion.div>
  )
}
