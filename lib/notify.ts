import { JobItem } from './types';

/**
 * Server酱 (ServerChan Turbo) 消息推送模块
 */

/**
 * 将匹配的招聘条目格式化为整洁的 Markdown Digest 消息
 */
export function formatMarkdownDigest(items: JobItem[]): { title: string; desp: string } {
  const count = items.length;
  const nowStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  const title = `🎯 找到 ${count} 条最新招聘信息通知 (${nowStr.slice(5, 16)})`;

  let desp = `### 📢 招聘监控最新提醒\n\n`;
  desp += `> 监测时间：${nowStr}\n`;
  desp += `> 本次共匹配到 **${count}** 条关键岗位信息：\n\n`;
  desp += `---\n\n`;

  items.forEach((item, index) => {
    desp += `#### ${index + 1}. [${item.title}](${item.link})\n`;
    desp += `- **来源**: \`${item.sourceName}\`\n`;
    if (item.date) {
      desp += `- **时间**: ${item.date}\n`;
    }
    if (item.summary) {
      // 限制摘要长度避免卡屏
      const cleanSummary = item.summary.replace(/\s+/g, ' ').slice(0, 120);
      desp += `- **摘要**: ${cleanSummary}...\n`;
    }
    desp += `\n[👉 点击查看详情](${item.link})\n\n`;
    desp += `---\n\n`;
  });

  desp += `*由 Recruitment Monitor 监控系统自动推送*`;

  return { title, desp };
}

/**
 * 发送 Server酱 微信推送
 * @param items 待推送的 JobItem 数组
 */
export async function sendServerChanNotification(items: JobItem[]): Promise<boolean> {
  const sendKey = process.env.SERVERCHAN_SENDKEY;

  if (!sendKey) {
    console.error('[Notification Error] 未配置 SERVERCHAN_SENDKEY 环境变量，跳过微信推送。');
    return false;
  }

  if (!items || items.length === 0) {
    console.log('[Notification] 没有新匹配的招聘条目，无需推送。');
    return true;
  }

  const { title, desp } = formatMarkdownDigest(items);
  const serverChanUrl = `https://sctapi.ftqq.com/${sendKey}.send`;

  try {
    const response = await fetch(serverChanUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: new URLSearchParams({
        title,
        desp,
      }),
    });

    const data = await response.json();

    if (data.code === 0 || data.errno === 0) {
      console.log(`[Server酱] 成功推送 ${items.length} 条招聘提醒！`);
      return true;
    } else {
      console.error('[Server酱 Error] 推送失败，返回响应:', data);
      return false;
    }
  } catch (error: any) {
    console.error('[Server酱 Exception] 发送请求异常:', error.message);
    return false;
  }
}
