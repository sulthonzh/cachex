export const VERSION = '1.1.0';
export class LRUCache {
    constructor(options = {}) {
        this.cache = new Map();
        this.head = null;
        this.tail = null;
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
    set(key, value) {
        const now = Date.now();
        const node = {
            key,
            value,
            prev: null,
            next: null,
            expiresAt: this.ttl ? now + this.ttl : undefined,
            accessCount: 0,
            lastAccessed: now
        };
        this.stats.sets++;
        this.stats.memoryUsage += this.estimateSize(value);
        if (this.cache.has(key)) {
            const existingNode = this.cache.get(key);
            this.unlinkNode(existingNode);
            this.stats.memoryUsage -= this.estimateSize(existingNode.value);
        }
        while (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }
        this.cache.set(key, node);
        this.addToHead(node);
        this.stats.size = this.cache.size;
    }
    get(key) {
        const node = this.cache.get(key);
        if (!node) {
            this.stats.gets++;
            this.stats.misses++;
            this.updateHitRatio();
            return undefined;
        }
        if (node.expiresAt && Date.now() > node.expiresAt) {
            this.delete(key);
            return undefined;
        }
        this.stats.gets++;
        this.stats.hits++;
        node.accessCount++;
        node.lastAccessed = Date.now();
        this.moveToHead(node);
        this.updateHitRatio();
        return node.value;
    }
    delete(key) {
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
    has(key) {
        const node = this.cache.get(key);
        if (!node)
            return false;
        if (node.expiresAt && Date.now() > node.expiresAt) {
            this.delete(key);
            return false;
        }
        return true;
    }
    clear() {
        for (const [key, node] of this.cache) {
            this.onEvict?.(key, node.value, 'explicit');
        }
        this.cache.clear();
        this.unlinkAll();
        this.stats.size = 0;
        this.stats.memoryUsage = 0;
    }
    size() {
        return this.cache.size;
    }
    getStats() {
        return { ...this.stats };
    }
    keys() {
        return Array.from(this.cache.keys());
    }
    values() {
        return Array.from(this.cache.values()).map(node => node.value);
    }
    entries() {
        return Array.from(this.cache.entries()).map(([key, node]) => [key, node.value]);
    }
    cleanup() {
        let evicted = 0;
        const now = Date.now();
        const keysToDelete = [];
        for (const [key, node] of this.cache) {
            if (node.expiresAt && now > node.expiresAt) {
                keysToDelete.push(key);
            }
        }
        for (const key of keysToDelete) {
            const node = this.cache.get(key);
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
    memoryUsage() {
        return this.stats.memoryUsage;
    }
    destroy() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }
    }
    addToHead(node) {
        node.prev = null;
        node.next = this.head;
        if (this.head) {
            this.head.prev = node;
        }
        else {
            this.tail = node;
        }
        this.head = node;
    }
    moveToHead(node) {
        this.unlinkNode(node);
        this.addToHead(node);
    }
    unlinkNode(node) {
        if (node.prev) {
            node.prev.next = node.next;
        }
        else {
            this.head = node.next;
        }
        if (node.next) {
            node.next.prev = node.prev;
        }
        else {
            this.tail = node.prev;
        }
        node.prev = null;
        node.next = null;
    }
    unlinkAll() {
        this.head = null;
        this.tail = null;
    }
    evictLRU() {
        if (!this.tail)
            return;
        const tailNode = this.tail;
        const tailKey = tailNode.key;
        this.unlinkNode(tailNode);
        this.cache.delete(tailKey);
        this.stats.memoryUsage -= this.estimateSize(tailNode.value);
        this.stats.evictions++;
        this.stats.size = this.cache.size;
        this.onEvict?.(tailKey, tailNode.value, 'size');
    }
    startCleanup() {
        if (this.cleanupInterval) {
            this.cleanupTimer = setInterval(() => {
                this.cleanup();
            }, this.cleanupInterval);
        }
    }
    updateHitRatio() {
        const total = this.stats.gets;
        if (total > 0) {
            this.stats.hitRatio = this.stats.hits / total;
        }
    }
    estimateSize(value) {
        const jsonSize = JSON.stringify(value).length;
        return jsonSize * 2;
    }
}
export class Cache {
    constructor(options = {}) {
        this.perKeyTtl = new Map();
        this.lru = new LRUCache(options);
    }
    set(key, value, ttl) {
        this.lru.set(key, value);
        if (ttl !== undefined) {
            this.perKeyTtl.set(key, Date.now() + ttl);
        }
    }
    get(key) {
        const expiry = this.perKeyTtl.get(key);
        if (expiry !== undefined && Date.now() > expiry) {
            this.delete(key);
            return undefined;
        }
        return this.lru.get(key);
    }
    delete(key) {
        this.perKeyTtl.delete(key);
        return this.lru.delete(key);
    }
    has(key) {
        return this.lru.has(key);
    }
    clear() {
        this.lru.clear();
    }
    size() {
        return this.lru.size();
    }
    getStats() {
        return this.lru.getStats();
    }
    keys() {
        return this.lru.keys();
    }
    values() {
        return this.lru.values();
    }
    entries() {
        return this.lru.entries();
    }
    cleanup() {
        return this.lru.cleanup();
    }
    memoryUsage() {
        return this.lru.memoryUsage();
    }
    destroy() {
        this.lru.destroy();
    }
}
export class MultiCache {
    constructor(defaultOptions = {}) {
        this.caches = new Map();
        this.defaultOptions = defaultOptions;
    }
    getOrCreateCache(name) {
        if (!this.caches.has(name)) {
            this.caches.set(name, new Cache(this.defaultOptions));
        }
        return this.caches.get(name);
    }
    set(cacheName, key, value, ttl) {
        const cache = this.getOrCreateCache(cacheName);
        cache.set(key, value, ttl);
    }
    get(cacheName, key) {
        const cache = this.caches.get(cacheName);
        return cache ? cache.get(key) : undefined;
    }
    delete(cacheName, key) {
        const cache = this.caches.get(cacheName);
        return cache ? cache.delete(key) : false;
    }
    has(cacheName, key) {
        const cache = this.caches.get(cacheName);
        return cache ? cache.has(key) : false;
    }
    clear(cacheName) {
        const cache = this.caches.get(cacheName);
        if (cache) {
            cache.clear();
        }
    }
    clearAll() {
        this.caches.clear();
    }
    cacheNames() {
        return Array.from(this.caches.keys());
    }
    getStats(cacheName) {
        const cache = this.caches.get(cacheName);
        return cache ? cache.getStats() : undefined;
    }
    getAllStats() {
        const allStats = new Map();
        for (const [name, cache] of this.caches) {
            allStats.set(name, cache.getStats());
        }
        return allStats;
    }
    deleteCache(cacheName) {
        return this.caches.delete(cacheName);
    }
}
export const CacheUtils = {
    createTTLCache(ttl, maxSize = 1000) {
        return new Cache({ ttl, maxSize });
    },
    createSizeCache(maxSize = 1000) {
        return new Cache({ maxSize });
    },
    createSimpleCache() {
        return new Cache();
    },
    estimateMemoryUsage(value) {
        try {
            return JSON.stringify(value).length * 2;
        }
        catch {
            return 0;
        }
    }
};
export const CacheStrategies = {
    ttl: (_ttl) => (value) => value,
    size: (_maxSize) => (value) => value,
    writeThrough: (cache, store) => (key, value) => {
        cache.set(key, value);
        store.set(key, value);
        return value;
    },
    writeBehind: (cache, store) => (key, value) => {
        cache.set(key, value);
        setTimeout(() => store.set(key, value), 100);
        return value;
    }
};
export const defaultCache = new Cache();
export default Cache;
//# sourceMappingURL=index.js.map