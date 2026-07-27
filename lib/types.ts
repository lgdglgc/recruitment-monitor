/**
 * 招聘信息单条数据结构
 */
export interface JobItem {
  id: string;          // 唯一标识 (通常为 URL 的 MD5 哈希或原文章 ID)
  title: string;       // 招聘标题
  link: string;        // 详情链接
  date?: string;       // 发布日期
  summary?: string;    // 内容摘要/简介
  sourceName: string;  // 数据来源名称
}

/**
 * 数据源类型
 */
export type SourceType = 'rss' | 'html' | 'custom';

/**
 * 监控源配置结构
 */
export interface SourceConfig {
  id: string;
  name: string;
  type: SourceType;
  url: string;
  // 针对 HTML 爬虫的 CSS 选择器配置
  selector?: {
    container: string; // 列表容器选择器
    title: string;     // 标题选择器
    link: string;      // 链接选择器
    date?: string;     // 日期选择器
    summary?: string;  // 摘要选择器
  };
  // 自定义适配器标识名 (对应 lib/adapters/ 下的具体类)
  adapterKey?: string;
}

/**
 * 关键词匹配模式：
 * OR: 匹配任意一个关键词即通过
 * AND: 必须包含年份关键词中的至少一个 AND 包含其他关键词中的至少一个
 */
export type FilterMode = 'OR' | 'AND';

/**
 * 过滤规则配置
 */
export interface FilterConfig {
  years: string[];     // 年份关键词 (如 ['2026', '2027'])
  keywords: string[];  // 核心关键词 (如 ['校招', '春招', '秋招', '应届', '招聘', '岗位'])
  mode: FilterMode;
}

/**
 * 单个源的抓取执行结果统计
 */
export interface ScrapeResult {
  sourceId: string;
  sourceName: string;
  totalFetched: number;
  matchedCount: number;
  newCount: number;
  items: JobItem[];
  error?: string;
}
