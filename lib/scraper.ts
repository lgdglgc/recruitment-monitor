import { CustomExampleAdapter } from './adapters/custom-example';
import { HTMLAdapter } from './adapters/html';
import { RSSAdapter } from './adapters/rss';
import { getFilterConfig, getSourcesConfig } from './dynamic-config';
import { filterJobs } from './filter';
import { sendServerChanNotification } from './notify';
import { filterNewItems, markItemsAsProcessed } from './redis';
import { JobItem, ScrapeResult, SourceConfig } from './types';

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
    totalFetched: number;
    totalMatched: number;
    newPushedCount: number;
  };
  results: ScrapeResult[];
}> {
  // 动态读取最新的数据源与过滤关键词规则
  const sourcesConfig = await getSourcesConfig();
  const filterConfig = await getFilterConfig();

  console.log(`[Workflow Start] 正在启动招聘监控工作流 (已加载 ${sourcesConfig.length} 个数据源)...`);

  const results: ScrapeResult[] = [];
  const allMatchedItems: JobItem[] = [];
  let totalFetchedCount = 0;

  // 1. 并发抓取所有配置的监控源
  const scrapePromises = sourcesConfig.map(async (source) => {
    try {
      const adapter = createAdapter(source);
      const fetchedItems = await adapter.fetchItems();

      // 关键词过滤
      const matched = filterJobs(fetchedItems, filterConfig);

      return {
        sourceId: source.id,
        sourceName: source.name,
        totalFetched: fetchedItems.length,
        matchedCount: matched.length,
        newCount: 0,
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
    `[Scraper Summary] 抓取完成。数据源: ${sourcesConfig.length}，抓取总量: ${totalFetchedCount}，关键词匹配符合项: ${allMatchedItems.length}`
  );

  // 2. Redis 去重：挑选出从未推送过的全新岗位
  const newUnsentItems = await filterNewItems(allMatchedItems);
  console.log(`[Dedupe Summary] 经过 Upstash Redis 去重后，剩余 ${newUnsentItems.length} 条新内容待推送。`);

  // 3. 执行推送 (如存在新条目)
  let pushSuccess = false;
  if (newUnsentItems.length > 0) {
    pushSuccess = await sendServerChanNotification(newUnsentItems);

    // 4. 推送成功后，在 Upstash Redis 中标记该批条目为已处理
    if (pushSuccess) {
      await markItemsAsProcessed(newUnsentItems);
    }
  }

  return {
    summary: {
      totalSources: sourcesConfig.length,
      totalFetched: totalFetchedCount,
      totalMatched: allMatchedItems.length,
      newPushedCount: pushSuccess ? newUnsentItems.length : 0,
    },
    results,
  };
}
