# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-06-20

### Added
- **`VERSION` export constant** — programmatic access to version via `import { VERSION } from 'cachex'`
- **`--version` / `-V` CLI flag** — display version number from command line
- **`version` CLI command** — display version number via `cachex version`
- **CHANGELOG.md** — full version history and migration guide
- **Real-world README examples**:
  - API response caching with 5-minute TTL
  - Session storage with per-key expiration
  - Multi-cache isolation for user data
- **Comparison table** vs lru-cache, node-cache, cache-manager, quick-lru
- **`test:core` npm script** — for running core test suite only
- **`engines: >=18.0.0`** — updated minimum Node.js version

### Improved
- Documentation with expanded feature examples
- README now includes 3 real-world use cases
- Added comprehensive alternative library comparison

## [1.0.0] - 2025-06-16

### Added
- **LRUCache** — Least Recently Used cache with TTL support
- **Cache** — Simple cache interface with optional per-key TTL
- **MultiCache** — Multi-key cache operations with namespace isolation
- **CacheUtils** — Utility functions for cache creation and memory estimation
- **CacheStrategies** — Cache strategy patterns (write-through, write-behind)
- Comprehensive CLI tool with set/get/delete/has/clear/stats/size/keys/values/demo/save/load commands
- Cache statistics (hits, misses, hit ratio, evictions, memory usage)
- Cleanup timer for automatic expired item removal
- Full TypeScript support with type definitions
- Comprehensive test suite (26 tests, 100% pass rate)

### Features
- Zero dependencies
- LRU eviction when maxSize is exceeded
- TTL expiration support
- Per-key TTL override
- Multi-namespace cache isolation
- Eviction callbacks
- Memory usage estimation
- JSON serialization for save/load

[1.1.0]: https://github.com/sulthonzh/cachex/releases/tag/v1.1.0
[1.0.0]: https://github.com/sulthonzh/cachex/releases/tag/v1.0.0