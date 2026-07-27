import { FilterConfig, JobItem } from './types';

/**
 * 判断单条招聘信息是否满足过滤条件
 * @param item 招聘信息
 * @param config 过滤规则配置
 */
export function isJobMatching(item: JobItem, config: FilterConfig): boolean {
  const contentToSearch = `${item.title} ${item.summary || ''}`.toLowerCase();

  const years = config.years.map((y) => y.toLowerCase());
  const keywords = config.keywords.map((k) => k.toLowerCase());

  // 1. 年份匹配检查
  const hasMatchingYear = years.some((year) => contentToSearch.includes(year));

  // 2. 核心关键词匹配检查
  const hasMatchingKeyword = keywords.some((kw) => contentToSearch.includes(kw));

  if (config.mode === 'AND') {
    // AND 模式：必须同时包含至少一个年份关键词 AND 至少一个核心关键词
    // 额外容错：如果未设置年份条件，则只需满足核心关键词
    if (years.length > 0) {
      return hasMatchingYear && hasMatchingKeyword;
    }
    return hasMatchingKeyword;
  } else {
    // OR 模式：满足年份 OR 核心关键词中任意一个即可
    return hasMatchingYear || hasMatchingKeyword;
  }
}

/**
 * 批量过滤招聘列表
 * @param items 原始招聘条目数组
 * @param config 过滤规则配置
 */
export function filterJobs(items: JobItem[], config: FilterConfig): JobItem[] {
  return items.filter((item) => isJobMatching(item, config));
}
