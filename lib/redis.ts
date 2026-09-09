import { Redis } from '@upstash/redis';
import crypto from 'crypto';
import { DEDUPE_TTL_SECONDS } from './config';
import { JobItem } from './types';

// 初始化 Upstash Redis 客户端
// 如果环境变量未设置，会优雅降级并打印 Warning
let redisClient: Redis | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redisClient = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
} else {
  console.warn('[Redis Warning] 未检测到 UPSTASH_REDIS_REST_URL 或 UPSTASH_REDIS_REST_TOKEN 环境变量，将使用内存去重模式 (注意：Serverless 环境重启后内存会清空)。');
}

/**
 * 获取全局统一的 Upstash Redis 客户端单例
 */
export function getRedisClient(): Redis | null {
  return redisClient;
}

// 内存降级去重集合 (本地无 Redis 测试用)
const inMemorySeenSet = new Set<string>();

/**
 * 根据文章 URL 生成 MD5 Hash 作为唯一 ID
 */
export function generateJobHash(url: string): string {
  return crypto.createHash('md5').update(url.trim()).digest('hex');
}

/**
 * Redis Key 前缀
 */
const KEY_PREFIX = 'job_sent:';

/**
 * 过滤出尚未推送过的全新招聘条目
 * @param items 待检查的招聘条目列表
 * @returns 仅包含未推送过条目的数组
 */
export async function filterNewItems(items: JobItem[]): Promise<JobItem[]> {
  if (!items || items.length === 0) return [];

  const newItems: JobItem[] = [];

  // 如果 Redis 可用，优先批量查询 Redis
  if (redisClient) {
    try {
      const pipeline = redisClient.pipeline();
      for (const item of items) {
        pipeline.exists(`${KEY_PREFIX}${item.id}`);
      }

      // 执行 Pipeline 查询
      const results = (await pipeline.exec()) as number[];

      for (let i = 0; i < items.length; i++) {
        // exists 返回 1 表示已存在，0 表示不存在
        if (!results[i]) {
          newItems.push(items[i]);
        }
      }
      return newItems;
    } catch (error) {
      console.error('[Redis Error] 查询已推送状态失败，降级为包含所有条目:', error);
      // 发生错误时，回退到内存检查
    }
  }

  // 降级使用内存 Check
  for (const item of items) {
    if (!inMemorySeenSet.has(item.id)) {
      newItems.push(item);
    }
  }

  return newItems;
}

/**
 * 将成功推送的条目标记为已推送
 * @param items 已经推送的条目
 */
export async function markItemsAsProcessed(items: JobItem[]): Promise<void> {
  if (!items || items.length === 0) return;

  if (redisClient) {
    try {
      const pipeline = redisClient.pipeline();
      for (const item of items) {
        // 设置 Key 并指定 TTL 过期时间 (默认 30 天)
        pipeline.set(`${KEY_PREFIX}${item.id}`, '1', { ex: DEDUPE_TTL_SECONDS });
      }
      await pipeline.exec();
      console.log(`[Redis] 成功在 Upstash Redis 中标记了 ${items.length} 条已推送条目 (TTL: ${DEDUPE_TTL_SECONDS}s)`);
      return;
    } catch (error) {
      console.error('[Redis Error] 标记已推送状态失败:', error);
    }
  }

  // 内存记录
  for (const item of items) {
    inMemorySeenSet.add(item.id);
  }
}

/**
 * Redis 最近岗位存储 Key 与最大保留条数 (支持保留历史每日数据，最多 1000 条)
 */
const RECENT_JOBS_KEY = 'jobs:recent';
const MAX_RECENT_JOBS = 1000;
let inMemoryRecentJobs: JobItem[] = [];

/**
 * 保存/合并抓取到的岗位列表 (保留历史每日数据，最多 1000 条，并保留首次收录日期)
 */
export async function saveRecentJobs(items: JobItem[]): Promise<void> {
  if (!items || items.length === 0) return;

  if (redisClient) {
    try {
      const existing = (await redisClient.get<JobItem[]>(RECENT_JOBS_KEY)) || [];
      const map = new Map<string, JobItem>();

      // 建立已存在项字典，方便保留其原始首次收录日期
      const existingMap = new Map<string, JobItem>();
      for (const item of existing) {
        if (item.id) existingMap.set(item.id, item);
      }

      // 处理新抓取的条目
      for (const item of items) {
        if (!item.id) continue;
        const old = existingMap.get(item.id);
        if (old && old.crawledDate) {
          // 保留初次发现和收录的日期
          map.set(item.id, { ...item, crawledDate: old.crawledDate });
        } else {
          map.set(item.id, item);
        }
      }

      // 将历史已有但本次未抓到的条目追加回来
      for (const item of existing) {
        if (item.id && !map.has(item.id)) {
          map.set(item.id, item);
        }
      }

      // 按收录日期降序排列（最新收录的排在最前）
      const merged = Array.from(map.values())
        .sort((a, b) => {
          const dateA = a.crawledDate || a.date || '';
          const dateB = b.crawledDate || b.date || '';
          return dateB.localeCompare(dateA);
        })
        .slice(0, MAX_RECENT_JOBS);

      await redisClient.set(RECENT_JOBS_KEY, merged);
      inMemoryRecentJobs = merged;
      return;
    } catch (error) {
      console.error('[Redis Error] 保存岗位历史数据失败:', error);
    }
  }

  // 内存降级保存
  const existingMap = new Map<string, JobItem>();
  for (const item of inMemoryRecentJobs) {
    if (item.id) existingMap.set(item.id, item);
  }

  const map = new Map<string, JobItem>();
  for (const item of items) {
    if (!item.id) continue;
    const old = existingMap.get(item.id);
    if (old && old.crawledDate) {
      map.set(item.id, { ...item, crawledDate: old.crawledDate });
    } else {
      map.set(item.id, item);
    }
  }
  for (const item of inMemoryRecentJobs) {
    if (item.id && !map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  inMemoryRecentJobs = Array.from(map.values())
    .sort((a, b) => {
      const dateA = a.crawledDate || a.date || '';
      const dateB = b.crawledDate || b.date || '';
      return dateB.localeCompare(dateA);
    })
    .slice(0, MAX_RECENT_JOBS);
}

/**
 * 获取抓取的历史岗位列表 (按日期排序)
 */
export async function getRecentJobs(): Promise<JobItem[]> {
  if (redisClient) {
    try {
      const data = await redisClient.get<JobItem[]>(RECENT_JOBS_KEY);
      if (data && Array.isArray(data)) {
        return data.sort((a, b) => {
          const dateA = a.crawledDate || a.date || '';
          const dateB = b.crawledDate || b.date || '';
          return dateB.localeCompare(dateA);
        });
      }
    } catch (error) {
      console.error('[Redis Error] 读取岗位历史数据失败:', error);
    }
  }
  return inMemoryRecentJobs.sort((a, b) => {
    const dateA = a.crawledDate || a.date || '';
    const dateB = b.crawledDate || b.date || '';
    return dateB.localeCompare(dateA);
  });
}

