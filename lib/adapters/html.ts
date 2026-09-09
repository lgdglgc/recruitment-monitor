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
      const html = await this.fetchHtmlWithEncoding(this.config.url);

      const $ = cheerio.load(html);
      const items: JobItem[] = [];

      $(selector.container).each((_, element) => {
        const $item = $(element);

        // 优先提取 title 属性 (避免部分中文政企网站列表页截断文字带省略号)，其次提取文本内容
        const $titleEl = $item.find(selector.title);
        const attrTitle = $titleEl.attr('title')?.replace(/\s+/g, ' ').trim();
        const textTitle = $titleEl.text().replace(/\s+/g, ' ').trim();
        const title = attrTitle && attrTitle.length >= textTitle.length ? attrTitle : textTitle;

        // 提取链接
        let href = $item.find(selector.link).attr('href')?.trim() || '';
        
        // 过滤无效伪链接
        if (
          !href ||
          href.startsWith('javascript:') ||
          href === '#' ||
          href.toLowerCase() === 'void(0);'
        ) {
          return;
        }

        // 将相对路径补全为绝对路径
        try {
          href = new URL(href, this.config.url).toString();
        } catch (e) {
          // URL 补全异常保持原样
        }

        // 提取日期 (可选)
        const date = selector.date ? $item.find(selector.date).text().replace(/\s+/g, ' ').trim() : undefined;

        // 提取摘要 (可选)
        const summary = selector.summary ? $item.find(selector.summary).text().replace(/\s+/g, ' ').trim() : undefined;

        if (title && href) {
          const id = generateJobHash(href);
          items.push({
            id,
            title,
            link: href,
            date: date || undefined,
            summary: summary || undefined,
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
