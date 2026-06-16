#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { Cache, MultiCache } from './index.js';
const C = {
    reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m',
    yellow: '\x1b[33m', cyan: '\x1b[36m', bright: '\x1b[1m'
};
const c = (t, col) => `${col}${t}${C.reset}`;
function usage() {
    console.log(`cachex - Zero-dependency in-memory cache library
Usage: cachex <command> [options]

Commands:
  set <key> <value>     Set a value in the cache
  get <key>            Get a value from the cache
  delete <key>         Delete a value from the cache
  has <key>            Check if a key exists
  clear                Clear the cache
  stats                Show cache statistics
  size                 Show cache size
  keys                 Show all keys
  values               Show all values
  demo                 Run a demonstration
  save <file>          Save cache to JSON file
  load <file>          Load cache from JSON file

Options:
  -t, --ttl <ms>       Time to live in milliseconds
  -m, --max-size <n>   Maximum cache size
  -c, --cache <name>   Cache name (multi-cache mode)
  -f, --format <type>  Output format (json|table)
  -o, --output <file>  Output to file

Examples:
  cachex set user:1 '{"name":"Alice"}'
  cachex get user:1 -f json
  cachex stats -c mycache`);
}
function parseArgs(args) {
    const opts = {};
    const rest = [];
    let command = '';
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-t' || a === '--ttl') {
            opts.ttl = parseInt(args[++i]);
        }
        else if (a === '-m' || a === '--max-size' || a === '--maxSize') {
            opts.maxSize = parseInt(args[++i]);
        }
        else if (a === '-f' || a === '--format') {
            opts.format = args[++i];
        }
        else if (a === '-c' || a === '--cache') {
            opts.cacheName = args[++i];
        }
        else if (a === '-o' || a === '--output' || a === '--file') {
            opts.file = args[++i];
        }
        else if (a.startsWith('--')) {
            const [k, v] = a.slice(2).split('=');
            if (k === 'ttl')
                opts.ttl = parseInt(v);
            else if (k === 'maxSize' || k === 'max-size')
                opts.maxSize = parseInt(v);
            else if (k === 'format')
                opts.format = v;
            else if (k === 'cache')
                opts.cacheName = v;
            else if (k === 'file' || k === 'output')
                opts.file = v;
        }
        else if (!command) {
            command = a;
        }
        else {
            rest.push(a);
        }
    }
    return { command, opts, rest };
}
function makeCache(opts) {
    const co = { ttl: opts.ttl, maxSize: opts.maxSize };
    return opts.cacheName ? new MultiCache(co) : new Cache(co);
}
function isMulti(c) { return c instanceof MultiCache; }
function saveToFile(cache, filename) {
    let data = {};
    if (isMulti(cache)) {
        for (const name of cache.cacheNames()) {
            const s = cache.getStats(name);
            if (!s)
                continue;
            data[name] = { stats: s };
        }
    }
    else {
        const entries = cache.entries();
        for (const [k, v] of entries)
            data[k] = v;
    }
    writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(c(`✓ Saved to ${filename}`, C.green));
}
const argv = process.argv.slice(2);
if (argv.length === 0) {
    usage();
    process.exit(0);
}
const { command, opts, rest } = parseArgs(argv);
const cache = makeCache(opts);
try {
    switch (command) {
        case 'set': {
            if (rest.length < 2) {
                console.error('Usage: cachex set <key> <value>');
                process.exit(1);
            }
            let val;
            try {
                val = JSON.parse(rest[1]);
            }
            catch {
                val = rest[1];
            }
            if (isMulti(cache))
                cache.set(opts.cacheName, rest[0], val, opts.ttl);
            else
                cache.set(rest[0], val, opts.ttl);
            console.log(c(`✓ Set ${rest[0]}`, C.green));
            if (opts.file)
                saveToFile(cache, opts.file);
            break;
        }
        case 'get': {
            if (rest.length < 1) {
                console.error('Usage: cachex get <key>');
                process.exit(1);
            }
            const v = isMulti(cache) ? cache.get(opts.cacheName, rest[0]) : cache.get(rest[0]);
            if (v === undefined) {
                console.log(c(`✗ ${rest[0]} not found`, C.red));
                process.exit(1);
            }
            console.log(opts.format === 'json' ? JSON.stringify(v, null, 2) : typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v));
            break;
        }
        case 'delete': {
            if (rest.length < 1) {
                console.error('Usage: cachex delete <key>');
                process.exit(1);
            }
            const ok = isMulti(cache) ? cache.delete(opts.cacheName, rest[0]) : cache.delete(rest[0]);
            console.log(ok ? c(`✓ Deleted ${rest[0]}`, C.green) : c(`✗ ${rest[0]} not found`, C.red));
            break;
        }
        case 'has': {
            if (rest.length < 1) {
                console.error('Usage: cachex has <key>');
                process.exit(1);
            }
            const ex = isMulti(cache) ? cache.has(opts.cacheName, rest[0]) : cache.has(rest[0]);
            console.log(ex ? c(`✓ ${rest[0]} exists`, C.green) : c(`✗ ${rest[0]} not found`, C.red));
            break;
        }
        case 'clear': {
            if (isMulti(cache))
                cache.clear(opts.cacheName ?? '');
            else
                cache.clear();
            console.log(c('✓ Cache cleared', C.green));
            break;
        }
        case 'stats': {
            const s = isMulti(cache) ? cache.getStats(opts.cacheName) : cache.getStats();
            if (!s) {
                console.log(c('No stats available', C.yellow));
                break;
            }
            console.log(opts.format === 'json' ? JSON.stringify(s, null, 2) : Object.entries(s).map(([k, v]) => `${k}: ${v}`).join('\n'));
            break;
        }
        case 'size': {
            const sz = isMulti(cache) ? (cache.getStats(opts.cacheName)?.size ?? 0) : cache.size();
            console.log(c(`Size: ${sz}`, C.cyan));
            break;
        }
        case 'keys': {
            const ks = isMulti(cache) ? [] : cache.keys();
            console.log(opts.format === 'json' ? JSON.stringify(ks) : ks.join(', '));
            break;
        }
        case 'values': {
            const vs = isMulti(cache) ? [] : cache.values();
            console.log(opts.format === 'json' ? JSON.stringify(vs) : vs.map(v => JSON.stringify(v)).join('\n'));
            break;
        }
        case 'save': {
            if (rest.length < 1) {
                console.error('Usage: cachex save <file>');
                process.exit(1);
            }
            saveToFile(cache, rest[0]);
            break;
        }
        case 'load': {
            if (rest.length < 1) {
                console.error('Usage: cachex load <file>');
                process.exit(1);
            }
            if (!existsSync(rest[0])) {
                console.error(c(`✗ ${rest[0]} not found`, C.red));
                process.exit(1);
            }
            const data = JSON.parse(readFileSync(rest[0], 'utf8'));
            if (!isMulti(cache)) {
                for (const [k, v] of Object.entries(data))
                    cache.set(k, v);
            }
            console.log(c(`✓ Loaded from ${rest[0]}`, C.green));
            break;
        }
        case 'demo': {
            console.log(c('\n🚀 Cachex Demo\n', C.bright + C.cyan));
            const sc = cache;
            sc.set('user:1', { id: 1, name: 'Alice' }, opts.ttl);
            sc.set('user:2', { id: 2, name: 'Bob' }, opts.ttl);
            sc.set('config', { app: 'demo', version: '1.0' }, opts.ttl);
            console.log(c('Set 3 items', C.green));
            console.log(`user:1 → ${JSON.stringify(sc.get('user:1'))}`);
            console.log(`user:2 → ${JSON.stringify(sc.get('user:2'))}`);
            console.log(`config → ${JSON.stringify(sc.get('config'))}`);
            sc.get('user:1');
            sc.get('user:1');
            sc.get('missing');
            const st = sc.getStats();
            console.log(c('\nStats:', C.yellow));
            console.log(`  size: ${st.size}, hits: ${st.hits}, misses: ${st.misses}`);
            console.log(`  hit ratio: ${(st.hitRatio * 100).toFixed(1)}%`);
            console.log(`  sets: ${st.sets}, gets: ${st.gets}`);
            console.log(c('\n✨ Done!', C.bright + C.green));
            break;
        }
        default:
            console.error(c(`✗ Unknown command: ${command}`, C.red));
            usage();
            process.exit(1);
    }
}
catch (err) {
    console.error(c(`✗ Error: ${err}`, C.red));
    process.exit(1);
}
//# sourceMappingURL=cli.js.map