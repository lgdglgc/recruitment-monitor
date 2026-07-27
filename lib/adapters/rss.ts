import Parser from 'rss-parser';
import { generateJobHash } from '../redis';
import { JobItem } from '../types';
import { BaseAdapter } from './base';

/**
 * RSS / 微信公众号转 RSS 适配器
 */
export class RSSAdapter extends BaseAdapter {
  private parser: Parser;

  constructor(config: any) {
    super(config);
    this.parser = new Parser({
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 10000,
    });
  }

  async fetchItems(): Promise<JobItem[]> {
    try {
      // 1. 获取 RSS xml 字符串
      const response = await this.fetchWithRetry(this.config.url);
      const xmlData = await response.text();

      // 2. 解析 RSS
      const feed = await this.parser.parseString(xmlData);

      const items: JobItem[] = [];

      for (const item of feed.items || []) {
        const link = item.link || item.guid || '';
        const title = item.title || '无标题';

        if (!link) continue;

        // 使用 URL 的 Hash 或 Guid 作为唯一 ID
        const id = generateJobHash(link);

        items.push({
          id,
          title: title.trim(),
          link: link.trim(),
          date: item.pubDate || item.isoDate || '',
          summary: item.contentSnippet || item.content || '',
          sourceName: this.config.name,
        });
      }

      return items;
    } catch (error: any) {
      console.error(`[RSSAdapter Error] 数据源 [${this.config.name}] 解析失败:`, error.message);
      throw error;
    }
  }
}
