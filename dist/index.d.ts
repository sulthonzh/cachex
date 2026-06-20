export declare const VERSION = "1.1.0";
export interface CacheOptions {
    maxSize?: number;
    ttl?: number;
    cleanupInterval?: number;
    onEvict?: (key: any, value: any, reason: 'size' | 'ttl' | 'explicit') => void;
}
export interface CacheStats {
    size: number;
    gets: number;
    sets: number;
    deletes: number;
    evictions: number;
    hits: number;
    misses: number;
    hitRatio: number;
    memoryUsage: number;
}
export interface CacheEntry<T = any> {
    value: T;
    setAt: number;
    expiresAt?: number;
    accessCount: number;
    lastAccessed: number;
}
export declare class LRUCache<K = string, V = any> {
    private cache;
    private head;
    private tail;
    private maxSize;
    private ttl?;
    private cleanupInterval?;
    private onEvict?;
    private stats;
    private cleanupTimer?;
    constructor(options?: CacheOptions);
    set(key: K, value: V): void;
    get(key: K): V | undefined;
    delete(key: K): boolean;
    has(key: K): boolean;
    clear(): void;
    size(): number;
    getStats(): CacheStats;
    keys(): K[];
    values(): V[];
    entries(): [K, V][];
    cleanup(): number;
    memoryUsage(): number;
    destroy(): void;
    private addToHead;
    private moveToHead;
    private unlinkNode;
    private unlinkAll;
    private evictLRU;
    private startCleanup;
    private updateHitRatio;
    private estimateSize;
}
export declare class Cache<V = any> {
    private lru;
    private perKeyTtl;
    constructor(options?: CacheOptions);
    set(key: string, value: V, ttl?: number): void;
    get(key: string): V | undefined;
    delete(key: string): boolean;
    has(key: string): boolean;
    clear(): void;
    size(): number;
    getStats(): CacheStats;
    keys(): string[];
    values(): V[];
    entries(): [string, V][];
    cleanup(): number;
    memoryUsage(): number;
    destroy(): void;
}
export declare class MultiCache<V = any> {
    private caches;
    private defaultOptions;
    constructor(defaultOptions?: CacheOptions);
    private getOrCreateCache;
    set(cacheName: string, key: string, value: V, ttl?: number): void;
    get(cacheName: string, key: string): V | undefined;
    delete(cacheName: string, key: string): boolean;
    has(cacheName: string, key: string): boolean;
    clear(cacheName: string): void;
    clearAll(): void;
    cacheNames(): string[];
    getStats(cacheName: string): CacheStats | undefined;
    getAllStats(): Map<string, CacheStats>;
    deleteCache(cacheName: string): boolean;
}
export declare const CacheUtils: {
    createTTLCache<V>(ttl: number, maxSize?: number): Cache<V>;
    createSizeCache<V>(maxSize?: number): Cache<V>;
    createSimpleCache<V>(): Cache<V>;
    estimateMemoryUsage<T>(value: T): number;
};
export declare const CacheStrategies: {
    ttl: <V>(_ttl: number) => (value: V) => V;
    size: <V>(_maxSize: number) => (value: V) => V;
    writeThrough: <V>(cache: Cache<V>, store: {
        set: (key: string, value: V) => void;
    }) => (key: string, value: V) => V;
    writeBehind: <V>(cache: Cache<V>, store: {
        set: (key: string, value: V) => Promise<void>;
    }) => (key: string, value: V) => V;
};
export declare const defaultCache: Cache<any>;
export default Cache;
//# sourceMappingURL=index.d.ts.map