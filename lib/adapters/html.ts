import * as cheerio from 'cheerio';
import { generateJobHash } from '../redis';
import { JobItem } from '../types';
import { BaseAdapter } from './base';

/**
 * 通用 HTML 页面 cheerio 适配器
 */
export class HTMLAdapter extends BaseAdapter {
  async fetchItems(): Promise<JobItem[]> {
    const selector = this.config.selector;
    if (!selector) {
      throw new Error(`[HTMLAdapter Error] 数据源 [${this.config.name}] 未配置 selector 选择器！`);
    }

    try {
      const response = await this.fetchWithRetry(this.config.url);
      const html = await response.text();

      const $ = cheerio.load(html);
      const items: JobItem[] = [];

      $(selector.container).each((_, element) => {
        const $item = $(element);

        // 提取标题
        const title = $item.find(selector.title).text().trim();

        // 提取链接
        let href = $item.find(selector.link).attr('href') || '';
        if (href) {
          // 将相对路径补全为绝对路径
          try {
            href = new URL(href, this.config.url).toString();
          } catch (e) {
            // URL 补全异常保持原样
          }
        }

        // 提取日期 (可选)
        const date = selector.date ? $item.find(selector.date).text().trim() : undefined;

        // 提取摘要 (可选)
        const summary = selector.summary ? $item.find(selector.summary).text().trim() : undefined;

        if (title && href) {
          const id = generateJobHash(href);
          items.push({
            id,
            title,
            link: href,
            date,
            summary,
            sourceName: this.config.name,
          });
        }
      });

      return items;
    } catch (error: any) {
      console.error(`[HTMLAdapter Error] 数据源 [${this.config.name}] 抓取失败:`, error.message);
      throw error;
    }
  }
}
