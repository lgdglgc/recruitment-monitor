import { FilterConfig, JobItem } from './types';

/**
 * 判断单条招聘信息是否满足过滤条件
 * @param item 招聘信息
 * @param config 过滤规则配置
 */
export function isJobMatching(item: JobItem, config: FilterConfig): boolean {
  const contentToSearch = `${item.title} ${item.summary || ''}`.toLowerCase();

  // 1. 排除词 (黑名单) 检查：命中任意排除词则直接丢弃
  if (config.excludeKeywords && config.excludeKeywords.length > 0) {
    const hasExcludeKeyword = config.excludeKeywords.some((ex) => {
      const trimmed = ex.trim().toLowerCase();
      return trimmed && contentToSearch.includes(trimmed);
    });
    if (hasExcludeKeyword) {
      return false;
    }
  }

  const years = (config.years || []).map((y) => y.trim().toLowerCase()).filter(Boolean);
  const keywords = (config.keywords || []).map((k) => k.trim().toLowerCase()).filter(Boolean);

  // 2. 年份匹配检查
  const hasMatchingYear = years.some((year) => contentToSearch.includes(year));

  // 3. 核心关键词匹配检查
  const hasMatchingKeyword = keywords.some((kw) => contentToSearch.includes(kw));

  // 4. 模式判定
  if (config.mode === 'AND') {
    // 检查是否包含历史过期年份 (2018 - 2024)，防止历史文章被误抓
    const hasOutdatedYear = /(201[8-9]|202[0-4])/.test(contentToSearch);

    if (years.length > 0) {
      // 若显式包含关注年份且匹配关键词，直接通过
      if (hasMatchingYear && hasMatchingKeyword) {
        return true;
      }
      // 容错防漏报：如果标题未显式注明任何年份（且不属于过期年份），但强烈命中核心关键词，予以通过
      if (!hasOutdatedYear && hasMatchingKeyword) {
        return true;
      }
      return false;
    }
    return hasMatchingKeyword;
  } else {
    // OR 模式：满足年份或核心关键词中任意一个即可
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
