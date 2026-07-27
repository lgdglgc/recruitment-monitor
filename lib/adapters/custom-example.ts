import { generateJobHash } from '../redis';
import { JobItem } from '../types';
import { BaseAdapter } from './base';

/**
 * 自定义适配器示例 (针对复杂的 JSON API 接口或特殊网页结构)
 *
 * 【使用方法】：
 * 1. 拷贝此类并修改你的解析逻辑
 * 2. 在 lib/scraper.ts 的 factory 中引入并注册
 */
export class CustomExampleAdapter extends BaseAdapter {
  async fetchItems(): Promise<JobItem[]> {
    try {
      // 示例：某些校园招聘网站采用异步 JSON API 返回数据
      const response = await this.fetchWithRetry(this.config.url, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Referer': this.config.url,
        },
      });

      const json = await response.json();
      const items: JobItem[] = [];

      // 假设 JSON 数据格式为： { code: 200, data: { list: [ { id: 123, jobName: 'xxx', postUrl: 'xxx', createTime: '2026-03-01' } ] } }
      const list = json?.data?.list || json?.data || json?.list || [];

      for (const raw of list) {
        const title = raw.jobName || raw.title || raw.name;
        const link = raw.postUrl || raw.url || raw.link;

        if (title && link) {
          const absoluteLink = new URL(link, this.config.url).toString();
          items.push({
            id: generateJobHash(absoluteLink),
            title: String(title).trim(),
            link: absoluteLink,
            date: raw.createTime || raw.publishTime || raw.date,
            summary: raw.description || raw.summary,
            sourceName: this.config.name,
          });
        }
      }

      return items;
    } catch (error: any) {
      console.error(`[CustomAdapter Error] 数据源 [${this.config.name}] 自定义解析失败:`, error.message);
      throw error;
    }
  }
}
