/**
 * 招聘信息意向匹配计算结果
 */
export interface JobMatchInfo {
  isMatched: boolean;           // 是否命中意向画像
  matchedRegions: string[];      // 命中地区 (如 ['邓州', '南阳'])
  matchedRoles: string[];        // 命中岗位角色 (如 ['主治医师', '医疗'])
  matchedNatures: string[];      // 命中性质 (如 ['事业编', '人才引进'])
  score: number;                // 匹配总分 (0 - 100)
  level: 'exact' | 'high' | 'partial' | 'none'; // exact: 地区+岗位+编制全中; high: 命中核心组合; partial: 部分命中
}

/**
 * 招聘信息单条数据结构
 */
export interface JobItem {
  id: string;          // 唯一标识 (通常为 URL 的 MD5 哈希或原文章 ID)
  title: string;       // 招聘标题
  link: string;        // 详情链接
  date?: string;       // 原始公告发布日期 (如 2026-09-10)
  crawledDate?: string;// 系统监控抓取并收录的日期 (如 2026-09-10)
  summary?: string;    // 内容摘要/简介
  sourceName: string;  // 数据来源名称
  matchInfo?: JobMatchInfo; // 意向偏好匹配详情
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
  enabled?: boolean; // 是否启用此数据源 (默认为 true)
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
 * 个人求职意向偏好画像 (如：主治医师 / 南阳邓州淅川西峡 / 医疗招聘 / 事业编制)
 */
export interface TargetPreference {
  enabled: boolean;          // 是否启用个性化意向画像过滤与高亮
  regions: string[];        // 意向地区 (如 ['南阳', '邓州', '淅川', '西峡'])
  roles: string[];          // 意向岗位/专业 (如 ['主治医师', '主治', '医师', '医生', '临床', '医疗', '卫生', '医院'])
  natures: string[];        // 意向性质 (如 ['事业编', '编制', '人才引进', '公开招聘', '招录', '急需紧缺', '绿色通道'])
}

/**
 * 过滤规则配置
 */
export interface FilterConfig {
  years: string[];            // 年份关键词 (如 ['2026', '2027'])
  keywords: string[];         // 核心关键词 (如 ['招聘', '主治', '医师', '医疗', '事业编'])
  excludeKeywords?: string[]; // 排除词黑名单 (如 ['体检', '公示', '拟录用', '递补', '培训'])
  mode: FilterMode;
  preferences?: TargetPreference; // 个人求职意向画像
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
