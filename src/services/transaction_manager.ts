import { produce } from 'immer'
import { GameLogger } from '@/lib/game_logger'
import type { GameState } from '@/schemas/schema'

/**
 * Transaction/rollback support for effect resolution
 * Ensures atomic state changes with the ability to rollback on failure
 */

export interface TransactionOperation {
  id: string
  description: string
  timestamp: number
  stateSnapshot?: GameState
}

export interface Transaction {
  id: string
  startState: GameState
  operations: TransactionOperation[]
  startTime: number
  status: 'pending' | 'committed' | 'rolled_back'
}

export class TransactionManager {
  private currentTransaction: Transaction | null = null
  private transactionCounter = 0

  /**
   * Begin a new transaction
   */
  begin(startState: GameState): string {
    if (this.currentTransaction && this.currentTransaction.status === 'pending') {
      GameLogger.warn('TransactionManager: Starting new transaction while one is pending')
    }

    const transactionId = `txn_${++this.transactionCounter}_${Date.now()}`

    this.currentTransaction = {
      id: transactionId,
      startState: produce(startState, () => { /* no-op clone */ }),
      operations: [],
      startTime: Date.now(),
      status: 'pending',
    }

    GameLogger.debug(`TransactionManager: Started transaction ${transactionId}`)
    return transactionId
  }

  /**
   * Add an operation to the current transaction
   */
  addOperation(description: string, currentState?: GameState): void {
    if (!this.currentTransaction || this.currentTransaction.status !== 'pending') {
      GameLogger.warn('TransactionManager: No pending transaction for operation')
      return
    }

    const operation: TransactionOperation = {
      id: `op_${this.currentTransaction.operations.length + 1}`,
      description,
      timestamp: Date.now(),
      stateSnapshot: currentState ? produce(currentState, () => { /* no-op clone */ }) : undefined,
    }

    this.currentTransaction.operations.push(operation)
    GameLogger.debug(`TransactionManager: Added operation "${description}"`)
  }

  /**
   * Commit the current transaction
   */
  commit(): boolean {
    if (!this.currentTransaction || this.currentTransaction.status !== 'pending') {
      GameLogger.warn('TransactionManager: No pending transaction to commit')
      return false
    }

    this.currentTransaction.status = 'committed'
    const duration = Date.now() - this.currentTransaction.startTime

    GameLogger.debug(
      `TransactionManager: Committed transaction ${this.currentTransaction.id} ` +
      `(${this.currentTransaction.operations.length} operations, ${duration}ms)`
    )

    // Clear the transaction
    this.currentTransaction = null
    return true
  }

  /**
   * Rollback to the start state
   */
  rollback(): GameState | null {
    if (!this.currentTransaction) {
      GameLogger.warn('TransactionManager: No transaction to rollback')
      return null
    }

    const startState = this.currentTransaction.startState
    this.currentTransaction.status = 'rolled_back'

    GameLogger.debug(
      `TransactionManager: Rolled back transaction ${this.currentTransaction.id} ` +
      `(${this.currentTransaction.operations.length} operations discarded)`
    )

    this.currentTransaction = null
    return startState
  }

  /**
   * Rollback to a specific operation
   */
  rollbackToOperation(operationId: string): GameState | null {
    if (!this.currentTransaction || this.currentTransaction.status !== 'pending') {
      GameLogger.warn('TransactionManager: No pending transaction for partial rollback')
      return null
    }

    const operationIndex = this.currentTransaction.operations.findIndex(op => op.id === operationId)

    if (operationIndex === -1) {
      GameLogger.warn(`TransactionManager: Operation ${operationId} not found`)
      return null
    }

    const operation = this.currentTransaction.operations[operationIndex]
    if (!operation.stateSnapshot) {
      GameLogger.warn(`TransactionManager: Operation ${operationId} has no state snapshot`)
      return this.rollback()
    }

    // Remove operations after the rollback point
    this.currentTransaction.operations = this.currentTransaction.operations.slice(0, operationIndex + 1)

    GameLogger.debug(`TransactionManager: Rolled back to operation ${operationId}`)
    return operation.stateSnapshot
  }

  /**
   * Get current transaction status
   */
  getStatus(): { active: boolean; operationCount: number; transactionId: string | null } {
    return {
      active: this.currentTransaction?.status === 'pending' || false,
      operationCount: this.currentTransaction?.operations.length || 0,
      transactionId: this.currentTransaction?.id || null,
    }
  }

  /**
   * Check if a transaction is active
   */
  isActive(): boolean {
    return this.currentTransaction?.status === 'pending' || false
  }

  /**
   * Get the start state of the current transaction
   */
  getStartState(): GameState | null {
    return this.currentTransaction?.startState || null
  }
}

// Singleton instance
export const transactionManager = new TransactionManager()
