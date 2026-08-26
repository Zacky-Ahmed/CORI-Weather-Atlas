import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60, useClones: false });
const events = new Map();

export function cached(key, loader) {
  const existing = cache.get(key);
  if (existing !== undefined) {
    events.set(key, 'HIT');
    return Promise.resolve(existing);
  }
  events.set(key, 'MISS');
  return Promise.resolve(loader()).then((value) => {
    cache.set(key, value);
    return value;
  });
}

export function cacheStatus() {
  return { ttlSeconds: 300, keys: cache.keys(), lastResult: Object.fromEntries(events) };
}
