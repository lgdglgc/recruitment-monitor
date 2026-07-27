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
}
