/**
 * A fixed-size ring buffer (circular buffer) data structure
 * Used for memory-efficient event history that doesn't grow unbounded
 * Eliminates GC pressure from array slicing operations
 */
export class RingBuffer<T> {
  private buffer: (T | undefined)[]
  private head = 0  // Points to the next write position
  private tail = 0  // Points to the oldest element
  private count = 0 // Current number of elements

  constructor(private readonly capacity: number) {
    if (capacity <= 0) {
      throw new Error('RingBuffer capacity must be positive')
    }
    this.buffer = new Array(capacity)
  }

  /**
   * Add an item to the buffer
   * If buffer is full, overwrites the oldest item
   * O(1) operation
   */
  push(item: T): void {
    this.buffer[this.head] = item
    this.head = (this.head + 1) % this.capacity

    if (this.count < this.capacity) {
      this.count++
    } else {
      // Buffer was full, tail moves forward
      this.tail = (this.tail + 1) % this.capacity
    }
  }

  /**
   * Remove and return the oldest item
   * O(1) operation
   */
  shift(): T | undefined {
    if (this.count === 0) {
      return undefined
    }

    const item = this.buffer[this.tail]
    this.buffer[this.tail] = undefined // Help GC
    this.tail = (this.tail + 1) % this.capacity
    this.count--
    return item
  }

  /**
   * Get item at index (0 = oldest, length-1 = newest)
   * O(1) operation
   */
  get(index: number): T | undefined {
    if (index < 0 || index >= this.count) {
      return undefined
    }
    const actualIndex = (this.tail + index) % this.capacity
    return this.buffer[actualIndex]
  }

  /**
   * Get the most recent item without removing it
   * O(1) operation
   */
  peek(): T | undefined {
    if (this.count === 0) {
      return undefined
    }
    const index = (this.head - 1 + this.capacity) % this.capacity
    return this.buffer[index]
  }

  /**
   * Get the oldest item without removing it
   * O(1) operation
   */
  peekOldest(): T | undefined {
    if (this.count === 0) {
      return undefined
    }
    return this.buffer[this.tail]
  }

  /**
   * Get the current number of items in the buffer
   */
  get length(): number {
    return this.count
  }

  /**
   * Get the maximum capacity of the buffer
   */
  get maxCapacity(): number {
    return this.capacity
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(): boolean {
    return this.count === 0
  }

  /**
   * Check if buffer is full
   */
  isFull(): boolean {
    return this.count === this.capacity
  }

  /**
   * Clear all items from the buffer
   * O(n) to help GC, but can be O(1) if we don't care about GC
   */
  clear(): void {
    this.buffer = new Array(this.capacity)
    this.head = 0
    this.tail = 0
    this.count = 0
  }

  /**
   * Convert to array (oldest to newest)
   * O(n) operation - use sparingly
   */
  toArray(): T[] {
    const result: T[] = []
    for (let i = 0; i < this.count; i++) {
      const item = this.get(i)
      if (item !== undefined) {
        result.push(item)
      }
    }
    return result
  }

  /**
   * Get the last n items (newest first)
   * More efficient than toArray().slice(-n).reverse()
   */
  getLastN(n: number): T[] {
    const result: T[] = []
    const actualN = Math.min(n, this.count)
    for (let i = this.count - 1; i >= this.count - actualN; i--) {
      const item = this.get(i)
      if (item !== undefined) {
        result.push(item)
      }
    }
    return result
  }

  /**
   * Iterate over all items (oldest to newest)
   */
  *[Symbol.iterator](): Iterator<T> {
    for (let i = 0; i < this.count; i++) {
      const item = this.get(i)
      if (item !== undefined) {
        yield item
      }
    }
  }

  /**
   * Find an item in the buffer
   * O(n) operation
   */
  find(predicate: (item: T) => boolean): T | undefined {
    for (const item of this) {
      if (predicate(item)) {
        return item
      }
    }
    return undefined
  }

  /**
   * Filter items in the buffer
   * Returns new array, O(n) operation
   */
  filter(predicate: (item: T) => boolean): T[] {
    const result: T[] = []
    for (const item of this) {
      if (predicate(item)) {
        result.push(item)
      }
    }
    return result
  }

  /**
   * Check if any item matches predicate
   */
  some(predicate: (item: T) => boolean): boolean {
    for (const item of this) {
      if (predicate(item)) {
        return true
      }
    }
    return false
  }

  /**
   * Apply a function to each item
   */
  forEach(callback: (item: T, index: number) => void): void {
    let i = 0
    for (const item of this) {
      callback(item, i++)
    }
  }
}
