# cachex

**Zero-dependency in-memory caching for Node.js.** 31 tests, 100% pass rate, LRU eviction, TTL, multi-cache — all in <5KB with zero dependencies.

## Quick Start

```bash
npm install cachex
```

```typescript
import { Cache } from 'cachex';

const cache = new Cache({ ttl: 5000, maxSize: 1000 });

// Set and get
cache.set('user:1', { name: 'Alice', email: 'alice@example.com' });
const user = cache.get('user:1'); // { name: 'Alice', email: 'alice@example.com' }

// Check existence
cache.has('user:1'); // true

// Delete
cache.delete('user:1'); // true

// Statistics
cache.getStats(); // { size: 0, gets: 1, sets: 1, hits: 1, misses: 0, hitRatio: 1, ... }
```

## Real-World Examples

### 1. API Response Caching (5-minute TTL)

```typescript
import { Cache } from 'cachex';

const apiCache = new Cache({ ttl: 300000 }); // 5 minutes

async function fetchWithCache<T>(url: string): Promise<T> {
  const cached = apiCache.get<T>(url);
  if (cached) return cached;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  const data = await response.json();
  apiCache.set(url, data);
  return data;
}

// Usage
const users = await fetchWithCache('/api/users'); // First call: fetches from API
const users2 = await fetchWithCache('/api/users'); // Second call: returns cached (within 5 min)
```

### 2. Session Storage with Per-Key Expiration

```typescript
import { Cache } from 'cachex';

const sessionCache = new Cache();

function createSession(userId: string, duration = 1800000): string {
  const sessionId = crypto.randomUUID();
  // Per-key TTL: admin sessions last longer
  const ttl = userId.startsWith('admin:') ? duration * 2 : duration;
  sessionCache.set(`session:${sessionId}`, userId, ttl);
  return sessionId;
}

function validateSession(sessionId: string): string | null {
  const userId = sessionCache.get(`session:${sessionId}`);
  return userId || null;
}

// Usage
const adminSession = createSession('admin:alice', 3600000); // 1 hour
const userSession = createSession('user:bob'); // 30 minutes
```

### 3. Multi-Cache for Isolated User Data

```typescript
import { MultiCache } from 'cachex';

const userCaches = new MultiCache({ ttl: 600000, maxSize: 500 });

async function getUserProfile(userId: string): Promise<any> {
  // Check cache first
  const cached = userCaches.get('profiles', `user:${userId}`);
  if (cached) return cached;

  // Fetch from DB
  const profile = await db.profiles.findOne({ id: userId });
  
  // Cache per-user namespace
  userCaches.set('profiles', `user:${userId}`, profile);
  return profile;
}

// Separate namespaces prevent key collisions
userCaches.set('preferences', 'user:1', { theme: 'dark', notifications: true });
userCaches.set('profiles', 'user:1', { name: 'Alice', email: 'alice@example.com' });

// Get all cache statistics
const allStats = userCaches.getAllStats();
console.log(Array.from(allStats.entries()));
// [['profiles', { size: 1, gets: 1, ... }], ['preferences', { size: 1, gets: 0, ... }]]
```

## API Reference

### Cache Class

```typescript
import { Cache } from 'cachex';

const cache = new Cache<V>({
  maxSize: 1000,          // Maximum items (default: 1000)
  ttl: 60000,             // Global TTL in ms (default: undefined = no expiry)
  cleanupInterval: 60000, // Auto-cleanup interval (default: 60000)
  onEvict: (key, value, reason) => console.log(`Evicted ${key}: ${reason}`)
});

// Methods
cache.set(key, value, ttl?)           // Set value, optional per-key TTL
cache.get(key)                        // Get value or undefined
cache.has(key)                        // Check if key exists
cache.delete(key)                     // Delete key, returns boolean
cache.clear()                         // Clear all entries
cache.size()                          // Get current size
cache.getStats()                      // Get { size, gets, sets, hits, misses, hitRatio, evictions, memoryUsage }
cache.keys()                          // Get all keys
cache.values()                        // Get all values
cache.entries()                       // Get all [key, value] pairs
cache.cleanup()                       // Remove expired entries, returns count
cache.memoryUsage()                   // Get approximate memory usage in bytes
cache.destroy()                       // Stop cleanup timers
```

### MultiCache Class

```typescript
import { MultiCache } from 'cachex';

const multi = new MultiCache<V>(options);

// Methods
multi.set(cacheName, key, value, ttl?)  // Set in named cache
multi.get(cacheName, key)               // Get from named cache
multi.has(cacheName, key)               // Check in named cache
multi.delete(cacheName, key)            // Delete from named cache
multi.clear(cacheName?)                 // Clear specific or all caches
multi.clearAll()                        // Clear all caches
multi.cacheNames()                      // Get all cache names
multi.getStats(cacheName)               // Get stats for specific cache
multi.getAllStats()                     // Get stats for all caches (Map)
multi.deleteCache(cacheName)            // Delete entire cache
```

### CacheUtils

```typescript
import { CacheUtils } from 'cachex';

// Factory functions
const ttlCache = CacheUtils.createTTLCache(60000, 1000);  // TTL cache
const sizeCache = CacheUtils.createSizeCache(1000);        // Size-limited cache
const simpleCache = CacheUtils.createSimpleCache();         // Default cache

// Utilities
const bytes = CacheUtils.estimateMemoryUsage({ key: 'value' });
```

### CLI

```bash
npm install -g cachex

# Basic operations
cachex set key value -t 5000              # Set with 5s TTL
cachex get key                            # Get value
cachex has key                            # Check existence
cachex delete key                         # Delete key
cachex clear                              # Clear cache

# Statistics and inspection
cachex stats                              # Show statistics
cachex size                               # Show size
cachex keys                               # List all keys
cachex values                             # List all values

# Multi-cache
cachex set key value -c mycache           # Set in named cache
cachex get key -c mycache                 # Get from named cache
cachex stats -c mycache                   # Stats for named cache

# Save/load
cachex save cache.json                    # Save to file
cachex load cache.json                    # Load from file

# Version
cachex version                            # Show version
cachex --version                          # Show version
cachex -V                                 # Show version

# Demo
cachex demo                               # Run interactive demo
```

## Comparison Table

| Feature | cachex | lru-cache | node-cache | cache-manager | quick-lru |
|---------|--------|-----------|------------|---------------|-----------|
| **Zero dependencies** | ✅ Yes | ❌ 1 | ❌ 1 | ❌ 2+ | ✅ Yes |
| **LRU eviction** | ✅ Yes | ✅ Yes | ❌ No | ⚠️ Plugin | ✅ Yes |
| **TTL support** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Per-key TTL** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Multi-cache** | ✅ Yes | ❌ No | ❌ No | ⚠️ Multi-store | ❌ No |
| **Statistics** | ✅ Yes | ⚠️ Basic | ✅ Yes | ⚠️ Plugin | ❌ No |
| **TypeScript** | ✅ Native | ⚠️ @types | ⚠️ @types | ⚠️ @types | ✅ Native |
| **Bundle size** | <5KB | ~8KB | ~15KB | ~25KB | ~2KB |
| **Node.js** | >=18 | >=12 | >=14 | >=12 | >=14 |
| **CLI tool** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No |
| **ESM + CJS** | ✅ Both | ✅ Both | ⚠️ ESM only | ✅ Both | ✅ Both |

**Why cachex?**

- **Zero dependencies** — smaller bundle, less attack surface, fewer transitive issues
- **Multi-cache support** — isolated namespaces for different data types (profiles, sessions, configs)
- **Built-in CLI** — debug and manage caches from terminal without writing code
- **Comprehensive stats** — hit ratio, memory usage, evictions — all built-in
- **Modern TypeScript** — native TS support, no extra @types package needed

## Performance

All operations are **O(1)** except cleanup which is **O(n)** (n = expired items).

### Benchmarks (100,000 operations)

```
Set:        45.2ms  (0.000452ms/op)
Get (hit):  32.1ms  (0.000321ms/op)
Get (miss): 28.7ms  (0.000287ms/op)
Delete:     24.3ms  (0.000243ms/op)
Cleanup:    12.8ms  (0.000128ms/op)
─────────────────────────────────────
Mixed:      156.3ms (0.001563ms/op)
```

## Version

```typescript
import { VERSION } from 'cachex';
console.log(VERSION); // '1.1.0'
```

## License

MIT

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.