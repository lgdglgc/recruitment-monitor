import { DEFAULT_USER_AGENT, MAX_RETRIES, REQUEST_TIMEOUT_MS } from '../config';
import { JobItem, SourceConfig } from '../types';

/**
 * 适配器抽象基类
 * 所有抓取适配器 (RSS、HTML 爬虫、自定义适配器) 继承此基类
 */
export abstract class BaseAdapter {
  protected config: SourceConfig;

  constructor(config: SourceConfig) {
    this.config = config;
  }

  /**
   * 核心抓取接口，子类必须实现
   */
  abstract fetchItems(): Promise<JobItem[]>;

  /**
   * 带超时和重试机制的 HTTP GET Fetch 工具函数
   */
  protected async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    retries = MAX_RETRIES
  ): Promise<Response> {
    const headers = {
      'User-Agent': DEFAULT_USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      ...options.headers,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        if (attempt > 0) {
          console.log(`[Adapter ${this.config.name}] 正在重试第 ${attempt}/${retries} 次...`);
          // 简单的指数退避延迟
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }

        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} - ${response.statusText}`);
        }

        return response;
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = err.name === 'AbortError' ? new Error(`请求超时 (${REQUEST_TIMEOUT_MS}ms)`) : err;
      }
    }

    throw new Error(`抓取页面 [${url}] 失败，在 ${retries} 次重试后放弃。原因: ${lastError?.message}`);
  }

  /**
   * 带智能编码检测的 HTML 页面获取工具 (完美支持 UTF-8 / GBK / GB2312)
   */
  protected async fetchHtmlWithEncoding(url: string, options: RequestInit = {}): Promise<string> {
    const response = await this.fetchWithRetry(url, options);
    const contentType = response.headers.get('content-type') || '';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. 从 HTTP Content-Type Header 中提取 charset
    let charset = '';
    const headerMatch = contentType.match(/charset=([a-zA-Z0-9_-]+)/i);
    if (headerMatch) {
      charset = headerMatch[1].toLowerCase();
    }

    // 2. 若 Header 未标明，从 HTML 前部 <meta charset="..."> 中探测
    if (!charset) {
      const prefix = buffer.subarray(0, 1500).toString('latin1');
      const metaMatch =
        prefix.match(/<meta[^>]+charset=["']?([a-zA-Z0-9_-]+)/i) ||
        prefix.match(/<meta[^>]+http-equiv=["']?Content-Type["']?[^>]+content=["'][^"']*charset=([a-zA-Z0-9_-]+)/i);
      if (metaMatch) {
        charset = metaMatch[1].toLowerCase();
      }
    }

    // 3. 执行精准解码
    if (charset === 'gbk' || charset === 'gb2312' || charset === 'gb18030') {
      try {
        const decoder = new TextDecoder('gbk');
        return decoder.decode(buffer);
      } catch (e) {
        console.warn(`[BaseAdapter] GBK 解码异常，尝试回退为 UTF-8:`, e);
      }
    }

    // 默认使用 UTF-8 解码
    return new TextDecoder('utf-8').decode(buffer);
  }
}
