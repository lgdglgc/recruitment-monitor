import { DEFAULT_FILTER_CONFIG, SOURCES_CONFIG } from './config';
import { getRedisClient } from './redis';
import { FilterConfig, SourceConfig } from './types';

const SOURCES_REDIS_KEY = 'config:sources';
const FILTER_REDIS_KEY = 'config:filter';

// 内存中的全局缓存 (降级使用)
let inMemorySources: SourceConfig[] = [...SOURCES_CONFIG];
let inMemoryFilter: FilterConfig = { ...DEFAULT_FILTER_CONFIG };

/**
 * 获取当前启用的数据源配置（优先从 Upstash Redis 获取）
 */
export async function getSourcesConfig(): Promise<SourceConfig[]> {
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const data = await redisClient.get<SourceConfig[]>(SOURCES_REDIS_KEY);
      // 只要 Redis 中有保存的数组（即使为空数组 []），都以用户保存的为主，避免无法删空
      if (data !== null && Array.isArray(data)) {
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
  const redisClient = getRedisClient();
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
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const data = await redisClient.get<FilterConfig>(FILTER_REDIS_KEY);
      if (data && typeof data === 'object') {
        return {
          ...DEFAULT_FILTER_CONFIG,
          ...data,
          // 兼容历史 Redis 数据无 excludeKeywords 的情况
          excludeKeywords: data.excludeKeywords || DEFAULT_FILTER_CONFIG.excludeKeywords || [],
        };
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
  const redisClient = getRedisClient();
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
