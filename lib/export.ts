import { JobItem } from './types';

/**
 * 将招聘岗位列表导出为 Excel 兼容的 CSV 格式 (带 UTF-8 BOM，防止 Windows Excel/WPS 打开乱码)
 * @param jobs 待导出的岗位列表
 * @param filename 导出的文件名 (默认: 医疗招聘信息_YYYYMMDD.csv)
 */
export function exportJobsToCSV(jobs: JobItem[], filename?: string): void {
  if (!jobs || jobs.length === 0) {
    alert('暂无数据可供导出！');
    return;
  }

  // 1. 表头定义
  const headers = [
    '收录日期',
    '原发布日期',
    '意向匹配度',
    '命中地区',
    '命中岗位/专业',
    '命中编制性质',
    '数据来源',
    '招聘标题',
    '岗位详情链接',
  ];

  // 辅助转义 CSV 单元格 (处理双引号、逗号、换行)
  const escapeCell = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  // 2. 构造数据行
  const rows: string[] = [];
  rows.push(headers.map(escapeCell).join(','));

  for (const job of jobs) {
    const crawledDate = job.crawledDate || job.date || '';
    const originalDate = job.date || '';
    
    let matchLevel = '常规收录';
    let regions = '';
    let roles = '';
    let natures = '';

    if (job.matchInfo) {
      if (job.matchInfo.level === 'exact') matchLevel = '⭐ 极度匹配(地区+岗位+编制)';
      else if (job.matchInfo.level === 'high') matchLevel = '🔥 高度匹配';
      else if (job.matchInfo.level === 'partial') matchLevel = '📌 局部匹配';
      
      regions = (job.matchInfo.matchedRegions || []).join('; ');
      roles = (job.matchInfo.matchedRoles || []).join('; ');
      natures = (job.matchInfo.matchedNatures || []).join('; ');
    }

    const row = [
      escapeCell(crawledDate),
      escapeCell(originalDate),
      escapeCell(matchLevel),
      escapeCell(regions),
      escapeCell(roles),
      escapeCell(natures),
      escapeCell(job.sourceName || ''),
      escapeCell(job.title || ''),
      escapeCell(job.link || ''),
    ];
    rows.push(row.join(','));
  }

  // 3. 添加 UTF-8 BOM (\uFEFF)
  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  // 4. 触发下载
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const targetFilename = filename || `南阳医疗招聘监控_${dateStr}.csv`;

  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', targetFilename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 生成排版优美的 Markdown 招聘简报文本 (方便复制到微信、飞书、文档等)
 */
export function generateMarkdownReport(jobs: JobItem[], title?: string): string {
  if (!jobs || jobs.length === 0) {
    return '今日暂无新增招聘信息。';
  }

  const dateStr = new Date().toLocaleDateString('zh-CN');
  const docTitle = title || `🩺 南阳医疗招聘与事业编制监控简报 (${dateStr})`;

  const exactMatches = jobs.filter((j) => j.matchInfo?.level === 'exact');
  const highMatches = jobs.filter((j) => j.matchInfo?.level === 'high');
  const otherJobs = jobs.filter((j) => !j.matchInfo || (j.matchInfo.level !== 'exact' && j.matchInfo.level !== 'high'));

  const lines: string[] = [];
  lines.push(`# ${docTitle}`);
  lines.push(`> 汇总时间：${new Date().toLocaleString('zh-CN')} | 共收录 ${jobs.length} 条岗位信息`);
  lines.push('');

  if (exactMatches.length > 0) {
    lines.push(`## ⭐⭐ 极度匹配岗位 (主治/医疗/编制重点推荐 · ${exactMatches.length}条)`);
    exactMatches.forEach((job, idx) => {
      const tags = [
        ...(job.matchInfo?.matchedRegions || []),
        ...(job.matchInfo?.matchedRoles || []),
        ...(job.matchInfo?.matchedNatures || []),
      ].join(' · ');
      lines.push(`${idx + 1}. **[${job.title}](${job.link})**`);
      lines.push(`   - 来源：${job.sourceName} | 收录：${job.crawledDate || job.date || '-'}`);
      if (tags) lines.push(`   - 🎯 意向标签：\`${tags}\``);
    });
    lines.push('');
  }

  if (highMatches.length > 0) {
    lines.push(`## 🔥 高度匹配岗位 (南阳及周边医疗招录 · ${highMatches.length}条)`);
    highMatches.forEach((job, idx) => {
      const tags = [
        ...(job.matchInfo?.matchedRegions || []),
        ...(job.matchInfo?.matchedRoles || []),
        ...(job.matchInfo?.matchedNatures || []),
      ].join(' · ');
      lines.push(`${idx + 1}. [${job.title}](${job.link})`);
      lines.push(`   - 来源：${job.sourceName} | 标签：\`${tags}\``);
    });
    lines.push('');
  }

  if (otherJobs.length > 0) {
    lines.push(`## 📋 其他综合招考信息 (${otherJobs.length}条)`);
    otherJobs.slice(0, 15).forEach((job, idx) => {
      lines.push(`${idx + 1}. [${job.title}](${job.link}) (${job.sourceName})`);
    });
    if (otherJobs.length > 15) {
      lines.push(`   *...及其他 ${otherJobs.length - 15} 条公告，详见网页端查看。*`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('*由「招聘监控推送系统」自动化整理生成*');

  return lines.join('\n');
}

/**
 * 复制文本到剪贴板工具
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      textArea.remove();
      return successful;
    }
  } catch (err) {
    console.error('复制到剪贴板失败:', err);
    return false;
  }
}
