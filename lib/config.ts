import { FilterConfig, SourceConfig, TargetPreference } from './types';

/**
 * 专为【主治医师 · 南阳地区（邓州/淅川/西峡）· 医疗事业编】量身定制的意向偏好画像
 */
export const DEFAULT_TARGET_PREFERENCE: TargetPreference = {
  enabled: true,
  // 重点关注地区 (南阳市直及下辖邓州、淅川、西峡)
  regions: ['南阳', '邓州', '淅川', '西峡'],
  // 意向岗位与专业方向 (主治医师、临床医师、医学专业)
  roles: [
    '主治医师',
    '主治',
    '医师',
    '医生',
    '临床',
    '内科',
    '外科',
    '妇产',
    '儿科',
    '急诊',
    '全科',
    '医疗',
    '卫生',
    '卫健',
    '医院',
  ],
  // 意向招考与编制性质
  natures: [
    '编制',
    '事业编',
    '人才引进',
    '招才引智',
    '急需紧缺',
    '绿色通道',
    '高层次人才',
    '公开招聘',
    '招考',
    '招录',
  ],
};

/**
 * 医疗与事业单位招聘专用过滤规则配置
 */
export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  // 关注年份
  years: ['2026', '2027'],
  // 目标招聘关键词 (覆盖医疗、招考与事业单位编制)
  keywords: [
    '招聘',
    '公开招聘',
    '主治',
    '医师',
    '医生',
    '医疗',
    '卫生',
    '卫健',
    '医院',
    '事业编',
    '编制',
    '人才引进',
    '招才引智',
    '招考',
    '招录',
    '岗位',
  ],
  // 排除词黑名单 (命中任意词直接丢弃，避免体检、公示、真题培训等干扰)
  excludeKeywords: ['体检', '拟聘', '拟录用', '结果公示', '递补', '资格复审', '真题', '网校培训', '冲刺班'],
  // 匹配模式: AND (包含年份或未标年份但强烈命中医疗/招考关键词)
  mode: 'AND',
  // 个人求职画像
  preferences: DEFAULT_TARGET_PREFERENCE,
};

/**
 * 监控数据源清单 (针对南阳地区及邓州、淅川、西峡医疗招考)
 */
export const SOURCES_CONFIG: SourceConfig[] = [
  {
    id: 'nysrsksw-official',
    name: '南阳市人事考试网 (官方)',
    type: 'html',
    enabled: true,
    url: 'http://www.nysrsksw.cn/',
    selector: {
      container: 'ul li:has(a[title])',
      title: 'a',
      link: 'a',
      date: '.time',
    },
  },
  {
    id: 'rsks-nanyang',
    name: '南阳人事招考公告专栏 (知仕阁)',
    type: 'html',
    enabled: true,
    url: 'https://www.rsks.cn/henan/nanyang/',
    selector: {
      container: '.list-content .list-item',
      title: 'a.list-title',
      link: 'a.list-title',
      date: '.list-date',
    },
  },
  {
    id: 'dengzhou-rsks',
    name: '邓州市人民政府·招考聘用专栏',
    type: 'html',
    enabled: true,
    url: 'https://www.rsks.cn/henan/dengzhou/',
    selector: {
      container: '.list-content .list-item',
      title: 'a.list-title',
      link: 'a.list-title',
      date: '.list-date',
    },
  },
  {
    id: 'xichuan-rsks',
    name: '淅川县人民政府·人事招考专栏',
    type: 'html',
    enabled: true,
    url: 'https://www.rsks.cn/henan/xichuan/',
    selector: {
      container: '.list-content .list-item',
      title: 'a.list-title',
      link: 'a.list-title',
      date: '.list-date',
    },
  },
  {
    id: 'xixia-rsks',
    name: '西峡县人民政府·人事招考专栏',
    type: 'html',
    enabled: true,
    url: 'https://www.rsks.cn/henan/xixia/',
    selector: {
      container: '.list-content .list-item',
      title: 'a.list-title',
      link: 'a.list-title',
      date: '.list-date',
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
 * 适配国内政企网站网络握手，并在 Vercel Serverless 时限内保持安全
 */
export const REQUEST_TIMEOUT_MS = 8000;

/**
 * 抓取重试次数
 */
export const MAX_RETRIES = 1;

/**
 * Upstash Redis 中去重 Key 的保存时间 (秒)
 * 默认 30 天 (30 * 24 * 3600 = 2592000 秒)
 */
export const DEDUPE_TTL_SECONDS = 2592000;
