import { FilterConfig, JobItem, JobMatchInfo, TargetPreference } from './types';

/**
 * 计算单条招聘信息与个人求职意向画像的匹配度
 * @param item 招聘条目
 * @param pref 意向偏好配置
 */
export function evaluateJobPreference(item: JobItem, pref?: TargetPreference): JobMatchInfo {
  if (!pref || !pref.enabled) {
    return {
      isMatched: false,
      matchedRegions: [],
      matchedRoles: [],
      matchedNatures: [],
      score: 0,
      level: 'none',
    };
  }

  const text = `${item.title} ${item.summary || ''} ${item.sourceName || ''}`.toLowerCase();

  const matchedRegions = (pref.regions || []).filter((r) => {
    const reg = r.trim().toLowerCase();
    return reg && text.includes(reg);
  });

  const matchedRoles = (pref.roles || []).filter((r) => {
    const role = r.trim().toLowerCase();
    return role && text.includes(role);
  });

  const matchedNatures = (pref.natures || []).filter((n) => {
    const nature = n.trim().toLowerCase();
    return nature && text.includes(nature);
  });

  const hasRegion = matchedRegions.length > 0;
  const hasRole = matchedRoles.length > 0;
  const hasNature = matchedNatures.length > 0;

  // 特殊加分项：标题中直接命中“主治医师”或“主治”
  const hasDoctorTitle = text.includes('主治医师') || text.includes('主治');

  let score = 0;
  let level: JobMatchInfo['level'] = 'none';

  if (hasRegion && hasRole && hasNature) {
    // 地区 + 医疗/医师 + 编制 三者全中：黄金顶配！
    score = 95 + (hasDoctorTitle ? 5 : 0);
    level = 'exact';
  } else if (hasRegion && (hasRole || hasNature)) {
    // 地区 + 岗位 或 地区 + 编制
    score = 80 + (hasDoctorTitle ? 10 : 0);
    level = 'high';
  } else if (hasRole && hasNature) {
    // 医疗岗位 + 事业编 (可能属于南阳下辖但未显式写区县名，如南阳市直医院)
    score = 75 + (hasDoctorTitle ? 10 : 0);
    level = 'high';
  } else if (hasDoctorTitle || hasRole || hasRegion) {
    // 仅命中主治医师或医疗或地区
    score = hasDoctorTitle ? 70 : 50;
    level = 'partial';
  }

  const isMatched = score >= 70;

  return {
    isMatched,
    matchedRegions,
    matchedRoles,
    matchedNatures,
    score,
    level,
  };
}

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
 * 批量过滤招聘列表并附加意向匹配信息
 * @param items 原始招聘条目数组
 * @param config 过滤规则配置
 */
export function filterJobs(items: JobItem[], config: FilterConfig): JobItem[] {
  return items
    .filter((item) => isJobMatching(item, config))
    .map((item) => ({
      ...item,
      matchInfo: evaluateJobPreference(item, config.preferences),
    }));
}

