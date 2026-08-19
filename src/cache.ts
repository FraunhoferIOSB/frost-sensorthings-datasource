/**
 * A minimal in-memory cache with per-key time to live. It replaces the
 * unmaintained `memory-cache` package that was previously used by the Api
 * class, with the same semantics.
 */

interface CacheItem<T> {
  value: T;
  expires: number;
}

export class Cache<T = any> {
  private items = new Map<string, CacheItem<T>>();

  /**
   * Returns the cached value for the key, or undefined if the key is not
   * cached or has expired.
   */
  get(key: string): T | undefined {
    const item = this.items.get(key);
    if (!item) {
      return undefined;
    }
    if (Date.now() > item.expires) {
      this.items.delete(key);
      return undefined;
    }
    return item.value;
  }

  /**
   * Stores a value for the given number of seconds.
   */
  put(key: string, value: T, durationSeconds: number): void {
    this.items.set(key, {
      value,
      expires: Date.now() + durationSeconds * 1000,
    });
  }

  /**
   * Removes the value for the key.
   */
  del(key: string): void {
    this.items.delete(key);
  }
}
