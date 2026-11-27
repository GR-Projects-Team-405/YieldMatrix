import baseApi from '../../../services/api';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
}

const DEFAULT_TTL_MS = 60 * 1000; // 60 seconds TTL
const ym04Cache = new Map<string, CacheEntry>();

export function buildCacheKey(url: string, params?: any): string {
  if (!params) return url;
  try {
    const keys = Object.keys(params).sort();
    const query = keys
      .map((k) => `${k}=${encodeURIComponent(String(params[k]))}`)
      .join('&');
    return `${url}?${query}`;
  } catch {
    return `${url}?${JSON.stringify(params)}`;
  }
}

/**
 * Retrieve cached response data synchronously if within TTL.
 */
export function getCachedData<T = any>(
  url: string,
  params?: any,
  ttl: number = DEFAULT_TTL_MS
): T | null {
  const key = buildCacheKey(url, params);
  const entry = ym04Cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttl) {
    ym04Cache.delete(key);
    return null;
  }
  return entry.data as T;
}

/**
 * Manually set or update a cache entry.
 */
export function setCachedData<T = any>(url: string, params: any, data: T): void {
  const key = buildCacheKey(url, params);
  ym04Cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Invalidate cached entries.
 * If prefix is supplied, deletes matching entries; otherwise clears all YM04 cache.
 */
export function invalidateYm04Cache(prefix?: string): void {
  if (!prefix) {
    ym04Cache.clear();
    return;
  }
  for (const key of ym04Cache.keys()) {
    if (key.includes(prefix)) {
      ym04Cache.delete(key);
    }
  }
}

export interface YM04RequestConfig extends AxiosRequestConfig {
  skipCache?: boolean;
  ttl?: number;
}

/**
 * Enhanced API service for YM04 with lightweight in-memory caching
 * and automatic cache invalidation on mutations (POST/PUT/PATCH/DELETE).
 */
const ym04Api = {
  ...baseApi,

  async get<T = any>(
    url: string,
    config?: YM04RequestConfig
  ): Promise<AxiosResponse<T>> {
    const ttl = config?.ttl ?? DEFAULT_TTL_MS;
    const key = buildCacheKey(url, config?.params);

    if (!config?.skipCache) {
      const cached = ym04Cache.get(key);
      if (cached && Date.now() - cached.timestamp < ttl) {
        // Instant response from cache
        return {
          data: cached.data,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: (config || {}) as any
        } as AxiosResponse<T>;
      }
    }

    // Live network request
    const response = await baseApi.get<T>(url, config);
    if (response && response.status >= 200 && response.status < 300) {
      ym04Cache.set(key, { data: response.data, timestamp: Date.now() });
    }
    return response;
  },

  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    const response = await baseApi.post<T>(url, data, config);
    // Invalidate YM04 cache on mutation so all queries stay fresh
    invalidateYm04Cache();
    return response;
  },

  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    const response = await baseApi.put<T>(url, data, config);
    // Invalidate YM04 cache on mutation so all queries stay fresh
    invalidateYm04Cache();
    return response;
  },

  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    const response = await baseApi.patch<T>(url, data, config);
    // Invalidate YM04 cache on mutation so all queries stay fresh
    invalidateYm04Cache();
    return response;
  },

  async delete<T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    const response = await baseApi.delete<T>(url, config);
    // Invalidate YM04 cache on mutation so all queries stay fresh
    invalidateYm04Cache();
    return response;
  },

  getCached: getCachedData,
  setCached: setCachedData,
  invalidateCache: invalidateYm04Cache
};

export default ym04Api;
