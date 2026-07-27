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
