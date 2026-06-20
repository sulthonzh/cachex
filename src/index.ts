/**
 * cachex - Zero-Dependency In-Memory Cache Library
 * 
 * A powerful, zero-dependency in-memory cache library for Node.js with LRU eviction,
 * TTL support, and comprehensive cache operations.
 * 
 * @author Sulthonzh
 * @license MIT
 * @version 1.1.0
 */

export const VERSION = '1.1.0';


export interface CacheOptions {
  /** Maximum number of items in cache (default: 1000) */
  maxSize?: number;
  /** Time to live in milliseconds for items (default: undefined = no expiry) */
  ttl?: number;
  /** Cleanup interval in milliseconds (default: 60000) */
  cleanupInterval?: number;
  /** Callback when items are evicted */
  onEvict?: (key: any, value: any, reason: 'size' | 'ttl' | 'explicit') => void;
}

export interface CacheStats {
  /** Total items currently in cache */
  size: number;
  /** Total number of gets */
  gets: number;
  /** Total number of sets */
  sets: number;
  /** Total number of deletes */
  deletes: number;
  /** Total number of evictions */
  evictions: number;
  /** Cache hits (found in cache) */
  hits: number;
  /** Cache misses (not found in cache) */
  misses: number;
  /** Cache hit ratio (0-1) */
  hitRatio: number;
  /** Total memory usage in bytes (approximate) */
  memoryUsage: number;
}

export interface CacheEntry<T = any> {
  /** The cached value */
  value: T;
  /** Timestamp when the item was set */
  setAt: number;
  /** Expiration timestamp (if TTL is set) */
  expiresAt?: number;
  /** Access count for LRU tracking */
  accessCount: number;
  /** Last access timestamp for LRU tracking */
  lastAccessed: number;
}

/**
 * Cache node for doubly linked list
 */
interface CacheNode<K, V> {
  key: K;
  value: V;
  prev: CacheNode<K, V> | null;
  next: CacheNode<K, V> | null;
  expiresAt?: number;
  accessCount: number;
  lastAccessed: number;
}

/**
 * LRUCache - Least Recently Used cache with TTL support
 */
export class LRUCache<K = string, V = any> {
  private cache = new Map<K, CacheNode<K, V>>();
  private head: CacheNode<K, V> | null = null;
  private tail: CacheNode<K, V> | null = null;
  private maxSize: number;
  private ttl?: number;
  private cleanupInterval?: number;
  /** @internal tracks whether stats collection is enabled */
  /** @internal */
  private onEvict?: (key: any, value: any, reason: 'size' | 'ttl' | 'explicit') => void;
  private stats: CacheStats;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl;
    this.cleanupInterval = options.cleanupInterval;
    this.onEvict = options.onEvict;

    this.stats = {
      size: 0,
      gets: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      hits: 0,
      misses: 0,
      hitRatio: 0,
      memoryUsage: 0
    };

    if (this.cleanupInterval) {
      this.startCleanup();
    }
  }

  /**
   * Set a value in the cache
   */
  set(key: K, value: V): void {
    const now = Date.now();
    const node: CacheNode<K, V> = {
      key,
      value,
      prev: null,
      next: null,
      expiresAt: this.ttl ? now + this.ttl : undefined,
      accessCount: 0,
      lastAccessed: now
    };

    // Update stats
    this.stats.sets++;
    this.stats.memoryUsage += this.estimateSize(value);

    // If key already exists, update it
    if (this.cache.has(key)) {
      const existingNode = this.cache.get(key)!;
      this.unlinkNode(existingNode);
      this.stats.memoryUsage -= this.estimateSize(existingNode.value);
    }

    // Check if we need to evict items
    while (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    // Add to cache and move to head
    this.cache.set(key, node);
    this.addToHead(node);
    this.stats.size = this.cache.size;
  }

  /**
   * Get a value from the cache
   */
  get(key: K): V | undefined {
    const node = this.cache.get(key);
    if (!node) {
      this.stats.gets++;
      this.stats.misses++;
      this.updateHitRatio();
      return undefined;
    }

    // Check if expired
    if (node.expiresAt && Date.now() > node.expiresAt) {
      this.delete(key);
      return undefined;
    }

    // Update stats and move to head
    this.stats.gets++;
    this.stats.hits++;
    node.accessCount++;
    node.lastAccessed = Date.now();
    this.moveToHead(node);
    this.updateHitRatio();

    return node.value;
  }

  /**
   * Delete a value from the cache
   */
  delete(key: K): boolean {
    const node = this.cache.get(key);
    if (!node) {
      this.stats.deletes++;
      return false;
    }

    this.stats.deletes++;
    this.stats.memoryUsage -= this.estimateSize(node.value);
    this.unlinkNode(node);
    this.cache.delete(key);
    this.stats.size = this.cache.size;

    this.onEvict?.(key, node.value, 'explicit');
    return true;
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: K): boolean {
    const node = this.cache.get(key);
    if (!node) return false;

    // Check if expired
    if (node.expiresAt && Date.now() > node.expiresAt) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    for (const [key, node] of this.cache) {
      this.onEvict?.(key, node.value, 'explicit');
    }
    this.cache.clear();
    this.unlinkAll();
    this.stats.size = 0;
    this.stats.memoryUsage = 0;
  }

  /**
   * Get the size of the cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get all keys in the cache
   */
  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all values in the cache
   */
  values(): V[] {
    return Array.from(this.cache.values()).map(node => node.value);
  }

  /**
   * Get all entries in the cache
   */
  entries(): [K, V][] {
    return Array.from(this.cache.entries()).map(([key, node]) => [key, node.value]);
  }

  /**
   * Evict all expired items
   */
  cleanup(): number {
    let evicted = 0;
    const now = Date.now();
    const keysToDelete: K[] = [];

    for (const [key, node] of this.cache) {
      if (node.expiresAt && now > node.expiresAt) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      const node = this.cache.get(key)!;
      this.stats.memoryUsage -= this.estimateSize(node.value);
      this.unlinkNode(node);
      this.cache.delete(key);
      this.onEvict?.(key, node.value, 'ttl');
      evicted++;
    }

    this.stats.evictions += evicted;
    this.stats.size = this.cache.size;

    return evicted;
  }

  /**
   * Get the size of the cache in bytes (approximate)
   */
  memoryUsage(): number {
    return this.stats.memoryUsage;
  }

  /**
   * Stop the cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  private addToHead(node: CacheNode<K, V>): void {
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    } else {
      this.tail = node;
    }

    this.head = node;
  }

  private moveToHead(node: CacheNode<K, V>): void {
    this.unlinkNode(node);
    this.addToHead(node);
  }

  private unlinkNode(node: CacheNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    node.prev = null;
    node.next = null;
  }

  private unlinkAll(): void {
    this.head = null;
    this.tail = null;
  }

  private evictLRU(): void {
    if (!this.tail) return;

    const tailNode = this.tail;
    const tailKey = tailNode.key;

    this.unlinkNode(tailNode);
    this.cache.delete(tailKey);
    this.stats.memoryUsage -= this.estimateSize(tailNode.value);
    this.stats.evictions++;
    this.stats.size = this.cache.size;

    this.onEvict?.(tailKey, tailNode.value, 'size');
  }

  private startCleanup(): void {
    if (this.cleanupInterval) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, this.cleanupInterval);
    }
  }

  private updateHitRatio(): void {
    const total = this.stats.gets;
    if (total > 0) {
      this.stats.hitRatio = this.stats.hits / total;
    }
  }

  private estimateSize(value: any): number {
    // Simple size estimation - in a real implementation, this would be more sophisticated
    const jsonSize = JSON.stringify(value).length;
    return jsonSize * 2; // Rough approximation of memory usage
  }
}

/**
 * Simple cache interface with optional per-key TTL
 */
export class Cache<V = any> {
  private lru: LRUCache<string, V>;
  private perKeyTtl: Map<string, number> = new Map();

  constructor(options: CacheOptions = {}) {
    this.lru = new LRUCache<string, V>(options);
  }

  /**
   * Set a value in the cache with optional per-key TTL
   */
  set(key: string, value: V, ttl?: number): void {
    this.lru.set(key, value);
    if (ttl !== undefined) {
      this.perKeyTtl.set(key, Date.now() + ttl);
    }
  }

  /**
   * Get a value from the cache
   */
  get(key: string): V | undefined {
    // Check per-key TTL
    const expiry = this.perKeyTtl.get(key);
    if (expiry !== undefined && Date.now() > expiry) {
      this.delete(key);
      return undefined;
    }
    return this.lru.get(key);
  }

  /**
   * Delete a value from the cache
   */
  delete(key: string): boolean {
    this.perKeyTtl.delete(key);
    return this.lru.delete(key);
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: string): boolean {
    return this.lru.has(key);
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.lru.clear();
  }

  /**
   * Get the size of the cache
   */
  size(): number {
    return this.lru.size();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return this.lru.getStats();
  }

  /**
   * Get all keys in the cache
   */
  keys(): string[] {
    return this.lru.keys();
  }

  /**
   * Get all values in the cache
   */
  values(): V[] {
    return this.lru.values();
  }

  /**
   * Get all entries in the cache
   */
  entries(): [string, V][] {
    return this.lru.entries();
  }

  /**
   * Evict all expired items
   */
  cleanup(): number {
    return this.lru.cleanup();
  }

  /**
   * Get the size of the cache in bytes (approximate)
   */
  memoryUsage(): number {
    return this.lru.memoryUsage();
  }

  /**
   * Destroy the cache
   */
  destroy(): void {
    this.lru.destroy();
  }
}

/**
 * Multi-key cache operations
 */
export class MultiCache<V = any> {
  private caches: Map<string, Cache<V>> = new Map();
  private defaultOptions: CacheOptions;

  constructor(defaultOptions: CacheOptions = {}) {
    this.defaultOptions = defaultOptions;
  }

  /**
   * Get or create a named cache
   */
  private getOrCreateCache(name: string): Cache<V> {
    if (!this.caches.has(name)) {
      this.caches.set(name, new Cache(this.defaultOptions));
    }
    return this.caches.get(name)!;
  }

  /**
   * Set a value in a specific cache
   */
  set(cacheName: string, key: string, value: V, ttl?: number): void {
    const cache = this.getOrCreateCache(cacheName);
    cache.set(key, value, ttl);
  }

  /**
   * Get a value from a specific cache
   */
  get(cacheName: string, key: string): V | undefined {
    const cache = this.caches.get(cacheName);
    return cache ? cache.get(key) : undefined;
  }

  /**
   * Delete a value from a specific cache
   */
  delete(cacheName: string, key: string): boolean {
    const cache = this.caches.get(cacheName);
    return cache ? cache.delete(key) : false;
  }

  /**
   * Check if a key exists in a specific cache
   */
  has(cacheName: string, key: string): boolean {
    const cache = this.caches.get(cacheName);
    return cache ? cache.has(key) : false;
  }

  /**
   * Clear a specific cache
   */
  clear(cacheName: string): void {
    const cache = this.caches.get(cacheName);
    if (cache) {
      cache.clear();
    }
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.caches.clear();
  }

  /**
   * Get a list of all cache names
   */
  cacheNames(): string[] {
    return Array.from(this.caches.keys());
  }

  /**
   * Get statistics for a specific cache
   */
  getStats(cacheName: string): CacheStats | undefined {
    const cache = this.caches.get(cacheName);
    return cache ? cache.getStats() : undefined;
  }

  /**
   * Get statistics for all caches
   */
  getAllStats(): Map<string, CacheStats> {
    const allStats = new Map<string, CacheStats>();
    for (const [name, cache] of this.caches) {
      allStats.set(name, cache.getStats());
    }
    return allStats;
  }

  /**
   * Delete a specific cache
   */
  deleteCache(cacheName: string): boolean {
    return this.caches.delete(cacheName);
  }
}

/**
 * Cache utility functions
 */
export const CacheUtils = {
  /**
   * Create a cache with TTL only
   */
  createTTLCache<V>(ttl: number, maxSize = 1000): Cache<V> {
    return new Cache<V>({ ttl, maxSize });
  },

  /**
   * Create a cache with size limit only
   */
  createSizeCache<V>(maxSize = 1000): Cache<V> {
    return new Cache<V>({ maxSize });
  },

  /**
   * Create a simple cache with default options
   */
  createSimpleCache<V>(): Cache<V> {
    return new Cache<V>();
  },

  /**
   * Memory usage helper for estimating cache memory usage
   */
  estimateMemoryUsage<T>(value: T): number {
    try {
      return JSON.stringify(value).length * 2; // Rough approximation
    } catch {
      return 0;
    }
  }
};

/**
 * Cache strategies
 */
export const CacheStrategies = {
  /**
   * Cache with time-to-live (TTL)
   */
  ttl: <V>(_ttl: number) => (value: V): V => value,

  /**
   * Cache with size-based eviction
   */
  size: <V>(_maxSize: number) => (value: V): V => value,

  /**
   * Cache with write-through pattern
   */
  writeThrough: <V>(cache: Cache<V>, store: { set: (key: string, value: V) => void }) => 
    (key: string, value: V): V => {
      cache.set(key, value);
      store.set(key, value);
      return value;
    },

  /**
   * Cache with write-behind pattern
   */
  writeBehind: <V>(cache: Cache<V>, store: { set: (key: string, value: V) => Promise<void> }) => 
    (key: string, value: V): V => {
      cache.set(key, value);
      // Schedule async write to store
      setTimeout(() => store.set(key, value), 100);
      return value;
    }
};

// Default cache instance
export const defaultCache = new Cache();

// Export default classes for convenience
export default Cache;