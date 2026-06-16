import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { Cache, LRUCache, MultiCache, CacheUtils } from '../dist/index.js';

describe('LRUCache', () => {
  it('set and get basic values', () => {
    const cache = new LRUCache();
    cache.set('a', 1);
    cache.set('b', 2);
    assert.equal(cache.get('a'), 1);
    assert.equal(cache.get('b'), 2);
  });

  it('returns undefined for missing keys', () => {
    const cache = new LRUCache();
    assert.equal(cache.get('missing'), undefined);
  });

  it('has() checks existence', () => {
    const cache = new LRUCache();
    cache.set('key', 'value');
    assert.equal(cache.has('key'), true);
    assert.equal(cache.has('nope'), false);
  });

  it('delete() removes entries', () => {
    const cache = new LRUCache();
    cache.set('x', 1);
    assert.equal(cache.delete('x'), true);
    assert.equal(cache.has('x'), false);
    assert.equal(cache.delete('x'), false);
  });

  it('clear() empties the cache', () => {
    const cache = new LRUCache();
    cache.set('a', 1); cache.set('b', 2);
    cache.clear();
    assert.equal(cache.size(), 0);
  });

  it('enforces maxSize with LRU eviction', () => {
    const cache = new LRUCache({ maxSize: 3 });
    cache.set(1, 'a'); cache.set(2, 'b'); cache.set(3, 'c');
    cache.get(1); // make key 1 recently used
    cache.set(4, 'd'); // should evict key 2 (LRU)
    assert.equal(cache.has(2), false);
    assert.equal(cache.has(1), true);
    assert.equal(cache.has(3), true);
    assert.equal(cache.has(4), true);
  });

  it('tracks stats correctly', () => {
    const cache = new LRUCache({ maxSize: 10 });
    cache.set('a', 1);
    cache.get('a'); // hit
    cache.get('b'); // miss
    const stats = cache.getStats();
    assert.equal(stats.sets, 1);
    assert.equal(stats.hits, 1);
    assert.equal(stats.misses, 1);
    assert.equal(stats.size, 1);
  });

  it('supports TTL expiration', async () => {
    const cache = new LRUCache({ ttl: 50 });
    cache.set('temp', 'value');
    assert.equal(cache.get('temp'), 'value');
    await new Promise(r => setTimeout(r, 60));
    assert.equal(cache.get('temp'), undefined);
  });

  it('calls onEvict on explicit delete', () => {
    const evicted = [];
    const cache = new LRUCache({ onEvict: (key) => evicted.push(key) });
    cache.set('k', 42);
    cache.delete('k');
    assert.deepEqual(evicted, ['k']);
  });

  it('keys() and values() return arrays', () => {
    const cache = new LRUCache();
    cache.set('a', 1); cache.set('b', 2);
    assert.deepEqual(cache.keys().sort(), ['a', 'b']);
    assert.deepEqual(cache.values().sort(), [1, 2]);
  });

  it('entries() returns key-value pairs', () => {
    const cache = new LRUCache();
    cache.set('x', 10); cache.set('y', 20);
    const entries = cache.entries();
    assert.equal(entries.length, 2);
  });

  it('cleanup() removes expired items', async () => {
    const cache = new LRUCache({ ttl: 30 });
    cache.set('a', 1); cache.set('b', 2);
    await new Promise(r => setTimeout(r, 40));
    const removed = cache.cleanup();
    assert.equal(removed, 2);
    assert.equal(cache.size(), 0);
  });

  it('updates entry on duplicate set', () => {
    const cache = new LRUCache();
    cache.set('k', 1);
    cache.set('k', 2);
    assert.equal(cache.get('k'), 2);
    assert.equal(cache.size(), 1);
  });
});

describe('Cache', () => {
  it('set/get with per-key TTL', async () => {
    const cache = new Cache();
    cache.set('a', 1, 50);
    assert.equal(cache.get('a'), 1);
    await new Promise(r => setTimeout(r, 60));
    assert.equal(cache.get('a'), undefined);
  });

  it('set/get without TTL persists', () => {
    const cache = new Cache();
    cache.set('forever', 'value');
    assert.equal(cache.get('forever'), 'value');
  });

  it('delete removes per-key TTL too', () => {
    const cache = new Cache();
    cache.set('temp', 1, 1000);
    cache.delete('temp');
    assert.equal(cache.has('temp'), false);
  });

  it('clear empties everything', () => {
    const cache = new Cache();
    cache.set('a', 1); cache.set('b', 2);
    cache.clear();
    assert.equal(cache.size(), 0);
  });

  it('delegates to LRUCache stats', () => {
    const cache = new Cache();
    cache.set('x', 1);
    cache.get('x');
    const stats = cache.getStats();
    assert.equal(stats.sets, 1);
    assert.equal(stats.hits, 1);
  });
});

describe('MultiCache', () => {
  it('isolates caches by name', () => {
    const mc = new MultiCache();
    mc.set('users', 'a', 1);
    mc.set('posts', 'a', 2);
    assert.equal(mc.get('users', 'a'), 1);
    assert.equal(mc.get('posts', 'a'), 2);
  });

  it('clear specific cache only', () => {
    const mc = new MultiCache();
    mc.set('c1', 'k', 'v1');
    mc.set('c2', 'k', 'v2');
    mc.clear('c1');
    assert.equal(mc.has('c1', 'k'), false);
    assert.equal(mc.has('c2', 'k'), true);
  });

  it('clearAll removes everything', () => {
    const mc = new MultiCache();
    mc.set('a', 'x', 1);
    mc.set('b', 'y', 2);
    mc.clearAll();
    assert.equal(mc.cacheNames().length, 0);
  });

  it('deleteCache removes a named cache', () => {
    const mc = new MultiCache();
    mc.set('temp', 'k', 'v');
    assert.equal(mc.deleteCache('temp'), true);
    assert.equal(mc.cacheNames().includes('temp'), false);
  });

  it('getAllStats returns map', () => {
    const mc = new MultiCache();
    mc.set('c1', 'k', 1);
    mc.set('c2', 'k', 2);
    const all = mc.getAllStats();
    assert.equal(all.size, 2);
  });
});

describe('CacheUtils', () => {
  it('createTTLCache returns Cache', () => {
    const c = CacheUtils.createTTLCache(1000);
    c.set('k', 'v');
    assert.equal(c.get('k'), 'v');
  });

  it('createSizeCache returns Cache', () => {
    const c = CacheUtils.createSizeCache(5);
    c.set('k', 1);
    assert.equal(c.get('k'), 1);
  });

  it('estimateMemoryUsage returns number', () => {
    const size = CacheUtils.estimateMemoryUsage({ a: 1, b: 'hello' });
    assert.equal(typeof size, 'number');
    assert.ok(size > 0);
  });
});
