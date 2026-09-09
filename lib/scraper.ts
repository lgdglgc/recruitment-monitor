import { CustomExampleAdapter } from './adapters/custom-example';
import { HTMLAdapter } from './adapters/html';
import { RSSAdapter } from './adapters/rss';
import { getFilterConfig, getSourcesConfig } from './dynamic-config';
import { filterJobs } from './filter';
import { sendAllNotifications } from './notify';
import { filterNewItems, markItemsAsProcessed, saveRecentJobs } from './redis';
import { JobItem, ScrapeResult, SourceConfig } from './types';

/**
 * 获取当前北京时间日期字符串 (YYYY-MM-DD)
 */
export function getTodayDateString(): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(new Date())
      .replace(/\//g, '-');
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * 根据源配置实例化对应的适配器
 */
export function createAdapter(config: SourceConfig) {
  if (config.adapterKey === 'custom-example') {
    return new CustomExampleAdapter(config);
  }

  switch (config.type) {
    case 'rss':
      return new RSSAdapter(config);
    case 'html':
      return new HTMLAdapter(config);
    default:
      throw new Error(`未知的 Source Type: ${config.type}`);
  }
}

/**
 * 运行完整的抓取、过滤、去重与推送流程
 */
export async function runMonitoringWorkflow(): Promise<{
  summary: {
    totalSources: number;
    activeSources: number;
    totalFetched: number;
    totalMatched: number;
    newPushedCount: number;
  };
  results: ScrapeResult[];
}> {
  const todayStr = getTodayDateString();

  // 动态读取最新的数据源与过滤关键词规则
  const sourcesConfig = await getSourcesConfig();
  const filterConfig = await getFilterConfig();

  // 过滤出启用的数据源 (enabled 默认为 true)
  const activeSources = sourcesConfig.filter((s) => s.enabled !== false);

  console.log(
    `[Workflow Start] 启动招聘监控工作流 [日期: ${todayStr}] (数据源: ${sourcesConfig.length}, 启用: ${activeSources.length})...`
  );

  const results: ScrapeResult[] = [];
  const allMatchedItems: JobItem[] = [];
  let totalFetchedCount = 0;

  // 1. 并发抓取所有启用的监控源
  const scrapePromises = activeSources.map(async (source) => {
    try {
      const adapter = createAdapter(source);
      const fetchedItems = await adapter.fetchItems();

      // 关键词与黑名单过滤
      const matched = filterJobs(fetchedItems, filterConfig);

      // 为每条匹配岗位打上收录日期标签
      matched.forEach((item) => {
        if (!item.crawledDate) {
          item.crawledDate = todayStr;
        }
      });

      return {
        sourceId: source.id,
        sourceName: source.name,
        totalFetched: fetchedItems.length,
        matchedCount: matched.length,
        newCount: 0, // 先占位，后续去重后精准回填
        items: matched,
      } as ScrapeResult;
    } catch (err: any) {
      console.error(`[Scraper Engine] 源 [${source.name}] 执行异常:`, err.message);
      return {
        sourceId: source.id,
        sourceName: source.name,
        totalFetched: 0,
        matchedCount: 0,
        newCount: 0,
        items: [],
        error: err.message,
      } as ScrapeResult;
    }
  });

  const settleResults = await Promise.allSettled(scrapePromises);

  settleResults.forEach((res) => {
    if (res.status === 'fulfilled') {
      const r = res.value;
      results.push(r);
      totalFetchedCount += r.totalFetched;
      allMatchedItems.push(...r.items);
    }
  });

  console.log(
    `[Scraper Summary] 抓取完成。启用源: ${activeSources.length}，抓取总量: ${totalFetchedCount}，关键词匹配符合项: ${allMatchedItems.length}`
  );

  // 1.5 保存所有匹配到的岗位到 Redis 持久化展示缓存 (供前端界面浏览，按抓取日期保存历史记录)
  if (allMatchedItems.length > 0) {
    await saveRecentJobs(allMatchedItems);
  }

  // 2. Redis 去重：挑选出从未推送过的全新岗位
  const newUnsentItems = await filterNewItems(allMatchedItems);
  console.log(`[Dedupe Summary] 经过 Upstash Redis 去重后，剩余 ${newUnsentItems.length} 条今日新增待推送内容。`);

  // 精准回填每个源的新增条数 newCount
  const newIdSet = new Set(newUnsentItems.map((item) => item.id));
  for (const r of results) {
    r.newCount = r.items.filter((item) => newIdSet.has(item.id)).length;
  }

  // 3. 执行多渠道推送 (如存在新条目)
  let pushSuccess = false;
  if (newUnsentItems.length > 0) {
    pushSuccess = await sendAllNotifications(newUnsentItems);

    // 4. 推送成功后，在 Upstash Redis 中标记该批条目为已处理
    if (pushSuccess) {
      await markItemsAsProcessed(newUnsentItems);
    }
  }

  return {
    summary: {
      totalSources: sourcesConfig.length,
      activeSources: activeSources.length,
      totalFetched: totalFetchedCount,
      totalMatched: allMatchedItems.length,
      newPushedCount: pushSuccess ? newUnsentItems.length : 0,
    },
    results,
  };
}
