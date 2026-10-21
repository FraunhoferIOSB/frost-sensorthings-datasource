package plugin

import (
	"bytes"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"
)

// encodeParams serializes a parameter map into a URL query string, sorting
// the keys for deterministic output.
func encodeParams(params map[string]string) string {
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var buffer bytes.Buffer
	for i, k := range keys {
		if i > 0 {
			buffer.WriteByte('&')
		}
		buffer.WriteString(url.QueryEscape(k))
		buffer.WriteByte('=')
		buffer.WriteString(url.QueryEscape(params[k]))
	}
	return buffer.String()
}

// parseURLQuery parses a URL query string (with or without a leading "?")
// into a map. Repeated keys keep the last value, mirroring the behavior of
// the frontend, where parameters are stored in an object.
func parseURLQuery(query string) (map[string]string, error) {
	result := map[string]string{}

	if strings.HasPrefix(query, "?") {
		query = query[1:]
	}
	if query == "" {
		return result, nil
	}

	for _, kv := range strings.Split(query, "&") {
		if kv == "" {
			continue
		}
		parts := strings.SplitN(kv, "=", 2)
		key, err := url.QueryUnescape(parts[0])
		if err != nil {
			return nil, err
		}
		value := ""
		if len(parts) == 2 {
			value, err = url.QueryUnescape(parts[1])
			if err != nil {
				return nil, err
			}
		}
		result[key] = value
	}

	return result, nil
}

// TTLCache is a minimal thread-safe in-memory cache with per-key time to
// live. It replaces the memory-cache npm package used by the frontend.
type TTLCache struct {
	mu    sync.Mutex
	items map[string]cacheItem
}

type cacheItem struct {
	value   []byte
	expires time.Time
}

// NewTTLCache creates a new empty cache.
func NewTTLCache() *TTLCache {
	return &TTLCache{
		items: make(map[string]cacheItem),
	}
}

// Get returns the cached value for the key, or nil if the key is not cached
// or has expired.
func (c *TTLCache) Get(key string) ([]byte, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	item, ok := c.items[key]
	if !ok {
		return nil, nil
	}
	if time.Now().After(item.expires) {
		delete(c.items, key)
		return nil, nil
	}
	return item.value, nil
}

// Put stores a value for the given duration. The duration is in seconds.
func (c *TTLCache) Put(key string, value []byte, durationSeconds int) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.items[key] = cacheItem{
		value:   value,
		expires: time.Now().Add(time.Duration(durationSeconds) * time.Second),
	}
}

// Del removes the value for the key.
func (c *TTLCache) Del(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	delete(c.items, key)
}

// Flush removes all values from the cache.
func (c *TTLCache) Flush() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.items = make(map[string]cacheItem)
}

// Len returns the number of items currently in the cache.
func (c *TTLCache) Len() int {
	c.mu.Lock()
	defer c.mu.Unlock()

	return len(c.items)
}
