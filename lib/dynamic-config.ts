import { Redis } from '@upstash/redis';
import { DEFAULT_FILTER_CONFIG, SOURCES_CONFIG } from './config';
import { FilterConfig, SourceConfig } from './types';

let redisClient: Redis | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redisClient = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

const SOURCES_REDIS_KEY = 'config:sources';
const FILTER_REDIS_KEY = 'config:filter';

// 内存中的全局缓存 (降级使用)
let inMemorySources: SourceConfig[] = [...SOURCES_CONFIG];
let inMemoryFilter: FilterConfig = { ...DEFAULT_FILTER_CONFIG };

/**
 * 获取当前启用的数据源配置（优先从 Upstash Redis 获取）
 */
export async function getSourcesConfig(): Promise<SourceConfig[]> {
  if (redisClient) {
    try {
      const data = await redisClient.get<SourceConfig[]>(SOURCES_REDIS_KEY);
      if (data && Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch (err) {
      console.error('[DynamicConfig] 从 Redis 读取数据源配置失败:', err);
    }
  }
  return inMemorySources;
}

/**
 * 保存数据源配置至 Redis
 */
export async function saveSourcesConfig(sources: SourceConfig[]): Promise<boolean> {
  inMemorySources = sources;
  if (redisClient) {
    try {
      await redisClient.set(SOURCES_REDIS_KEY, sources);
      return true;
    } catch (err) {
      console.error('[DynamicConfig] 保存数据源配置至 Redis 失败:', err);
      return false;
    }
  }
  return true;
}

/**
 * 获取当前的关键词过滤配置
 */
export async function getFilterConfig(): Promise<FilterConfig> {
  if (redisClient) {
    try {
      const data = await redisClient.get<FilterConfig>(FILTER_REDIS_KEY);
      if (data && typeof data === 'object') {
        return data;
      }
    } catch (err) {
      console.error('[DynamicConfig] 从 Redis 读取过滤配置失败:', err);
    }
  }
  return inMemoryFilter;
}

/**
 * 保存过滤规则配置至 Redis
 */
export async function saveFilterConfig(config: FilterConfig): Promise<boolean> {
  inMemoryFilter = config;
  if (redisClient) {
    try {
      await redisClient.set(FILTER_REDIS_KEY, config);
      return true;
    } catch (err) {
      console.error('[DynamicConfig] 保存过滤配置至 Redis 失败:', err);
      return false;
    }
  }
  return true;
}
