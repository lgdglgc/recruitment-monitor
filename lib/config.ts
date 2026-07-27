import { FilterConfig, SourceConfig } from './types';

/**
 * 关键词过滤规则配置
 */
export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  // 关注年份
  years: ['2026', '2027'],
  // 目标招聘关键词
  keywords: ['校招', '春招', '秋招', '应届', '招聘', '岗位', '实习', '管培生'],
  // 匹配模式:
  // 'AND' 表示：(包含 2026 或 2027) AND (包含校招/春招/秋招/应届/招聘...)
  // 'OR' 表示：包含任意一个关键词即可
  mode: 'AND',
};

/**
 * 监控数据源清单
 * 在这里添加你需要监控的网站链接或微信公众号 RSS
 */
export const SOURCES_CONFIG: SourceConfig[] = [
  {
    id: 'wx-official-rss',
    name: '微信公众号「名企校招推送」',
    type: 'rss',
    // 微信公众号转成的 RSS 源（例如通过 RSSHub 或 WeRss 生成的链接）
    url: 'https://rsshub.app/wechat/officialaccounts/cntvnews', // 示例 RSS 链接，可换成你的公众号 RSS
  },
  {
    id: 'campus-job-rss',
    name: '某大学就业网 RSS 招聘列表',
    type: 'rss',
    url: 'https://news.ycombinator.com/rss', // 示例 RSS 地址
  },
  {
    id: 'university-job-site',
    name: 'XX大学就业网招聘列表 (HTML网页爬取)',
    type: 'html',
    url: 'https://example.edu.cn/job/list', // 示例网页地址
    selector: {
      container: '.job-list .item',  // 列表每一项的 CSS 选择器
      title: '.title a',             // 标题选择器
      link: '.title a',              // 链接选择器
      date: '.date',                 // 日期选择器 (可选)
      summary: '.desc',              // 摘要选择器 (可选)
    },
  },
];

/**
 * 通用 HTTP 请求 Headers 配置 (模拟标准浏览器)
 */
export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/**
 * 单个源请求超时时间 (毫秒)
 */
export const REQUEST_TIMEOUT_MS = 10000;

/**
 * 抓取重试次数
 */
export const MAX_RETRIES = 2;

/**
 * Upstash Redis 中去重 Key 的保存时间 (秒)
 * 默认 30 天 (30 * 24 * 3600 = 2592000 秒)
 */
export const DEDUPE_TTL_SECONDS = 2592000;
